import {
  StrategicInsight,
  MapStats,
  MapPlan,
  Player,
  DraftStats,
  CompositionStats,
  PlayerTendency,
  RosterStability,
  ReportEvidence,
} from './models.js';

export interface ScoutingReport {
  /**
   * When present, the report’s recommendations are generated in “matchup mode” (our team vs opponent).
   */
  ourTeamName?: string;
  opponentName: string;
  game?: 'LOL' | 'VALORANT';
  winProbability: number;
  evidence: ReportEvidence;
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
