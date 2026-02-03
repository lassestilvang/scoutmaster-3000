import '../loadEnv.js';

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

/**
 * Production-ready GRID GraphQL Client for Cloud9 Hackathon
 */
export class GridGraphqlClient {
  private apiKey: string;
  private cache: Map<string, { data: any; expiresAt: number }> = new Map();
  private defaultTtl: number = 5 * 60 * 1000; // 5 minutes cache by default

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Helper for exponential backoff sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

    let lastError: Error | null = null;
    let delay = 500; // Starting delay for backoff: 500ms
    const maxRetries = 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(endpoint, {
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
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay;
          
          if (attempt < maxRetries) {
            console.warn(`GRID API rate limit hit (429). Retrying in ${waitTime}ms... (Attempt ${attempt + 1}/${maxRetries})`);
            await this.sleep(waitTime);
            delay *= 2; // Exponential backoff
            continue;
          }
        }

        if (!response.ok) {
          const errorText = await response.text();
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

        // Cache successful response
        this.cache.set(cacheKey, {
          data: result.data,
          expiresAt: Date.now() + this.defaultTtl,
        });

        return result.data;
      } catch (error: any) {
        lastError = error;
        // If it's not a retryable error, or we're out of attempts, throw
        if (attempt === maxRetries) {
          break;
        }
        
        // Handle network errors (Fetch throws on network failure)
        if (error.name === 'TypeError' || error.message.includes('network')) {
           console.warn(`GRID API network error. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
           await this.sleep(delay);
           delay *= 2;
           continue;
        }

        throw error;
      }
    }

    throw lastError || new Error('Failed to execute GRID query after multiple retries.');
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
export const gridGraphqlClient = new GridGraphqlClient(GRID_API_KEY || '');
