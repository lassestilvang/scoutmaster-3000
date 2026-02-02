import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GRID_API_URL = 'https://api.grid.gg/query';
const GRID_API_KEY = process.env.GRID_API_KEY;

export interface GridTeam {
  id: string;
  name: string;
}

export interface GridPlayer {
  id: string;
  name: string;
}

export interface GridSeriesTeam {
  team: GridTeam;
  score: number;
  win: boolean;
  players?: GridPlayer[];
}

export interface GridSeries {
  id: string;
  startTime: string;
  teams: GridSeriesTeam[];
}

export interface GridMatch {
  id: string;
  seriesId: string;
  map: {
    name: string;
  };
  teams: GridSeriesTeam[];
}

export class GridClient {
  private apiKey: string;
  private maxRetries = 3;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public async query<T>(graphqlQuery: string, variables: any = {}): Promise<T> {
    if (!this.apiKey || this.apiKey === 'your_grid_api_key_here' || this.apiKey === '') {
      console.warn('GRID_API_KEY is not set or is a placeholder. Returning mock data.');
      return this.getMockData() as T;
    }

    let lastError: any;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await axios.post(
          GRID_API_URL,
          { query: graphqlQuery, variables },
          {
            headers: {
              'x-api-key': this.apiKey,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.data.errors) {
          throw new Error(`GRID API Error: ${JSON.stringify(response.data.errors)}`);
        }

        return response.data.data;
      } catch (error) {
        lastError = error;
        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError;
          if (axiosError.response?.status === 429) {
            const delay = Math.pow(2, attempt) * 1000;
            console.warn(`Rate limited. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        // If it's not a rate limit error, or we've exhausted retries, fallback to mock data for demo
        console.error('Error querying GRID API, falling back to mock data:', (error as any).message);
        return this.getMockData() as T;
      }
    }
    return this.getMockData() as T;
  }

  private getMockData() {
    return {
      allSeries: {
        edges: [
          {
            node: {
              id: 'mock-series-1',
              startTime: new Date().toISOString(),
              teams: [
                { 
                  team: { id: 't1', name: 'Team Alpha' }, 
                  score: 16, 
                  win: true,
                  players: [
                    { id: 'p1', name: 'Player One' },
                    { id: 'p2', name: 'Player Two' },
                  ]
                },
                { 
                  team: { id: 't2', name: 'Team Beta' }, 
                  score: 10, 
                  win: false,
                  players: [
                    { id: 'p3', name: 'Player Three' },
                    { id: 'p4', name: 'Player Four' },
                  ]
                },
              ],
            }
          }
        ]
      },
      match: {
        id: 'mock-match-1',
        seriesId: 'mock-series-1',
        map: { name: 'Mirage' },
        teams: [
          { 
            team: { id: 't1', name: 'Team Alpha' }, 
            score: 16, 
            win: true,
            players: [
              { id: 'p1', name: 'Player One' },
              { id: 'p2', name: 'Player Two' },
            ]
          },
          { 
            team: { id: 't2', name: 'Team Beta' }, 
            score: 10, 
            win: false,
            players: [
              { id: 'p3', name: 'Player Three' },
              { id: 'p4', name: 'Player Four' },
            ]
          },
        ],
      }
    };
  }

  async getTeamMatches(teamId: string, limit: number = 10): Promise<GridSeries[]> {
    const graphqlQuery = `
      query GetTeamMatches($teamId: ID!, $limit: Int) {
        allSeries(filter: { teamIds: [$teamId] }, first: $limit) {
          edges {
            node {
              id
              startTime
              teams {
                team {
                  id
                  name
                }
                score
                win
              }
              matches {
                id
                map {
                  name
                }
                teams {
                  team {
                    id
                    name
                  }
                  score
                  win
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.query<{ allSeries: { edges: { node: GridSeries }[] } }>(graphqlQuery, { teamId, limit });
    return data.allSeries?.edges?.map(edge => edge.node) || [];
  }

  async getTeamMatchesByName(teamName: string, limit: number = 10): Promise<GridSeries[]> {
    const graphqlQuery = `
      query GetTeamMatchesByName($teamName: String!, $limit: Int) {
        allSeries(filter: { teamNames: [$teamName] }, first: $limit) {
          edges {
            node {
              id
              startTime
              teams {
                team {
                  id
                  name
                }
                score
                win
              }
              matches {
                id
                map {
                  name
                }
                teams {
                  team {
                    id
                    name
                  }
                  score
                  win
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.query<{ allSeries: { edges: { node: GridSeries }[] } }>(graphqlQuery, { teamName, limit });
    return data.allSeries?.edges?.map(edge => edge.node) || [];
  }

  async getMatchDetails(matchId: string): Promise<GridMatch> {
    const graphqlQuery = `
      query GetMatchDetails($matchId: ID!) {
        match(id: $matchId) {
          id
          seriesId
          map {
            name
          }
          teams {
            team {
              id
              name
            }
            score
            win
          }
        }
      }
    `;

    const data = await this.query<{ match: GridMatch }>(graphqlQuery, { matchId });
    return data.match;
  }
}

export const gridClient = new GridClient(GRID_API_KEY || '');
