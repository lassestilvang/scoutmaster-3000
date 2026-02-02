import { GridTeam, GridSeriesState, GridSeriesTeamState } from './gridGraphqlClient.js';
import { Team, Match, TeamResult, Player } from '@scoutmaster-3000/shared';

/**
 * Normalizes a raw GRID Series State into a list of Match models.
 */
export function normalizeSeriesState(gss: GridSeriesState): Match[] {
  if (!gss.games) return [];
  return gss.games.map(game => ({
    id: game.id,
    seriesId: gss.id,
    startTime: new Date().toISOString(), // We could fetch this from Central Data if needed
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

// Since GRID responses often group things differently, 
// we can add more specific normalization helpers as needed.
