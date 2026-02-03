import {
  Match,
  MapStats,
  Player,
  StrategicInsight,
  HowToWinEngineResult,
  HowToWinCandidate,
  PlayerTendency,
  PlayerMapPerformance,
  PlayerDraftableStat,
  RosterStability,
  Confidence,
  WinRateTrend,
  NormalizedMatchInput,
  ReportRawInputs,
} from '@scoutmaster-3000/shared';

function confidenceFromSampleSize(n: number): Confidence {
  if (n >= 8) return 'High';
  if (n >= 4) return 'Medium';
  return 'Low';
}

function formatTimeWindow(matches: Match[]): string {
  if (matches.length === 0) return 'no time window';
  const times = matches
    .map(m => new Date(m.startTime).getTime())
    .filter(t => Number.isFinite(t));
  if (times.length === 0) return 'unknown time window';
  const start = new Date(Math.min(...times)).toISOString().slice(0, 10);
  const end = new Date(Math.max(...times)).toISOString().slice(0, 10);
  return `${start} → ${end}`;
}

/**
 * Computes a simple win-rate trend by comparing the most recent `recentCount` matches
 * to the preceding `recentCount` matches.
 */
export function calculateWinRateTrend(
  matches: Match[],
  teamRef: string,
  recentCount: number = 5
): WinRateTrend | undefined {
  if (matches.length < 4) return undefined;
  const sorted = [...matches].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const recent = sorted.slice(0, recentCount);
  const previous = sorted.slice(recentCount, recentCount * 2);
  if (recent.length < 2 || previous.length < 2) return undefined;

  const winRate = (ms: Match[]) => {
    const wins = ms.filter(m => findTeam(m, teamRef)?.isWinner).length;
    return ms.length > 0 ? wins / ms.length : 0;
  };

  const recentWinRate = winRate(recent);
  const previousWinRate = winRate(previous);
  const delta = recentWinRate - previousWinRate;

  const direction: WinRateTrend['direction'] = delta >= 0.05 ? 'Up' : delta <= -0.05 ? 'Down' : 'Flat';

  return {
    direction,
    deltaPctPoints: Math.round(delta * 100),
    recentWinRate,
    previousWinRate,
    recentMatches: recent.length,
    previousMatches: previous.length,
  };
}

/**
 * Filters matches to a trailing time window of `timeframeDays` from `now`.
 *
 * Notes:
 * - If `timeframeDays` is undefined/null, returns the original array.
 * - If a match has an invalid/missing `startTime`, it is kept (best-effort).
 */
export function filterMatchesByTimeframe(
  matches: Match[],
  timeframeDays?: number,
  now: number = Date.now()
): Match[] {
  if (!timeframeDays || !Number.isFinite(timeframeDays) || timeframeDays <= 0) return matches;
  const cutoff = now - timeframeDays * 24 * 60 * 60 * 1000;
  return matches.filter(m => {
    const t = new Date(m.startTime).getTime();
    if (!Number.isFinite(t)) return true;
    return t >= cutoff;
  });
}

/**
 * Helper to find a team in a match by ID or Name.
 */
function findTeam(match: Match, teamRef: string) {
  return match.teams.find(t => 
    t.teamId === teamRef || t.teamName.toLowerCase() === teamRef.toLowerCase()
  );
}

/**
 * Produces a bounded, judge-friendly list of normalized matches used as inputs.
 *
 * This is intentionally a small slice (defaults to 20) to avoid huge dumps.
 */
export function buildReportRawInputs(
  matches: Match[],
  teamRef: string,
  maxMatches: number = 20
): ReportRawInputs {
  const max = (Number.isFinite(maxMatches) && maxMatches > 0) ? Math.floor(maxMatches) : 20;

  const sorted = [...matches].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  const slice = sorted.slice(0, max);

  const normalized: NormalizedMatchInput[] = slice.map(m => {
    const team = findTeam(m, teamRef);
    const opponent = team ? (m.teams.find(t => t.teamId !== team.teamId) || m.teams.find(t => t.teamName.toLowerCase() !== team.teamName.toLowerCase())) : undefined;

    const teamScore = team?.score;
    const opponentScore = opponent?.score;

    const result: NormalizedMatchInput['result'] =
      team?.isWinner === true ? 'W'
        : team?.isWinner === false ? 'L'
          : '?';

    return {
      matchId: m.id,
      seriesId: m.seriesId,
      startTime: m.startTime,
      mapName: m.mapName || 'Unknown',
      opponentName: opponent?.teamName || 'Unknown',
      teamScore: typeof teamScore === 'number' && Number.isFinite(teamScore) ? teamScore : 0,
      opponentScore: typeof opponentScore === 'number' && Number.isFinite(opponentScore) ? opponentScore : 0,
      result,
    };
  });

  return {
    kind: 'NormalizedMatches',
    totalMatches: matches.length,
    shownMatches: normalized.length,
    truncated: matches.length > normalized.length,
    matches: normalized,
  };
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
  const window = formatTimeWindow(matches);
  const confidence = confidenceFromSampleSize(matches.length);
  const trend = calculateWinRateTrend(matches, teamRef);
  
  const insights: string[] = [
    `Performance: ${winRate}% win rate over the last ${matches.length} matches (${window}) • Confidence: ${confidence}.`,
    `Aggression: Displays a ${aggression.toLowerCase()} aggression profile based on scoring patterns (${window}, n=${matches.length}).`,
  ];

  if (trend) {
    const arrow = trend.direction === 'Up' ? '↑' : trend.direction === 'Down' ? '↓' : '→';
    insights.push(
      `Trend: ${arrow} ${trend.direction} (${trend.deltaPctPoints >= 0 ? '+' : ''}${trend.deltaPctPoints}pp) comparing last ${trend.recentMatches} vs previous ${trend.previousMatches} matches.`
    );
  }

  if (mapStats.length > 0) {
    const favoriteMap = mapStats[0];
    insights.push(
      `Map Specialist: Particularly active on ${favoriteMap.mapName} with a ${Math.round(favoriteMap.winRate * 100)}% success rate (${favoriteMap.matchesPlayed} games in window).`
    );
  }

  if (roster.length > 0) {
    insights.push(`Roster: Core lineup features ${roster.slice(0, 2).map(p => p.name).join(' and ')} (most recent roster snapshot).`);
  }

  return insights;
}

/**
 * Generates strategic "How to Win" recommendations using a ranked, testable engine.
 */
function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function confidenceFactor(confidence: Confidence): number {
  if (confidence === 'High') return 1.0;
  if (confidence === 'Medium') return 0.7;
  return 0.4;
}

function scoreImpact(weaknessSeverity: number, exploitability: number, confidence: Confidence): number {
  const w = clamp01(weaknessSeverity);
  const e = clamp01(exploitability);
  const c = confidenceFactor(confidence);
  return Math.round(100 * w * e * c);
}

export function generateHowToWinEngine(matches: Match[], teamRef: string): HowToWinEngineResult {
  const formula = 'impact = weaknessSeverity × exploitability × confidence';

  if (matches.length === 0) {
    const breakdown = {
      weaknessSeverity: 1,
      exploitability: 0,
      confidence: 'Low' as const,
      confidenceFactor: confidenceFactor('Low'),
      impact: 0,
    };
    const fallback: HowToWinCandidate = {
      id: 'fallback:no-data',
      rule: 'Fallback',
      insight: 'Gather more data',
      evidence: '0 matches found',
      status: 'Selected',
      breakdown,
    };
    return { selected: [{ insight: fallback.insight, evidence: fallback.evidence }], candidates: [fallback], formula };
  }

  const mapStats = calculateMapStats(matches, teamRef);
  const winRate = calculateWinRate(matches, teamRef);
  const aggression = calculateAggressionProfile(matches, teamRef);
  const window = formatTimeWindow(matches);

  const candidates: HowToWinCandidate[] = [];

  // Rule 1: Map Pool Weaknesses
  // Guardrail: map recommendations with <3 games must be explicitly marked low confidence.
  const mapConfidence = (n: number): Confidence => (n >= 4 ? 'High' : n >= 3 ? 'Medium' : 'Low');
  const weakMaps = mapStats.filter(m => m.winRate < 0.45 && m.matchesPlayed >= 1);
  for (const map of weakMaps) {
    const confidence = mapConfidence(map.matchesPlayed);
    const impact = scoreImpact(
      1 - map.winRate,
      Math.min(1, map.matchesPlayed / 6),
      confidence
    );

    const lowSampleNote = map.matchesPlayed < 3 ? ' • Low confidence (n<3) — treat cautiously' : '';
    candidates.push({
      id: `map-weakness:${map.mapName}`,
      rule: 'Map weakness',
      insight: `Force the series to ${map.mapName}`,
      evidence: `Opponent has a ${Math.round(map.winRate * 100)}% win rate on this map over ${map.matchesPlayed} game(s) (${window}) • Confidence: ${confidence}${lowSampleNote}`,
      status: 'NotSelected',
      breakdown: {
        weaknessSeverity: clamp01(1 - map.winRate),
        exploitability: clamp01(map.matchesPlayed / 6),
        confidence,
        confidenceFactor: confidenceFactor(confidence),
        impact,
      },
    });
  }

  if (weakMaps.length === 0 && mapStats.length > 0 && matches.length >= 2) {
    const maxSample = Math.max(...mapStats.map(s => s.matchesPlayed));
    if (maxSample < 3) {
      const confidence: Confidence = 'Low';
      const impact = scoreImpact(0.35, 0.4, confidence);
      candidates.push({
        id: 'guardrail:map-sample',
        rule: 'Guardrail',
        insight: 'Treat map-pool conclusions cautiously',
        evidence: `No map has at least 3 games in the current window (${window}), so map-specific weaknesses are low confidence`,
        status: 'NotSelected',
        breakdown: {
          weaknessSeverity: 0.35,
          exploitability: 0.4,
          confidence,
          confidenceFactor: confidenceFactor(confidence),
          impact,
        },
      });
    }
  }

  // Rule 2: Recent Momentum
  const overallConf = confidenceFromSampleSize(matches.length);
  if (winRate < 40) {
    const weaknessSeverity = clamp01((40 - winRate) / 40);
    const exploitability = 0.8;
    const impact = scoreImpact(weaknessSeverity, exploitability, overallConf);
    candidates.push({
      id: 'momentum:cold',
      rule: 'Momentum',
      insight: 'Aggressive early-game pressure',
      evidence: `Opponent is on a cold streak with only ${winRate}% total win rate (${window}, n=${matches.length}) • Confidence: ${overallConf}`,
      status: 'NotSelected',
      breakdown: {
        weaknessSeverity,
        exploitability,
        confidence: overallConf,
        confidenceFactor: confidenceFactor(overallConf),
        impact,
      },
    });
  } else if (winRate > 70) {
    // Not a weakness, but still a coaching counter.
    const weaknessSeverity = 0.35;
    const exploitability = 0.6;
    const impact = scoreImpact(weaknessSeverity, exploitability, overallConf);
    candidates.push({
      id: 'momentum:hot',
      rule: 'Momentum',
      insight: 'Disrupt their rhythm with early timeouts',
      evidence: `Opponent has a ${winRate}% win rate (${window}, n=${matches.length}) • Confidence: ${overallConf}`,
      status: 'NotSelected',
      breakdown: {
        weaknessSeverity,
        exploitability,
        confidence: overallConf,
        confidenceFactor: confidenceFactor(overallConf),
        impact,
      },
    });
  }

  // Rule 3: Playstyle Counter
  if (aggression === 'High') {
    const weaknessSeverity = 0.6;
    const exploitability = 0.7;
    const impact = scoreImpact(weaknessSeverity, exploitability, overallConf);
    candidates.push({
      id: 'playstyle:high-aggression',
      rule: 'Playstyle',
      insight: 'Prioritize defensive utility and spacing',
      evidence: `Opponent averages ${calculateAverageScore(matches, teamRef)} points per game (${window}), indicating high aggression • Confidence: ${overallConf}`,
      status: 'NotSelected',
      breakdown: {
        weaknessSeverity,
        exploitability,
        confidence: overallConf,
        confidenceFactor: confidenceFactor(overallConf),
        impact,
      },
    });
  } else if (aggression === 'Low') {
    const weaknessSeverity = 0.6;
    const exploitability = 0.7;
    const impact = scoreImpact(weaknessSeverity, exploitability, overallConf);
    candidates.push({
      id: 'playstyle:low-aggression',
      rule: 'Playstyle',
      insight: 'Initiate fast-paced executes',
      evidence: `Opponent plays a slow game (avg ${calculateAverageScore(matches, teamRef)} pts) in window (${window}) • Confidence: ${overallConf}`,
      status: 'NotSelected',
      breakdown: {
        weaknessSeverity,
        exploitability,
        confidence: overallConf,
        confidenceFactor: confidenceFactor(overallConf),
        impact,
      },
    });
  }

  // Rule 4: Map Pool Breadth
  if (mapStats.length < 3 && matches.length >= 3) {
    const weaknessSeverity = 0.55;
    const exploitability = 0.7;
    const impact = scoreImpact(weaknessSeverity, exploitability, overallConf);
    candidates.push({
      id: 'map-pool:narrow',
      rule: 'Map pool',
      insight: 'Punish narrow map pool',
      evidence: `Opponent has only shown results on ${mapStats.length} map(s) in their last ${matches.length} matches (${window}) • Confidence: ${overallConf}`,
      status: 'NotSelected',
      breakdown: {
        weaknessSeverity,
        exploitability,
        confidence: overallConf,
        confidenceFactor: confidenceFactor(overallConf),
        impact,
      },
    });
  }

  // Rule 5: Scarcity of recent games
  if (matches.length < 3) {
    const confidence: Confidence = 'Low';
    const weaknessSeverity = 0.4;
    const exploitability = 0.6;
    const impact = scoreImpact(weaknessSeverity, exploitability, confidence);
    candidates.push({
      id: 'guardrail:scarce-data',
      rule: 'Guardrail',
      insight: 'Prepare for unknown strategies',
      evidence: `Only ${matches.length} recent matches available for analysis (${window}) • Confidence: Low`,
      status: 'NotSelected',
      breakdown: {
        weaknessSeverity,
        exploitability,
        confidence,
        confidenceFactor: confidenceFactor(confidence),
        impact,
      },
    });
  }

  if (candidates.length === 0) {
    const confidence: Confidence = 'Low';
    const weaknessSeverity = 0.35;
    const exploitability = 0.5;
    const impact = scoreImpact(weaknessSeverity, exploitability, confidence);
    candidates.push({
      id: 'fallback:default',
      rule: 'Fallback',
      insight: 'Default to fundamentals: prep your comfort and anti-strats for their best looks',
      evidence: `No high-signal weaknesses detected in the current window (${window}) • Confidence: Low`,
      status: 'NotSelected',
      breakdown: {
        weaknessSeverity,
        exploitability,
        confidence,
        confidenceFactor: confidenceFactor(confidence),
        impact,
      },
    });
  }

  const sorted = [...candidates].sort((a, b) => b.breakdown.impact - a.breakdown.impact);
  const selected = sorted.slice(0, 5);
  const selectedIds = new Set(selected.map(c => c.id));
  const cutoff = selected.length > 0 ? selected[selected.length - 1].breakdown.impact : 0;

  const withStatus: HowToWinCandidate[] = sorted.map(c => {
    const isSelected = selectedIds.has(c.id);
    const lowConf = c.breakdown.confidence === 'Low';
    const status: HowToWinCandidate['status'] = isSelected
      ? (lowConf ? 'LowConfidenceSelected' : 'Selected')
      : (lowConf ? 'LowConfidenceNotSelected' : 'NotSelected');

    const whyNotSelected = !isSelected
      ? `Lower impact score (${c.breakdown.impact}) than selected cutoff (${cutoff})`
      : undefined;

    return { ...c, status, whyNotSelected };
  });

  return {
    selected: selected.map(({ insight, evidence }) => ({ insight, evidence })),
    candidates: withStatus,
    formula,
  };
}

export function generateHowToWin(matches: Match[], teamRef: string): StrategicInsight[] {
  return generateHowToWinEngine(matches, teamRef).selected;
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
