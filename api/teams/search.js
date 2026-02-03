import { normalizeGameParam, toBoundedInt } from '../_lib/validation.js';

// Import compiled backend logic (included via `vercel.json` includeFiles).
import { searchTeams } from '../../backend/dist/backend/src/scoutingService.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('allow', 'GET');
    return res.end();
  }

  const q = typeof req.query?.q === 'string' ? req.query.q : '';
  const game = typeof req.query?.game === 'string' ? req.query.game : undefined;
  const gameEnum = normalizeGameParam(game);

  if (!q || q.trim().length < 2 || q.trim().length > 80) {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify([]));
  }

  // Optional hard limit for safety (even though backend already caps internally).
  const _limit = toBoundedInt(req.query?.limit, 10, 1, 25);
  void _limit;

  try {
    const teams = await searchTeams(q, gameEnum);
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify(teams));
  } catch (error) {
    console.error('Error searching teams:', (error && error.message) || error);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
