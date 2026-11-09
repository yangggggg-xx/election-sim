"""Replay the existing GLM event inputs with sourced pre-election events."""
import json

from monte_carlo_offline import DATA_DIR, OUTPUT_DIR, generate_agents, process_event, fade_step, compute_predictions

CUTOFF = "2026-11-02"
EVENTS = [
    {
        "date": "2026-09-02",
        "title": "签署拨款法案，避免选前联邦政府停摆",
        "source": "https://www.investing.com/news/economy-news/trump-signs-bill-to-avert-government-shutdown-before-midterm-elections-4886940",
        "assumption": "假设停摆风险降低小幅改善共和党和独立选民的态度。",
        "impact": {"rep_positive": 0.02, "ind_positive": 0.01},
    },
    {
        "date": "2026-10-14",
        "title": "美国公布 9 月 CPI，环比上涨 0.6%",
        "source": "https://www.bls.gov/news.release/archives/cpi_10142026.htm",
        "assumption": "假设物价压力削弱共和党支持者和独立选民的态度，并小幅提升民主党支持者的态度。",
        "impact": {"rep_positive": -0.04, "dem_positive": 0.02, "ind_positive": -0.05},
    },
    {
        "date": "2026-10-02",
        "title": "美国劳工统计局发布 9 月就业报告",
        "source": "https://www.bls.gov/news.release/archives/empsit_10022026.htm",
        "assumption": "只收录数据发布节点，情景中不加入方向性冲击。",
        "impact": {},
    },
    {
        "date": "2026-10-15",
        "title": "美国公布 9 月 PPI，最终需求价格环比上涨 1.3%",
        "source": "https://www.bls.gov/news.release/archives/ppi_10152026.htm",
        "assumption": "假设生产端价格压力对执政党态度有小幅负向影响。考虑与 CPI 的重叠，赋予较小权重。",
        "impact": {"rep_positive": -0.01, "ind_positive": -0.01},
    },
    {
        "date": "2026-10-28",
        "title": "美联储维持联邦基金利率目标区间在 3.75% 至 4%",
        "source": "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm",
        "assumption": "利率维持不变，情景中不加入方向性冲击。",
        "impact": {},
    },
    {
        "date": "2026-10-29",
        "title": "美国公布第三季度实际 GDP 初值，年化增长 3.4%",
        "source": "https://www.bea.gov/news/2026/gdp-advance-estimate-3rd-quarter-2026",
        "assumption": "假设经济增长加快小幅改善共和党和独立选民的态度。",
        "impact": {"rep_positive": 0.02, "ind_positive": 0.02},
    },
]


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    states = load(DATA_DIR / "us_states.json")
    election = {row["state"]: row for row in load(DATA_DIR / "election_2020.json")}
    original = load(OUTPUT_DIR / "election_2026_glm.json")["events"]
    baseline = [event for event in original if event["date"] <= CUTOFF]

    def replay(events):
        agents = generate_agents(states, election)
        for event in sorted(events, key=lambda row: row["date"]):
            if event.get("impact"):
                process_event(agents, event["impact"])
                fade_step(agents)
                fade_step(agents)
        rep, dem, predictions = compute_predictions(agents, states, election)
        return {"rep": rep, "dem": dem, "states": predictions}

    assert all(event["date"] <= CUTOFF for event in EVENTS)
    result = {
        "cutoff": CUTOFF,
        "baselineEventCount": len(baseline),
        "events": sorted(EVENTS, key=lambda event: event["date"]),
        "baseline": replay(baseline),
        "updated": replay(baseline + EVENTS),
    }
    assert all(run["rep"] + run["dem"] == 538 for run in (result["baseline"], result["updated"]))
    (OUTPUT_DIR / "election_2026_backtest.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
