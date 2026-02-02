export interface StrategicInsight {
  insight: string;
  evidence: string;
}

export interface ScoutingReport {
  opponentName: string;
  winProbability: number;
  keyInsights: string[];
  howToWin: StrategicInsight[];
}

export * from './models.js';
