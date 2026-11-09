"""US Election Simulation Platform — FastAPI Backend."""
import json
import os
import asyncio
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from models.agent import GroupAgent
from models.event import Event, EventCreate, EventImpact
from models.simulation import (
    FineGrainedFactors, SimulationState, DailySnapshot,
    ActionStats, PredictionResult,
)
from engine.generator import generate_agents, load_election_2020
from engine.decision import process_event_for_agent, compute_actions
from engine.llm_interface import get_engine


# ── Global simulation state ──────────────────────────────────────
class SimManager:
    def __init__(self):
        self.state = SimulationState()
        self.agents: list[GroupAgent] = []
        self.events: list[Event] = []
        self.factors = FineGrainedFactors()
        self.engine = get_engine("rule")
        self.ws_connections: list[WebSocket] = []

    def reset(self):
        self.state = SimulationState()
        self.agents = []
        self.events = []
        self.factors = FineGrainedFactors()

    def load_preset_events(self):
        data_path = os.path.join(os.path.dirname(__file__), "data", "preset_events.json")
        with open(data_path, "r", encoding="utf-8") as f:
            records = json.load(f)
        self.events = []
        for r in records:
            impact = EventImpact(**r.pop("impact")) if "impact" in r else None
            self.events.append(Event(**r, impact=impact, status="pending"))
        self.state.events = [e.model_dump() for e in self.events]

    def init_agents(self):
        self.agents = generate_agents()
        self.state.agents = [a.model_dump() for a in self.agents]

    def get_state_summary(self) -> dict:
        states_data_path = os.path.join(os.path.dirname(__file__), "data", "us_states.json")
        with open(states_data_path, "r", encoding="utf-8") as f:
            states_data = {s["abbr"]: s for s in json.load(f)}

        # Load 2020 baseline for prediction
        election_2020 = load_election_2020()

        state_predictions = {}
        for abbr in states_data:
            state_agents = [a for a in self.agents if a.state_abbr == abbr]
            e2020 = election_2020.get(abbr, {"winner": "dem", "repVotes": 0, "demVotes": 0})

            # ── 2020 baseline: actual vote counts ──
            rep_2020 = e2020.get("repVotes", 0)
            dem_2020 = e2020.get("demVotes", 0)
            total_2020 = rep_2020 + dem_2020 or 1
            margin_2020 = (rep_2020 - dem_2020) / total_2020  # positive = R lean, negative = D lean

            # ── Agent attitude shift from initial state ──
            # Calculate how much each party's attitudes have shifted from their initial baseline
            # Initial baseline: rep positive ~0.75, dem positive ~0.75, ind positive ~0.45
            # A shift of +0.1 in positive attitude for a party means more enthusiasm → higher turnout
            INITIAL_REP_POS = 0.75
            INITIAL_DEM_POS = 0.75
            INITIAL_IND_POS = 0.45

            rep_agents = [a for a in state_agents if a.party.value == "republican"]
            dem_agents = [a for a in state_agents if a.party.value == "democrat"]
            ind_agents = [a for a in state_agents if a.party.value == "independent"]

            # Enthusiasm-based turnout: shift from initial positive attitude
            rep_enthusiasm = sum(a.attitudes.positive for a in rep_agents) / (len(rep_agents) or 1) - INITIAL_REP_POS
            dem_enthusiasm = sum(a.attitudes.positive for a in dem_agents) / (len(dem_agents) or 1) - INITIAL_DEM_POS
            ind_attitude = sum(a.attitudes.positive for a in ind_agents) / (len(ind_agents) or 1) - INITIAL_IND_POS

            # Convert attitude shifts to vote swing
            # Each 0.05 shift in attitude ≈ 1% vote swing in that state
            SWING_FACTOR = 0.20  # how much attitude translates to vote margin change
            enthusiasm_gap = (rep_enthusiasm - dem_enthusiasm) * SWING_FACTOR
            ind_swing = ind_attitude * SWING_FACTOR * 0.5  # independents have less weight

            total_swing = enthusiasm_gap + ind_swing

            # Apply swing to 2020 margin
            predicted_margin = margin_2020 + total_swing

            winner = "rep" if predicted_margin > 0 else "dem"
            confidence = round(abs(predicted_margin), 3)
            state_predictions[abbr] = {
                "winner": winner,
                "confidence": confidence,
                "ev": states_data[abbr]["electoralVotes"],
            }

        rep_ev = sum(p["ev"] for p in state_predictions.values() if p["winner"] == "rep")
        dem_ev = sum(p["ev"] for p in state_predictions.values() if p["winner"] == "dem")

        total_actions = ActionStats()
        for a in self.agents:
            acts = compute_actions(a, self.state.current_day)
            total_actions.views += acts.views
            total_actions.likes += acts.likes
            total_actions.comments += acts.comments
            total_actions.shares += acts.shares

        return {
            "current_day": self.state.current_day,
            "is_running": self.state.is_running,
            "rep_electoral_votes": rep_ev,
            "dem_electoral_votes": dem_ev,
            "state_predictions": state_predictions,
            "action_stats": total_actions.model_dump(),
            "agents": [a.model_dump() for a in self.agents],
        }


manager = SimManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    manager.load_preset_events()
    manager.init_agents()
    yield


app = FastAPI(title="US Election Simulator", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST API ─────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/events")
def get_events():
    return {"events": [e.model_dump() for e in manager.events]}


@app.post("/api/events")
def add_event(event_create: EventCreate):
    import uuid
    event = Event(
        id=f"evt-{uuid.uuid4().hex[:6]}",
        **event_create.model_dump(),
        impact=EventImpact(),  # default zero impact for custom events
        status="pending",
    )
    manager.events.append(event)
    manager.state.events = [e.model_dump() for e in manager.events]
    return event.model_dump()


@app.delete("/api/events/{event_id}")
def delete_event(event_id: str):
    manager.events = [e for e in manager.events if e.id != event_id]
    manager.state.events = [e.model_dump() for e in manager.events]
    return {"deleted": event_id}


@app.put("/api/events/{event_id}")
def update_event(event_id: str, updates: dict):
    for e in manager.events:
        if e.id == event_id:
            for key, val in updates.items():
                if key == "impact" and isinstance(val, dict):
                    e.impact = EventImpact(**val)
                elif hasattr(e, key):
                    setattr(e, key, val)
            manager.state.events = [ev.model_dump() for ev in manager.events]
            return e.model_dump()
    return {"error": "Event not found"}


@app.post("/api/events/preset")
def load_preset():
    manager.load_preset_events()
    return {"events": [e.model_dump() for e in manager.events]}


@app.get("/api/agents")
def get_agents(state: Optional[str] = None):
    agents = manager.agents
    if state:
        agents = [a for a in agents if a.state_abbr == state.upper()]
    return {"agents": [a.model_dump() for a in agents]}


@app.put("/api/agents/{agent_id}")
def update_agent(agent_id: str, updates: dict):
    for i, a in enumerate(manager.agents):
        if a.id == agent_id:
            for key, val in updates.items():
                if hasattr(a, key):
                    setattr(a, key, val)
            return a.model_dump()
    return {"error": "Agent not found"}


@app.get("/api/factors")
def get_factors():
    return manager.factors.model_dump()


@app.put("/api/factors")
def update_factors(factors: FineGrainedFactors):
    manager.factors = factors
    return factors.model_dump()


@app.get("/api/state")
def get_state():
    return manager.get_state_summary()


@app.get("/api/prediction")
def get_prediction():
    summary = manager.get_state_summary()
    sp = summary["state_predictions"]

    # Build state results
    state_results = []
    for abbr, pred in sp.items():
        state_results.append({
            "state": abbr,
            "predicted_winner": pred["winner"],
            "confidence": pred["confidence"],
            "electoral_votes": pred["ev"],
        })

    rep_ev = summary["rep_electoral_votes"]
    dem_ev = summary["dem_electoral_votes"]
    total = rep_ev + dem_ev
    rep_rate = round(rep_ev / total, 4) if total > 0 else 0
    dem_rate = round(dem_ev / total, 4) if total > 0 else 0

    result = PredictionResult(
        rep_electoral_votes=rep_ev,
        dem_electoral_votes=dem_ev,
        rep_support_rate=rep_rate,
        dem_support_rate=dem_rate,
        winner="Trump" if rep_ev > dem_ev else "Harris",
        state_results=state_results,
    )
    return result.model_dump()


# ── WebSocket for real-time simulation ───────────────────────────

@app.websocket("/ws/simulate")
async def ws_simulate(websocket: WebSocket):
    await websocket.accept()
    manager.ws_connections.append(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            cmd = data.get("command")

            if cmd == "start":
                await run_simulation(websocket)
            elif cmd == "reset":
                manager.reset()
                manager.load_preset_events()
                manager.init_agents()
                await websocket.send_json({"type": "reset", "data": manager.get_state_summary()})
            elif cmd == "update_factors":
                factors = FineGrainedFactors(**data.get("factors", {}))
                manager.factors = factors
                await websocket.send_json({"type": "factors_updated", "data": factors.model_dump()})
    except WebSocketDisconnect:
        manager.ws_connections.remove(websocket)


async def run_simulation(websocket: WebSocket):
    """Run the full simulation day by day, pushing updates via WebSocket."""
    manager.state.is_running = True

    # Apply emotion fading for days between events
    event_idx = 0
    day = 1

    for event in manager.events:
        if not manager.state.is_running:
            break

        event.status = "processing"
        await websocket.send_json({"type": "event_start", "event": event.model_dump(), "day": day})

        # Process event for all agents
        for i, agent in enumerate(manager.agents):
            manager.agents[i] = process_event_for_agent(agent, event, day, manager.factors)

        # Small delay for animation effect
        await asyncio.sleep(0.3)

        event.status = "completed"
        summary = manager.get_state_summary()
        summary["day"] = day
        summary["event_id"] = event.id
        await websocket.send_json({"type": "day_update", "data": summary})

        # Fading days between events (simulating time passing)
        for fade_day in range(1, 3):
            day += 1
            for i, agent in enumerate(manager.agents):
                # Apply fading
                agent.emotions.happy = max(0, agent.emotions.happy * (1 - manager.factors.emotion_fading))
                agent.emotions.sad = max(0, agent.emotions.sad * (1 - manager.factors.emotion_fading))
                agent.emotions.angry = max(0, agent.emotions.angry * (1 - manager.factors.emotion_fading))
                # Apply forgetting
                agent.attitudes.positive = agent.attitudes.positive * (1 - manager.factors.forgetting_probability) + 0.5 * manager.factors.forgetting_probability
                agent.attitudes.negative = 1.0 - agent.attitudes.positive
                manager.agents[i] = agent

            await asyncio.sleep(0.2)
            fade_summary = manager.get_state_summary()
            fade_summary["day"] = day
            fade_summary["event_id"] = None
            await websocket.send_json({"type": "day_update", "data": fade_summary})

        day += 1
        event_idx += 1

    # Final prediction
    prediction = await get_prediction_data()
    manager.state.is_running = False
    await websocket.send_json({"type": "simulation_complete", "prediction": prediction})


async def get_prediction_data() -> dict:
    summary = manager.get_state_summary()
    sp = summary["state_predictions"]
    rep_ev = summary["rep_electoral_votes"]
    dem_ev = summary["dem_electoral_votes"]
    total = rep_ev + dem_ev
    return {
        "rep_electoral_votes": rep_ev,
        "dem_electoral_votes": dem_ev,
        "rep_support_rate": round(rep_ev / total, 4) if total > 0 else 0,
        "dem_support_rate": round(dem_ev / total, 4) if total > 0 else 0,
        "winner": "Trump" if rep_ev > dem_ev else "Harris",
        "state_predictions": sp,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
