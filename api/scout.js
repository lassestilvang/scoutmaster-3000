import { normalizeGameParam, readJsonBody, toBoundedInt, validateTeamNameInput } from './_lib/validation.js';

import {
  generateMatchupScoutingReportByName,
  generateScoutingReportByName,
  isTeamNotFoundError,
} from '../backend/dist/backend/src/scoutingService.js';

export const config = {
  // Upstream GRID calls + analysis can take time.
  maxDuration: 60,
  memory: 1024,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('allow', 'POST');
    return res.end();
  }

  const body = readJsonBody(req) || {};

  const teamNameValid = validateTeamNameInput(body.teamName);
  const ourTeamNameValid = body.ourTeamName ? validateTeamNameInput(body.ourTeamName) : undefined;
  if (!teamNameValid) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'teamName is required (2–80 chars, letters/numbers/spaces)' }));
  }
  if (body.ourTeamName && !ourTeamNameValid) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'ourTeamName must be 2–80 chars when provided' }));
  }

  const gameEnum = normalizeGameParam(body.game);
  const limitNum = toBoundedInt(body.limit, 10, 1, 50);
  const timeframeNum = (body.timeframeDays === undefined || body.timeframeDays === null)
    ? undefined
    : toBoundedInt(body.timeframeDays, 60, 1, 365);

  try {
    const report = (ourTeamNameValid && ourTeamNameValid.trim() !== '')
      ? await generateMatchupScoutingReportByName(ourTeamNameValid, teamNameValid, limitNum, gameEnum, timeframeNum)
      : await generateScoutingReportByName(teamNameValid, limitNum, gameEnum, timeframeNum);

    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify(report));
  } catch (error) {
    if (isTeamNotFoundError(error)) {
      res.statusCode = 404;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({
        error: `${error.which === 'our' ? 'Your team' : 'Opponent team'} not found: ${error.query}`,
        suggestions: error.suggestions,
      }));
    }

    console.error('Error generating report:', (error && error.message) || error);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Failed to generate scouting report' }));
  }
}
