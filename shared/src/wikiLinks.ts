export type GameCode = 'LOL' | 'VALORANT';

function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

function toWikiSlug(name: string): string {
  // Fandom typically uses underscores for spaces.
  return normalizeName(name).replace(/\s+/g, '_');
}

function encodeWikiPathSegment(segment: string): string {
  // `encodeURIComponent` does not encode some characters (including `'`).
  // For wiki page titles, we want a conservative encoding to avoid broken URLs.
  return encodeURIComponent(segment).replace(/[!'()*\u0027]/g, (c) => {
    return `%${c.charCodeAt(0).toString(16).toUpperCase()}`;
  });
}

function toDirectWikiUrl(base: string, pageTitle: string): string {
  const slug = toWikiSlug(pageTitle);
  return `${base}${encodeWikiPathSegment(slug)}`;
}

function toSearchUrl(base: string, query: string): string {
  return `${base}Special:Search?query=${encodeWikiPathSegment(normalizeName(query))}`;
}

const KNOWN_VALORANT_MAPS = new Set(
  [
    'Abyss',
    'Ascent',
    'Bind',
    'Breeze',
    'Fracture',
    'Haven',
    'Icebox',
    'Lotus',
    'Pearl',
    'Split',
    'Sunset',
  ].map((m) => m.toLowerCase())
);

const KNOWN_LOL_MAPS = new Set(
  [
    "Summoner's Rift",
    'Howling Abyss',
    'Twisted Treeline',
    'Crystal Scar',
    'The Proving Grounds',
    "Butcher's Bridge",
  ].map((m) => m.toLowerCase())
);

/**
 * Returns a best-effort link to a map page on the corresponding Fandom wiki.
 *
 * - VALORANT maps: https://valorant.fandom.com/wiki/Maps
 * - LoL maps: https://leagueoflegends.fandom.com/wiki/Category:Fields_of_Justice
 */
export function getMapWikiUrl(game: GameCode | undefined, mapName: string | undefined): string | undefined {
  if (!game) return undefined;
  if (typeof mapName !== 'string') return undefined;
  const name = normalizeName(mapName);
  if (!name) return undefined;

  if (game === 'VALORANT') {
    const base = 'https://valorant.fandom.com/wiki/';
    return KNOWN_VALORANT_MAPS.has(name.toLowerCase())
      ? toDirectWikiUrl(base, name)
      : toSearchUrl(base, name);
  }

  if (game === 'LOL') {
    const base = 'https://leagueoflegends.fandom.com/wiki/';
    return KNOWN_LOL_MAPS.has(name.toLowerCase())
      ? toDirectWikiUrl(base, name)
      : toSearchUrl(base, name);
  }

  return undefined;
}
