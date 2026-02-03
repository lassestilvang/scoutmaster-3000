import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { 
  generateScoutingReportByName, 
  generateScoutingReportById,
  generateMatchupScoutingReportByName,
  searchTeams,
  isTeamNotFoundError
} from './scoutingService.js';
import { generatePdf } from './utils/pdfGenerator.js';

// Environment variables are loaded via ./loadEnv.js import at the top

const app = express();
const port = process.env.PORT || 3001;

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser clients (no Origin header) and same-origin.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
}));

app.use(express.json());

app.use((req, res, next) => {
  const headerId = req.headers['x-request-id'];
  const requestId = (typeof headerId === 'string' && headerId.trim()) ? headerId.trim() : crypto.randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const pathOnly = (req.originalUrl || req.url || '').split('?')[0];
    console.log(JSON.stringify({
      level: 'info',
      msg: 'request',
      requestId,
      method: req.method,
      path: pathOnly,
      status: res.statusCode,
      durationMs: Math.round(elapsedMs),
    }));
  });
  next();
});

function validateTeamNameInput(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  if (s.length < 2 || s.length > 80) return undefined;
  // Allow common esports org names; block control chars.
  if (!/^[\p{L}\p{N} ._\-']+$/u.test(s)) return undefined;
  return s;
}

function toBoundedInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ScoutMaster 3000 API is running' });
});

app.get('/api/teams/search', async (req, res) => {
  const { q, game } = req.query as { q?: string; game?: string };
  if (!q || typeof q !== 'string') {
    return res.json([]);
  }

  if (q.trim().length < 2 || q.trim().length > 80) {
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
    console.error(JSON.stringify({ level: 'error', msg: 'Error searching teams', requestId: (req as any).requestId, error: (error as any)?.message }));
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
  const limit = toBoundedInt(req.query.limit, 10, 1, 50);

  if (!teamId || teamId.trim() === '') {
    return res.status(400).json({ error: 'teamId is required' });
  }

  try {
    const report = await generateScoutingReportById(teamId, limit);
    res.json(report);
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', msg: 'Error generating report for teamId', requestId: (req as any).requestId, teamId, error: (error as any)?.message }));
    res.status(500).json({ error: 'Failed to generate scouting report' });
  }
});

/**
 * GET /api/scout/:teamId/pdf
 * Generates and downloads a PDF scouting report for a specific team ID.
 */
app.get('/api/scout/:teamId/pdf', async (req, res) => {
  const { teamId } = req.params;
  const limit = toBoundedInt(req.query.limit, 10, 1, 50);

  try {
    const report = await generateScoutingReportById(teamId, limit);
    const pdfBuffer = await generatePdf(report);

    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="scouting-report-${teamId}.pdf"`);
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', msg: 'Error generating PDF for teamId', requestId: (req as any).requestId, teamId, error: (error as any)?.message }));
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});

app.post('/api/scout', async (req, res) => {
  const { teamName, ourTeamName, game, limit, timeframeDays } = req.body as {
    teamName?: string;
    ourTeamName?: string;
    game?: string;
    limit?: number;
    timeframeDays?: number;
  };
  const teamNameValid = validateTeamNameInput(teamName);
  const ourTeamNameValid = ourTeamName ? validateTeamNameInput(ourTeamName) : undefined;
  if (!teamNameValid) return res.status(400).json({ error: 'teamName is required (2–80 chars, letters/numbers/spaces)' });
  if (ourTeamName && !ourTeamNameValid) return res.status(400).json({ error: 'ourTeamName must be 2–80 chars when provided' });

  const gameEnum = (typeof game === 'string' && game.toLowerCase() === 'lol') ? 'LOL'
    : (typeof game === 'string' && game.toLowerCase() === 'valorant') ? 'VALORANT'
    : undefined;

  try {
    const limitNum = toBoundedInt(limit as any, 10, 1, 50);
    const timeframeNum = (timeframeDays === undefined || timeframeDays === null)
      ? undefined
      : toBoundedInt(timeframeDays as any, 60, 1, 365);

    const report = (ourTeamNameValid && ourTeamNameValid.trim() !== '')
      ? await generateMatchupScoutingReportByName(ourTeamNameValid, teamNameValid, limitNum, gameEnum as any, timeframeNum)
      : await generateScoutingReportByName(teamNameValid, limitNum, gameEnum as any, timeframeNum);
    res.json(report);
  } catch (error) {
    if (isTeamNotFoundError(error)) {
      return res.status(404).json({
        error: `${error.which === 'our' ? 'Your team' : 'Opponent team'} not found: ${error.query}`,
        suggestions: error.suggestions
      });
    }
    console.error(JSON.stringify({ level: 'error', msg: 'Error generating report', requestId: (req as any).requestId, error: (error as any)?.message }));
    res.status(500).json({ error: 'Failed to generate scouting report' });
  }
});

/**
 * GET /api/scout/name/:teamName/pdf
 * Generates and downloads a PDF scouting report for a specific team name.
 */
app.get('/api/scout/name/:teamName/pdf', async (req, res) => {
  const { teamName } = req.params;
  const teamNameValid = validateTeamNameInput(teamName);
  if (!teamNameValid) return res.status(400).json({ error: 'teamName is invalid' });

  const limit = toBoundedInt(req.query.limit, 10, 1, 50);
  const game = (req.query.game as string | undefined) || undefined;
  const ourTeamNameRaw = (req.query.ourTeamName as string | undefined) || undefined;
  const ourTeamNameValid = ourTeamNameRaw ? validateTeamNameInput(ourTeamNameRaw) : undefined;
  if (ourTeamNameRaw && !ourTeamNameValid) return res.status(400).json({ error: 'ourTeamName is invalid' });
  const timeframeDays = req.query.timeframeDays ? parseInt(req.query.timeframeDays as string) : undefined;
  const gameEnum = (typeof game === 'string' && game.toLowerCase() === 'lol') ? 'LOL'
    : (typeof game === 'string' && game.toLowerCase() === 'valorant') ? 'VALORANT'
    : undefined;

  try {
    const timeframeNum = (timeframeDays === undefined || timeframeDays === null)
      ? undefined
      : toBoundedInt(timeframeDays as any, 60, 1, 365);

    const report = (ourTeamNameValid && ourTeamNameValid.trim() !== '')
      ? await generateMatchupScoutingReportByName(ourTeamNameValid, teamNameValid, limit, gameEnum as any, timeframeNum)
      : await generateScoutingReportByName(teamNameValid, limit, gameEnum as any, timeframeNum);
    const pdfBuffer = await generatePdf(report);

    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="scouting-report-${teamName.replace(/\s+/g, '-')}.pdf"`);
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    if (isTeamNotFoundError(error)) {
      return res.status(404).json({
        error: `${error.which === 'our' ? 'Your team' : 'Opponent team'} not found: ${error.query}`,
        suggestions: error.suggestions
      });
    }
    console.error(JSON.stringify({ level: 'error', msg: 'Error generating PDF for teamName', requestId: (req as any).requestId, teamName, error: (error as any)?.message }));
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
