import { normalizeTeam, normalizeMatch, normalizePlayer } from './data/normalizer.js';
import { GridTeam, GridMatch, GridPlayer } from './data/gridClient.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('Running Normalizer Tests...');

// Test Team Normalization
const rawTeam: GridTeam = { id: 't1', name: 'Astralis' };
const normalizedTeam = normalizeTeam(rawTeam);
assert(normalizedTeam.id === 't1', 'Team ID should match');
assert(normalizedTeam.name === 'Astralis', 'Team Name should match');
console.log('✅ Team Normalization');

// Test Player Normalization
const rawPlayer: GridPlayer = { id: 'p1', name: 'device' };
const normalizedPlayer = normalizePlayer(rawPlayer, 't1');
assert(normalizedPlayer.id === 'p1', 'Player ID should match');
assert(normalizedPlayer.name === 'device', 'Player Name should match');
assert(normalizedPlayer.teamId === 't1', 'Player TeamID should match');
console.log('✅ Player Normalization');

// Test Match Normalization
const rawMatch: GridMatch = {
  id: 'm1',
  seriesId: 's1',
  map: { name: 'Inferno' },
  teams: [
    { team: { id: 't1', name: 'Astralis' }, score: 16, win: true },
    { team: { id: 't2', name: 'NaVi' }, score: 14, win: false }
  ]
};
const normalizedMatch = normalizeMatch(rawMatch, '2023-01-01T12:00:00Z');
assert(normalizedMatch.id === 'm1', 'Match ID should match');
assert(normalizedMatch.mapName === 'Inferno', 'Map name should match');
assert(normalizedMatch.teams.length === 2, 'Should have 2 teams');
assert(normalizedMatch.teams[0].teamName === 'Astralis', 'First team name should match');
assert(normalizedMatch.teams[0].isWinner === true, 'First team win status should match');
assert(normalizedMatch.startTime === '2023-01-01T12:00:00Z', 'Start time should match');
console.log('✅ Match Normalization');

console.log('All tests passed! 🚀');
