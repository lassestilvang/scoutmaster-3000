export interface ScoutingReport {
  opponentName: string;
  winProbability: number;
  keyInsights: string[];
  howToWin: string[];
}

export * from './models.js';
