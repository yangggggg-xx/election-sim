"""Abstract LLM interface — pluggable backend for decision reasoning.

Current implementation: RuleEngine (math-based).
Future: Ollama, OpenAI API, etc.
"""
from abc import ABC, abstractmethod
from models.agent import GroupAgent
from models.event import Event
from models.simulation import FineGrainedFactors


class LLMInterface(ABC):
    @abstractmethod
    def process_event(self, agent: GroupAgent, event: Event, day: int, factors: FineGrainedFactors) -> GroupAgent:
        pass


class RuleEngine(LLMInterface):
    """Rule-based engine using mathematical formulas (no LLM required)."""

    def process_event(self, agent: GroupAgent, event: Event, day: int, factors: FineGrainedFactors) -> GroupAgent:
        from engine.decision import process_event_for_agent
        return process_event_for_agent(agent, event, day, factors)


class OllamaEngine(LLMInterface):
    """Future: Ollama-based engine using local LLM."""

    def process_event(self, agent: GroupAgent, event: Event, day: int, factors: FineGrainedFactors) -> GroupAgent:
        raise NotImplementedError("Ollama engine not yet implemented. Use RuleEngine for now.")


def get_engine(engine_type: str = "rule") -> LLMInterface:
    if engine_type == "rule":
        return RuleEngine()
    elif engine_type == "ollama":
        return OllamaEngine()
    else:
        raise ValueError(f"Unknown engine type: {engine_type}")
