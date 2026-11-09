"""
2026 Midterm Election Simulation — Multi-LLM Comparison

Uses GLM / Qwen / GPT to generate voter emotion impact parameters
for real 2025-2026 events, then runs the rule engine to produce
state-by-state predictions.

Usage:
  1. Set API keys (any missing provider is skipped):
       set GLM_API_KEY=your-key
       set DASHSCOPE_API_KEY=your-key        # optional
       set OPENAI_API_KEY=your-key            # optional
  2. Install: pip install requests
  3. Run:     python scripts/simulate_2026.py
  4. Results: frontend/src/data/election_2026_*.json
"""

import json
import math
import os
import re
import sys
import time
from pathlib import Path
from typing import Optional

try:
    import requests
except ImportError:
    print("Missing 'requests'. Run: pip install requests")
    sys.exit(1)

# ─── Paths ──────────────────────────────────────────────

BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / "backend"
DATA_DIR = BACKEND_DIR / "data"
OUTPUT_DIR = BASE_DIR / "frontend" / "src" / "data"

# ─── LLM Provider Config ───────────────────────────────

LLM_PROVIDERS = {
    "glm": {
        "name": "GLM-5.1",
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "api_key_env": "GLM_API_KEY",
        "model": "glm-5.1",
    },
    "qwen": {
        "name": "Qwen-Plus",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "api_key_env": "DASHSCOPE_API_KEY",
        "model": "qwen-plus",
    },
    "gpt": {
        "name": "GPT-4o",
        "base_url": "https://api.openai.com/v1",
        "api_key_env": "OPENAI_API_KEY",
        "model": "gpt-4o",
    },
}

# ─── 2025-2026 Real Events (user-verified) ──────────────

EVENTS_2026 = [
    {
        "id": "evt-2026-1",
        "title": "Trump Second Inauguration and Executive Order Blitz",
        "date": "2025-01-20",
        "content": (
            "Donald Trump is inaugurated as the 47th President in extreme weather at the Capitol, with JD Vance as "
            "Vice President. On day one, he signs over 100 executive orders: declaring a national emergency at the "
            "southern border, withdrawing from the Paris Climate Agreement again, withdrawing from the WHO, pardoning "
            "January 6 defendants, freezing federal hiring, and ordering mass deportation operations. The sheer volume "
            "signals an aggressive 'second Trump era.' Markets and allied nations rapidly reassess policies. Domestic "
            "reactions are intensely polarized — supporters celebrate decisive action, opponents decry authoritarian overreach."
        ),
        "domain": "politics",
    },
    {
        "id": "evt-2026-2",
        "title": "Tariff War Escalation Shakes Global Economy",
        "date": "2025-04-02",
        "content": (
            "The Trump administration launches sweeping 'Liberation Day' tariffs — a baseline 10% on most imports "
            "with reciprocal tariffs as high as 34% on China, 25% on Canada and Mexico. China retaliates immediately. "
            "The S&P 500 drops sharply, consumer prices spike on electronics and automobiles, and small businesses "
            "dependent on cross-border supply chains face existential threats. Farm states suffer as China cancels "
            "agricultural orders. On April 9, most country tariffs are paused for 90 days, but China tariffs escalate "
            "to 145%. Protests erupt in manufacturing states and port cities over rising living costs and job losses."
        ),
        "domain": "economy",
    },
    {
        "id": "evt-2026-3",
        "title": "White House Shooting Incident",
        "date": "2025-05-15",
        "content": (
            "A shooting incident occurs near the White House perimeter. Secret Service agents intervene and shoot "
            "the suspect, who is killed. The incident triggers a nationwide debate about presidential security and "
            "the escalating climate of political violence. CNN and Fox News provide continuous coverage. Washington DC "
            "security is immediately upgraded. Social media erupts with conspiracy theories and partisan reactions. "
            "The event evokes memories of the 2024 Trump rally shooting and deepens national anxiety about safety."
        ),
        "domain": "security",
    },
    {
        "id": "evt-2026-4",
        "title": "Immigration Raids and Nationwide Protest Wave",
        "date": "2025-06-08",
        "content": (
            "Hardline immigration enforcement leads to large-scale ICE raids in Los Angeles, New York, and Chicago. "
            "Protests erupt across multiple cities. President Trump federalizes 2,000 California National Guard troops "
            "and deploys 700 Marines to Los Angeles over the explicit objections of Governor Newsom — the first time "
            "a president has done so without governor consent since 1965. Newsom sues the administration, calling it "
            "unconstitutional. The Posse Comitatus Act debate dominates headlines. A curfew is imposed on downtown LA. "
            "The event becomes one of the most severe domestic confrontations in modern American history."
        ),
        "domain": "security",
    },
    {
        "id": "evt-2026-5",
        "title": "Big Beautiful Bill Tax and Spending Package",
        "date": "2025-07-01",
        "content": (
            "The 'One Big Beautiful Bill Act' passes the Senate — a massive reconciliation package making permanent the "
            "2017 Trump tax cuts, eliminating taxes on tips and overtime, raising the SALT deduction cap, while slashing "
            "Medicaid and SNAP with new work requirements. Defense and border security receive major funding boosts. "
            "Clean energy tax credits from the Inflation Reduction Act are rolled back. The bill is estimated to add "
            "$3+ trillion to the national deficit over a decade. Democrats unanimously oppose it as a giveaway to the "
            "wealthy that strips healthcare from millions. Massive street protests erupt. Congressional debate is fierce."
        ),
        "domain": "politics",
    },
    {
        "id": "evt-2026-6",
        "title": "US-Iran Military Conflict Escalation",
        "date": "2025-10-20",
        "content": (
            "The Israel-Iran conflict explodes into direct military confrontation. Israel launches major strikes on "
            "Iranian military and nuclear-adjacent facilities. Iran retaliates with waves of ballistic missiles targeting "
            "Israeli cities. The US enters the conflict directly: B-2 stealth bombers strike Iran's Fordow, Natanz, "
            "and Isfahan nuclear sites. Oil prices surge past $90/barrel. The Strait of Hormuz is threatened. China "
            "and Russia condemn the strikes. Congress divides over war powers without authorization. Global markets "
            "plunge. 'Is this World War III?' dominates every news channel. Military deployments increase nationwide."
        ),
        "domain": "security",
    },
    {
        "id": "evt-2026-7",
        "title": "US-China Diplomatic Summit on Trade and Technology",
        "date": "2026-05-15",
        "content": (
            "A high-profile diplomatic summit takes place between the United States and China — the first such "
            "meeting in years. The summit covers trade reduction frameworks, AI governance cooperation, energy "
            "partnerships, and regional de-escalation. A framework agreement on tariff reduction is announced, "
            "alongside cooperation on AI safety standards. The stock market rallies on trade optimism. However, "
            "US media is deeply split: conservative outlets call it a diplomatic triumph, while liberal outlets "
            "criticize concessions on human rights and regional security. Political debate over 'detente or "
            "appeasement' dominates the midterm campaign."
        ),
        "domain": "politics",
    },
    {
        "id": "evt-2026-8",
        "title": "SpaceX Historic IPO and Musk Trillionaire Milestone",
        "date": "2026-06-01",
        "content": (
            "SpaceX goes public in the largest IPO in US financial history, raising approximately $75 billion. "
            "Market valuation surpasses $2 trillion on the first trading day. Elon Musk's net worth crosses $1 "
            "trillion, making him the first person in history to reach that milestone. Pension funds and index "
            "funds become passive holders. Wall Street celebrates, but the event triggers a massive public backlash: "
            "critics decry 'tech oligarchy' and the concentration of wealth. Left-wing politicians demand wealth "
            "taxes. The cultural divide between 'celebration of innovation' and 'rage at inequality' becomes "
            "a defining midterm election issue."
        ),
        "domain": "economy",
    },
    {
        "id": "evt-2026-9",
        "title": "US-Iran Ceasefire and Oil Market Reversal",
        "date": "2026-06-10",
        "content": (
            "After months of escalation, the US and Iran approach a ceasefire agreement. War risk drops suddenly. "
            "International oil prices swing wildly — from $90+ down toward $60. Global markets reverse sharply. "
            "Inflation expectations improve as energy costs fall. Investment markets reprice aggressively. Trump "
            "declares it a diplomatic victory, but critics question the cost of the preceding months of conflict. "
            "The rapid reversal creates whiplash for voters — relief mixed with anger over the disruption. "
            "The economic impact of the oil shock lingers in consumer prices and supply chain adjustments."
        ),
        "domain": "economy",
    },
]

# ─── Simulation Constants (from backend) ────────────────

SWING_FACTOR = 0.20
INITIAL_REP_POS = 0.75
INITIAL_DEM_POS = 0.75
INITIAL_IND_POS = 0.45
EMOTION_ATTITUDE_COUPLING = 0.15
CHAR_WEIGHTS = {"susceptible": 1.5, "ordinary": 1.0, "calm": 0.5}
EMOTION_BASELINE = {"happy": 0.05, "sad": 0.05, "angry": 0.08}
WAVE_TAU = 2.5

# ─── LLM API ────────────────────────────────────────────

def call_llm(provider_key: str, prompt: str) -> str:
    config = LLM_PROVIDERS[provider_key]
    api_key = os.environ.get(config["api_key_env"], "")
    if not api_key:
        return ""

    url = f"{config['base_url']}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": config["model"],
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a rigorous political analyst simulating voter emotions. "
                    "Always respond with ONLY a valid JSON object, no markdown, no explanation."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.7,
        "max_tokens": 4096,
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=90)
        print(f"    HTTP {resp.status_code}")
        if resp.status_code == 400:
            # Check for content filter — caller can retry with sanitized prompt
            body = resp.text[:500]
            if "1301" in body or "敏感" in body or "unsafe" in body.lower() or "content" in body.lower():
                print(f"    ⚠️  Content filter triggered — will retry with sanitized prompt")
                return "__CONTENT_FILTERED__"
            print(f"    Error body: {body}")
            return ""
        if resp.status_code != 200:
            print(f"    Error body: {resp.text[:300]}")
            return ""
        data = resp.json()
        if "choices" in data and len(data["choices"]) > 0:
            msg = data["choices"][0].get("message", {})
            content = msg.get("content", "") or ""
            reasoning = msg.get("reasoning_content", "") or ""
            if content.strip():
                return content
            if reasoning.strip():
                json_matches = list(re.finditer(r'\{[^{}]*"rep_happy"[^{}]*\}', reasoning, re.DOTALL))
                if json_matches:
                    return json_matches[-1].group()
                return reasoning
        print(f"    Unexpected response: {json.dumps(data, ensure_ascii=False)[:300]}")
        return ""
    except requests.exceptions.RequestException as e:
        print(f"    Request failed: {e}")
        return ""
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        print(f"    Response parse error: {e}")
        return ""

# ─── Prompt ─────────────────────────────────────────────

def build_impact_prompt(event: dict, sanitized: bool = False) -> str:
    event_title = event['title']
    event_content = event['content']
    if sanitized:
        # Strip specific names that may trigger content filters
        for name in ["Trump", "Xi Jinping", "Biden", "Harris", "Putin"]:
            event_title = event_title.replace(name, "the President")
            event_content = event_content.replace(name, "the President")
        event_content = event_content.replace("Beijing", "the host capital")

    return f"""You are simulating voter emotional reactions to a political event in the 2026 US midterm election cycle.

Political context:
- A Republican president is in office (second term)
- Congress is narrowly Republican-controlled
- The 2026 midterms will determine control of the House and Senate
- Key national issues: immigration, economy/tariffs, government spending, executive power, foreign wars

Event: {event_title}
Date: {event['date']}
Description: {event_content}

For each voter group, estimate their emotional reaction and attitude shift.

CRITICAL CALIBRATION — here are real examples from the 2024 election model:

Example 1: Rally Shooting Targeting Republican Candidate (Jul 2024)
  rep_happy: 0.30, rep_sad: 0.10, rep_angry: 0.50, rep_positive: +0.40
  dem_happy: 0.02, dem_sad: 0.30, dem_angry: 0.10, dem_positive: -0.10
  ind_happy: 0.05, ind_sad: 0.35, ind_angry: 0.30, ind_positive: +0.10
  → Republicans ANGRY and rallying (+0.40); Democrats SAD and demoralized (-0.10)

Example 2: Incumbent President Withdraws, Endorses Successor (Jul 2024)
  rep_happy: 0.15, rep_sad: 0.05, rep_angry: 0.10, rep_positive: +0.10
  dem_happy: 0.30, dem_sad: 0.20, dem_angry: 0.10, dem_positive: +0.20
  ind_happy: 0.15, ind_sad: 0.10, ind_angry: 0.05, ind_positive: +0.10
  → Democrats HAPPY and energized (+0.20); Republicans pleased but cautious

Example 3: Major Legislative Victory for the Governing Party (hypothetical)
  rep_happy: 0.35, rep_sad: 0.02, rep_angry: 0.05, rep_positive: +0.25
  dem_happy: 0.02, dem_sad: 0.30, dem_angry: 0.25, dem_positive: -0.15
  ind_happy: 0.05, ind_sad: 0.20, ind_angry: 0.15, ind_positive: -0.05
  → Republicans HAPPY and energized (+0.25); Democrats SAD + ANGRY but DEMORALIZED (-0.15)
  Pattern: CLEAR VICTORY → opposition demoralized

Example 4: Controversial Government Action Sparking Mass Protests (hypothetical)
  rep_happy: 0.20, rep_sad: 0.05, rep_angry: 0.10, rep_positive: +0.15
  dem_happy: 0.02, dem_sad: 0.15, dem_angry: 0.35, dem_positive: +0.10
  ind_happy: 0.03, ind_sad: 0.20, ind_angry: 0.25, ind_positive: -0.05
  → Republicans pleased (+0.15); Democrats ANGRY and ENERGIZED to resist (+0.10)
  Pattern: CONTROVERSIAL ACTION → opposition energized (but less than governing party)

RULES — follow strictly:
1. Emotion values: typically 0.05–0.45. Above 0.40 ONLY for the most extreme events (assassination, war). NEVER above 0.55.
2. "positive" = attitude shift toward supporting THEIR OWN party. Positive = energized/motivated. Negative = demoralized/discouraged.
3. KEY DISTINCTION — two very different patterns:
   a) CLEAR VICTORY for Party A (election win, legislation passed, ceasefire claimed as win):
      Party A → positive (+0.15 to +0.25), Party B → negative (-0.05 to -0.15, demoralized)
   b) CONTROVERSIAL ACTION by Party A (raids, tariffs, military strikes, policies sparking protests):
      Party A → positive (+0.10 to +0.20), Party B → ALSO positive (+0.05 to +0.15, energized to resist)
      When a government action sparks major protests and backlash, the opposition is ENERGIZED, not demoralized.
4. BALANCE: Both parties should NOT both be strongly positive on the SAME event (+0.20 each is the max for a controversial action). On clear victories, the losing party should be slightly negative.
5. MIDTERM EFFECT: The party in power typically loses some motivation over time. The opposition gains from grievance accumulation. But this is gradual — individual events should not always push the same direction.
6. Keep values proportional to severity: routine events 0.05–0.15, significant events 0.15–0.30, extreme events 0.30–0.45.
7. The "positive" field for each group should typically stay within -0.15 to +0.20 for most events. Only truly extraordinary events (assassination attempt) warrant values beyond this range.

Now rate the event below. Respond with ONLY this JSON (no other text, no markdown):
{{"rep_happy":0,"rep_sad":0,"rep_angry":0,"rep_positive":0,"dem_happy":0,"dem_sad":0,"dem_angry":0,"dem_positive":0,"ind_happy":0,"ind_sad":0,"ind_angry":0,"ind_positive":0}}"""

# ─── Response Parser ────────────────────────────────────

def parse_impact_response(text: str) -> Optional[dict]:
    if not text:
        return None
    text = re.sub(r"```json\s*|```\s*", "", text)
    json_match = re.search(r"\{[^{}]+\}", text)
    if not json_match:
        print("    No JSON found in response")
        return None
    try:
        data = json.loads(json_match.group())
    except json.JSONDecodeError as e:
        print(f"    JSON parse error: {e}")
        return None
    required = [
        "rep_happy", "rep_sad", "rep_angry", "rep_positive",
        "dem_happy", "dem_sad", "dem_angry", "dem_positive",
        "ind_happy", "ind_sad", "ind_angry", "ind_positive",
    ]
    for key in required:
        if key not in data:
            print(f"    Missing field: {key}")
            return None
        val = float(data[key])
        if "positive" in key:
            data[key] = round(max(-0.25, min(0.25, val)), 2)
        else:
            data[key] = round(max(0.0, min(0.55, val)), 2)
            if val > 0.45:
                print(f"    ⚠️  {key}={val:.2f} — capped to 0.45 (extreme events only)")
                data[key] = min(data[key], 0.45)

    # Balance check: both parties strongly positive is OK for controversial events,
    # but cap the smaller one to be strictly less than the larger (opposition energized < governing party)
    rep_pos = data["rep_positive"]
    dem_pos = data["dem_positive"]
    if rep_pos > 0.15 and dem_pos > 0.15:
        # Both strongly positive — ensure one is clearly smaller (controversial action pattern)
        if rep_pos > dem_pos:
            data["dem_positive"] = round(min(dem_pos, rep_pos * 0.6), 2)
            print(f"    ⚖️  Balance: dem_positive {dem_pos:+.2f} → {data['dem_positive']:+.2f}")
        elif dem_pos > rep_pos:
            data["rep_positive"] = round(min(rep_pos, dem_pos * 0.6), 2)
            print(f"    ⚖️  Balance: rep_positive {rep_pos:+.2f} → {data['rep_positive']:+.2f}")

    return data

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

# ─── Emotion Wave Generator ────────────────────────────

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

# ─── Ensemble & Monte Carlo ────────────────────────────

IMPACT_KEYS = [
    "rep_happy", "rep_sad", "rep_angry", "rep_positive",
    "dem_happy", "dem_sad", "dem_angry", "dem_positive",
    "ind_happy", "ind_sad", "ind_angry", "ind_positive",
]


def compute_ensemble_impacts(results: dict) -> list:
    """Compute median impact across all providers for each event.

    Returns list of (event_dict, median_impact_dict) pairs.
    """
    # Gather impacts per event across providers
    event_impacts_by_id: dict = {}  # event_id -> {key: [values from each provider]}
    event_meta_by_id: dict = {}     # event_id -> event dict

    for provider_key, result in results.items():
        for ev in result.get("events", []):
            eid = ev["id"]
            if eid not in event_impacts_by_id:
                event_impacts_by_id[eid] = {k: [] for k in IMPACT_KEYS}
                event_meta_by_id[eid] = {
                    "id": ev["id"], "title": ev["title"],
                    "date": ev["date"], "content": ev["content"],
                    "domain": ev["domain"],
                }
            impact = ev.get("impact", {})
            for k in IMPACT_KEYS:
                if k in impact:
                    event_impacts_by_id[eid][k].append(float(impact[k]))

    # Compute median for each field
    ensemble = []
    for eid in event_impacts_by_id:
        median_impact = {}
        for k in IMPACT_KEYS:
            vals = event_impacts_by_id[eid][k]
            if vals:
                sorted_vals = sorted(vals)
                n = len(sorted_vals)
                if n % 2 == 1:
                    median_impact[k] = round(sorted_vals[n // 2], 3)
                else:
                    median_impact[k] = round((sorted_vals[n // 2 - 1] + sorted_vals[n // 2]) / 2, 3)
            else:
                median_impact[k] = 0.0

        # Compute cross-provider disagreement (std dev) for Monte Carlo noise scaling
        disagreement = {}
        for k in IMPACT_KEYS:
            vals = event_impacts_by_id[eid][k]
            if len(vals) >= 2:
                mean = sum(vals) / len(vals)
                std = (sum((v - mean) ** 2 for v in vals) / len(vals)) ** 0.5
                disagreement[k] = round(std, 4)
            else:
                disagreement[k] = 0.03  # default noise for single-provider

        median_impact["_disagreement"] = disagreement
        ensemble.append((event_meta_by_id[eid], median_impact))

    return ensemble


def run_monte_carlo(ensemble_impacts, us_states, election_2020, n_sim=200, base_noise=0.02):
    """Run Monte Carlo simulation with perturbed impacts.

    For each run, add Gaussian noise proportional to:
      - base_noise (minimum uncertainty)
      - cross-provider disagreement (if LLMs disagree, more uncertainty)

    Returns dict with statistics: median, p5, p95, win_probability, etc.
    """
    import random
    random.seed(42)

    rep_evs = []
    dem_evs = []
    state_result_list = []  # list of {abbr: winner} per run

    for sim_idx in range(n_sim):
        agents = generate_agents(us_states, election_2020)

        for event, impact in ensemble_impacts:
            # Perturb impact values
            disagreement = impact.get("_disagreement", {})
            perturbed = {}
            for k in IMPACT_KEYS:
                base_val = impact[k]
                # Noise scale = max(base_noise, disagreement for this field)
                noise_scale = max(base_noise, disagreement.get(k, base_noise))
                noise = random.gauss(0, noise_scale)
                perturbed[k] = round(base_val + noise, 4)
                # Clamp
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

    # Compute statistics
    rep_evs.sort()
    dem_evs.sort()

    rep_wins = sum(1 for r in rep_evs if r >= 270)
    dem_wins = n_sim - rep_wins

    # Per-state win probability
    state_probs = {}
    all_abbrs = set()
    for sr in state_result_list:
        all_abbrs.update(sr.keys())
    for abbr in all_abbrs:
        rep_count = sum(1 for sr in state_result_list if sr.get(abbr) == "rep")
        state_probs[abbr] = {
            "rep_probability": round(rep_count / n_sim, 3),
            "dem_probability": round(1 - rep_count / n_sim, 3),
        }

    return {
        "n_simulations": n_sim,
        "rep_win_probability": round(rep_wins / n_sim, 3),
        "dem_win_probability": round(dem_wins / n_sim, 3),
        "rep_ev_median": round(sorted(rep_evs)[n_sim // 2]),
        "dem_ev_median": round(sorted(dem_evs)[n_sim // 2]),
        "rep_ev_p5": rep_evs[max(0, int(n_sim * 0.05))],
        "rep_ev_p95": rep_evs[min(n_sim - 1, int(n_sim * 0.95))],
        "dem_ev_p5": dem_evs[max(0, int(n_sim * 0.05))],
        "dem_ev_p95": dem_evs[min(n_sim - 1, int(n_sim * 0.95))],
        "rep_ev_mean": round(sum(rep_evs) / n_sim, 1),
        "dem_ev_mean": round(sum(dem_evs) / n_sim, 1),
        "state_probabilities": state_probs,
    }


# ─── Main ───────────────────────────────────────────────

def main():
    print("=" * 60)
    print("2026 Midterm Simulation — Multi-LLM Comparison")
    print(f"  Events: {len(EVENTS_2026)} (2025-2026 real events)")
    print("=" * 60)

    us_states = json.loads((DATA_DIR / "us_states.json").read_text(encoding="utf-8"))
    election_2020_raw = json.loads((DATA_DIR / "election_2020.json").read_text(encoding="utf-8"))
    election_2020 = {e["state"]: e for e in election_2020_raw}

    available = {}
    for key, config in LLM_PROVIDERS.items():
        api_key = os.environ.get(config["api_key_env"], "")
        if api_key:
            available[key] = config
            print(f"  OK {config['name']}: key found")
        else:
            print(f"  -- {config['name']}: no key ({config['api_key_env']}), skipping")

    if not available:
        print("\nNo API keys. Set at least one: set GLM_API_KEY=your-key")
        sys.exit(1)

    results = {}

    for provider_key, provider_config in available.items():
        print(f"\n{'=' * 55}")
        print(f"Simulating with {provider_config['name']}")
        print(f"{'=' * 55}")

        agents = generate_agents(us_states, election_2020)
        event_impacts = []

        for i, event in enumerate(EVENTS_2026):
            print(f"\n  [{i+1}/{len(EVENTS_2026)}] {event['title']}")

            prompt = build_impact_prompt(event)
            response = call_llm(provider_key, prompt)

            # Retry with sanitized prompt if content filter triggered
            if response == "__CONTENT_FILTERED__":
                print("    🔄 Retrying with sanitized prompt...")
                prompt = build_impact_prompt(event, sanitized=True)
                response = call_llm(provider_key, prompt)

            if response == "__CONTENT_FILTERED__":
                print("    ❌ Content filter still triggered after sanitization, SKIP")
                continue

            impact = parse_impact_response(response)
            if impact is None:
                print("    SKIP — could not parse response")
                continue

            print(f"    R: happy={impact['rep_happy']:.2f} sad={impact['rep_sad']:.2f} "
                  f"angry={impact['rep_angry']:.2f} pos={impact['rep_positive']:+.2f}")
            print(f"    D: happy={impact['dem_happy']:.2f} sad={impact['dem_sad']:.2f} "
                  f"angry={impact['dem_angry']:.2f} pos={impact['dem_positive']:+.2f}")
            print(f"    I: happy={impact['ind_happy']:.2f} sad={impact['ind_sad']:.2f} "
                  f"angry={impact['ind_angry']:.2f} pos={impact['ind_positive']:+.2f}")

            event_impacts.append((event, impact))
            process_event(agents, impact)
            fade_step(agents)
            fade_step(agents)
            time.sleep(1)

        if not event_impacts:
            print(f"\n  No events processed for {provider_config['name']}")
            continue

        rep_ev, dem_ev, state_results = compute_predictions(agents, us_states, election_2020)
        winner = "Republican" if rep_ev >= 270 else "Democrat"
        print(f"\n  RESULT: R {rep_ev} vs D {dem_ev} -> {winner} wins")

        emotion_waves = []
        for event, impact in event_impacts:
            wave = generate_emotion_wave(event["id"], event["title"], impact)
            emotion_waves.append(wave)

        result = {
            "year": 2026,
            "provider": provider_key,
            "provider_name": provider_config["name"],
            "rep_candidate": "Republican",
            "dem_candidate": "Democrat",
            "simulated": {
                "rep_electoral_votes": rep_ev,
                "dem_electoral_votes": dem_ev,
                "state_predictions": state_results,
            },
            "events": [
                {
                    "id": event["id"],
                    "title": event["title"],
                    "date": event["date"],
                    "content": event["content"],
                    "domain": event["domain"],
                    "country": "US",
                    "impact": impact,
                    "status": "completed",
                }
                for event, impact in event_impacts
            ],
            "emotion_waves": emotion_waves,
        }

        results[provider_key] = result
        out_path = OUTPUT_DIR / f"election_2026_{provider_key}.json"
        out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"  Saved: {out_path.relative_to(BASE_DIR)}")

    if results:
        combined = {
            "year": 2026,
            "providers": list(results.keys()),
            "provider_names": {k: LLM_PROVIDERS[k]["name"] for k in results},
            "results": results,
        }
        combined_path = OUTPUT_DIR / "election_2026_comparison.json"
        combined_path.write_text(json.dumps(combined, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"\n{'=' * 60}")
        print(f"Done! {len(results)} provider(s) simulated.")
        for key, r in results.items():
            rep = r["simulated"]["rep_electoral_votes"]
            dem = r["simulated"]["dem_electoral_votes"]
            n = len(r["events"])
            print(f"   {r['provider_name']:12s} -> R {rep:3d} vs D {dem:3d}  ({n} events processed)")
        print(f"{'=' * 60}")

    # ── Ensemble & Monte Carlo ──
    if len(results) >= 1:
        print(f"\n{'=' * 60}")
        print("📊 Ensemble & Monte Carlo Uncertainty Analysis")
        print(f"{'=' * 60}")

        # Step 1: Compute ensemble (median across providers)
        ensemble = compute_ensemble_impacts(results)
        print(f"\n  Ensemble: {len(ensemble)} events (median across {len(results)} provider(s))")
        for event, impact in ensemble:
            dis = impact.get("_disagreement", {})
            max_dis = max(dis.values()) if dis else 0
            flag = " ⚠️ HIGH DISAGREEMENT" if max_dis > 0.08 else ""
            print(f"    {event['title'][:50]:50s}  R pos={impact['rep_positive']:+.2f}  D pos={impact['dem_positive']:+.2f}{flag}")

        # Run ensemble simulation (with median impacts, no noise)
        agents = generate_agents(us_states, election_2020)
        for event, impact in ensemble:
            clean_impact = {k: impact[k] for k in IMPACT_KEYS}
            process_event(agents, clean_impact)
            fade_step(agents)
            fade_step(agents)
        rep_ev, dem_ev, state_results = compute_predictions(agents, us_states, election_2020)
        winner = "Republican" if rep_ev >= 270 else "Democrat"
        print(f"\n  Ensemble Result: R {rep_ev} vs D {dem_ev} -> {winner}")

        # Step 2: Monte Carlo uncertainty
        print(f"\n  Running Monte Carlo (200 simulations)...")
        mc = run_monte_carlo(ensemble, us_states, election_2020, n_sim=200)

        print(f"\n  ┌─────────────────────────────────────────────────┐")
        print(f"  │  🎲 MONTE CARLO RESULTS (200 runs)              │")
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

        # Swing states with flip probability
        swing_states = []
        for abbr, probs in mc["state_probabilities"].items():
            rep_prob = probs["rep_probability"]
            if 0.15 < rep_prob < 0.85:  # competitive
                ev = state_results.get(abbr, {}).get("ev", 0)
                swing_states.append((abbr, rep_prob, ev))
        swing_states.sort(key=lambda x: abs(x[1] - 0.5))

        if swing_states:
            print(f"\n  Competitive states (flip probability > 15%):")
            for abbr, rep_prob, ev in swing_states[:10]:
                dem_prob = 1 - rep_prob
                bar_r = "█" * int(rep_prob * 20)
                bar_d = "█" * int(dem_prob * 20)
                print(f"    {abbr:3s} ({ev:2d}EV) R {rep_prob*100:5.1f}% {bar_r}│{bar_d} {dem_prob*100:5.1f}% D")

        # Save ensemble + Monte Carlo results
        ensemble_result = {
            "year": 2026,
            "type": "ensemble",
            "providers_used": list(results.keys()),
            "provider_names": {k: LLM_PROVIDERS[k]["name"] for k in results},
            "simulated": {
                "rep_electoral_votes": rep_ev,
                "dem_electoral_votes": dem_ev,
                "state_predictions": state_results,
            },
            "events": [
                {
                    "id": event["id"], "title": event["title"],
                    "date": event["date"], "content": event["content"],
                    "domain": event["domain"], "country": "US",
                    "impact": {k: impact[k] for k in IMPACT_KEYS},
                    "disagreement": impact.get("_disagreement", {}),
                    "status": "completed",
                }
                for event, impact in ensemble
            ],
            "emotion_waves": [
                generate_emotion_wave(event["id"], event["title"], {k: impact[k] for k in IMPACT_KEYS})
                for event, impact in ensemble
            ],
            "monte_carlo": mc,
        }
        ensemble_path = OUTPUT_DIR / "election_2026_ensemble.json"
        ensemble_path.write_text(json.dumps(ensemble_result, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"\n  Saved: {ensemble_path.relative_to(BASE_DIR)}")

if __name__ == "__main__":
    main()
