import { GridTeam, GridSeriesState, GridSeriesTeamState } from './gridGraphqlClient.js';
import { Team, Match, TeamResult, Player, DraftStats, CompositionStats, CompositionKind, MapPlan } from '@scoutmaster-3000/shared';

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

/**
 * Aggregates team composition stats from draft actions.
 * For LoL this is typically champion picks; for VALORANT this is typically agent picks.
 *
 * Notes:
 * - We build one composition per series per kind (CHAMPION/AGENT/UNKNOWN)
 * - We treat the series outcome as the win/loss label for the composition
 */
export function normalizeCompositionStats(seriesStates: GridSeriesState[], teamId: string): CompositionStats[] {
  const compMap: Record<string, { kind: CompositionKind; members: string[]; seriesCount: number; wins: number }> = {};

  const toKind = (t?: string): CompositionKind => {
    const upper = (t || '').toUpperCase();
    if (upper === 'CHAMPION') return 'CHAMPION';
    if (upper === 'AGENT') return 'AGENT';
    return 'UNKNOWN';
  };

  for (const ss of seriesStates) {
    const teamWon = ss.teams.find(t => t.id === teamId)?.won || false;
    const actions = ss.draftActions || [];

    const picksByKind: Record<CompositionKind, Set<string>> = {
      CHAMPION: new Set<string>(),
      AGENT: new Set<string>(),
      UNKNOWN: new Set<string>(),
    };

    for (const action of actions) {
      if (action.type !== 'PICK') continue;
      if (action.drafter?.id !== teamId) continue;
      const name = action.draftable?.name;
      if (!name) continue;

      const kind = toKind(action.draftable?.type);
      picksByKind[kind].add(name);
    }

    (Object.keys(picksByKind) as CompositionKind[]).forEach(kind => {
      const members = [...picksByKind[kind]].sort((a, b) => a.localeCompare(b));
      if (members.length === 0) return;

      const key = `${kind}:${members.join('|')}`;
      if (!compMap[key]) {
        compMap[key] = { kind, members, seriesCount: 0, wins: 0 };
      }
      compMap[key].seriesCount++;
      if (teamWon) compMap[key].wins++;
    });
  }

  return Object.values(compMap)
    .map(v => ({
      kind: v.kind,
      members: v.members,
      pickCount: v.seriesCount,
      winRate: v.seriesCount > 0 ? v.wins / v.seriesCount : 0,
    }))
    .sort((a, b) => b.pickCount - a.pickCount);
}

/**
 * Builds a per-map plan for a team.
 *
 * For VALORANT, this primarily surfaces "default" agent compositions per map.
 * Note: round-by-round site-level data (A/B hits, etc.) is not included in the
 * currently used GRID query, so `siteTendenciesAvailable` defaults to `false`.
 */
export function normalizeMapPlans(seriesStates: GridSeriesState[], teamId: string): MapPlan[] {
  const mapOutcomes: Record<string, { played: number; wins: number }> = {};
  const mapComps: Record<
    string,
    Record<string, { members: string[]; played: number; wins: number }>
  > = {};

  const toKind = (t?: string): CompositionKind => {
    const upper = (t || '').toUpperCase();
    if (upper === 'CHAMPION') return 'CHAMPION';
    if (upper === 'AGENT') return 'AGENT';
    return 'UNKNOWN';
  };

  for (const ss of seriesStates) {
    const actions = ss.draftActions || [];

    // Build a best-effort agent comp for the team in this series (if provided).
    const agentPicks = new Set<string>();
    for (const action of actions) {
      if (action.type !== 'PICK') continue;
      if (action.drafter?.id !== teamId) continue;
      const name = action.draftable?.name;
      if (!name) continue;
      if (toKind(action.draftable?.type) !== 'AGENT') continue;
      agentPicks.add(name);
    }
    const agentMembers = [...agentPicks].sort((a, b) => a.localeCompare(b));
    const agentKey = agentMembers.length > 0 ? `AGENT:${agentMembers.join('|')}` : null;

    for (const game of ss.games || []) {
      const mapName = game.map?.name || 'Unknown';
      const teamWonGame = game.teams.find(t => t.id === teamId)?.won || false;

      if (!mapOutcomes[mapName]) mapOutcomes[mapName] = { played: 0, wins: 0 };
      mapOutcomes[mapName].played++;
      if (teamWonGame) mapOutcomes[mapName].wins++;

      if (!agentKey) continue;
      if (!mapComps[mapName]) mapComps[mapName] = {};
      if (!mapComps[mapName][agentKey]) {
        mapComps[mapName][agentKey] = { members: agentMembers, played: 0, wins: 0 };
      }
      mapComps[mapName][agentKey].played++;
      if (teamWonGame) mapComps[mapName][agentKey].wins++;
    }
  }

  return Object.entries(mapOutcomes)
    .map(([mapName, o]): MapPlan => {
      const compsForMap = mapComps[mapName] || {};
      const commonCompositions: CompositionStats[] = Object.values(compsForMap)
        .map(c => ({
          kind: 'AGENT' as const,
          members: c.members,
          pickCount: c.played,
          winRate: c.played > 0 ? c.wins / c.played : 0,
        }))
        .sort((a, b) => b.pickCount - a.pickCount);

      return {
        mapName,
        matchesPlayed: o.played,
        winRate: o.played > 0 ? o.wins / o.played : 0,
        commonCompositions: commonCompositions.length > 0 ? commonCompositions : undefined,
        siteTendenciesAvailable: false,
      };
    })
    .sort((a, b) => b.matchesPlayed - a.matchesPlayed);
}

// Since GRID responses often group things differently, 
// we can add more specific normalization helpers as needed.
