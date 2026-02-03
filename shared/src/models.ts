export interface Team {
  id: string;
  name: string;
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  role?: string;
}

export interface Match {
  id: string;
  seriesId: string;
  startTime: string;
  mapName: string;
  teams: TeamResult[];
}

export interface TeamResult {
  teamId: string;
  teamName: string;
  score: number;
  isWinner: boolean;
  players?: Player[];
}

export interface StrategicInsight {
  insight: string;
  evidence: string;
}

export interface HowToWinScoreBreakdown {
  /**
   * 0..1 — how severe the weakness/opportunity is.
   */
  weaknessSeverity: number;
  /**
   * 0..1 — how actionable / exploitable it is for a coach (sample size, clarity, etc.).
   */
  exploitability: number;
  /**
   * Confidence classification used for the scoring multiplier.
   */
  confidence: Confidence;
  /**
   * Numeric multiplier derived from `confidence`.
   */
  confidenceFactor: number;
  /**
   * Final impact score (0..100-ish). This is what we sort on.
   */
  impact: number;
}

export type HowToWinCandidateStatus =
  | 'Selected'
  | 'NotSelected'
  | 'LowConfidenceSelected'
  | 'LowConfidenceNotSelected';

export interface HowToWinCandidate {
  id: string;
  rule: string;
  insight: string;
  evidence: string;
  status: HowToWinCandidateStatus;
  breakdown: HowToWinScoreBreakdown;
  /**
   * Populated for non-selected candidates to explain why they were not chosen.
   */
  whyNotSelected?: string;
}

export interface HowToWinEngineResult {
  /**
   * The selected top 3–5 tips (mirrors `ScoutingReport.howToWin`).
   */
  selected: StrategicInsight[];
  /**
   * Full candidate list used for transparency / debugging / UI.
   */
  candidates: HowToWinCandidate[];
  /**
   * A short string describing the scoring formula.
   */
  formula: string;
}

export type Confidence = 'High' | 'Medium' | 'Low';

export interface WinRateTrend {
  direction: 'Up' | 'Down' | 'Flat';
  /**
   * recentWinRate - previousWinRate, in percentage points.
   */
  deltaPctPoints: number;
  recentWinRate: number; // 0 to 1
  previousWinRate: number; // 0 to 1
  recentMatches: number;
  previousMatches: number;
}

/**
 * High-level provenance + context to make insights auditable.
 */
export interface ReportEvidence {
  startTime: string;
  endTime: string;
  matchesAnalyzed: number;
  mapsPlayed: number;
  seriesIds: string[];
  winRateConfidence: Confidence;
  winRateTrend?: WinRateTrend;
}

export interface MapStats {
  mapName: string;
  matchesPlayed: number;
  winRate: number; // 0 to 1
}

export interface MapPlan {
  mapName: string;
  matchesPlayed: number;
  winRate: number; // 0 to 1
  /**
   * Map veto / selection counts when available from draft actions.
   */
  mapPickCount?: number;
  mapBanCount?: number;
  /**
   * Common compositions observed on this map (e.g., VAL agent comps).
   * Optional because the underlying feed may not provide draft/composition data.
   */
  commonCompositions?: CompositionStats[];
  /**
   * Whether round-by-round site data (A/B hits, etc.) was available to compute site tendencies.
   */
  siteTendenciesAvailable?: boolean;
}

export interface PlayerMapPerformance {
  mapName: string;
  matchesPlayed: number;
  winRate: number; // 0 to 1
}

export interface PlayerClutchIndicator {
  /**
   * Best-effort, derived from “close matches” where the player appears.
   */
  closeMatchesPlayed: number;
  winRate: number; // 0 to 1
  rating: 'High' | 'Medium' | 'Low';
}

export interface PlayerDraftableStat {
  name: string;
  type: CompositionKind;
  pickCount: number;
  winRate: number; // 0 to 1
}

export interface PlayerTendency {
  playerId: string;
  playerName: string;
  matchesPlayed: number;
  winRate: number; // 0 to 1
  mapPerformance: PlayerMapPerformance[];
  /**
   * Best-effort: only available when draft actions attribute picks to a player.
   */
  topPicks?: PlayerDraftableStat[];
  /**
   * Conservative proxy for “clutch/high-impact”.
   */
  clutch?: PlayerClutchIndicator;
}

export interface RosterStability {
  confidence: 'High' | 'Medium' | 'Low';
  matchesConsidered: number;
  corePlayers: Player[];
  uniquePlayersSeen: number;
}

export interface DraftStats {
  heroOrMapName: string;
  pickCount: number;
  banCount: number;
  winRate: number;
}

export type CompositionKind = 'CHAMPION' | 'AGENT' | 'UNKNOWN';

export interface CompositionStats {
  kind: CompositionKind;
  members: string[];
  pickCount: number;
  winRate: number;
}
