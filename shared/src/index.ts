import {
  StrategicInsight,
  MapStats,
  MapPlan,
  Player,
  DraftStats,
  CompositionStats,
  PlayerTendency,
  RosterStability,
} from './models.js';

export interface ScoutingReport {
  opponentName: string;
  game?: 'LOL' | 'VALORANT';
  winProbability: number;
  keyInsights: string[];
  howToWin: StrategicInsight[];
  topMaps: MapStats[];
  mapPlans?: MapPlan[];
  roster: Player[];
  rosterStability?: RosterStability;
  playerTendencies?: PlayerTendency[];
  aggression: 'High' | 'Medium' | 'Low';
  avgScore: number;
  matchesAnalyzed: number;
  draftStats?: DraftStats[];
  compositions?: CompositionStats[];
  isMockData?: boolean;
}

export * from './models.js';
