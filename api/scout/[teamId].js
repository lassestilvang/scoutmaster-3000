import { toBoundedInt } from '../_lib/validation.js';
import { generateScoutingReportById } from '../../backend/dist/backend/src/scoutingService.js';

export const config = {
  maxDuration: 60,
  memory: 1024,
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('allow', 'GET');
    return res.end();
  }

  const teamId = typeof req.query?.teamId === 'string' ? req.query.teamId : '';
  const limit = toBoundedInt(req.query?.limit, 10, 1, 50);

  if (!teamId || teamId.trim() === '') {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'teamId is required' }));
  }

  try {
    const report = await generateScoutingReportById(teamId, limit);
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify(report));
  } catch (error) {
    console.error('Error generating report for teamId:', (error && error.message) || error);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Failed to generate scouting report' }));
  }
}
