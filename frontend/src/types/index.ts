// ── Election Year ──
export type ElectionYear = 2020 | 2024 | 2026;

// ── State Abbreviation → Full Name ──
export const STATE_NAMES: Record<string, string> = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',
  CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',
  FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',
  IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',
  ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',
  MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',
  NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',
  NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',
  OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
  SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',
  VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
};

// ── Agent Models ──
export interface EmotionState {
  happy: number;
  sad: number;
  angry: number;
}

export interface AttitudeState {
  positive: number;
  negative: number;
}

export interface MemoryItem {
  day: number;
  event_id: string;
  event_title: string;
  emotion_snapshot: EmotionState;
  attitude_snapshot: AttitudeState;
  freshness: number;
}

export type CharacterType = 'susceptible' | 'ordinary' | 'calm';
export type PartyType = 'republican' | 'democrat' | 'independent';

export interface GroupAgent {
  id: string;
  state_abbr: string;
  state_name: string;
  party: PartyType;
  population: number;
  character: CharacterType;
  emotions: EmotionState;
  attitudes: AttitudeState;
  memory_queue: MemoryItem[];
  layer: number;
}

// ── Event Models ──
export interface EventImpact {
  rep_happy: number; rep_sad: number; rep_angry: number;
  dem_happy: number; dem_sad: number; dem_angry: number;
  ind_happy: number; ind_sad: number; ind_angry: number;
  rep_positive: number; dem_positive: number; ind_positive: number;
}

export interface SimEvent {
  id: string;
  title: string;
  date: string;
  content: string;
  domain: string;
  country: string;
  impact: EventImpact | null;
  status: 'pending' | 'processing' | 'completed';
}

// ── Simulation Models ──
export interface FineGrainedFactors {
  population_weight: number;
  emotion_fading: number;
  forgetting_probability: number;
  character_enabled: boolean;
}

export interface ActionStats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface StatePrediction {
  winner: 'rep' | 'dem';
  confidence: number;
  ev: number;
}

export interface SimulationSummary {
  current_day: number;
  is_running: boolean;
  rep_electoral_votes: number;
  dem_electoral_votes: number;
  state_predictions: Record<string, StatePrediction>;
  action_stats: ActionStats;
  agents: GroupAgent[];
}

export interface PredictionResult {
  rep_candidate: string;
  dem_candidate: string;
  rep_electoral_votes: number;
  dem_electoral_votes: number;
  rep_support_rate: number;
  dem_support_rate: number;
  winner: string;
  state_results: { state: string; predicted_winner: string; confidence: number; electoral_votes: number }[];
  swing_state_accuracy: number;
}

// ── Historical Election Data (for 2020/2024 static pages) ──
export interface StateActualResult {
  winner: 'rep' | 'dem';
  repVotes: number;
  demVotes: number;
}

export interface HistoricalAccuracy {
  state_accuracy: number;
  ev_error: number;
  correctly_predicted: number;
  total_states: number;
  mape?: number;
}

export interface HistoricalElectionData {
  year: ElectionYear;
  rep_candidate: string;
  dem_candidate: string;
  provider?: string;
  provider_name?: string;
  simulated: {
    rep_electoral_votes: number;
    dem_electoral_votes: number;
    state_predictions: Record<string, StatePrediction>;
  };
  actual?: {
    rep_electoral_votes: number;
    dem_electoral_votes: number;
    state_results: Record<string, StateActualResult>;
  };
  events: SimEvent[];
  accuracy?: HistoricalAccuracy;
  emotion_waves?: EmotionWaveData[];
}

// ── Emotion Wave Data (for 2024 page) ──
export interface PartyEmotionSnapshot {
  happy: number;
  sad: number;
  angry: number;
  positive: number;
}

export interface EmotionTimePoint {
  day_offset: number;
  republicans: PartyEmotionSnapshot;
  democrats: PartyEmotionSnapshot;
  independents: PartyEmotionSnapshot;
}

export interface EmotionWaveData {
  event_id: string;
  event_title: string;
  event_date: string;
  timeline: EmotionTimePoint[];
}

// ── Year Config ──
export interface YearConfig {
  year: ElectionYear;
  label: string;
  subtitle: string;
  type: 'static' | 'interactive';
  badge: string;
}
