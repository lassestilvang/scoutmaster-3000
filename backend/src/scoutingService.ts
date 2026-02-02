import { gridClient } from './data/gridClient.js';
import { normalizeSeries } from './data/normalizer.js';
import { ScoutingReport, Match } from '@scoutmaster-3000/shared';
import { 
  calculateWinRate, 
  generateScoutingInsights, 
  generateHowToWin,
  calculateMapStats,
  identifyRecentRoster,
  calculateAggressionProfile,
  calculateAverageScore
} from './analysis/scoutingAnalysis.js';

/**
 * Shared internal logic to generate a scouting report from normalized matches.
 */
async function generateReport(matches: Match[], teamRef: string, fallbackName: string): Promise<ScoutingReport> {
  // Try to find the actual team name from the matches if possible
  let actualName = fallbackName;
  for (const match of matches) {
    const team = match.teams.find(t => t.teamId === teamRef || t.teamName.toLowerCase() === teamRef.toLowerCase());
    if (team) {
      actualName = team.teamName;
      break;
    }
  }

  const winProbability = calculateWinRate(matches, teamRef);
  const insights = generateScoutingInsights(matches, teamRef);
  const howToWin = generateHowToWin(matches, teamRef);
  const topMaps = calculateMapStats(matches, teamRef);
  const roster = identifyRecentRoster(matches, teamRef);
  const aggression = calculateAggressionProfile(matches, teamRef);
  const avgScore = calculateAverageScore(matches, teamRef);

  return {
    opponentName: actualName,
    winProbability,
    keyInsights: insights,
    howToWin: howToWin,
    topMaps,
    roster,
    aggression,
    avgScore,
    matchesAnalyzed: matches.length,
  };
}

export async function generateScoutingReportByName(teamName: string, limit: number = 10): Promise<ScoutingReport> {
  const recentSeries = await gridClient.getTeamMatchesByName(teamName, limit);
  const allMatches: Match[] = recentSeries.flatMap(normalizeSeries);
  return generateReport(allMatches, teamName, teamName);
}

export async function generateScoutingReportById(teamId: string, limit: number = 10): Promise<ScoutingReport> {
  const recentSeries = await gridClient.getTeamMatches(teamId, limit);
  const allMatches: Match[] = recentSeries.flatMap(normalizeSeries);
  return generateReport(allMatches, teamId, `Team ${teamId}`);
}

// Deprecated: use generateScoutingReportByName instead
export async function generateScoutingReport(teamName: string): Promise<ScoutingReport> {
  return generateScoutingReportByName(teamName, 5);
}
