import dotenv from 'dotenv';

dotenv.config();

const GRID_GRAPHQL_ENDPOINT = 'https://api.grid.gg/query';
const GRID_API_KEY = process.env.GRID_API_KEY;

/**
 * GRID GraphQL Schema Interfaces (Subset of used fields)
 */

export interface GridTeam {
  id: string;
  name: string;
}

export interface GridPlayer {
  id: string;
  name: string;
}

export interface GridResultTeam {
  team: GridTeam;
  score: number;
  win: boolean;
  players?: GridPlayer[];
}

export interface GridMatch {
  id: string;
  seriesId?: string;
  map?: {
    name: string;
  };
  teams: GridResultTeam[];
}

export interface GridSeries {
  id: string;
  startTime: string;
  teams: GridResultTeam[];
  matches: GridMatch[];
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
 * Production-ready GRID GraphQL Client
 */
export class GridGraphqlClient {
  private endpoint: string;
  private apiKey: string;

  constructor(endpoint: string, apiKey: string) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
  }

  /**
   * Generic GraphQL query executor
   */
  private async executeQuery<T>(query: string, variables: Record<string, any> = {}): Promise<T> {
    if (!this.apiKey) {
      throw new Error('GRID_API_KEY is missing. Please set it in your environment variables.');
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
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
   * Fragments for reusable fields
   */
  private static readonly FRAGMENTS = `
    fragment TeamFields on Team {
      id
      name
    }
    fragment PlayerFields on Player {
      id
      name
    }
    fragment ResultTeamFields on SeriesTeam {
      team {
        ...TeamFields
      }
      score
      win
      players {
        ...PlayerFields
      }
    }
    fragment MatchFields on Match {
      id
      map {
        name
      }
      teams {
        team {
          ...TeamFields
        }
        score
        win
        players {
          ...PlayerFields
        }
      }
    }
  `;

  /**
   * Fetches a team by its ID
   */
  async getTeamById(teamId: string): Promise<GridTeam> {
    const query = `
      query GetTeam($teamId: ID!) {
        team(id: $teamId) {
          ...TeamFields
        }
      }
      ${GridGraphqlClient.FRAGMENTS}
    `;
    const data = await this.executeQuery<{ team: GridTeam }>(query, { teamId });
    return data.team;
  }

  /**
   * Fetches the most recent series/matches for a team
   */
  async getRecentMatchesByTeam(teamId: string, limit: number = 10): Promise<GridSeries[]> {
    const query = `
      query GetRecentMatches($teamId: ID!, $limit: Int!) {
        allSeries(filter: { teamIds: [$teamId] }, first: $limit) {
          edges {
            node {
              id
              startTime
              teams {
                ...ResultTeamFields
              }
              matches {
                ...MatchFields
              }
            }
          }
        }
      }
      ${GridGraphqlClient.FRAGMENTS}
    `;

    const data = await this.executeQuery<{ allSeries: { edges: Array<{ node: GridSeries }> } }>(query, {
      teamId,
      limit,
    });

    return data.allSeries.edges.map((edge) => edge.node);
  }

  /**
   * Fetches details for a specific match
   */
  async getMatchDetails(matchId: string): Promise<GridMatch> {
    const query = `
      query GetMatchDetails($matchId: ID!) {
        match(id: $matchId) {
          ...MatchFields
          seriesId
        }
      }
      ${GridGraphqlClient.FRAGMENTS}
    `;

    const data = await this.executeQuery<{ match: GridMatch }>(query, { matchId });
    return data.match;
  }
}

// Export a singleton instance
export const gridGraphqlClient = new GridGraphqlClient(GRID_GRAPHQL_ENDPOINT, GRID_API_KEY || '');
