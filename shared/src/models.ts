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
