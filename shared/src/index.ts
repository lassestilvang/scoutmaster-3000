import {
  StrategicInsight,
  HowToWinEngineResult,
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
  /**
   * Optional transparency payload: ranked candidates + scoring breakdown.
   */
  howToWinEngine?: HowToWinEngineResult;
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
  /**
   * When `isMockData` is true, this provides a lightweight reason code for better UI messaging.
   */
  mockReason?: 'TeamNotFound' | 'MissingApiKey' | 'ApiError';
  /**
   * Optional team suggestions (typically populated when a team name could not be resolved).
   */
  suggestedTeams?: Array<{ id: string; name: string }>;
}

export * from './models.js';
