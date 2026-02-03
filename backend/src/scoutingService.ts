import { gridGraphqlClient } from './data/gridGraphqlClient.js';
import {
  normalizeCompositionStats,
  normalizeDraftStats,
  normalizeMapPlans,
  normalizePlayerDraftPicks,
  normalizeSeriesState,
} from './data/normalizer.js';
import { ScoutingReport, Match } from '@scoutmaster-3000/shared';
import {
  calculateWinRate, 
  generateScoutingInsights, 
  generateHowToWin,
  generateHowToWinMatchup,
  calculateMapStats,
  identifyRecentRoster,
  calculateRosterStability,
  calculatePlayerTendencies,
  calculateAggressionProfile,
  calculateAverageScore,
  calculateWinRateTrend
} from './analysis/scoutingAnalysis.js';

function buildReportEvidence(matches: Match[], teamRef: string): ScoutingReport['evidence'] {
  const matchesAnalyzed = matches.length;
  const mapsPlayed = new Set(matches.map(m => m.mapName || 'Unknown')).size;
  const seriesIds = [...new Set(matches.map(m => m.seriesId).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  const times = matches
    .map(m => new Date(m.startTime).getTime())
    .filter(t => Number.isFinite(t));

  const startTime = times.length > 0 ? new Date(Math.min(...times)).toISOString() : new Date().toISOString();
  const endTime = times.length > 0 ? new Date(Math.max(...times)).toISOString() : new Date().toISOString();

  const winRateConfidence = matchesAnalyzed >= 8 ? 'High' : matchesAnalyzed >= 4 ? 'Medium' : 'Low';
  const winRateTrend = calculateWinRateTrend(matches, teamRef);

  return {
    startTime,
    endTime,
    matchesAnalyzed,
    mapsPlayed,
    seriesIds,
    winRateConfidence,
    winRateTrend,
  };
}

/**
 * Shared internal logic to generate a scouting report from normalized matches.
 */
async function generateReport(
  matches: Match[],
  teamRef: string,
  fallbackName: string,
  extras?: Pick<ScoutingReport, 'draftStats' | 'compositions' | 'mapPlans' | 'rosterStability' | 'playerTendencies'>,
  ourTeamName?: string,
  game?: 'LOL' | 'VALORANT'
): Promise<ScoutingReport> {
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
  const evidence = buildReportEvidence(matches, teamRef);
  const insights = generateScoutingInsights(matches, teamRef);
  const howToWin = generateHowToWin(matches, teamRef);
  const topMaps = calculateMapStats(matches, teamRef);
  const roster = identifyRecentRoster(matches, teamRef);
  const rosterStability = extras?.rosterStability ?? calculateRosterStability(matches, teamRef);
  const playerTendencies = extras?.playerTendencies;
  const aggression = calculateAggressionProfile(matches, teamRef);
  const avgScore = calculateAverageScore(matches, teamRef);

  return {
    ourTeamName,
    opponentName: actualName,
    game,
    winProbability,
    evidence,
    keyInsights: insights,
    howToWin: howToWin,
    topMaps,
    mapPlans: extras?.mapPlans,
    roster,
    rosterStability,
    playerTendencies,
    aggression,
    avgScore,
    matchesAnalyzed: matches.length,
    draftStats: extras?.draftStats,
    compositions: extras?.compositions,
    isMockData: false,
  };
}

export async function generateScoutingReportByName(teamName: string, limit: number = 10, game?: 'LOL' | 'VALORANT'): Promise<ScoutingReport> {
  try {
    // 1. Find the team ID (optionally filter by game)
    const teams = await gridGraphqlClient.findTeamsByName(teamName, 1, game);
    if (teams.length === 0) {
      console.error(`Error generating scouting report from real data, falling back to mock: Team "${teamName}" not found in GRID Central Data.`);
      return generateMockReport(teamName, game);
    }

    const teamId = teams[0].id;
    const actualTeamName = teams[0].name;

    // 2. Get full series states
    const seriesStates = await gridGraphqlClient.getFullSeriesByTeam(teamId, limit);
    
    // 3. Normalize and generate report
    const allMatches: Match[] = seriesStates.flatMap(normalizeSeriesState);
    const draftStats = normalizeDraftStats(seriesStates, teamId);
    const compositions = normalizeCompositionStats(seriesStates, teamId);
    const mapPlans = normalizeMapPlans(seriesStates, teamId);
    const playerDraftPicks = normalizePlayerDraftPicks(seriesStates, teamId);
    const playerTendencies = calculatePlayerTendencies(allMatches, teamId, playerDraftPicks);
    const rosterStability = calculateRosterStability(allMatches, teamId);
    return generateReport(
      allMatches,
      teamId,
      actualTeamName,
      { draftStats, compositions, mapPlans, playerTendencies, rosterStability },
      undefined,
      game
    );
  } catch (error) {
    console.error('Error generating scouting report from real data, falling back to mock:', (error as any).message);
    // If we have a real team name, use it in the mock report
    return generateMockReport(teamName, game);
  }
}

export async function generateScoutingReportById(teamId: string, limit: number = 10): Promise<ScoutingReport> {
  try {
    // Get full series states
    const seriesStates = await gridGraphqlClient.getFullSeriesByTeam(teamId, limit);
    
    // Normalize and generate report
    const allMatches: Match[] = seriesStates.flatMap(normalizeSeriesState);
    const draftStats = normalizeDraftStats(seriesStates, teamId);
    const compositions = normalizeCompositionStats(seriesStates, teamId);
    const mapPlans = normalizeMapPlans(seriesStates, teamId);
    const playerDraftPicks = normalizePlayerDraftPicks(seriesStates, teamId);
    const playerTendencies = calculatePlayerTendencies(allMatches, teamId, playerDraftPicks);
    const rosterStability = calculateRosterStability(allMatches, teamId);
    return generateReport(
      allMatches,
      teamId,
      `Team ${teamId}`,
      { draftStats, compositions, mapPlans, playerTendencies, rosterStability }
    );
  } catch (error) {
    console.error(`Error generating report for teamId ${teamId}, falling back to mock:`, (error as any).message);
    return generateMockReport(`Team ${teamId}`);
  }
}

export async function generateMatchupScoutingReportByName(
  ourTeamName: string,
  opponentTeamName: string,
  limit: number = 10,
  game?: 'LOL' | 'VALORANT'
): Promise<ScoutingReport> {
  try {
    const [ourTeams, opponentTeams] = await Promise.all([
      gridGraphqlClient.findTeamsByName(ourTeamName, 1, game),
      gridGraphqlClient.findTeamsByName(opponentTeamName, 1, game),
    ]);

    if (ourTeams.length === 0 || opponentTeams.length === 0) {
      console.error('Matchup report falling back to mock: could not resolve both teams in GRID Central Data.');
      return generateMockReport(opponentTeamName, game, ourTeamName);
    }

    const ourId = ourTeams[0].id;
    const ourActualName = ourTeams[0].name;
    const opponentId = opponentTeams[0].id;
    const opponentActualName = opponentTeams[0].name;

    const [ourSeriesStates, opponentSeriesStates] = await Promise.all([
      gridGraphqlClient.getFullSeriesByTeam(ourId, limit),
      gridGraphqlClient.getFullSeriesByTeam(opponentId, limit),
    ]);

    const opponentMatches: Match[] = opponentSeriesStates.flatMap(normalizeSeriesState);
    const ourMatches: Match[] = ourSeriesStates.flatMap(normalizeSeriesState);

    const draftStats = normalizeDraftStats(opponentSeriesStates, opponentId);
    const compositions = normalizeCompositionStats(opponentSeriesStates, opponentId);
    const mapPlans = normalizeMapPlans(opponentSeriesStates, opponentId);
    const playerDraftPicks = normalizePlayerDraftPicks(opponentSeriesStates, opponentId);
    const playerTendencies = calculatePlayerTendencies(opponentMatches, opponentId, playerDraftPicks);
    const rosterStability = calculateRosterStability(opponentMatches, opponentId);

    // Override “How to Win” with matchup-aware recommendations.
    const matchupHowToWin = generateHowToWinMatchup(ourMatches, ourId, opponentMatches, opponentId);

    const report = await generateReport(
      opponentMatches,
      opponentId,
      opponentActualName,
      { draftStats, compositions, mapPlans, playerTendencies, rosterStability },
      ourActualName,
      game
    );

    report.howToWin = matchupHowToWin.length > 0 ? matchupHowToWin : report.howToWin;
    return report;
  } catch (error) {
    console.error('Error generating matchup scouting report from real data, falling back to mock:', (error as any).message);
    return generateMockReport(opponentTeamName, game, ourTeamName);
  }
}

/**
 * Generates a mock report for demo/fallback purposes.
 */
function generateMockReport(teamName: string, game?: 'LOL' | 'VALORANT', ourTeamName?: string): ScoutingReport {
  // Simple mock data for demo
  const roster = [
    { id: 'p1', name: 'MockPlayer1', teamId: 'mock' },
    { id: 'p2', name: 'MockPlayer2', teamId: 'mock' }
  ];

  const now = Date.now();
  const evidence: ScoutingReport['evidence'] = {
    startTime: new Date(now - (14 * 24 * 60 * 60 * 1000)).toISOString(),
    endTime: new Date(now).toISOString(),
    matchesAnalyzed: 10,
    mapsPlayed: 2,
    seriesIds: Array.from({ length: 10 }, (_, i) => `mock-series-${i + 1}`),
    winRateConfidence: 'Medium',
  };

  const howToWin = ourTeamName
    ? [
        {
          insight: 'Prioritize your comfort maps and force their weakest looks',
          evidence: 'Mock mode: matchup recommendations are illustrative when real series data is unavailable',
        },
        {
          insight: 'Match their tempo: prepare anti-rush and anti-default round plans',
          evidence: 'Mock mode: use this as a checklist until real aggression data can be fetched',
        },
        {
          insight: 'Draft denial: ban their most-picked comfort and target their off-maps',
          evidence: 'Mock mode: draft stats shown are example values (not live GRID data)',
        },
      ]
    : [
        { insight: 'Prioritize defensive utility', evidence: 'Opponent averages 14 points per game' },
        { insight: 'Force the series to Overpass', evidence: 'Opponent has 30% win rate on this map' },
      ];

  return {
    ourTeamName,
    opponentName: teamName,
    game,
    winProbability: 65,
    evidence,
    keyInsights: [
      `Aggression: Displays a high aggression profile based on scoring patterns.`,
      `Map Specialist: Particularly active on Mirage with a 75% success rate.`
    ],
    howToWin,
    topMaps: [
      { mapName: 'Mirage', matchesPlayed: 8, winRate: 0.75 },
      { mapName: 'Inferno', matchesPlayed: 5, winRate: 0.60 }
    ],
    mapPlans: game === 'VALORANT' ? [
      {
        mapName: 'Ascent',
        matchesPlayed: 6,
        winRate: 0.67,
        siteTendenciesAvailable: false,
        commonCompositions: [
          { kind: 'AGENT', members: ['Jett', 'Omen', 'Sova', 'Killjoy', 'Skye'], pickCount: 4, winRate: 0.75 },
          { kind: 'AGENT', members: ['Raze', 'Brimstone', 'Sova', 'Cypher', 'Fade'], pickCount: 2, winRate: 0.50 },
        ],
      },
    ] : undefined,
    roster,
    rosterStability: {
      confidence: 'High',
      matchesConsidered: 8,
      corePlayers: roster,
      uniquePlayersSeen: 2,
    },
    playerTendencies: [
      {
        playerId: 'p1',
        playerName: 'MockPlayer1',
        matchesPlayed: 8,
        winRate: 0.63,
        mapPerformance: [
          { mapName: 'Ascent', matchesPlayed: 4, winRate: 0.75 },
          { mapName: 'Bind', matchesPlayed: 2, winRate: 0.5 },
        ],
        topPicks: [
          { name: 'Jett', type: 'AGENT', pickCount: 5, winRate: 0.6 },
          { name: 'Sova', type: 'AGENT', pickCount: 3, winRate: 0.67 },
        ]
      },
      {
        playerId: 'p2',
        playerName: 'MockPlayer2',
        matchesPlayed: 8,
        winRate: 0.63,
        mapPerformance: [
          { mapName: 'Ascent', matchesPlayed: 4, winRate: 0.75 },
          { mapName: 'Bind', matchesPlayed: 2, winRate: 0.5 },
        ],
        topPicks: [
          { name: 'Omen', type: 'AGENT', pickCount: 4, winRate: 0.5 },
          { name: 'Killjoy', type: 'AGENT', pickCount: 3, winRate: 0.67 },
        ]
      },
    ],
    aggression: 'High',
    avgScore: 14,
    matchesAnalyzed: 10,
    draftStats: [
      { heroOrMapName: 'Jett', pickCount: 6, banCount: 1, winRate: 0.67 },
      { heroOrMapName: 'Sova', pickCount: 5, banCount: 0, winRate: 0.60 },
      { heroOrMapName: 'Ascent', pickCount: 0, banCount: 2, winRate: 0 },
    ],
    compositions: [
      { kind: 'AGENT', members: ['Jett', 'Omen', 'Sova', 'Killjoy', 'Skye'], pickCount: 4, winRate: 0.75 },
      { kind: 'AGENT', members: ['Raze', 'Brimstone', 'Sova', 'Cypher', 'Fade'], pickCount: 2, winRate: 0.50 },
    ],
    isMockData: true,
  };
}

export async function searchTeams(query: string, game?: 'LOL' | 'VALORANT'): Promise<Array<{ id: string, name: string }>> {
  try {
    return await gridGraphqlClient.findTeamsByName(query, 10, game);
  } catch (error) {
    console.error('Error searching for teams:', error);
    return [];
  }
}

// Deprecated: use generateScoutingReportByName instead
export async function generateScoutingReport(teamName: string): Promise<ScoutingReport> {
  return generateScoutingReportByName(teamName, 5);
}
