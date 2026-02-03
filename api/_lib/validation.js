export function validateTeamNameInput(raw) {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  if (s.length < 2 || s.length > 80) return undefined;
  // Allow common esports org names; block control chars.
  if (!/^[\p{L}\p{N} ._\-']+$/u.test(s)) return undefined;
  return s;
}

export function toBoundedInt(v, fallback, min, max) {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export function normalizeGameParam(game) {
  if (typeof game !== 'string') return undefined;
  const g = game.toLowerCase();
  if (g === 'lol') return 'LOL';
  if (g === 'valorant') return 'VALORANT';
  return undefined;
}

export function readJsonBody(req) {
  // Vercel Node functions typically parse JSON bodies automatically.
  // Still, be defensive in case the body arrives as a string.
  const b = req.body;
  if (b && typeof b === 'object') return b;
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch {
      return undefined;
    }
  }
  return undefined;
}
