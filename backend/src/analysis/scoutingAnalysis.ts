import {
  Match,
  MapStats,
  Player,
  StrategicInsight,
  PlayerTendency,
  PlayerMapPerformance,
  PlayerDraftableStat,
  RosterStability,
} from '@scoutmaster-3000/shared';

/**
 * Helper to find a team in a match by ID or Name.
 */
function findTeam(match: Match, teamRef: string) {
  return match.teams.find(t => 
    t.teamId === teamRef || t.teamName.toLowerCase() === teamRef.toLowerCase()
  );
}

/**
 * Calculates the overall win rate for a team.
 */
export function calculateWinRate(matches: Match[], teamRef: string): number {
  if (matches.length === 0) return 0;
  const wins = matches.filter(m => {
    const team = findTeam(m, teamRef);
    return team?.isWinner;
  }).length;
  return Math.round((wins / matches.length) * 100);
}

/**
 * Aggregates statistics per map.
 */
export function calculateMapStats(matches: Match[], teamRef: string): MapStats[] {
  const mapData: Record<string, { played: number; wins: number }> = {};
  
  matches.forEach(m => {
    const mapName = m.mapName;
    if (!mapData[mapName]) mapData[mapName] = { played: 0, wins: 0 };
    mapData[mapName].played++;
    const team = findTeam(m, teamRef);
    if (team?.isWinner) mapData[mapName].wins++;
  });

  return Object.entries(mapData).map(([mapName, stats]) => ({
    mapName,
    matchesPlayed: stats.played,
    winRate: stats.played > 0 ? stats.wins / stats.played : 0,
  })).sort((a, b) => b.matchesPlayed - a.matchesPlayed);
}

/**
 * Calculates the average score per match.
 */
export function calculateAverageScore(matches: Match[], teamRef: string): number {
  if (matches.length === 0) return 0;
  const totalScore = matches.reduce((acc, m) => {
    const team = findTeam(m, teamRef);
    return acc + (team?.score || 0);
  }, 0);
  return Math.round(totalScore / matches.length);
}

/**
 * Identifies the roster based on the most recent match.
 */
export function identifyRecentRoster(matches: Match[], teamRef: string): Player[] {
  if (matches.length === 0) return [];
  // Use the most recent match to find the active roster
  const latestMatch = [...matches].sort((a, b) => 
    new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  )[0];
  
  const team = findTeam(latestMatch, teamRef);
  return team?.players || [];
}

/**
 * Estimates roster stability and returns a confidence score.
 *
 * This is best-effort because the feed may omit players for some matches.
 */
export function calculateRosterStability(matches: Match[], teamRef: string, maxMatches: number = 10): RosterStability | undefined {
  if (matches.length === 0) return undefined;

  const recent = [...matches]
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, maxMatches);

  let matchesConsidered = 0;
  const rosterSizes: number[] = [];
  const appearances: Record<string, { player: Player; count: number }> = {};

  for (const m of recent) {
    const team = findTeam(m, teamRef);
    const players = team?.players;
    if (!players || players.length === 0) continue;

    matchesConsidered++;
    rosterSizes.push(players.length);
    for (const p of players) {
      if (!appearances[p.id]) appearances[p.id] = { player: p, count: 0 };
      appearances[p.id].count++;
      // Keep latest name/teamId if they changed
      appearances[p.id].player = p;
    }
  }

  if (matchesConsidered === 0) return undefined;

  const threshold = Math.ceil(matchesConsidered * 0.8);
  const corePlayers = Object.values(appearances)
    .filter(a => a.count >= threshold)
    .map(a => a.player)
    .sort((a, b) => a.name.localeCompare(b.name));

  const uniquePlayersSeen = Object.keys(appearances).length;

  const typicalRosterSize = rosterSizes.length > 0 ? Math.max(...rosterSizes) : corePlayers.length;

  let confidence: 'High' | 'Medium' | 'Low' = 'Low';
  // Heuristic:
  // - High when we have enough samples and very low churn (unique players close to typical roster size)
  // - Medium when we have a few samples and churn is still low
  if (matchesConsidered >= 5 && uniquePlayersSeen <= typicalRosterSize + 1) confidence = 'High';
  else if (matchesConsidered >= 3 && uniquePlayersSeen <= typicalRosterSize + 1) confidence = 'Medium';

  return {
    confidence,
    matchesConsidered,
    corePlayers,
    uniquePlayersSeen,
  };
}

/**
 * Aggregates per-player tendencies from match participation.
 *
 * Notes:
 * - Without per-player performance stats, this uses map win rates as a proxy.
 * - If `draftPicksByPlayerId` is provided, includes best-effort pick tendencies.
 */
export function calculatePlayerTendencies(
  matches: Match[],
  teamRef: string,
  draftPicksByPlayerId?: Record<string, PlayerDraftableStat[]>
): PlayerTendency[] {
  const byPlayer: Record<
    string,
    {
      playerName: string;
      matchesPlayed: number;
      wins: number;
      closeMatchesPlayed: number;
      closeWins: number;
      byMap: Record<string, { played: number; wins: number }>;
    }
  > = {};

  const isCloseMatch = (a: number, b: number) => {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    const maxScore = Math.max(a, b);
    const threshold = maxScore <= 5 ? 1 : 2;
    return Math.abs(a - b) <= threshold;
  };

  for (const m of matches) {
    const team = findTeam(m, teamRef);
    const players = team?.players;
    if (!players || players.length === 0) continue;

    const won = !!team?.isWinner;
    const opponent = m.teams.find(t => t.teamId !== team.teamId);
    const close = opponent ? isCloseMatch(team.score, opponent.score) : false;
    for (const p of players) {
      if (!byPlayer[p.id]) {
        byPlayer[p.id] = {
          playerName: p.name,
          matchesPlayed: 0,
          wins: 0,
          closeMatchesPlayed: 0,
          closeWins: 0,
          byMap: {}
        };
      }
      byPlayer[p.id].playerName = p.name;
      byPlayer[p.id].matchesPlayed++;
      if (won) byPlayer[p.id].wins++;

      if (close) {
        byPlayer[p.id].closeMatchesPlayed++;
        if (won) byPlayer[p.id].closeWins++;
      }

      const mapName = m.mapName || 'Unknown';
      if (!byPlayer[p.id].byMap[mapName]) byPlayer[p.id].byMap[mapName] = { played: 0, wins: 0 };
      byPlayer[p.id].byMap[mapName].played++;
      if (won) byPlayer[p.id].byMap[mapName].wins++;
    }
  }

  const toMapPerf = (byMap: Record<string, { played: number; wins: number }>): PlayerMapPerformance[] => {
    return Object.entries(byMap)
      .map(([mapName, s]) => ({
        mapName,
        matchesPlayed: s.played,
        winRate: s.played > 0 ? s.wins / s.played : 0,
      }))
      .sort((a, b) => b.matchesPlayed - a.matchesPlayed);
  };

  return Object.entries(byPlayer)
    .map(([playerId, v]) => {
      const closeWinRate = v.closeMatchesPlayed > 0 ? v.closeWins / v.closeMatchesPlayed : 0;
      const clutch = v.closeMatchesPlayed >= 2 ? {
        closeMatchesPlayed: v.closeMatchesPlayed,
        winRate: closeWinRate,
        rating:
          (v.closeMatchesPlayed >= 3 && closeWinRate >= 0.66) ? 'High'
            : (closeWinRate >= 0.5 ? 'Medium' : 'Low')
      } as const : undefined;

      return {
        playerId,
        playerName: v.playerName,
        matchesPlayed: v.matchesPlayed,
        winRate: v.matchesPlayed > 0 ? v.wins / v.matchesPlayed : 0,
        mapPerformance: toMapPerf(v.byMap),
        topPicks: draftPicksByPlayerId?.[playerId]?.slice(0, 5),
        clutch,
      };
    })
    .sort((a, b) => b.matchesPlayed - a.matchesPlayed);
}

/**
 * Detects aggression profile based on average scores.
 */
export function calculateAggressionProfile(matches: Match[], teamRef: string): 'High' | 'Medium' | 'Low' {
  const avgScore = calculateAverageScore(matches, teamRef);
  // Arbitrary thresholds for demo purposes
  if (avgScore > 12) return 'High';
  if (avgScore > 8) return 'Medium';
  return 'Low';
}

/**
 * Generates high-level insights from match data.
 */
export function generateScoutingInsights(matches: Match[], teamRef: string): string[] {
  if (matches.length === 0) return ['No recent matches found for this team.'];

  const winRate = calculateWinRate(matches, teamRef);
  const mapStats = calculateMapStats(matches, teamRef);
  const aggression = calculateAggressionProfile(matches, teamRef);
  const roster = identifyRecentRoster(matches, teamRef);
  
  const insights: string[] = [
    `Performance: ${winRate}% win rate over the last ${matches.length} matches.`,
    `Aggression: Displays a ${aggression.toLowerCase()} aggression profile based on scoring patterns.`,
  ];

  if (mapStats.length > 0) {
    const favoriteMap = mapStats[0];
    insights.push(`Map Specialist: Particularly active on ${favoriteMap.mapName} with a ${Math.round(favoriteMap.winRate * 100)}% success rate.`);
  }

  if (roster.length > 0) {
    insights.push(`Roster: Core lineup features ${roster.slice(0, 2).map(p => p.name).join(' and ')}.`);
  }

  return insights;
}

/**
 * Generates strategic "How to Win" recommendations using a rule-based engine.
 */
export function generateHowToWin(matches: Match[], teamRef: string): StrategicInsight[] {
  if (matches.length === 0) return [{ insight: 'Gather more data', evidence: '0 matches found' }];

  const mapStats = calculateMapStats(matches, teamRef);
  const winRate = calculateWinRate(matches, teamRef);
  const aggression = calculateAggressionProfile(matches, teamRef);
  
  const candidates: (StrategicInsight & { impact: number })[] = [];

  // Rule 1: Map Pool Weaknesses (High Impact)
  const weakMaps = mapStats.filter(m => m.winRate < 0.4 && m.matchesPlayed >= 1);
  weakMaps.forEach(map => {
    candidates.push({
      insight: `Force the series to ${map.mapName}`,
      evidence: `Opponent has a ${Math.round(map.winRate * 100)}% win rate on this map over ${map.matchesPlayed} games`,
      impact: 90 - (map.winRate * 100) // Lower win rate = higher impact
    });
  });

  // Rule 2: Exploit Recent Momentum (Medium-High Impact)
  if (winRate < 40) {
    candidates.push({
      insight: "Aggressive early-game pressure",
      evidence: `Opponent is on a cold streak with only ${winRate}% total win rate`,
      impact: 80 - winRate
    });
  } else if (winRate > 70) {
    candidates.push({
      insight: "Disrupt their rhythm with early timeouts",
      evidence: `Opponent has high confidence with a ${winRate}% win rate`,
      impact: 60 // Lower impact because it's a strength-based counter
    });
  }

  // Rule 3: Playstyle Counter (Medium Impact)
  if (aggression === 'High') {
    candidates.push({
      insight: "Prioritize defensive utility and spacing",
      evidence: `Opponent averages ${calculateAverageScore(matches, teamRef)} points per game, indicating high aggression`,
      impact: 70
    });
  } else if (aggression === 'Low') {
    candidates.push({
      insight: "Initiate fast-paced executes",
      evidence: `Opponent plays a slow game (avg ${calculateAverageScore(matches, teamRef)} pts), making them vulnerable to speed`,
      impact: 75
    });
  }

  // Rule 4: Map Pool Breadth (Medium Impact)
  if (mapStats.length < 3 && matches.length >= 3) {
    candidates.push({
      insight: "Punish narrow map pool",
      evidence: `Opponent has only shown comfort on ${mapStats.length} maps in their last ${matches.length} series`,
      impact: 65
    });
  }

  // Rule 5: Scarcity of recent games (Low Impact)
  if (matches.length < 3) {
    candidates.push({
      insight: "Prepare for unknown strategies",
      evidence: `Only ${matches.length} recent matches available for analysis`,
      impact: 30
    });
  }

  // Sort by impact and return top 3-5
  return candidates
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 5)
    .map(({ insight, evidence }) => ({ insight, evidence }));
}

/**
 * Matchup-aware recommendations (our team vs opponent).
 *
 * This intentionally uses only metrics we can reliably compute from the current normalized feed:
 * - map win rates and sample sizes
 * - coarse aggression profile
 */
export function generateHowToWinMatchup(
  ourMatches: Match[],
  ourTeamRef: string,
  opponentMatches: Match[],
  opponentTeamRef: string
): StrategicInsight[] {
  if (ourMatches.length === 0 || opponentMatches.length === 0) return [];

  const ourMapStats = calculateMapStats(ourMatches, ourTeamRef);
  const oppMapStats = calculateMapStats(opponentMatches, opponentTeamRef);

  const ourByMap: Record<string, MapStats> = {};
  for (const s of ourMapStats) ourByMap[s.mapName] = s;

  const oppByMap: Record<string, MapStats> = {};
  for (const s of oppMapStats) oppByMap[s.mapName] = s;

  const sharedMaps = Object.keys(ourByMap).filter(m => !!oppByMap[m]);
  const candidates: (StrategicInsight & { score: number })[] = [];

  const sampleConfidence = (n: number): 'High' | 'Medium' | 'Low' => {
    if (n >= 4) return 'High';
    if (n >= 2) return 'Medium';
    return 'Low';
  };

  // Rule 1: Pick maps where we have a clear advantage AND we both have at least some sample.
  for (const mapName of sharedMaps) {
    const us = ourByMap[mapName];
    const them = oppByMap[mapName];
    const minSample = Math.min(us.matchesPlayed, them.matchesPlayed);
    if (minSample < 1) continue;

    const advantage = us.winRate - them.winRate;
    const absAdv = Math.abs(advantage);

    const confidence = sampleConfidence(minSample);

    // Prefer bigger deltas with better sample sizes.
    const score = (absAdv * 100) + (minSample * 4) - (confidence === 'Low' ? 6 : 0);

    if (advantage >= 0.15) {
      candidates.push({
        insight: `Prioritize ${mapName} in the veto/pick phase`,
        evidence: `Your recent win rate: ${Math.round(us.winRate * 100)}% (${us.matchesPlayed} games) vs opponent: ${Math.round(them.winRate * 100)}% (${them.matchesPlayed} games) • Confidence: ${confidence}`,
        score,
      });
    } else if (advantage <= -0.15) {
      candidates.push({
        insight: `Avoid ${mapName} unless you have a prepared counter-plan`,
        evidence: `Opponent is stronger here: ${Math.round(them.winRate * 100)}% (${them.matchesPlayed} games) vs your ${Math.round(us.winRate * 100)}% (${us.matchesPlayed} games) • Confidence: ${confidence}`,
        score: score - 2,
      });
    }
  }

  // Rule 1b: If there are no shared maps in the recent sample, recommend steering toward our comfort maps
  // and avoiding their comfort maps.
  // (This can happen when teams have disjoint map pools or limited samples.)
  if (sharedMaps.length === 0) {
    const ourOnly = ourMapStats
      .filter(s => !oppByMap[s.mapName])
      .sort((a, b) => (b.matchesPlayed - a.matchesPlayed) || (b.winRate - a.winRate));

    const oppOnly = oppMapStats
      .filter(s => !ourByMap[s.mapName])
      .sort((a, b) => (b.matchesPlayed - a.matchesPlayed) || (b.winRate - a.winRate));

    const ourTarget = ourOnly.find(m => m.matchesPlayed >= 2) || ourOnly[0];
    if (ourTarget) {
      candidates.push({
        insight: `Steer the series toward ${ourTarget.mapName} (their untested map in this sample)`,
        evidence: `You have ${Math.round(ourTarget.winRate * 100)}% win rate over ${ourTarget.matchesPlayed} game(s) • Opponent has 0 recent games recorded here`,
        score: 58 + (ourTarget.matchesPlayed * 3) + (ourTarget.winRate * 15),
      });
    }

    const oppThreat = oppOnly.find(m => m.matchesPlayed >= 2) || oppOnly[0];
    if (oppThreat) {
      candidates.push({
        insight: `Avoid ${oppThreat.mapName} (opponent comfort map; no recent games for you in this sample)`,
        evidence: `Opponent has ${Math.round(oppThreat.winRate * 100)}% win rate over ${oppThreat.matchesPlayed} game(s) • You have 0 recent games recorded here`,
        score: 55 + (oppThreat.matchesPlayed * 3) + (oppThreat.winRate * 10),
      });
    }
  }

  // Rule 2: Aggression mismatch (coarse).
  const ourAggression = calculateAggressionProfile(ourMatches, ourTeamRef);
  const oppAggression = calculateAggressionProfile(opponentMatches, opponentTeamRef);
  if (oppAggression === 'High' && ourAggression !== 'High') {
    candidates.push({
      insight: 'Plan anti-rush rounds and punish over-aggression',
      evidence: `Opponent shows high aggression (avg score proxy). Your profile: ${ourAggression.toLowerCase()} aggression`,
      score: 55,
    });
  } else if (ourAggression === 'High' && oppAggression !== 'High') {
    candidates.push({
      insight: 'Increase tempo and pressure early to deny slow setups',
      evidence: `Your profile: high aggression vs opponent: ${oppAggression.toLowerCase()} aggression`,
      score: 52,
    });
  }

  // Rule 3: If opponent map pool looks narrow relative to ours, recommend widening the series.
  if (oppMapStats.length > 0 && ourMapStats.length > 0 && oppMapStats.length <= 2 && ourMapStats.length >= 4) {
    candidates.push({
      insight: 'Extend the series: lean into maps they rarely play',
      evidence: `Opponent has shown results on only ${oppMapStats.length} map(s) recently vs your ${ourMapStats.length}`,
      score: 45,
    });
  }

  if (candidates.length === 0) {
    candidates.push({
      insight: 'Default to comfort and preparation: pick your best maps and pre-plan counters for theirs',
      evidence: `Recent sample size — you: ${ourMatches.length} matches, opponent: ${opponentMatches.length} matches`,
      score: 10,
    });
  }

  // Return top 3–5 unique insights.
  const seen = new Set<string>();
  return candidates
    .sort((a, b) => b.score - a.score)
    .filter(c => {
      if (seen.has(c.insight)) return false;
      seen.add(c.insight);
      return true;
    })
    .slice(0, 5)
    .map(({ insight, evidence }) => ({ insight, evidence }));
}
