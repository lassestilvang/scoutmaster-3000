import { StrategicInsight, MapStats, Player } from './models.js';

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
  isMockData?: boolean;
}

export * from './models.js';
