import dotenv from 'dotenv';

dotenv.config();

const CENTRAL_DATA_ENDPOINT = 'https://api-op.grid.gg/central-data/graphql';
const SERIES_STATE_ENDPOINT = 'https://api-op.grid.gg/live-data-feed/series-state/graphql';
const GRID_API_KEY = process.env.GRID_API_KEY;

/**
 * GRID GraphQL Schema Interfaces (Subset of used fields for api-op)
 */

export interface GridTeam {
  id: string;
  name: string;
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
  teams: GridSeriesTeamState[];
  games: Array<{
    id: string;
    map?: {
      name: string;
    };
    teams: GridSeriesTeamState[];
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

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Generic GraphQL query executor
   */
  private async executeQuery<T>(endpoint: string, query: string, variables: Record<string, any> = {}): Promise<T> {
    if (!this.apiKey) {
      throw new Error('GRID_API_KEY is missing. Please set it in your environment variables.');
    }

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
      throw new Error(`GRID API rate limit exceeded. Retry after ${retryAfter || 'some time'} seconds.`);
    }

    if (!response.ok) {
      const errorText = await response.text();
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

    return result.data;
  }

  /**
   * Search for teams by name using Central Data
   */
  async findTeamsByName(name: string, limit: number = 5): Promise<GridTeam[]> {
    const query = `
      query FindTeams($name: String!, $limit: Int!) {
        teams(filter: { name: { contains: $name } }, first: $limit) {
          edges {
            node {
              id
              name
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
    return data.teams.edges.map(e => e.node);
  }

  /**
   * Get recent series IDs for a team using Central Data
   */
  async getRecentSeriesByTeam(teamId: string, limit: number = 10): Promise<string[]> {
    const query = `
      query GetRecentSeries($teamId: ID!, $limit: Int!) {
        allSeries(filter: { teamId: $teamId }, first: $limit, orderBy: StartTimeScheduled, orderDirection: DESC) {
          edges {
            node {
              id
            }
          }
        }
      }
    `;
    const data = await this.executeQuery<{ allSeries: { edges: Array<{ node: { id: string } }> } }>(
      CENTRAL_DATA_ENDPOINT,
      query,
      { teamId, limit }
    );
    return data.allSeries.edges.map(e => e.node.id);
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
    const seriesIds = await this.getRecentSeriesByTeam(teamId, limit);
    const states: GridSeriesState[] = [];
    
    for (const id of seriesIds) {
      try {
        const state = await this.getSeriesState(id);
        if (state) states.push(state);
      } catch (error) {
        console.warn(`Could not fetch state for series ${id}:`, error);
      }
    }
    
    return states;
  }
}

// Export a singleton instance
export const gridGraphqlClient = new GridGraphqlClient(GRID_API_KEY || '');
