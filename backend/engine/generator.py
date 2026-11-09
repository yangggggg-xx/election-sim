"""Generate 51 state-level group agents based on US population data."""
import json
import os
from models.agent import GroupAgent, CharacterType, PartyType, EmotionState, AttitudeState


def load_states_data() -> list[dict]:
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "us_states.json")
    with open(data_path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_election_2020() -> dict:
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "election_2020.json")
    with open(data_path, "r", encoding="utf-8") as f:
        records = json.load(f)
    return {r["state"]: r for r in records}


def determine_character(rep_pct: float) -> CharacterType:
    """Determine group character based on party dominance."""
    if abs(rep_pct - 0.5) < 0.05:
        return CharacterType.SUSCEPTIBLE  # swing states more reactive
    elif abs(rep_pct - 0.5) < 0.15:
        return CharacterType.ORDINARY
    else:
        return CharacterType.CALM  # safe states less reactive


def generate_agents() -> list[GroupAgent]:
    """Generate one group agent per state per party (3 agents per state, 153 total)."""
    states = load_states_data()
    election_2020 = load_election_2020()
    agents = []

    for state in states:
        abbr = state["abbr"]
        pop = state["population"]
        rep_pct = state["repPct"]
        dem_pct = state["demPct"]
        ind_pct = 1.0 - rep_pct - dem_pct

        # 2020 baseline attitude
        e2020 = election_2020.get(abbr, {"winner": "dem"})
        baseline_2020 = 1.0 if e2020["winner"] == "rep" else -1.0

        for party, pct, party_enum in [
            ("rep", rep_pct, PartyType.REPUBLICAN),
            ("dem", dem_pct, PartyType.DEMOCRAT),
            ("ind", max(ind_pct, 0.05), PartyType.INDEPENDENT),
        ]:
            party_pop = int(pop * pct)

            # Character: swing state agents are more susceptible
            char = determine_character(rep_pct) if party == "ind" else (
                CharacterType.CALM if party == "rep" and rep_pct > 0.55 else
                CharacterType.CALM if party == "dem" and dem_pct > 0.55 else
                CharacterType.ORDINARY
            )

            # Initial attitudes based on 2020 baseline and party
            if party == "rep":
                pos = 0.65 + 0.15 * (1 if baseline_2020 > 0 else 0)
                neg = 1.0 - pos
            elif party == "dem":
                pos = 0.65 + 0.15 * (1 if baseline_2020 < 0 else 0)
                neg = 1.0 - pos
            else:
                pos = 0.45 + 0.1 * baseline_2020
                neg = 1.0 - pos

            agent = GroupAgent(
                id=f"{abbr}-{party}",
                state_abbr=abbr,
                state_name=state["name"],
                party=party_enum,
                population=party_pop,
                character=char,
                emotions=EmotionState(happy=0.1, sad=0.05, angry=0.05),
                attitudes=AttitudeState(positive=round(pos, 3), negative=round(neg, 3)),
                memory_queue=[],
                layer=1,
            )
            agents.append(agent)

    return agents
