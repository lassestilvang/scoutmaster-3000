import { gridClient } from './data/gridClient.js';
import { normalizeSeries } from './data/normalizer.js';
import { ScoutingReport, Match } from '@scoutmaster-3000/shared';
import { 
  calculateWinRate, 
  generateScoutingInsights, 
  generateHowToWin 
} from './analysis/scoutingAnalysis.js';

export async function generateScoutingReport(teamName: string): Promise<ScoutingReport> {
  // Use the new gridClient methods
  const recentSeries = await gridClient.getTeamMatchesByName(teamName, 5);
  
  // Normalize all matches from the series
  const allMatches: Match[] = recentSeries.flatMap(normalizeSeries);
  
  // Use pure analysis functions to generate metrics and insights
  const winProbability = calculateWinRate(allMatches, teamName);
  const insights = generateScoutingInsights(allMatches, teamName);
  const howToWin = generateHowToWin(allMatches, teamName);

  return {
    opponentName: teamName,
    winProbability,
    keyInsights: insights,
    howToWin: howToWin,
  };
}
