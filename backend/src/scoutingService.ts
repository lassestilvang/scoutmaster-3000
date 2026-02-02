import { gridGraphqlClient } from './data/gridGraphqlClient.js';
import { normalizeSeriesState } from './data/normalizer.js';
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
    isMockData: false,
  };
}

export async function generateScoutingReportByName(teamName: string, limit: number = 10): Promise<ScoutingReport> {
  try {
    // 1. Find the team ID
    const teams = await gridGraphqlClient.findTeamsByName(teamName, 1);
    if (teams.length === 0) {
      throw new Error(`Team "${teamName}" not found in GRID Central Data.`);
    }

    const teamId = teams[0].id;
    const actualTeamName = teams[0].name;

    // 2. Get full series states
    const seriesStates = await gridGraphqlClient.getFullSeriesByTeam(teamId, limit);
    
    // 3. Normalize and generate report
    const allMatches: Match[] = seriesStates.flatMap(normalizeSeriesState);
    return generateReport(allMatches, teamId, actualTeamName);
  } catch (error) {
    console.error('Error generating scouting report from real data, falling back to mock:', (error as any).message);
    // If we have a real team name, use it in the mock report
    return generateMockReport(teamName);
  }
}

export async function generateScoutingReportById(teamId: string, limit: number = 10): Promise<ScoutingReport> {
  try {
    // Get full series states
    const seriesStates = await gridGraphqlClient.getFullSeriesByTeam(teamId, limit);
    
    // Normalize and generate report
    const allMatches: Match[] = seriesStates.flatMap(normalizeSeriesState);
    return generateReport(allMatches, teamId, `Team ${teamId}`);
  } catch (error) {
    console.error(`Error generating report for teamId ${teamId}, falling back to mock:`, (error as any).message);
    return generateMockReport(`Team ${teamId}`);
  }
}

/**
 * Generates a mock report for demo/fallback purposes.
 */
function generateMockReport(teamName: string): ScoutingReport {
  // Simple mock data for demo
  return {
    opponentName: teamName,
    winProbability: 65,
    keyInsights: [
      `Aggression: Displays a high aggression profile based on scoring patterns.`,
      `Map Specialist: Particularly active on Mirage with a 75% success rate.`
    ],
    howToWin: [
      { insight: 'Prioritize defensive utility', evidence: 'Opponent averages 14 points per game' },
      { insight: 'Force the series to Overpass', evidence: 'Opponent has 30% win rate on this map' }
    ],
    topMaps: [
      { mapName: 'Mirage', matchesPlayed: 8, winRate: 0.75 },
      { mapName: 'Inferno', matchesPlayed: 5, winRate: 0.60 }
    ],
    roster: [
      { id: 'p1', name: 'MockPlayer1', teamId: 'mock' },
      { id: 'p2', name: 'MockPlayer2', teamId: 'mock' }
    ],
    aggression: 'High',
    avgScore: 14,
    matchesAnalyzed: 10,
    isMockData: true,
  };
}

// Deprecated: use generateScoutingReportByName instead
export async function generateScoutingReport(teamName: string): Promise<ScoutingReport> {
  return generateScoutingReportByName(teamName, 5);
}
