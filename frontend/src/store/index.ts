import { create } from 'zustand';
import type {
  GroupAgent, SimEvent, FineGrainedFactors,
  SimulationSummary, ActionStats, StatePrediction,
  ElectionYear, HistoricalElectionData,
} from '../types';

// ── Pre-computed 2020/2024/2026 data ──
import data2020 from '../data/election_2020_results.json';
import data2024 from '../data/election_2024_results.json';
import data2026 from '../data/election_2026_stepwise.json';

interface SimStore {
  // Year
  year: ElectionYear;
  setYear: (year: ElectionYear) => void;

  // Events (for 2026 interactive)
  events: SimEvent[];
  setEvents: (events: SimEvent[]) => void;
  addEvent: (event: SimEvent) => void;
  removeEvent: (id: string) => void;
  updateEventStatus: (id: string, status: SimEvent['status']) => void;

  // Agents (for 2026 interactive)
  agents: GroupAgent[];
  setAgents: (agents: GroupAgent[]) => void;

  // Simulation (for 2026 interactive)
  isRunning: boolean;
  currentDay: number;
  repEV: number;
  demEV: number;
  statePredictions: Record<string, StatePrediction>;
  actionStats: ActionStats;

  setSimState: (summary: Partial<SimulationSummary>) => void;
  reset: () => void;

  // Factors (for 2026 interactive)
  factors: FineGrainedFactors;
  setFactors: (factors: FineGrainedFactors) => void;

  // Static data (for 2020/2024)
  staticData: Record<number, HistoricalElectionData>;

  // Ensemble + Monte Carlo data for 2026
  ensembleData: any;

  // UI
  selectedState: string | null;
  setSelectedState: (state: string | null) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  detailPage: string | null;
  setDetailPage: (page: string | null) => void;
}

export const useSimStore = create<SimStore>((set) => ({
  // Year
  year: 2020,
  setYear: (year) => set({ year }),

  // Events
  events: [],
  setEvents: (events) => set({ events }),
  addEvent: (event) => set((s) => ({ events: [...s.events, event] })),
  removeEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
  updateEventStatus: (id, status) =>
    set((s) => ({
      events: s.events.map((e) => (e.id === id ? { ...e, status } : e)),
    })),

  // Agents
  agents: [],
  setAgents: (agents) => set({ agents }),

  // Simulation
  isRunning: false,
  currentDay: 0,
  repEV: 0,
  demEV: 0,
  statePredictions: {},
  actionStats: { views: 0, likes: 0, comments: 0, shares: 0 },

  setSimState: (summary) =>
    set((s) => ({
      isRunning: summary.is_running ?? s.isRunning,
      currentDay: summary.current_day ?? s.currentDay,
      repEV: summary.rep_electoral_votes ?? s.repEV,
      demEV: summary.dem_electoral_votes ?? s.demEV,
      statePredictions: summary.state_predictions ?? s.statePredictions,
      actionStats: summary.action_stats ?? s.actionStats,
      agents: summary.agents ?? s.agents,
    })),

  reset: () =>
    set({
      isRunning: false,
      currentDay: 0,
      repEV: 0,
      demEV: 0,
      statePredictions: {},
      actionStats: { views: 0, likes: 0, comments: 0, shares: 0 },
    }),

  // Factors
  factors: {
    population_weight: 1.0,
    emotion_fading: 0.1,
    forgetting_probability: 0.05,
    character_enabled: true,
  },
  setFactors: (factors) => set({ factors }),

  // Static data
  staticData: {
    2020: data2020 as unknown as HistoricalElectionData,
    2024: data2024 as unknown as HistoricalElectionData,
    2026: data2026 as unknown as HistoricalElectionData,
  },
  // Ensemble + Monte Carlo data (loaded separately)
  ensembleData: null as any,

  // UI
  selectedState: null,
  setSelectedState: (state) => set({ selectedState: state }),
  activeTab: 'map',
  setActiveTab: (tab) => set({ activeTab: tab }),
  detailPage: null,
  setDetailPage: (page) => set({ detailPage: page }),
}));
