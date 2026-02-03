import { normalizeGameParam } from './_lib/validation.js';

const HARD_CODED_DEMO_TEAMS = {
  VALORANT: [
    // Cloud9 Hackathon: keep Cloud9 first.
    { id: 'valorant:cloud9', name: 'Cloud9' },
    { id: 'valorant:sentinels', name: 'Sentinels' },
    { id: 'valorant:g2-esports', name: 'G2 Esports' },
    { id: 'valorant:evil-geniuses', name: 'Evil Geniuses' },
    { id: 'valorant:edward-gaming', name: 'EDward Gaming' },
    { id: 'valorant:team-heretics', name: 'Team Heretics' },
  ],
  LOL: [
    // Cloud9 Hackathon: keep Cloud9 Kia first.
    { id: 'lol:cloud9-kia', name: 'Cloud9 Kia' },
    { id: 'lol:fnatic', name: 'Fnatic' },
    { id: 'lol:g2-esports', name: 'G2 Esports' },
    { id: 'lol:t1', name: 'T1' },
    { id: 'lol:geng-esports', name: 'Gen.G Esports' },
  ],
};

export const config = {
  // Keep generous defaults for serverless environments.
  maxDuration: 60,
  memory: 1024,
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('allow', 'GET');
    return res.end();
  }

  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const gameParam = url.searchParams.get('game') || undefined;
  const gameEnum = normalizeGameParam(gameParam);

  const teams = gameEnum === 'VALORANT'
    ? HARD_CODED_DEMO_TEAMS.VALORANT
    : gameEnum === 'LOL'
      ? HARD_CODED_DEMO_TEAMS.LOL
      : [
        ...HARD_CODED_DEMO_TEAMS.VALORANT,
        ...HARD_CODED_DEMO_TEAMS.LOL,
      ];

  res.statusCode = 200;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  // This list is curated + hardcoded, so it is safe to cache for a while.
  res.setHeader('cache-control', 'public, max-age=3600');
  return res.end(JSON.stringify({ game: gameEnum || null, teams }));
}
