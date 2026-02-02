import { Match, MapStats, Player, StrategicInsight } from '@scoutmaster-3000/shared';

/**
 * Calculates the overall win rate for a team.
 */
export function calculateWinRate(matches: Match[], teamName: string): number {
  if (matches.length === 0) return 0;
  const wins = matches.filter(m => {
    const team = m.teams.find(t => t.teamName.toLowerCase() === teamName.toLowerCase());
    return team?.isWinner;
  }).length;
  return Math.round((wins / matches.length) * 100);
}

/**
 * Aggregates statistics per map.
 */
export function calculateMapStats(matches: Match[], teamName: string): MapStats[] {
  const mapData: Record<string, { played: number; wins: number }> = {};
  
  matches.forEach(m => {
    const mapName = m.mapName;
    if (!mapData[mapName]) mapData[mapName] = { played: 0, wins: 0 };
    mapData[mapName].played++;
    const team = m.teams.find(t => t.teamName.toLowerCase() === teamName.toLowerCase());
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
export function calculateAverageScore(matches: Match[], teamName: string): number {
  if (matches.length === 0) return 0;
  const totalScore = matches.reduce((acc, m) => {
    const team = m.teams.find(t => t.teamName.toLowerCase() === teamName.toLowerCase());
    return acc + (team?.score || 0);
  }, 0);
  return Math.round(totalScore / matches.length);
}

/**
 * Identifies the roster based on the most recent match.
 */
export function identifyRecentRoster(matches: Match[], teamName: string): Player[] {
  if (matches.length === 0) return [];
  // Use the most recent match to find the active roster
  const latestMatch = [...matches].sort((a, b) => 
    new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  )[0];
  
  const team = latestMatch.teams.find(t => t.teamName.toLowerCase() === teamName.toLowerCase());
  return team?.players || [];
}

/**
 * Detects aggression profile based on average scores.
 */
export function calculateAggressionProfile(matches: Match[], teamName: string): 'High' | 'Medium' | 'Low' {
  const avgScore = calculateAverageScore(matches, teamName);
  // Arbitrary thresholds for demo purposes
  if (avgScore > 12) return 'High';
  if (avgScore > 8) return 'Medium';
  return 'Low';
}

/**
 * Generates high-level insights from match data.
 */
export function generateScoutingInsights(matches: Match[], teamName: string): string[] {
  if (matches.length === 0) return ['No recent matches found for this team.'];

  const winRate = calculateWinRate(matches, teamName);
  const mapStats = calculateMapStats(matches, teamName);
  const aggression = calculateAggressionProfile(matches, teamName);
  const roster = identifyRecentRoster(matches, teamName);
  
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
export function generateHowToWin(matches: Match[], teamName: string): StrategicInsight[] {
  if (matches.length === 0) return [{ insight: 'Gather more data', evidence: '0 matches found' }];

  const mapStats = calculateMapStats(matches, teamName);
  const winRate = calculateWinRate(matches, teamName);
  const aggression = calculateAggressionProfile(matches, teamName);
  
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
      evidence: `Opponent averages ${calculateAverageScore(matches, teamName)} points per game, indicating high aggression`,
      impact: 70
    });
  } else if (aggression === 'Low') {
    candidates.push({
      insight: "Initiate fast-paced executes",
      evidence: `Opponent plays a slow game (avg ${calculateAverageScore(matches, teamName)} pts), making them vulnerable to speed`,
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
