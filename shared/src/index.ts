import { StrategicInsight, MapStats, Player, DraftStats, CompositionStats } from './models.js';

export interface ScoutingReport {
  opponentName: string;
  winProbability: number;
  keyInsights: string[];
  howToWin: StrategicInsight[];
  topMaps: MapStats[];
  roster: Player[];
  aggression: 'High' | 'Medium' | 'Low';
  avgScore: number;
  matchesAnalyzed: number;
  draftStats?: DraftStats[];
  compositions?: CompositionStats[];
  isMockData?: boolean;
}

export * from './models.js';
