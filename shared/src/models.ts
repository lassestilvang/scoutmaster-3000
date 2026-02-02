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

export interface MapStats {
  mapName: string;
  matchesPlayed: number;
  winRate: number; // 0 to 1
}

export interface DraftStats {
  heroOrMapName: string;
  pickCount: number;
  banCount: number;
  winRate: number;
}
