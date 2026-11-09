"""Rule-based decision reasoning engine — replaces LLM for initial version."""
from models.agent import GroupAgent, PartyType, EmotionState, AttitudeState, MemoryItem
from models.event import Event, EventImpact
from models.simulation import FineGrainedFactors, ActionStats


def get_event_impact_for_party(event_impact: EventImpact, party: PartyType) -> dict:
    """Extract the relevant impact values for a given party."""
    prefix = "rep_" if party == PartyType.REPUBLICAN else "dem_" if party == PartyType.DEMOCRAT else "ind_"
    return {
        "happy": getattr(event_impact, f"{prefix}happy", 0.0),
        "sad": getattr(event_impact, f"{prefix}sad", 0.0),
        "angry": getattr(event_impact, f"{prefix}angry", 0.0),
        "positive_shift": getattr(event_impact, f"{prefix}positive", 0.0),
    }


def update_emotions(
    agent: GroupAgent,
    impact: dict,
    factors: FineGrainedFactors,
) -> EmotionState:
    """Update agent emotions based on event impact and fine-grained factors.

    E_new = E_old * (1 - fading) + impact * character_weight * population_weight
    """
    fading = factors.emotion_fading
    char_w = agent.character_weight(factors.character_enabled)
    pop_w = factors.population_weight

    new_happy = max(0, min(1, agent.emotions.happy * (1 - fading) + impact["happy"] * char_w * pop_w))
    new_sad = max(0, min(1, agent.emotions.sad * (1 - fading) + impact["sad"] * char_w * pop_w))
    new_angry = max(0, min(1, agent.emotions.angry * (1 - fading) + impact["angry"] * char_w * pop_w))

    return EmotionState(happy=round(new_happy, 4), sad=round(new_sad, 4), angry=round(new_angry, 4))


def update_attitudes(
    agent: GroupAgent,
    new_emotions: EmotionState,
    impact: dict,
    factors: FineGrainedFactors,
) -> AttitudeState:
    """Update agent attitudes based on new emotions and event impact.

    A_new = A_old * (1 - forgetting) + E_emotion_component + impact_positive_shift
    """
    forgetting = factors.forgetting_probability
    char_w = agent.character_weight(factors.character_enabled)

    # Emotion-driven attitude shift: high anger/negative emotions push attitude negative
    emotion_component = (new_emotions.happy - new_emotions.angry) * 0.15 * char_w

    # Direct positive shift from event impact
    direct_shift = impact["positive_shift"] * char_w * factors.population_weight

    new_positive = agent.attitudes.positive * (1 - forgetting) + emotion_component + direct_shift
    new_negative = 1.0 - new_positive

    # Clamp
    new_positive = max(0.01, min(0.99, new_positive))
    new_negative = round(max(0.01, min(0.99, new_negative)), 4)
    new_positive = round(1.0 - new_negative, 4)

    return AttitudeState(positive=new_positive, negative=new_negative)


def update_memory(
    agent: GroupAgent,
    day: int,
    event_id: str,
    event_title: str,
    new_emotions: EmotionState,
    new_attitudes: AttitudeState,
    factors: FineGrainedFactors,
) -> list[MemoryItem]:
    """Update memory queue with forgetting probability."""
    forgetting = factors.forgetting_probability

    # Decay freshness of existing memories
    updated = []
    for mem in agent.memory_queue:
        mem.freshness *= (1 - forgetting)
        if mem.freshness > 0.05:  # Keep if not fully forgotten
            updated.append(mem)

    # Add new memory
    new_mem = MemoryItem(
        day=day,
        event_id=event_id,
        event_title=event_title,
        emotion_snapshot=new_emotions,
        attitude_snapshot=new_attitudes,
        freshness=1.0,
    )
    updated.append(new_mem)

    # Keep at most 10 memories (queue limit)
    return updated[-10:]


def compute_actions(agent: GroupAgent, day: int) -> ActionStats:
    """Compute the number of views/likes/comments/shares for this agent."""
    intensity = (agent.emotions.happy + agent.emotions.sad + agent.emotions.angry) / 3.0
    pop = agent.population
    daily_rate = 0.01  # 1% of population might view per day during active event

    views = int(pop * daily_rate * (1 + intensity))
    likes = int(views * 0.15 * (1 + agent.attitudes.positive))
    comments = int(views * 0.05 * intensity)
    shares = int(views * 0.03 * intensity)

    return ActionStats(views=views, likes=likes, comments=comments, shares=shares)


def process_event_for_agent(
    agent: GroupAgent,
    event: Event,
    day: int,
    factors: FineGrainedFactors,
) -> GroupAgent:
    """Full pipeline: perceive event → update emotions → update attitudes → update memory."""
    if event.impact is None:
        return agent

    impact = get_event_impact_for_party(event.impact, agent.party)

    new_emotions = update_emotions(agent, impact, factors)
    new_attitudes = update_attitudes(agent, new_emotions, impact, factors)
    new_memory = update_memory(agent, day, event.id, event.title, new_emotions, new_attitudes, factors)

    agent.emotions = new_emotions
    agent.attitudes = new_attitudes
    agent.memory_queue = new_memory

    return agent
