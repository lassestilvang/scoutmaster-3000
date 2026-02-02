import { GridTeam, GridSeriesState, GridSeriesTeamState } from './gridGraphqlClient.js';
import { Team, Match, TeamResult, Player, DraftStats } from '@scoutmaster-3000/shared';

/**
 * Normalizes a raw GRID Series State into a list of Match models.
 */
export function normalizeSeriesState(gss: GridSeriesState): Match[] {
  if (!gss.games) return [];
  const startTime = gss.startedAt || new Date().toISOString();
  
  return gss.games.map(game => ({
    id: game.id,
    seriesId: gss.id,
    startTime,
    mapName: game.map?.name || 'Unknown',
    teams: game.teams.map(normalizeSeriesTeamState)
  }));
}

/**
 * Normalizes a raw GRID Series Team State into our domain TeamResult model.
 */
export function normalizeSeriesTeamState(gsts: GridSeriesTeamState): TeamResult {
  return {
    teamId: gsts.id,
    teamName: gsts.name,
    score: gsts.score,
    isWinner: gsts.won,
    players: gsts.players?.map(p => ({
      id: p.id,
      name: p.name,
      teamId: gsts.id
    }))
  };
}

/**
 * Normalizes a raw GRID Team into our domain Team model.
 */
export function normalizeTeam(gridTeam: GridTeam): Team {
  return {
    id: gridTeam.id,
    name: gridTeam.name,
  };
}

/**
 * Extracts draft statistics from a list of series states.
 * This aggregates picks and bans for maps or heroes.
 */
export function normalizeDraftStats(seriesStates: GridSeriesState[], teamId: string): DraftStats[] {
  const statsMap: Record<string, { picks: number; bans: number; wins: number; totalSeries: number }> = {};

  seriesStates.forEach(ss => {
    const teamWon = ss.teams.find(t => t.id === teamId)?.won || false;
    const actions = ss.draftActions || [];

    actions.forEach(action => {
      const isOurTeam = action.drafter?.id === teamId;
      if (!isOurTeam) return;

      const name = action.draftable?.name;
      if (!name) return;

      if (!statsMap[name]) {
        statsMap[name] = { picks: 0, bans: 0, wins: 0, totalSeries: 0 };
      }

      if (action.type === 'PICK') {
        statsMap[name].picks++;
        if (teamWon) statsMap[name].wins++;
      } else if (action.type === 'BAN') {
        statsMap[name].bans++;
      }
    });
  });

  return Object.entries(statsMap).map(([name, stats]) => ({
    heroOrMapName: name,
    pickCount: stats.picks,
    banCount: stats.bans,
    winRate: stats.picks > 0 ? stats.wins / stats.picks : 0
  })).sort((a, b) => (b.pickCount + b.banCount) - (a.pickCount + a.banCount));
}

// Since GRID responses often group things differently, 
// we can add more specific normalization helpers as needed.
