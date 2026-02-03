import { gridGraphqlClient } from './data/gridGraphqlClient.js';
import type { GridTeam } from './data/gridGraphqlClient.js';
import {
  normalizeCompositionStats,
  normalizeDraftStats,
  normalizeMapPlans,
  normalizePlayerDraftPicks,
  normalizeSeriesState,
} from './data/normalizer.js';
import type {
  Match,
  MatchupHowToWinTransparency,
  MatchupMapPoolDelta,
  MatchupTeamSnapshot,
  ScoutingReport,
} from '@scoutmaster-3000/shared';
import {
  calculateWinRate, 
  generateScoutingInsights, 
  generateHowToWin,
  generateHowToWinEngine,
  generateHowToWinMatchup,
  buildReportRawInputs,
  calculateMapStats,
  identifyRecentRoster,
  calculateRosterStability,
  calculatePlayerTendencies,
  calculateAggressionProfile,
  calculateAverageScore,
  calculateWinRateTrend,
  filterMatchesByTimeframe
} from './analysis/scoutingAnalysis.js';

const GRID_CENTRAL_DATA_ENDPOINT = 'https://api-op.grid.gg/central-data/graphql';
const GRID_SERIES_STATE_ENDPOINT = 'https://api-op.grid.gg/live-data-feed/series-state/graphql';

function buildReportDataSources(isMock: boolean): ScoutingReport['dataSources'] {
  const used = !isMock;
  const sources: ScoutingReport['dataSources'] = [
    {
      id: 'central-data',
      name: 'GRID Central Data (GraphQL)',
      endpoint: GRID_CENTRAL_DATA_ENDPOINT,
      purpose: 'Team search + recent series IDs (discovery layer)',
      used,
    },
    {
      id: 'series-state',
      name: 'GRID Series State (GraphQL)',
      endpoint: GRID_SERIES_STATE_ENDPOINT,
      purpose: 'Series results, per-map outcomes, players, and draft actions',
      used,
    },
  ];

  if (isMock) {
    sources.push({
      id: 'mock',
      name: 'Demo / Mock dataset',
      purpose: 'Used when GRID API is unavailable (missing key / rate limit / network) or team can’t be resolved',
      used: true,
    });
  }

  return sources;
}

class TeamNotFoundError extends Error {
  which: 'opponent' | 'our';
  query: string;
  suggestions: Array<{ id: string; name: string }>;

  constructor(which: 'opponent' | 'our', query: string, suggestions: Array<{ id: string; name: string }>) {
    super(`Team not found: ${query}`);
    this.name = 'TeamNotFoundError';
    this.which = which;
    this.query = query;
    this.suggestions = suggestions;
  }
}

export function isTeamNotFoundError(error: unknown): error is TeamNotFoundError {
  return error instanceof TeamNotFoundError;
}

function filterSeriesStatesByTimeframe(seriesStates: any[], timeframeDays?: number, now: number = Date.now()) {
  if (!timeframeDays || !Number.isFinite(timeframeDays) || timeframeDays <= 0) return seriesStates;
  const cutoff = now - timeframeDays * 24 * 60 * 60 * 1000;
  return seriesStates.filter(ss => {
    const t = new Date(ss?.startedAt || '').getTime();
    if (!Number.isFinite(t)) return true;
    return t >= cutoff;
  });
}

function normalizeQueryForSuggestions(query: string): string {
  return query
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickBestTeamMatch(teams: GridTeam[], query: string): GridTeam {
  if (teams.length === 0) {
    throw new Error('pickBestTeamMatch: empty teams list');
  }

  const q = query.trim().toLowerCase();
  const exact = teams.find(t => (t.name || '').trim().toLowerCase() === q);
  if (exact) return exact;

  const startsWith = teams.find(t => (t.name || '').toLowerCase().startsWith(q));
  if (startsWith) return startsWith;

  // Prefer shorter names when multiple contain the query.
  const contains = teams
    .filter(t => (t.name || '').toLowerCase().includes(q))
    .sort((a, b) => (a.name || '').length - (b.name || '').length);
  if (contains.length > 0) return contains[0];

  return teams[0];
}

async function suggestTeams(query: string, game?: 'LOL' | 'VALORANT'): Promise<Array<{ id: string; name: string }>> {
  const candidates: string[] = [];
  const normalized = normalizeQueryForSuggestions(query);
  if (normalized) candidates.push(normalized);

  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    candidates.push(parts[0]);
    candidates.push(parts.slice(0, 2).join(' '));
    candidates.push(parts[parts.length - 1]);
  }

  const seen = new Set<string>();
  const out: Array<{ id: string; name: string }> = [];
  for (const q of candidates) {
    if (!q || seen.has(q.toLowerCase())) continue;
    seen.add(q.toLowerCase());
    const results = await searchTeams(q, game);
    for (const r of results) {
      const key = r.id;
      if (out.find(x => x.id === key)) continue;
      out.push(r);
      if (out.length >= 10) return out;
    }
  }
  return out;
}

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
  const dataSources = buildReportDataSources(false);
  const rawInputs = buildReportRawInputs(matches, teamRef, 20);
  const insights = generateScoutingInsights(matches, teamRef);
  const howToWinEngine = generateHowToWinEngine(matches, teamRef);
  const howToWin = howToWinEngine.selected;
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
    dataSources,
    rawInputs,
    keyInsights: insights,
    howToWin: howToWin,
    howToWinEngine,
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

function buildTeamSnapshot(
  matches: Match[],
  teamRef: string,
  teamName: string
): MatchupTeamSnapshot {
  return {
    teamName,
    winRate: calculateWinRate(matches, teamRef),
    avgScore: calculateAverageScore(matches, teamRef),
    matchesAnalyzed: matches.length,
    evidence: buildReportEvidence(matches, teamRef),
    topMaps: calculateMapStats(matches, teamRef),
    aggression: calculateAggressionProfile(matches, teamRef),
    roster: identifyRecentRoster(matches, teamRef),
    rosterStability: calculateRosterStability(matches, teamRef),
  };
}

function buildMapPoolDeltas(our: MatchupTeamSnapshot, opponent: MatchupTeamSnapshot): MatchupMapPoolDelta[] {
  const ourByMap: Record<string, MatchupTeamSnapshot['topMaps'][number]> = {};
  for (const s of our.topMaps) ourByMap[s.mapName] = s;

  const oppByMap: Record<string, MatchupTeamSnapshot['topMaps'][number]> = {};
  for (const s of opponent.topMaps) oppByMap[s.mapName] = s;

  const shared = Object.keys(ourByMap).filter(m => !!oppByMap[m]);

  return shared
    .map(mapName => {
      const us = ourByMap[mapName];
      const them = oppByMap[mapName];
      return {
        mapName,
        our: us,
        opponent: them,
        deltaWinRate: us.winRate - them.winRate,
        minSample: Math.min(us.matchesPlayed, them.matchesPlayed),
      };
    })
    .sort((a, b) => (Math.abs(b.deltaWinRate) - Math.abs(a.deltaWinRate)) || (b.minSample - a.minSample))
    .slice(0, 8);
}

function buildMatchupHowToWinTransparency(
  ourMatches: Match[],
  opponentMatches: Match[],
  our: MatchupTeamSnapshot,
  opponent: MatchupTeamSnapshot
): MatchupHowToWinTransparency {
  const ourByMap = new Set(our.topMaps.map(s => s.mapName));
  const oppByMap = new Set(opponent.topMaps.map(s => s.mapName));
  const sharedMaps = [...ourByMap].filter(m => oppByMap.has(m)).length;

  return {
    kind: 'MatchupHeuristics',
    basedOn: {
      ourMatchesAnalyzed: ourMatches.length,
      opponentMatchesAnalyzed: opponentMatches.length,
      sharedMaps,
    },
    notes: [
      'Matchup tips are heuristic and derived from the current normalized feed (map win rates + sample sizes, coarse aggression profile, and map pool breadth).',
      'This is not a predictive win-probability model; treat recommendations as “what to prepare” rather than a guarantee.',
    ],
  };
}

/**
 * Public helper to build a matchup report from already-normalized matches.
 *
 * The top-level report remains opponent-centric for backwards compatibility, while `report.matchup`
 * provides a true two-sided snapshot + deltas.
 */
export async function generateMatchupReportFromMatches(
  ourMatches: Match[],
  ourTeamRef: string,
  ourTeamName: string,
  opponentMatches: Match[],
  opponentTeamRef: string,
  opponentTeamName: string,
  opponentExtras?: Pick<ScoutingReport, 'draftStats' | 'compositions' | 'mapPlans' | 'rosterStability' | 'playerTendencies'>,
  game?: 'LOL' | 'VALORANT'
): Promise<ScoutingReport> {
  const report = await generateReport(opponentMatches, opponentTeamRef, opponentTeamName, opponentExtras, ourTeamName, game);

  // Keep the opponent-only engine payload, but don’t attach it to `howToWinEngine` in matchup mode,
  // because `howToWin` tips will be overridden by matchup heuristics.
  const opponentHowToWinEngine = report.howToWinEngine;

  const matchupTips = generateHowToWinMatchup(ourMatches, ourTeamRef, opponentMatches, opponentTeamRef);
  if (matchupTips.length > 0) {
    report.howToWin = matchupTips;
  }
  report.howToWinEngine = undefined;

  const ourSnapshot = buildTeamSnapshot(ourMatches, ourTeamRef, ourTeamName);
  const opponentSnapshot: MatchupTeamSnapshot = {
    teamName: report.opponentName,
    winRate: report.winProbability,
    avgScore: report.avgScore,
    matchesAnalyzed: report.matchesAnalyzed,
    evidence: report.evidence,
    topMaps: report.topMaps,
    aggression: report.aggression,
    roster: report.roster,
    rosterStability: report.rosterStability,
  };

  report.matchup = {
    our: ourSnapshot,
    opponent: opponentSnapshot,
    deltas: {
      mapPool: buildMapPoolDeltas(ourSnapshot, opponentSnapshot),
      aggression: {
        our: ourSnapshot.aggression,
        opponent: opponentSnapshot.aggression,
        note:
          ourSnapshot.aggression === opponentSnapshot.aggression
            ? 'Teams have similar tempo based on the avg-score aggression proxy.'
            : `Aggression mismatch: ${ourSnapshot.teamName} is ${ourSnapshot.aggression.toLowerCase()} tempo vs ${opponentSnapshot.teamName} at ${opponentSnapshot.aggression.toLowerCase()} tempo.`,
      },
      rosterStability: {
        our: ourSnapshot.rosterStability,
        opponent: opponentSnapshot.rosterStability,
      },
    },
    howToWinTransparency: buildMatchupHowToWinTransparency(ourMatches, opponentMatches, ourSnapshot, opponentSnapshot),
    opponentHowToWinEngine,
  };

  return report;
}

/**
 * Public helper to build a report from already-normalized matches.
 *
 * This is used by tests (golden snapshots) and by any future code paths
 * that want to bypass GRID fetching.
 */
export async function generateReportFromMatches(
  matches: Match[],
  teamRef: string,
  fallbackName: string,
  extras?: Pick<ScoutingReport, 'draftStats' | 'compositions' | 'mapPlans' | 'rosterStability' | 'playerTendencies'>,
  ourTeamName?: string,
  game?: 'LOL' | 'VALORANT'
): Promise<ScoutingReport> {
  return generateReport(matches, teamRef, fallbackName, extras, ourTeamName, game);
}

export async function generateScoutingReportByName(
  teamName: string,
  limit: number = 10,
  game?: 'LOL' | 'VALORANT',
  timeframeDays?: number
): Promise<ScoutingReport> {
  try {
    // 1. Find the team ID (optionally filter by game)
    // Important: query multiple candidates, then pick the best match.
    // Querying only 1 and then filtering by game can produce false “not found” errors.
    const teams = await gridGraphqlClient.findTeamsByName(teamName, 10, game);
    if (teams.length === 0) {
      const suggestions = await suggestTeams(teamName, game);
      throw new TeamNotFoundError('opponent', teamName, suggestions);
    }

    const selected = pickBestTeamMatch(teams, teamName);
    const teamId = selected.id;
    const actualTeamName = selected.name;

    // 2. Get full series states
    const seriesStatesRaw = await gridGraphqlClient.getFullSeriesByTeam(teamId, limit);
    const seriesStates = filterSeriesStatesByTimeframe(seriesStatesRaw, timeframeDays);
    
    // 3. Normalize and generate report
    const allMatchesRaw: Match[] = seriesStates.flatMap(normalizeSeriesState);
    const allMatches: Match[] = filterMatchesByTimeframe(allMatchesRaw, timeframeDays);
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
    if (error instanceof TeamNotFoundError) {
      throw error;
    }

    const msg = (error as any)?.message || '';
    const missingKey = typeof msg === 'string' && msg.includes('GRID_API_KEY is missing');
    console.error('Error generating scouting report from real data, falling back to mock:', msg);
    return generateMockReport(teamName, game, undefined, {
      mockReason: missingKey ? 'MissingApiKey' : 'ApiError'
    });
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
  game?: 'LOL' | 'VALORANT',
  timeframeDays?: number
): Promise<ScoutingReport> {
  try {
    const [ourTeams, opponentTeams] = await Promise.all([
      gridGraphqlClient.findTeamsByName(ourTeamName, 10, game),
      gridGraphqlClient.findTeamsByName(opponentTeamName, 10, game),
    ]);

    if (ourTeams.length === 0 || opponentTeams.length === 0) {
      const which = ourTeams.length === 0 ? 'our' : 'opponent';
      const query = ourTeams.length === 0 ? ourTeamName : opponentTeamName;
      const suggestions = await suggestTeams(query, game);
      throw new TeamNotFoundError(which, query, suggestions);
    }

    const selectedOur = pickBestTeamMatch(ourTeams, ourTeamName);
    const selectedOpp = pickBestTeamMatch(opponentTeams, opponentTeamName);

    const ourId = selectedOur.id;
    const ourActualName = selectedOur.name;
    const opponentId = selectedOpp.id;
    const opponentActualName = selectedOpp.name;

    const [ourSeriesStatesRaw, opponentSeriesStatesRaw] = await Promise.all([
      gridGraphqlClient.getFullSeriesByTeam(ourId, limit),
      gridGraphqlClient.getFullSeriesByTeam(opponentId, limit),
    ]);

    const ourSeriesStates = filterSeriesStatesByTimeframe(ourSeriesStatesRaw, timeframeDays);
    const opponentSeriesStates = filterSeriesStatesByTimeframe(opponentSeriesStatesRaw, timeframeDays);

    const opponentMatchesRaw: Match[] = opponentSeriesStates.flatMap(normalizeSeriesState);
    const ourMatchesRaw: Match[] = ourSeriesStates.flatMap(normalizeSeriesState);

    const opponentMatches: Match[] = filterMatchesByTimeframe(opponentMatchesRaw, timeframeDays);
    const ourMatches: Match[] = filterMatchesByTimeframe(ourMatchesRaw, timeframeDays);

    const draftStats = normalizeDraftStats(opponentSeriesStates, opponentId);
    const compositions = normalizeCompositionStats(opponentSeriesStates, opponentId);
    const mapPlans = normalizeMapPlans(opponentSeriesStates, opponentId);
    const playerDraftPicks = normalizePlayerDraftPicks(opponentSeriesStates, opponentId);
    const playerTendencies = calculatePlayerTendencies(opponentMatches, opponentId, playerDraftPicks);
    const rosterStability = calculateRosterStability(opponentMatches, opponentId);

    return generateMatchupReportFromMatches(
      ourMatches,
      ourId,
      ourActualName,
      opponentMatches,
      opponentId,
      opponentActualName,
      { draftStats, compositions, mapPlans, playerTendencies, rosterStability },
      game
    );
  } catch (error) {
    if (error instanceof TeamNotFoundError) {
      throw error;
    }
    const msg = (error as any)?.message || '';
    const missingKey = typeof msg === 'string' && msg.includes('GRID_API_KEY is missing');
    console.error('Error generating matchup scouting report from real data, falling back to mock:', msg);
    return generateMockReport(opponentTeamName, game, ourTeamName, {
      mockReason: missingKey ? 'MissingApiKey' : 'ApiError'
    });
  }
}

/**
 * Generates a mock report for demo/fallback purposes.
 */
function generateMockReport(
  teamName: string,
  game?: 'LOL' | 'VALORANT',
  ourTeamName?: string,
  extras?: Pick<ScoutingReport, 'mockReason' | 'suggestedTeams'>
): ScoutingReport {
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

  const dataSources = buildReportDataSources(true);

  const mockTeamId = 'mock-team';
  const otherTeamId = 'other-team';
  const mockMatches: Match[] = Array.from({ length: 10 }, (_, i) => {
    const mapName = i % 2 === 0 ? 'Mirage' : 'Inferno';
    const won = i % 3 !== 0;
    const teamScore = won ? 13 : 9;
    const oppScore = won ? 9 : 13;
    return {
      id: `mock-match-${i + 1}`,
      seriesId: `mock-series-${i + 1}`,
      startTime: new Date(now - i * 24 * 60 * 60 * 1000).toISOString(),
      mapName,
      teams: [
        { teamId: mockTeamId, teamName, score: teamScore, isWinner: won, players: roster },
        { teamId: otherTeamId, teamName: 'Other', score: oppScore, isWinner: !won, players: [] },
      ],
    };
  });
  const rawInputs = buildReportRawInputs(mockMatches, mockTeamId, 20);

  const opponentOnlyHowToWin: ScoutingReport['howToWin'] = [
    { insight: 'Prioritize defensive utility', evidence: 'Opponent averages 14 points per game' },
    { insight: 'Force the series to Overpass', evidence: 'Opponent has 30% win rate on this map' },
  ];

  const matchupHowToWin: ScoutingReport['howToWin'] = [
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
  ];

  const howToWin = ourTeamName ? matchupHowToWin : opponentOnlyHowToWin;

  const opponentHowToWinEngine = {
    formula: 'impact = weaknessSeverity × exploitability × confidence',
    selected: opponentOnlyHowToWin,
    candidates: opponentOnlyHowToWin.map((t, i) => ({
      id: `mock:${i}`,
      rule: 'Mock',
      insight: t.insight,
      evidence: t.evidence,
      status: 'Selected',
      breakdown: {
        weaknessSeverity: 0.5,
        exploitability: 0.5,
        confidence: 'Low',
        confidenceFactor: 0.4,
        impact: 50 - i,
      },
    })),
  } satisfies NonNullable<ScoutingReport['howToWinEngine']>;

  const howToWinEngine: ScoutingReport['howToWinEngine'] = ourTeamName ? undefined : opponentHowToWinEngine;

  const topMaps: ScoutingReport['topMaps'] = [
    { mapName: 'Mirage', matchesPlayed: 8, winRate: 0.75 },
    { mapName: 'Inferno', matchesPlayed: 5, winRate: 0.60 }
  ];

  const rosterStability: NonNullable<ScoutingReport['rosterStability']> = {
    confidence: 'High',
    matchesConsidered: 8,
    corePlayers: roster,
    uniquePlayersSeen: 2,
  };

  const matchup: ScoutingReport['matchup'] = ourTeamName
    ? (() => {
        const opponentSnapshot: MatchupTeamSnapshot = {
          teamName,
          winRate: 65,
          avgScore: 14,
          matchesAnalyzed: 10,
          evidence,
          topMaps,
          aggression: 'High',
          roster,
          rosterStability,
        };

        const ourRoster = roster.map(p => ({ ...p, teamId: 'mock-our' }));
        const ourSnapshot: MatchupTeamSnapshot = {
          teamName: ourTeamName,
          winRate: 55,
          avgScore: 13,
          matchesAnalyzed: 10,
          evidence,
          topMaps: [
            { mapName: 'Mirage', matchesPlayed: 6, winRate: 0.55 },
            { mapName: 'Inferno', matchesPlayed: 4, winRate: 0.45 },
          ],
          aggression: 'Medium',
          roster: ourRoster,
          rosterStability: { ...rosterStability, confidence: 'Medium' },
        };

        return {
          our: ourSnapshot,
          opponent: opponentSnapshot,
          deltas: {
            mapPool: buildMapPoolDeltas(ourSnapshot, opponentSnapshot),
            aggression: {
              our: ourSnapshot.aggression,
              opponent: opponentSnapshot.aggression,
              note: 'Mock mode: aggression is illustrative.',
            },
            rosterStability: {
              our: ourSnapshot.rosterStability,
              opponent: opponentSnapshot.rosterStability,
              note: 'Mock mode: roster stability is illustrative.',
            },
          },
          howToWinTransparency: {
            kind: 'MatchupHeuristics',
            basedOn: { ourMatchesAnalyzed: 10, opponentMatchesAnalyzed: 10, sharedMaps: 2 },
            notes: [
              'Mock mode: matchup transparency is illustrative; real reports include data-driven sample sizes and shared-map detection.',
            ],
          } as MatchupHowToWinTransparency,
          opponentHowToWinEngine,
        };
      })()
    : undefined;

  return {
    ourTeamName,
    opponentName: teamName,
    game,
    winProbability: 65,
    evidence,
    dataSources,
    rawInputs,
    keyInsights: [
      `Aggression: Displays a high aggression profile based on scoring patterns.`,
      `Map Specialist: Particularly active on Mirage with a 75% success rate.`
    ],
    howToWin,
    howToWinEngine,
    matchup,
    topMaps,
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
    rosterStability,
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
    mockReason: extras?.mockReason,
    suggestedTeams: extras?.suggestedTeams,
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
