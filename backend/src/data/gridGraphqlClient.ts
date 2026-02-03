import '../loadEnv.js';

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const CENTRAL_DATA_ENDPOINT = 'https://api-op.grid.gg/central-data/graphql';
const SERIES_STATE_ENDPOINT = 'https://api-op.grid.gg/live-data-feed/series-state/graphql';
const GRID_API_KEY = process.env.GRID_API_KEY;

/**
 * GRID GraphQL Schema Interfaces (Subset of used fields for api-op)
 */

export interface GridTeam {
  id: string;
  name: string;
  // Optional fields for title/game info when available
  title?: { code?: string; name?: string } | null;
  titles?: Array<{ code?: string; name?: string }> | null;
}

export interface GridSeriesBase {
  id: string;
  startTimeScheduled?: string;
}

export interface GridSeriesStateTeam {
  id: string;
  name: string;
  score: number;
  won: boolean;
  players?: Array<{ id: string; name: string }>;
}

export interface GridGameState {
  id: string;
  map?: {
    name: string;
  };
  teams: GridSeriesTeamState[];
}

export interface GridSeriesTeamState {
  id: string;
  name: string;
  score: number;
  won: boolean;
  players?: Array<{ id: string; name: string }>;
}

export interface GridSeriesState {
  id: string;
  finished: boolean;
  startedAt?: string;
  teams: GridSeriesTeamState[];
  games: Array<{
    id: string;
    map?: {
      name: string;
    };
    teams: GridSeriesTeamState[];
  }>;
  draftActions?: Array<{
    type: string;
    drafter?: {
      id: string;
    };
    draftable?: {
      name: string;
      type: string;
    };
  }>;
}

export interface GridGraphqlResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: any;
  }>;
}

export class GridRateLimitError extends Error {
  retryAfterMs?: number;

  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'GridRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export function isGridRateLimitError(err: unknown): err is GridRateLimitError {
  return err instanceof GridRateLimitError;
}

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Production-ready GRID GraphQL Client for Cloud9 Hackathon
 */
export class GridGraphqlClient {
  private apiKey: string;
  private cache: Map<string, { data: any; expiresAt: number }> = new Map();
  private defaultTtl: number = 5 * 60 * 1000; // 5 minutes cache by default

  private inflight: Map<string, Promise<any>> = new Map();
  private fetchImpl: FetchImpl;
  private cacheDir?: string;
  private enableDiskCache: boolean;
  private kvClientPromise?: Promise<any | undefined>;

  constructor(
    apiKey: string,
    opts?: {
      fetchImpl?: FetchImpl;
      cacheDir?: string;
      enableDiskCache?: boolean;
      ttlMs?: number;
    }
  ) {
    this.apiKey = apiKey;
    this.fetchImpl = opts?.fetchImpl ?? fetch;
    this.enableDiskCache = opts?.enableDiskCache ?? true;
    this.cacheDir = opts?.cacheDir;
    if (typeof opts?.ttlMs === 'number' && Number.isFinite(opts.ttlMs) && opts.ttlMs > 0) {
      this.defaultTtl = opts.ttlMs;
    }
  }

  /**
   * Helper for exponential backoff sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getEffectiveCacheDir(): string {
    // Default to a repo-local cache folder for fast repeated demos.
    // Users can override via constructor or env.
    const fromEnv = process.env.GRID_CACHE_DIR;
    const base = (this.cacheDir || fromEnv || path.join(process.cwd(), '.grid-cache')).trim();
    return base;
  }

  private cacheFilePath(cacheKey: string): string {
    const hash = crypto.createHash('sha256').update(cacheKey).digest('hex');
    return path.join(this.getEffectiveCacheDir(), `${hash}.json`);
  }

  private getKvEnv(): { url: string; token: string } | undefined {
    // Supports both Vercel KV integration env vars and Upstash env vars.
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return undefined;
    return { url, token };
  }

  private async getKvClient(): Promise<any | undefined> {
    if (this.kvClientPromise) return this.kvClientPromise;

    const env = this.getKvEnv();
    if (!env) {
      this.kvClientPromise = Promise.resolve(undefined);
      return this.kvClientPromise;
    }

    this.kvClientPromise = (async () => {
      try {
        const { Redis } = await import('@upstash/redis');
        return new Redis({ url: env.url, token: env.token });
      } catch {
        return undefined;
      }
    })();

    return this.kvClientPromise;
  }

  private kvCacheKey(cacheKey: string): string {
    // Stable, hashed key to avoid huge Redis keys and allow schema changes via version bump.
    const hash = crypto.createHash('sha256').update(cacheKey).digest('hex');
    return `grid:gql:v1:${hash}`;
  }

  private async readKvCache<T>(cacheKey: string): Promise<{ data: T; expiresAt: number } | undefined> {
    const kv = await this.getKvClient();
    if (!kv) return undefined;

    try {
      const raw = await kv.get(this.kvCacheKey(cacheKey));
      if (!raw) return undefined;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!parsed || typeof parsed.expiresAt !== 'number') return undefined;
      if (parsed.expiresAt <= Date.now()) return undefined;
      return { data: parsed.data as T, expiresAt: parsed.expiresAt };
    } catch {
      return undefined;
    }
  }

  private async writeKvCache(cacheKey: string, data: unknown, expiresAt: number): Promise<void> {
    const kv = await this.getKvClient();
    if (!kv) return;

    try {
      const ttlMs = Math.max(1, expiresAt - Date.now());
      const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
      await kv.set(this.kvCacheKey(cacheKey), JSON.stringify({ expiresAt, data }), { ex: ttlSeconds });
    } catch {
      // Best-effort; KV cache should never break the request path.
    }
  }

  private async readDiskCache<T>(cacheKey: string): Promise<{ data: T; expiresAt: number } | undefined> {
    if (!this.enableDiskCache) return undefined;

    const filePath = this.cacheFilePath(cacheKey);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as { expiresAt: number; data: T };
      if (!parsed || typeof parsed.expiresAt !== 'number') return undefined;
      if (parsed.expiresAt <= Date.now()) return undefined;
      return { data: parsed.data, expiresAt: parsed.expiresAt };
    } catch {
      return undefined;
    }
  }

  private async writeDiskCache(cacheKey: string, data: unknown, expiresAt: number): Promise<void> {
    if (!this.enableDiskCache) return;

    const dir = this.getEffectiveCacheDir();
    const filePath = this.cacheFilePath(cacheKey);
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify({ expiresAt, data }), 'utf8');
    } catch {
      // Best-effort; disk cache should never break the request path.
    }
  }

  /**
   * Generic GraphQL query executor with caching and retry logic
   */
  private async executeQuery<T>(endpoint: string, query: string, variables: Record<string, any> = {}): Promise<T> {
    if (!this.apiKey) {
      throw new Error('GRID_API_KEY is missing. Please set it in your environment variables.');
    }

    const cacheKey = JSON.stringify({ endpoint, query, variables });
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const kvCached = await this.readKvCache<T>(cacheKey);
    if (kvCached !== undefined) {
      this.cache.set(cacheKey, { data: kvCached.data, expiresAt: kvCached.expiresAt });
      return kvCached.data;
    }

    const diskCached = await this.readDiskCache<T>(cacheKey);
    if (diskCached !== undefined) {
      this.cache.set(cacheKey, { data: diskCached.data, expiresAt: diskCached.expiresAt });
      return diskCached.data;
    }

    const inflight = this.inflight.get(cacheKey);
    if (inflight) {
      return inflight as Promise<T>;
    }

    const p = (async () => {
      let lastError: Error | null = null;
      let delay = 500; // Starting delay for backoff: 500ms
      const maxRetries = 3;
      let lastRetryAfterMs: number | undefined;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await this.fetchImpl(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': this.apiKey,
            },
            body: JSON.stringify({ query, variables }),
          });

          // Handle Rate Limiting (HTTP 429)
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const parsed = retryAfter ? parseInt(retryAfter, 10) : NaN;
            const waitTime = Number.isFinite(parsed) ? parsed * 1000 : delay;
            lastRetryAfterMs = waitTime;

            if (attempt < maxRetries) {
              console.warn(`GRID API rate limit hit (429). Retrying in ${waitTime}ms... (Attempt ${attempt + 1}/${maxRetries})`);
              await this.sleep(waitTime);
              delay *= 2; // Exponential backoff
              continue;
            }

            throw new GridRateLimitError('GRID API rate limit exceeded (429).', lastRetryAfterMs);
          }

          if (!response.ok) {
            const errorTextRaw = await response.text();
            const errorText = errorTextRaw.length > 500 ? `${errorTextRaw.slice(0, 500)}…` : errorTextRaw;
            // Retry on 5xx server errors
            if (response.status >= 500 && attempt < maxRetries) {
              console.warn(`GRID API server error (${response.status}). Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
              await this.sleep(delay);
              delay *= 2;
              continue;
            }
            throw new Error(`GRID API HTTP error: ${response.status} - ${errorText}`);
          }

          const result = (await response.json()) as GridGraphqlResponse<T>;

          if (result.errors && result.errors.length > 0) {
            const messages = result.errors.map((e) => e.message).join(', ');
            throw new Error(`GRID GraphQL Error: ${messages}`);
          }

          if (!result.data) {
            throw new Error('GRID API returned no data.');
          }

          const expiresAt = Date.now() + this.defaultTtl;
          // Cache successful response
          this.cache.set(cacheKey, {
            data: result.data,
            expiresAt,
          });
          await Promise.all([
            this.writeDiskCache(cacheKey, result.data, expiresAt),
            this.writeKvCache(cacheKey, result.data, expiresAt),
          ]);

          return result.data;
        } catch (error: any) {
          lastError = error;
          // If it's not a retryable error, or we're out of attempts, throw
          if (attempt === maxRetries) {
            break;
          }

          // Handle network errors (Fetch throws on network failure)
          if (error?.name === 'TypeError' || (typeof error?.message === 'string' && error.message.toLowerCase().includes('network'))) {
            console.warn(`GRID API network error. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
            await this.sleep(delay);
            delay *= 2;
            continue;
          }

          throw error;
        }
      }

      throw lastError || new Error('Failed to execute GRID query after multiple retries.');
    })();

    this.inflight.set(cacheKey, p);
    try {
      return await p;
    } finally {
      this.inflight.delete(cacheKey);
    }
  }

  /**
   * Search for teams by name using Central Data
   */
  async findTeamsByName(name: string, limit: number = 5, game?: 'LOL' | 'VALORANT'): Promise<GridTeam[]> {
    // Request potential title fields to enable filtering by game if supported by API
    const query = `
      query FindTeams($name: String!, $limit: Int!) {
        teams(filter: { name: { contains: $name } }, first: $limit) {
          edges {
            node {
              id
              name
              title { name }
              titles { name }
            }
          }
        }
      }
    `;
    const data = await this.executeQuery<{ teams: { edges: Array<{ node: GridTeam }> } }>(
      CENTRAL_DATA_ENDPOINT,
      query,
      { name, limit }
    );

    const nodes = data.teams.edges.map(e => e.node);

    if (!game) return nodes;

    const matchers = (n: GridTeam) => {
      const wanted = game === 'LOL' ? ['League of Legends', 'LOL', 'LoL'] : ['Valorant', 'VALORANT'];
      const hasTitle = (t?: { name?: string } | null) => !!t && wanted.includes(t.name || '');
      const anyTitles = Array.isArray(n.titles) && n.titles.some(t => hasTitle(t));
      return hasTitle(n.title as any) || anyTitles;
    };

    return nodes.filter(matchers);
  }

  /**
   * Get recent series IDs for a team using Central Data
   */
  async getRecentSeriesByTeam(teamId: string, limit: number = 10): Promise<Array<{ id: string; startTimeScheduled?: string }>> {
    const query = `
      query GetRecentSeries($teamId: ID!, $limit: Int!) {
        allSeries(filter: { teamId: $teamId }, first: $limit, orderBy: StartTimeScheduled, orderDirection: DESC) {
          edges {
            node {
              id
              startTimeScheduled
            }
          }
        }
      }
    `;
    const data = await this.executeQuery<{ allSeries: { edges: Array<{ node: { id: string, startTimeScheduled?: string } }> } }>(
      CENTRAL_DATA_ENDPOINT,
      query,
      { teamId, limit }
    );
    return data.allSeries.edges.map(e => ({
      id: e.node.id,
      startTimeScheduled: e.node.startTimeScheduled
    }));
  }

  /**
   * Get series state (results and games) from Series State API
   */
  async getSeriesState(seriesId: string): Promise<GridSeriesState> {
    const query = `
      query GetSeriesState($seriesId: ID!) {
        seriesState(id: $seriesId) {
          id
          finished
          startedAt
          teams {
            id
            name
            score
            won
            players {
              id
              name
            }
          }
          games {
            id
            map {
              name
            }
            teams {
              id
              name
              score
              won
              players {
                id
                name
              }
            }
          }
          draftActions {
            type
            drafter {
              id
            }
            draftable {
              name
              type
            }
          }
        }
      }
    `;
    const data = await this.executeQuery<{ seriesState: GridSeriesState }>(
      SERIES_STATE_ENDPOINT,
      query,
      { seriesId }
    );
    return data.seriesState;
  }

  /**
   * Combined method to get full series details for a team
   */
  async getFullSeriesByTeam(teamId: string, limit: number = 10): Promise<GridSeriesState[]> {
    const seriesInfos = await this.getRecentSeriesByTeam(teamId, limit);
    const states: GridSeriesState[] = [];
    
    for (const info of seriesInfos) {
      try {
        const state = await this.getSeriesState(info.id);
        if (state) {
          // Fallback to scheduled time if startedAt is missing
          if (!state.startedAt && info.startTimeScheduled) {
            state.startedAt = info.startTimeScheduled;
          }
          states.push(state);
        }
      } catch (error) {
        console.warn(`Could not fetch state for series ${info.id}:`, error);
      }
    }
    return states;
  }
}

// Export a singleton instance
export const gridGraphqlClient = new GridGraphqlClient(GRID_API_KEY || '', {
  // Vercel serverless filesystem is ephemeral; don’t rely on disk persistence there.
  enableDiskCache: !process.env.VERCEL,
});
