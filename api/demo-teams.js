import { normalizeGameParam } from './_lib/validation.js';

import {
  generateScoutingReportById,
  searchTeams,
} from '../backend/dist/backend/src/scoutingService.js';

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
  return `scoutmaster:demoTeams:v1:${gameEnum || 'any'}`;
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
  // Short mem cache to prevent repeated discovery bursts.
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

async function discoverDemoTeams(gameEnum) {
  // Seed queries designed to quickly find *some* teams for the selected game.
  // We validate each candidate by probing that it yields real matches (not mock mode).
  const seeds = ['a', 'e', 'i', 'o', 't', 'n', 's', 'r'];

  const candidates = [];
  const seen = new Set();

  for (const q of seeds) {
    const teams = await searchTeams(q, gameEnum);
    for (const t of teams) {
      if (!t || !t.id || !t.name) continue;
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      candidates.push(t);
      if (candidates.length >= 40) break;
    }
    if (candidates.length >= 40) break;
  }

  const out = [];
  const maxAttempts = 28;
  const perTeamSeriesLimit = 6;

  for (let i = 0; i < candidates.length && i < maxAttempts; i++) {
    const cand = candidates[i];
    try {
      const report = await generateScoutingReportById(cand.id, perTeamSeriesLimit);
      const matchesAnalyzed = typeof report?.matchesAnalyzed === 'number' ? report.matchesAnalyzed : 0;
      if (report && report.isMockData === false && matchesAnalyzed > 0) {
        out.push({ id: cand.id, name: report.opponentName || cand.name });
        if (out.length >= 8) break;
      }
    } catch {
      // Skip candidate.
    }
  }

  return out;
}

export const config = {
  // Discovery may do multiple upstream calls.
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
      return res.end(JSON.stringify({ game: gameEnum || null, teams: cached }));
    }

    const teams = await discoverDemoTeams(gameEnum);
    await writeCached(gameEnum, teams);

    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ game: gameEnum || null, teams }));
  } catch (error) {
    console.error('Error discovering demo teams:', (error && error.message) || error);
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    // Fail-open with empty list: guided demo will not show invalid teams.
    return res.end(JSON.stringify({ game: gameEnum || null, teams: [] }));
  }
}
