"""
Offline Monte Carlo Uncertainty Analysis — No API calls needed.
Reads existing GLM results and runs 200 perturbed simulations.

Usage:
  python scripts/monte_carlo_offline.py
"""

import json
import math
import random
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "backend" / "data"
OUTPUT_DIR = BASE_DIR / "frontend" / "src" / "data"

# ─── Simulation Constants ────────────────────────────────

SWING_FACTOR = 0.20
INITIAL_REP_POS = 0.75
INITIAL_DEM_POS = 0.75
INITIAL_IND_POS = 0.45
EMOTION_ATTITUDE_COUPLING = 0.15
CHAR_WEIGHTS = {"susceptible": 1.5, "ordinary": 1.0, "calm": 0.5}
WAVE_TAU = 2.5

IMPACT_KEYS = [
    "rep_happy", "rep_sad", "rep_angry", "rep_positive",
    "dem_happy", "dem_sad", "dem_angry", "dem_positive",
    "ind_happy", "ind_sad", "ind_angry", "ind_positive",
]

# ─── Embedded Simulation Engine ─────────────────────────

class Agent:
    __slots__ = ("state_abbr", "party", "population", "character", "emotions", "attitudes")
    def __init__(self, state_abbr, party, population, character, initial_positive):
        self.state_abbr = state_abbr
        self.party = party
        self.population = population
        self.character = character
        self.emotions = {"happy": 0.1, "sad": 0.05, "angry": 0.05}
        self.attitudes = {"positive": initial_positive, "negative": 1.0 - initial_positive}

def generate_agents(us_states, election_2020):
    agents = []
    for state in us_states:
        abbr = state["abbr"]
        pop = state["population"]
        rep_pct = state["repPct"]
        dem_pct = state["demPct"]
        ind_pct = max(1 - rep_pct - dem_pct, 0.05)
        e2020 = election_2020.get(abbr, {})
        baseline = 1.0 if e2020.get("winner") == "rep" else -1.0
        rep_char = "calm" if rep_pct > 0.55 else "ordinary"
        dem_char = "calm" if dem_pct > 0.55 else "ordinary"
        if abs(rep_pct - 0.5) < 0.05:
            ind_char = "susceptible"
        elif abs(rep_pct - 0.5) < 0.15:
            ind_char = "ordinary"
        else:
            ind_char = "calm"
        rep_pos = 0.65 + 0.15 * (1 if baseline > 0 else 0)
        dem_pos = 0.65 + 0.15 * (1 if baseline < 0 else 0)
        ind_pos = 0.45 + 0.1 * baseline
        agents.append(Agent(abbr, "rep", int(pop * rep_pct), rep_char, rep_pos))
        agents.append(Agent(abbr, "dem", int(pop * dem_pct), dem_char, dem_pos))
        agents.append(Agent(abbr, "ind", int(pop * ind_pct), ind_char, ind_pos))
    return agents

def process_event(agents, impact, fading=0.1, forgetting=0.05, pop_weight=1.0, char_enabled=True):
    for agent in agents:
        prefix = agent.party
        emo_impact = {
            "happy": impact.get(f"{prefix}_happy", 0),
            "sad":   impact.get(f"{prefix}_sad", 0),
            "angry": impact.get(f"{prefix}_angry", 0),
        }
        pos_shift = impact.get(f"{prefix}_positive", 0)
        cw = CHAR_WEIGHTS.get(agent.character, 1.0) if char_enabled else 1.0
        for emo_key in ("happy", "sad", "angry"):
            old = agent.emotions[emo_key]
            new = old * (1 - fading) + emo_impact[emo_key] * cw * pop_weight
            agent.emotions[emo_key] = round(max(0.0, min(1.0, new)), 4)
        emo_comp = (agent.emotions["happy"] - agent.emotions["angry"]) * EMOTION_ATTITUDE_COUPLING * cw
        direct = pos_shift * cw * pop_weight
        new_pos = agent.attitudes["positive"] * (1 - forgetting) + emo_comp + direct
        new_pos = round(max(0.01, min(0.99, new_pos)), 4)
        agent.attitudes = {"positive": new_pos, "negative": round(1.0 - new_pos, 4)}

def fade_step(agents, fading=0.1, forgetting=0.05):
    for agent in agents:
        for emo_key in ("happy", "sad", "angry"):
            agent.emotions[emo_key] = round(agent.emotions[emo_key] * (1 - fading), 4)
        pos = agent.attitudes["positive"]
        new_pos = pos * (1 - forgetting) + 0.5 * forgetting
        agent.attitudes = {"positive": round(new_pos, 4), "negative": round(1.0 - new_pos, 4)}

def compute_predictions(agents, us_states, election_2020):
    state_results = {}
    rep_ev = 0
    dem_ev = 0
    for state in us_states:
        abbr = state["abbr"]
        ev = state["electoralVotes"]
        e2020 = election_2020.get(abbr, {})
        total = e2020.get("repVotes", 0) + e2020.get("demVotes", 1)
        margin_2020 = (e2020.get("repVotes", 0) - e2020.get("demVotes", 0)) / total
        state_agents = [a for a in agents if a.state_abbr == abbr]
        rep_agents = [a for a in state_agents if a.party == "rep"]
        dem_agents = [a for a in state_agents if a.party == "dem"]
        ind_agents = [a for a in state_agents if a.party == "ind"]
        rep_ent = (sum(a.attitudes["positive"] for a in rep_agents) / len(rep_agents) - INITIAL_REP_POS) if rep_agents else 0
        dem_ent = (sum(a.attitudes["positive"] for a in dem_agents) / len(dem_agents) - INITIAL_DEM_POS) if dem_agents else 0
        ind_att = (sum(a.attitudes["positive"] for a in ind_agents) / len(ind_agents) - INITIAL_IND_POS) if ind_agents else 0
        enthusiasm_gap = (rep_ent - dem_ent) * SWING_FACTOR
        ind_swing = ind_att * SWING_FACTOR * 0.5
        total_swing = enthusiasm_gap + ind_swing
        predicted_margin = margin_2020 + total_swing
        winner = "rep" if predicted_margin > 0 else "dem"
        confidence = min(abs(predicted_margin), 0.5)
        state_results[abbr] = {"winner": winner, "confidence": round(confidence, 3), "ev": ev}
        if winner == "rep":
            rep_ev += ev
        else:
            dem_ev += ev
    return rep_ev, dem_ev, state_results

def generate_emotion_wave(event_id, event_title, peak_impact):
    baseline = {
        "rep_happy": 0.05, "rep_sad": 0.05, "rep_angry": 0.08,
        "dem_happy": 0.05, "dem_sad": 0.05, "dem_angry": 0.08,
        "ind_happy": 0.05, "ind_sad": 0.05, "ind_angry": 0.08,
        "rep_positive": 0, "dem_positive": 0, "ind_positive": 0,
    }
    timeline = []
    for day in range(-2, 8):
        entry = {"day_offset": day}
        for key, peak_val in peak_impact.items():
            base = baseline.get(key, 0)
            if day < 0:
                val = base
            elif day == 0:
                val = peak_val
            else:
                val = base + (peak_val - base) * math.exp(-day / WAVE_TAU)
            if "positive" in key:
                val = max(-0.30, min(0.30, val))
            else:
                val = max(0.0, min(1.0, val))
            entry[key] = round(val, 3)
        timeline.append(entry)
    return {"event_id": event_id, "title": event_title, "timeline": timeline}


# ─── Main ───────────────────────────────────────────────

def main():
    # Load existing GLM results
    glm_path = OUTPUT_DIR / "election_2026_glm.json"
    if not glm_path.exists():
        print("ERROR: election_2026_glm.json not found. Run the GLM simulation first.")
        return

    glm_data = json.loads(glm_path.read_text(encoding="utf-8"))
    events_data = glm_data.get("events", [])

    print("=" * 60)
    print("🎲 Offline Monte Carlo Uncertainty Analysis")
    print(f"  Source: {glm_data.get('provider_name', 'GLM-5.1')}")
    print(f"  Events: {len(events_data)}")
    print("=" * 60)

    # Load backend data
    us_states = json.loads((DATA_DIR / "us_states.json").read_text(encoding="utf-8"))
    election_2020_raw = json.loads((DATA_DIR / "election_2020.json").read_text(encoding="utf-8"))
    election_2020 = {e["state"]: e for e in election_2020_raw}

    # Run baseline (no noise) first
    agents = generate_agents(us_states, election_2020)
    for ev in events_data:
        impact = ev.get("impact", {})
        if impact:
            process_event(agents, impact)
            fade_step(agents)
            fade_step(agents)
    rep_ev_base, dem_ev_base, state_results_base = compute_predictions(agents, us_states, election_2020)
    winner_base = "Republican" if rep_ev_base >= 270 else "Democrat"
    print(f"\n  Baseline: R {rep_ev_base} vs D {dem_ev_base} -> {winner_base}")

    # Monte Carlo
    N_SIM = 200
    NOISE_SCALE = 0.15  # ±15% noise — reflects LLM uncertainty in emotion values
    POS_NOISE_SCALE = 0.08  # ±8% for attitude shifts (larger because these drive outcomes)

    random.seed(42)
    rep_evs = []
    dem_evs = []
    state_result_list = []

    print(f"\n  Running {N_SIM} Monte Carlo simulations (noise=±{NOISE_SCALE*100:.0f}%)...")
    for sim_idx in range(N_SIM):
        agents = generate_agents(us_states, election_2020)
        for ev in events_data:
            impact = ev.get("impact", {})
            if not impact:
                continue
            # Perturb each value
            perturbed = {}
            for k in IMPACT_KEYS:
                base_val = impact.get(k, 0)
                scale = POS_NOISE_SCALE if "positive" in k else NOISE_SCALE
                noise = random.gauss(0, scale)
                perturbed[k] = round(base_val + noise, 4)
                if "positive" in k:
                    perturbed[k] = max(-0.25, min(0.25, perturbed[k]))
                else:
                    perturbed[k] = max(0.0, min(0.55, perturbed[k]))
            process_event(agents, perturbed)
            fade_step(agents)
            fade_step(agents)

        rep_ev, dem_ev, state_results = compute_predictions(agents, us_states, election_2020)
        rep_evs.append(rep_ev)
        dem_evs.append(dem_ev)
        state_result_list.append({abbr: s["winner"] for abbr, s in state_results.items()})

        if (sim_idx + 1) % 50 == 0:
            print(f"    {sim_idx + 1}/{N_SIM} done...")

    # Statistics
    rep_evs.sort()
    dem_evs.sort()
    rep_wins = sum(1 for r in rep_evs if r >= 270)

    # Per-state win probability
    state_probs = {}
    all_abbrs = set()
    for sr in state_result_list:
        all_abbrs.update(sr.keys())
    for abbr in all_abbrs:
        rep_count = sum(1 for sr in state_result_list if sr.get(abbr) == "rep")
        state_probs[abbr] = {
            "rep_probability": round(rep_count / N_SIM, 3),
            "dem_probability": round(1 - rep_count / N_SIM, 3),
        }

    mc = {
        "n_simulations": N_SIM,
        "noise_scale": NOISE_SCALE,
        "rep_win_probability": round(rep_wins / N_SIM, 3),
        "dem_win_probability": round(1 - rep_wins / N_SIM, 3),
        "rep_ev_median": round(sorted(rep_evs)[N_SIM // 2]),
        "dem_ev_median": round(sorted(dem_evs)[N_SIM // 2]),
        "rep_ev_p5": rep_evs[max(0, int(N_SIM * 0.05))],
        "rep_ev_p95": rep_evs[min(N_SIM - 1, int(N_SIM * 0.95))],
        "dem_ev_p5": dem_evs[max(0, int(N_SIM * 0.05))],
        "dem_ev_p95": dem_evs[min(N_SIM - 1, int(N_SIM * 0.95))],
        "rep_ev_mean": round(sum(rep_evs) / N_SIM, 1),
        "dem_ev_mean": round(sum(dem_evs) / N_SIM, 1),
        "state_probabilities": state_probs,
    }

    # Print results
    print(f"\n  ┌─────────────────────────────────────────────────┐")
    print(f"  │  🎲 MONTE CARLO RESULTS ({N_SIM} runs)              │")
    print(f"  ├─────────────────────────────────────────────────┤")
    print(f"  │  R win probability:  {mc['rep_win_probability']*100:5.1f}%                     │")
    print(f"  │  D win probability:  {mc['dem_win_probability']*100:5.1f}%                     │")
    print(f"  │                                                  │")
    print(f"  │  R electoral votes:                              │")
    print(f"  │    Median: {mc['rep_ev_median']:3d}  Mean: {mc['rep_ev_mean']:5.1f}                  │")
    print(f"  │    90% CI: [{mc['rep_ev_p5']}, {mc['rep_ev_p95']}]                        │")
    print(f"  │  D electoral votes:                              │")
    print(f"  │    Median: {mc['dem_ev_median']:3d}  Mean: {mc['dem_ev_mean']:5.1f}                  │")
    print(f"  │    90% CI: [{mc['dem_ev_p5']}, {mc['dem_ev_p95']}]                        │")
    print(f"  └─────────────────────────────────────────────────┘")

    # Competitive states
    competitive = []
    for abbr, probs in state_probs.items():
        rp = probs["rep_probability"]
        if 0.15 < rp < 0.85:
            ev = state_results_base.get(abbr, {}).get("ev", 0)
            competitive.append((abbr, rp, ev))
    competitive.sort(key=lambda x: abs(x[1] - 0.5))

    if competitive:
        print(f"\n  Competitive states (flip probability > 15%):")
        for abbr, rp, ev in competitive[:12]:
            dp = 1 - rp
            bar_r = "█" * int(rp * 20)
            bar_d = "█" * int(dp * 20)
            print(f"    {abbr:3s} ({ev:2d}EV) R {rp*100:5.1f}% {bar_r}│{bar_d} {dp*100:5.1f}% D")

    # Save ensemble result
    ensemble_result = {
        "year": 2026,
        "type": "ensemble",
        "providers_used": [glm_data.get("provider", "glm")],
        "provider_names": {glm_data.get("provider", "glm"): glm_data.get("provider_name", "GLM-5.1")},
        "note": "Single-provider ensemble with Monte Carlo uncertainty (no cross-model comparison available)",
        "simulated": {
            "rep_electoral_votes": rep_ev_base,
            "dem_electoral_votes": dem_ev_base,
            "state_predictions": state_results_base,
        },
        "events": events_data,
        "emotion_waves": [
            generate_emotion_wave(ev["id"], ev["title"], ev.get("impact", {}))
            for ev in events_data
        ],
        "monte_carlo": mc,
    }
    ensemble_path = OUTPUT_DIR / "election_2026_ensemble.json"
    ensemble_path.write_text(json.dumps(ensemble_result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n  Saved: {ensemble_path.relative_to(BASE_DIR)}")
    print(f"\n  To show on frontend: copy frontend\\src\\data\\election_2026_ensemble.json frontend\\public\\")


if __name__ == "__main__":
    main()
