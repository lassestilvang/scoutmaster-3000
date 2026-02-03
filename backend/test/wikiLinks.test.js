import test from 'node:test';
import assert from 'node:assert/strict';

import { getMapWikiUrl } from '@scoutmaster-3000/shared';

test('getMapWikiUrl returns direct VALORANT map links for known maps', () => {
  assert.equal(getMapWikiUrl('VALORANT', 'Ascent'), 'https://valorant.fandom.com/wiki/Ascent');
  assert.equal(getMapWikiUrl('VALORANT', 'Icebox'), 'https://valorant.fandom.com/wiki/Icebox');
});

test('getMapWikiUrl returns direct LoL map links for known maps', () => {
  assert.equal(
    getMapWikiUrl('LOL', "Summoner's Rift"),
    'https://leagueoflegends.fandom.com/wiki/Summoner%27s_Rift'
  );
  assert.equal(getMapWikiUrl('LOL', 'Howling Abyss'), 'https://leagueoflegends.fandom.com/wiki/Howling_Abyss');
});

test('getMapWikiUrl falls back to Special:Search for unknown maps', () => {
  assert.equal(
    getMapWikiUrl('VALORANT', 'NotARealMap'),
    'https://valorant.fandom.com/wiki/Special:Search?query=NotARealMap'
  );
  assert.equal(
    getMapWikiUrl('LOL', 'NotARealMap'),
    'https://leagueoflegends.fandom.com/wiki/Special:Search?query=NotARealMap'
  );
});
