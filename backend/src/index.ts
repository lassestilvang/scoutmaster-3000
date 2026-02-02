import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { 
  generateScoutingReportByName, 
  generateScoutingReportById 
} from './scoutingService.js';
import { generatePdf } from './utils/pdfGenerator.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ScoutMaster 3000 API is running' });
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
  const { teamName } = req.body;
  if (!teamName) {
    return res.status(400).json({ error: 'teamName is required' });
  }

  try {
    const report = await generateScoutingReportByName(teamName, 10);
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

  try {
    const report = await generateScoutingReportByName(teamName, limit);
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
