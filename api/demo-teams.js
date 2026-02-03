import { normalizeGameParam } from './_lib/validation.js';

import {
  generateScoutingReportByName,
  isTeamNotFoundError,
} from '../backend/dist/backend/src/scoutingService.js';

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

// Cache validated demo teams so users can never pick an example that yields an empty report.
// - Memory cache: fast + avoids bursts
// - KV cache (Upstash/Vercel KV): persists across serverless invocations
let memCache = new Map();

function getKvEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return undefined;
  return { url, token };
}

async function getKv() {
  const env = getKvEnv();
  if (!env) return undefined;
  try {
    const { Redis } = await import('@upstash/redis');
    return new Redis({ url: env.url, token: env.token });
  } catch {
    return undefined;
  }
}

function kvKey(gameEnum) {
  // Bump version whenever validation logic or hard-coded inputs change.
  return `scoutmaster:demoTeams:v2:${gameEnum || 'any'}`;
}

async function readCached(gameEnum) {
  const k = kvKey(gameEnum);

  const mem = memCache.get(k);
  if (mem && mem.expiresAt > Date.now()) return mem.data;

  const kv = await getKv();
  if (!kv) return undefined;

  try {
    const raw = await kv.get(k);
    if (!raw) return undefined;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || !Array.isArray(parsed.teams)) return undefined;
    memCache.set(k, { data: parsed.teams, expiresAt: Date.now() + 60_000 });
    return parsed.teams;
  } catch {
    return undefined;
  }
}

async function writeCached(gameEnum, teams) {
  const k = kvKey(gameEnum);
  // Short mem cache to prevent repeated validation bursts.
  memCache.set(k, { data: teams, expiresAt: Date.now() + 5 * 60_000 });

  const kv = await getKv();
  if (!kv) return;

  try {
    // 24h cache.
    await kv.set(k, JSON.stringify({ teams }), { ex: 60 * 60 * 24 });
  } catch {
    // Best-effort.
  }
}

async function validateTeamsForGame(gameEnum) {
  const base = gameEnum === 'VALORANT'
    ? HARD_CODED_DEMO_TEAMS.VALORANT
    : HARD_CODED_DEMO_TEAMS.LOL;

  const out = [];
  const perTeamSeriesLimit = 6;

  for (const t of base) {
    try {
      const report = await generateScoutingReportByName(t.name, perTeamSeriesLimit, gameEnum);
      const matchesAnalyzed = typeof report?.matchesAnalyzed === 'number' ? report.matchesAnalyzed : 0;
      if (report && report.isMockData === false && matchesAnalyzed > 0) {
        out.push({ id: t.id, name: report.opponentName || t.name });
      }
    } catch (e) {
      if (isTeamNotFoundError(e)) {
        continue;
      }
      // Any other error: skip this team (fail-closed).
    }
  }

  return out;
}

export const config = {
  // Validation may do multiple upstream calls.
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

  try {
    const cached = await readCached(gameEnum);
    if (cached) {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.setHeader('cache-control', 'public, max-age=300');
      return res.end(JSON.stringify({ game: gameEnum || null, teams: cached }));
    }

    const teams = gameEnum === 'VALORANT' || gameEnum === 'LOL'
      ? await validateTeamsForGame(gameEnum)
      : [
        ...(await validateTeamsForGame('VALORANT')),
        ...(await validateTeamsForGame('LOL')),
      ];

    await writeCached(gameEnum, teams);

    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'public, max-age=300');
    return res.end(JSON.stringify({ game: gameEnum || null, teams }));
  } catch (error) {
    console.error('Error building demo teams list:', (error && error.message) || error);
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    // Fail-closed: guided demo should not show invalid teams.
    res.setHeader('cache-control', 'public, max-age=60');
    return res.end(JSON.stringify({ game: gameEnum || null, teams: [] }));
  }
}
