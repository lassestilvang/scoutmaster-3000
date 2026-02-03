import { normalizeGameParam, toBoundedInt, validateTeamNameInput } from '../../../_lib/validation.js';

// import {
//   generateMatchupScoutingReportByName,
//   generateScoutingReportByName,
// } from '../../../../backend/dist/backend/src/scoutingService.js';
// import { generatePdf } from '../../../../backend/dist/backend/src/utils/pdfGenerator.js';

export const config = {
  // PDF generation needs more memory/time due to Chromium.
  maxDuration: 60,
  memory: 1536,
};

export default async function handler(req, res) {
  console.log('PDF Handler invoked for:', req.url);
  console.log('Query:', JSON.stringify(req.query));

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('allow', 'GET');
    return res.end();
  }

  res.statusCode = 200;
  return res.end('PDF Generator Reachable');

  /*
  const teamNameParam = typeof req.query?.teamName === 'string' ? req.query.teamName : '';
  const teamNameDecoded = teamNameParam ? decodeURIComponent(teamNameParam) : '';
  const teamNameValid = validateTeamNameInput(teamNameDecoded);
  if (!teamNameValid) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'teamName is invalid' }));
  }

  const limit = toBoundedInt(req.query?.limit, 10, 1, 50);
  const timeframeDays = req.query?.timeframeDays;
  const timeframeNum = (timeframeDays === undefined || timeframeDays === null)
    ? undefined
    : toBoundedInt(timeframeDays, 60, 1, 365);

  const gameEnum = normalizeGameParam(req.query?.game);
  const ourTeamNameRaw = typeof req.query?.ourTeamName === 'string' ? req.query.ourTeamName : undefined;
  const ourTeamNameDecoded = ourTeamNameRaw ? decodeURIComponent(ourTeamNameRaw) : undefined;
  const ourTeamNameValid = ourTeamNameDecoded ? validateTeamNameInput(ourTeamNameDecoded) : undefined;
  if (ourTeamNameRaw && !ourTeamNameValid) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'ourTeamName is invalid' }));
  }

  try {
    const report = (ourTeamNameValid && ourTeamNameValid.trim() !== '')
      ? await generateMatchupScoutingReportByName(ourTeamNameValid, teamNameValid, limit, gameEnum, timeframeNum)
      : await generateScoutingReportByName(teamNameValid, limit, gameEnum, timeframeNum);

    const pdfBuffer = await generatePdf(report);

    res.statusCode = 200;
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', `attachment; filename="scouting-report-${encodeURIComponent(teamNameValid)}.pdf"`);
    return res.end(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error('Error generating PDF:', (error && error.message) || error);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Failed to generate PDF report' }));
  }
  */
}
