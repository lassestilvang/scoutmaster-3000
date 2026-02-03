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
  ReportDataSource,
  ReportRawInputs,
} from './models.js';

export interface MatchupTeamSnapshot {
  teamName: string;
  /**
   * Percent (0–100). Mirrors `ScoutingReport.winProbability`.
   */
  winRate: number;
  avgScore: number;
  matchesAnalyzed: number;
  evidence: ReportEvidence;
  topMaps: MapStats[];
  aggression: 'High' | 'Medium' | 'Low';
  roster: Player[];
  rosterStability?: RosterStability;
}

export interface MatchupMapPoolDelta {
  mapName: string;
  our: MapStats;
  opponent: MapStats;
  /**
   * our.winRate - opponent.winRate (range: -1 to 1)
   */
  deltaWinRate: number;
  /**
   * Min(our.matchesPlayed, opponent.matchesPlayed)
   */
  minSample: number;
}

export interface MatchupAggressionDelta {
  our: 'High' | 'Medium' | 'Low';
  opponent: 'High' | 'Medium' | 'Low';
  note: string;
}

export interface MatchupRosterStabilityDelta {
  our?: RosterStability;
  opponent?: RosterStability;
  note?: string;
}

export interface MatchupDeltas {
  mapPool: MatchupMapPoolDelta[];
  aggression: MatchupAggressionDelta;
  rosterStability?: MatchupRosterStabilityDelta;
}

export interface MatchupHowToWinTransparency {
  kind: 'MatchupHeuristics';
  basedOn: {
    ourMatchesAnalyzed: number;
    opponentMatchesAnalyzed: number;
    sharedMaps: number;
  };
  notes: string[];
}

export interface MatchupReport {
  our: MatchupTeamSnapshot;
  opponent: MatchupTeamSnapshot;
  deltas: MatchupDeltas;
  howToWinTransparency: MatchupHowToWinTransparency;
  /**
   * Optional transparency payload for the opponent-only engine.
   * In matchup mode the selected `howToWin` tips may be overridden, so this is kept separate.
   */
  opponentHowToWinEngine?: HowToWinEngineResult;
}

export interface ScoutingReport {
  /**
   * When present, the report’s recommendations are generated in “matchup mode” (our team vs opponent).
   */
  ourTeamName?: string;
  opponentName: string;
  game?: 'LOL' | 'VALORANT';
  winProbability: number;
  evidence: ReportEvidence;
  /**
   * Judge-friendly description of what sources were used.
   */
  dataSources: ReportDataSource[];
  /**
   * A bounded, readable slice of normalized inputs (not raw API payloads).
   */
  rawInputs?: ReportRawInputs;
  keyInsights: string[];
  howToWin: StrategicInsight[];
  /**
   * Optional transparency payload: ranked candidates + scoring breakdown.
   */
  howToWinEngine?: HowToWinEngineResult;
  /**
   * Optional, only populated in matchup mode.
   */
  matchup?: MatchupReport;
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
export * from './wikiLinks.js';
