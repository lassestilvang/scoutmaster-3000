import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import { 
  generateScoutingReportByName, 
  generateScoutingReportById,
  generateMatchupScoutingReportByName,
  searchTeams
} from './scoutingService.js';
import { generatePdf } from './utils/pdfGenerator.js';

// Environment variables are loaded via ./loadEnv.js import at the top

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ScoutMaster 3000 API is running' });
});

app.get('/api/teams/search', async (req, res) => {
  const { q, game } = req.query as { q?: string; game?: string };
  if (!q || typeof q !== 'string') {
    return res.json([]);
  }

  // Normalize game param to expected enum
  const gameEnum = (typeof game === 'string' && game.toLowerCase() === 'lol') ? 'LOL'
    : (typeof game === 'string' && game.toLowerCase() === 'valorant') ? 'VALORANT'
    : undefined;

  try {
    const teams = await searchTeams(q, gameEnum as any);
    res.json(teams);
  } catch (error) {
    console.error('Error searching teams:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/scout/:teamId
 * Fetches and generates a scouting report for a specific team ID.
 * Optional query param: limit (default 10)
 */
app.get('/api/scout/:teamId', async (req, res) => {
  const { teamId } = req.params;
  const limit = parseInt(req.query.limit as string) || 10;

  if (!teamId || teamId.trim() === '') {
    return res.status(400).json({ error: 'teamId is required' });
  }

  try {
    const report = await generateScoutingReportById(teamId, limit);
    res.json(report);
  } catch (error) {
    console.error(`Error generating report for teamId ${teamId}:`, error);
    res.status(500).json({ 
      error: 'Failed to generate scouting report',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/scout/:teamId/pdf
 * Generates and downloads a PDF scouting report for a specific team ID.
 */
app.get('/api/scout/:teamId/pdf', async (req, res) => {
  const { teamId } = req.params;
  const limit = parseInt(req.query.limit as string) || 10;

  try {
    const report = await generateScoutingReportById(teamId, limit);
    const pdfBuffer = await generatePdf(report);

    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="scouting-report-${teamId}.pdf"`);
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error(`Error generating PDF for teamId ${teamId}:`, error);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});

app.post('/api/scout', async (req, res) => {
  const { teamName, ourTeamName, game } = req.body as { teamName?: string; ourTeamName?: string; game?: string };
  if (!teamName) {
    return res.status(400).json({ error: 'teamName is required' });
  }

  const gameEnum = (typeof game === 'string' && game.toLowerCase() === 'lol') ? 'LOL'
    : (typeof game === 'string' && game.toLowerCase() === 'valorant') ? 'VALORANT'
    : undefined;

  try {
    const report = (ourTeamName && ourTeamName.trim() !== '')
      ? await generateMatchupScoutingReportByName(ourTeamName, teamName, 10, gameEnum as any)
      : await generateScoutingReportByName(teamName, 10, gameEnum as any);
    res.json(report);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate scouting report' });
  }
});

/**
 * GET /api/scout/name/:teamName/pdf
 * Generates and downloads a PDF scouting report for a specific team name.
 */
app.get('/api/scout/name/:teamName/pdf', async (req, res) => {
  const { teamName } = req.params;
  const limit = parseInt(req.query.limit as string) || 10;
  const game = (req.query.game as string | undefined) || undefined;
  const ourTeamName = (req.query.ourTeamName as string | undefined) || undefined;
  const gameEnum = (typeof game === 'string' && game.toLowerCase() === 'lol') ? 'LOL'
    : (typeof game === 'string' && game.toLowerCase() === 'valorant') ? 'VALORANT'
    : undefined;

  try {
    const report = (ourTeamName && ourTeamName.trim() !== '')
      ? await generateMatchupScoutingReportByName(ourTeamName, teamName, limit, gameEnum as any)
      : await generateScoutingReportByName(teamName, limit, gameEnum as any);
    const pdfBuffer = await generatePdf(report);

    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="scouting-report-${teamName.replace(/\s+/g, '-')}.pdf"`);
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error(`Error generating PDF for teamName ${teamName}:`, error);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
