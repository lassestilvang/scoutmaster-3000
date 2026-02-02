import { gridGraphqlClient } from './data/gridGraphqlClient.js';

async function testClient() {
  console.log('--- GRID GraphQL Client Test ---');
  
  const teamId = 't1'; // A common placeholder or example ID
  
  try {
    console.log(`Testing getTeamById with ID: ${teamId}...`);
    const team = await gridGraphqlClient.getTeamById(teamId);
    console.log('Success! Team fetched:', JSON.stringify(team, null, 2));
    
    console.log(`\nTesting getRecentMatchesByTeam for ID: ${teamId}...`);
    const series = await gridGraphqlClient.getRecentMatchesByTeam(teamId, 1);
    console.log(`Success! Fetched ${series.length} series.`);
    if (series.length > 0) {
      // Log sanitized first series
      const firstSeries = series[0];
      console.log('First Series ID:', firstSeries.id);
      console.log('Matches Count:', firstSeries.matches.length);
      
      if (firstSeries.matches.length > 0) {
        const matchId = firstSeries.matches[0].id;
        console.log(`\nTesting getMatchDetails for match ID: ${matchId}...`);
        const match = await gridGraphqlClient.getMatchDetails(matchId);
        console.log('Success! Match details fetched for ID:', match.id);
        console.log('Map:', match.map?.name);
      }
    }
  } catch (error: any) {
    console.error('Test Failed!');
    if (error.message.includes('GRID_API_KEY is missing')) {
      console.error('Error: GRID_API_KEY is not set. Please provide a valid key in .env');
    } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.error('Error: Invalid API Key (Unauthorized).');
    } else {
      console.error('Error:', error.message);
    }
  }
}

testClient();
