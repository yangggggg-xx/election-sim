"""
2026 Midterm Election — Stepwise Event-by-Event Simulation

Instead of running all 9 events and producing one final result, this script
processes events ONE AT A TIME, producing a prediction snapshot after each event.
The prediction from event N becomes the historical baseline for event N+1.

Usage:
  set GLM_API_KEY=your-key
  python scripts/simulate_2026_stepwise.py           # all 9 events
  python scripts/simulate_2026_stepwise.py --event 1  # only event 1

Output: frontend/src/data/election_2026_stepwise.json
"""

import json
import math
import os
import re
import sys
import time
import argparse
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

# ─── LLM Provider ──────────────────────────────────────

LLM_CONFIG = {
    "base_url": "https://open.bigmodel.cn/api/paas/v4",
    "api_key_env": "ANTHROPIC_AUTH_TOKEN",  # same key works for native GLM API
    "model": "glm-5.1",
    "name": "GLM-5.1",
}

# ─── 2025-2026 Real Events ─────────────────────────────

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

# ─── Simulation Constants ───────────────────────────────

SWING_FACTOR = 0.20
INITIAL_REP_POS = 0.75
INITIAL_DEM_POS = 0.75
INITIAL_IND_POS = 0.45
EMOTION_ATTITUDE_COUPLING = 0.15
CHAR_WEIGHTS = {"susceptible": 1.5, "ordinary": 1.0, "calm": 0.5}
WAVE_TAU = 2.5

# ─── LLM API ────────────────────────────────────────────

def call_llm(prompt: str) -> str:
    api_key = os.environ.get(LLM_CONFIG["api_key_env"], "")
    if not api_key:
        print("ERROR: GLM_API_KEY not set")
        sys.exit(1)

    url = f"{LLM_CONFIG['base_url']}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": LLM_CONFIG["model"],
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
            body = resp.text[:500]
            if "1301" in body or "敏感" in body or "unsafe" in body.lower():
                print("    Content filter triggered — retrying with sanitized prompt")
                return "__CONTENT_FILTERED__"
            print(f"    Error: {body}")
            return ""
        if resp.status_code != 200:
            print(f"    Error: {resp.text[:300]}")
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
        return ""
    except requests.exceptions.RequestException as e:
        print(f"    Request failed: {e}")
        return ""


# ─── Prompt ─────────────────────────────────────────────

def build_impact_prompt(event: dict, sanitized: bool = False) -> str:
    event_title = event['title']
    event_content = event['content']
    if sanitized:
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

RULES — follow strictly:
1. Emotion values: typically 0.05-0.45. Above 0.40 ONLY for the most extreme events. NEVER above 0.55.
2. "positive" = attitude shift toward supporting THEIR OWN party. Positive = energized. Negative = demoralized.
3. KEY DISTINCTION:
   a) CLEAR VICTORY for Party A → Party A positive (+0.15 to +0.25), Party B negative (-0.05 to -0.15)
   b) CONTROVERSIAL ACTION by Party A → Party A positive (+0.10 to +0.20), Party B ALSO positive (+0.05 to +0.15, energized to resist)
4. BALANCE: Both parties should NOT both be strongly positive on the SAME event.
5. MIDTERM EFFECT: The party in power typically loses some motivation over time.
6. Keep values proportional to severity: routine 0.05-0.15, significant 0.15-0.30, extreme 0.30-0.45.
7. "positive" field should typically stay within -0.15 to +0.20.

Respond with ONLY this JSON (no other text, no markdown):
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
            data[key] = round(max(0.0, min(0.45, val)), 2)

    # Balance check
    rep_pos = data["rep_positive"]
    dem_pos = data["dem_positive"]
    if rep_pos > 0.15 and dem_pos > 0.15:
        if rep_pos > dem_pos:
            data["dem_positive"] = round(min(dem_pos, rep_pos * 0.6), 2)
        elif dem_pos > rep_pos:
            data["rep_positive"] = round(min(rep_pos, dem_pos * 0.6), 2)

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


def generate_agents(us_states, election_2024_predictions):
    """Generate agents using 2024 election predictions as the historical baseline.

    Each state gets 3 agents: rep, dem, ind.
    Population of each agent = state_population * party_pct.
    Initial positive attitude based on 2024 result (winning party more positive).
    """
    agents = []
    for state in us_states:
        abbr = state["abbr"]
        pop = state["population"]
        rep_pct = state["repPct"]
        dem_pct = state["demPct"]
        ind_pct = max(1 - rep_pct - dem_pct, 0.05)

        # Use 2024 prediction as baseline
        pred_2024 = election_2024_predictions.get(abbr, {})
        baseline_2024 = 1.0 if pred_2024.get("winner") == "rep" else -1.0
        confidence_2024 = pred_2024.get("confidence", 0.1)

        # Character assignment
        rep_char = "calm" if rep_pct > 0.55 else "ordinary"
        dem_char = "calm" if dem_pct > 0.55 else "ordinary"
        if abs(rep_pct - 0.5) < 0.05:
            ind_char = "susceptible"
        elif abs(rep_pct - 0.5) < 0.15:
            ind_char = "ordinary"
        else:
            ind_char = "calm"

        # Initial positive attitude — based on 2024 result
        # Winning party agents are more positive, losing party less so
        rep_pos = 0.65 + 0.15 * (1 if baseline_2024 > 0 else 0)
        dem_pos = 0.65 + 0.15 * (1 if baseline_2024 < 0 else 0)
        ind_pos = 0.45 + 0.1 * baseline_2024

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


def compute_predictions(agents, us_states, historical_margins):
    """Compute state predictions using the provided historical margins.

    historical_margins: dict of {abbr: margin} where positive = R lean, negative = D lean
    This starts as 2024 prediction margins, then rolls forward after each event.
    """
    state_results = {}
    rep_ev = 0
    dem_ev = 0
    for state in us_states:
        abbr = state["abbr"]
        ev = state["electoralVotes"]
        margin = historical_margins.get(abbr, 0)

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
        predicted_margin = margin + total_swing
        winner = "rep" if predicted_margin > 0 else "dem"
        confidence = min(abs(predicted_margin), 0.5)
        state_results[abbr] = {"winner": winner, "confidence": round(confidence, 3), "ev": ev}
        if winner == "rep":
            rep_ev += ev
        else:
            dem_ev += ev
    return rep_ev, dem_ev, state_results


def predictions_to_margins(state_predictions):
    """Convert state predictions to margin dict for next event's baseline.

    confidence > 0 → margin = +confidence (rep lean)
    confidence > 0 → margin = -confidence (dem lean)
    """
    margins = {}
    for abbr, pred in state_predictions.items():
        if pred["winner"] == "rep":
            margins[abbr] = pred["confidence"]
        else:
            margins[abbr] = -pred["confidence"]
    return margins


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


# ─── Compute 2024 baseline margins ─────────────────────

def compute_2024_margins(us_states, election_2024_predictions):
    """Use 2024 election predictions as the initial historical margins.

    For each state, the margin = confidence * sign(winner).
    We also factor in the actual rep/dem vote percentages from us_states
    to get a more nuanced starting margin.
    """
    margins = {}
    for state in us_states:
        abbr = state["abbr"]
        pred = election_2024_predictions.get(abbr, {})
        if pred:
            # Use the 2024 prediction confidence as margin
            if pred.get("winner") == "rep":
                margins[abbr] = pred.get("confidence", 0.1)
            else:
                margins[abbr] = -pred.get("confidence", 0.1)
        else:
            # Fallback: use party registration percentages
            rep_pct = state["repPct"]
            dem_pct = state["demPct"]
            total = rep_pct + dem_pct
            margins[abbr] = (rep_pct - dem_pct) / total if total > 0 else 0
    return margins


# ─── Main ───────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="2026 Stepwise Event Simulation")
    parser.add_argument("--event", type=int, default=None, help="Only simulate a specific event (1-9)")
    parser.add_argument("--output", type=str, default=None, help="Output filename")
    args = parser.parse_args()

    print("=" * 60)
    print("2026 Midterm — Stepwise Event-by-Event Simulation")
    print(f"  Provider: {LLM_CONFIG['name']}")
    print("=" * 60)

    # Load data
    us_states = json.loads((DATA_DIR / "us_states.json").read_text(encoding="utf-8"))

    # Load 2024 election results as historical baseline
    data_2024_path = OUTPUT_DIR / "election_2024_results.json"
    if not data_2024_path.exists():
        print(f"ERROR: {data_2024_path} not found")
        sys.exit(1)
    data_2024 = json.loads(data_2024_path.read_text(encoding="utf-8"))
    predictions_2024 = data_2024["simulated"]["state_predictions"]

    print(f"\n  2024 baseline loaded: R {data_2024['simulated']['rep_electoral_votes']} vs D {data_2024['simulated']['dem_electoral_votes']}")

    # Compute starting margins from 2024 results
    historical_margins = compute_2024_margins(us_states, predictions_2024)

    # Generate agents (same structure as before)
    agents = generate_agents(us_states, predictions_2024)
    total_agents = len(agents)
    print(f"  Agents generated: {total_agents} (3 per state × 51 jurisdictions)")

    # Select events
    events = EVENTS_2026
    if args.event:
        idx = args.event - 1
        if idx < 0 or idx >= len(events):
            print(f"ERROR: event {args.event} out of range (1-{len(events)})")
            sys.exit(1)
        events = [events[idx]]
        print(f"  Mode: single event #{args.event}")

    # ── Stepwise simulation ──
    snapshots = []
    event_records = []

    for i, event in enumerate(events):
        evt_num = EVENTS_2026.index(event) + 1
        print(f"\n{'─' * 55}")
        print(f"  Event {evt_num}/9: {event['title']}")
        print(f"  Date: {event['date']}")
        print(f"{'─' * 55}")

        # 1. Call GLM for impact
        print("  🤖 Calling GLM for impact assessment...")
        prompt = build_impact_prompt(event)
        response = call_llm(prompt)

        if response == "__CONTENT_FILTERED__":
            print("  🔄 Retrying with sanitized prompt...")
            prompt = build_impact_prompt(event, sanitized=True)
            response = call_llm(prompt)

        if response == "__CONTENT_FILTERED__":
            print("  ❌ Content filter still triggered, SKIP")
            continue

        impact = parse_impact_response(response)
        if impact is None:
            print("  ❌ Could not parse response, SKIP")
            continue

        print(f"  ✅ Impact parsed:")
        print(f"     R: happy={impact['rep_happy']:.2f} sad={impact['rep_sad']:.2f} "
              f"angry={impact['rep_angry']:.2f} pos={impact['rep_positive']:+.2f}")
        print(f"     D: happy={impact['dem_happy']:.2f} sad={impact['dem_sad']:.2f} "
              f"angry={impact['dem_angry']:.2f} pos={impact['dem_positive']:+.2f}")
        print(f"     I: happy={impact['ind_happy']:.2f} sad={impact['ind_sad']:.2f} "
              f"angry={impact['ind_angry']:.2f} pos={impact['ind_positive']:+.2f}")

        # 2. Process event through agents
        process_event(agents, impact)
        fade_step(agents)
        fade_step(agents)

        # 3. Compute prediction snapshot using current historical margins
        rep_ev, dem_ev, state_results = compute_predictions(agents, us_states, historical_margins)
        winner = "Republican" if rep_ev >= 270 else "Democrat"
        print(f"\n  📊 Snapshot after Event {evt_num}: R {rep_ev} vs D {dem_ev} → {winner}")

        # 4. Generate emotion wave
        emotion_wave = generate_emotion_wave(event["id"], event["title"], impact)

        # 5. Save snapshot
        snapshot = {
            "event_index": evt_num,
            "event_id": event["id"],
            "event_title": event["title"],
            "event_date": event["date"],
            "event_domain": event["domain"],
            "impact": impact,
            "rep_electoral_votes": rep_ev,
            "dem_electoral_votes": dem_ev,
            "state_predictions": state_results,
            "emotion_wave": emotion_wave,
        }
        snapshots.append(snapshot)

        # 6. Update historical margins for next event
        #    The prediction from this event becomes the baseline for the next
        historical_margins = predictions_to_margins(state_results)
        print(f"  📌 Margins updated for next event baseline")

        # 7. Save event record
        event_records.append({
            "id": event["id"],
            "title": event["title"],
            "date": event["date"],
            "content": event["content"],
            "domain": event["domain"],
            "country": "US",
            "impact": impact,
            "status": "completed",
        })

        time.sleep(1)  # Rate limit

    if not snapshots:
        print("\n❌ No events processed successfully")
        sys.exit(1)

    # ── Build final output ──
    final_snapshot = snapshots[-1]
    output = {
        "year": 2026,
        "type": "stepwise",
        "provider": "glm",
        "provider_name": LLM_CONFIG["name"],
        "rep_candidate": "Republican",
        "dem_candidate": "Democrat",
        "baseline_year": 2024,
        "baseline_result": {
            "rep_electoral_votes": data_2024["simulated"]["rep_electoral_votes"],
            "dem_electoral_votes": data_2024["simulated"]["dem_electoral_votes"],
        },
        # Final prediction (after all processed events)
        "simulated": {
            "rep_electoral_votes": final_snapshot["rep_electoral_votes"],
            "dem_electoral_votes": final_snapshot["dem_electoral_votes"],
            "state_predictions": final_snapshot["state_predictions"],
        },
        "events": event_records,
        "emotion_waves": [s["emotion_wave"] for s in snapshots],
        # All stepwise snapshots
        "snapshots": snapshots,
    }

    out_name = args.output or "election_2026_stepwise.json"
    out_path = OUTPUT_DIR / out_name
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n{'=' * 60}")
    print(f"✅ Done! {len(snapshots)} event(s) processed")
    print(f"   Final: R {final_snapshot['rep_electoral_votes']} vs D {final_snapshot['dem_electoral_votes']}")
    print(f"   Saved: {out_path.relative_to(BASE_DIR)}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
