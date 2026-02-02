import { GridTeam, GridMatch, GridSeriesTeam, GridPlayer } from './gridClient.js';
import { Team, Match, TeamResult, Player } from '@scoutmaster-3000/shared';

/**
 * Normalizes a raw GRID Player into our domain Player model.
 */
export function normalizePlayer(gridPlayer: GridPlayer, teamId: string): Player {
  return {
    id: gridPlayer.id,
    name: gridPlayer.name,
    teamId,
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
 * Normalizes a raw GRID Match into our domain Match model.
 */
export function normalizeMatch(gridMatch: GridMatch, startTime?: string): Match {
  return {
    id: gridMatch.id,
    seriesId: gridMatch.seriesId,
    startTime: startTime || new Date().toISOString(),
    mapName: gridMatch.map?.name || 'Unknown',
    teams: gridMatch.teams.map(normalizeTeamResult),
  };
}

/**
 * Normalizes a raw GRID Series Team (which includes results) into our domain TeamResult model.
 */
export function normalizeTeamResult(gst: GridSeriesTeam): TeamResult {
  return {
    teamId: gst.team.id,
    teamName: gst.team.name,
    score: gst.score,
    isWinner: gst.win,
  };
}

// Since GRID responses often group things differently, 
// we can add more specific normalization helpers as needed.
