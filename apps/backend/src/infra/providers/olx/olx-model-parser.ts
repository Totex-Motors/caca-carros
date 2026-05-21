export type OlxModelParts = {
  brand: string;
  model: string;
  version: string | null;
};

const VERSION_FILTER_WORDS = new Set([
  'turbo',
  'flex',
  'gasolina',
  'diesel',
  'etanol',
  'hibrido',
  'hibrida',
  'hybrid',
  'eletrico',
  'eletrica',
  'electric',
  'phev',
  'hev',
  'ev',
  'plugin',
  'plug',
  'aut',
  'automatico',
  'automatica'
]);

const VERSION_SPLIT_MARKERS = new Set([
  'xli',
  'gl',
  'gs',
  'gli',
  'xei',
  'altis',
  'grs',
  'gr',
  'xr',
  'xrs',
  'xre',
  'xrx',
  'xlt',
  'xls',
  'xle',
  'lt',
  'ltz',
  'ltd',
  'ls',
  'le',
  'se',
  'sx',
  'sv',
  'sl',
  'slt',
  'ex',
  'exl',
  'lx',
  'lxs',
  'sense',
  'advance',
  'exclusive',
  'comfortline',
  'highline',
  'trendline',
  'sportline',
  'way',
  'at',
  'mt',
  'cvt',
  'dct',
  'dsg',
  'awd',
  '4wd',
  'tb',
  'tsi',
  'tfsi',
  'mpi',
  'tdi',
  'mini',
  'premium',
  'sport',
  'touring',
  'limited',
  'longitude',
  'trailhawk'
]);

function stripParentheses(value: string): string {
  return value.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeComparable(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function normalizeToken(token: string): string {
  return token
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();
}

function splitTokens(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripBrandPrefix(tokens: string[], brand: string): string[] {
  const brandTokens = splitTokens(normalizeComparable(brand));
  if (brandTokens.length === 0 || brandTokens.length > tokens.length) return tokens;

  for (let index = 0; index < brandTokens.length; index += 1) {
    if (normalizeToken(tokens[index]) !== brandTokens[index]) {
      return tokens;
    }
  }

  return tokens.slice(brandTokens.length);
}

function shouldStartVersion(rawToken: string, normalizedToken: string, index: number): boolean {
  if (index <= 0) return false;
  if (!normalizedToken) return false;

  if (VERSION_FILTER_WORDS.has(normalizedToken) || VERSION_SPLIT_MARKERS.has(normalizedToken)) {
    return true;
  }

  if (/^\d+[.,]\d+$/.test(rawToken)) return true;
  if (/^\d+x\d+$/i.test(rawToken)) return true;
  if (/^\d+v$/i.test(rawToken)) return true;
  if (/^v\d+$/i.test(rawToken)) return true;
  if (/^\d+(?:cv|hp)$/i.test(rawToken)) return true;

  return false;
}

function splitModelAndVersion(tokens: string[]): { modelTokens: string[]; versionTokens: string[] } {
  for (let index = 1; index < tokens.length; index += 1) {
    const rawToken = tokens[index];
    const normalizedToken = normalizeToken(rawToken);
    if (!shouldStartVersion(rawToken, normalizedToken, index)) continue;

    const modelTokens = tokens.slice(0, index);
    const versionTokens = tokens.slice(index);
    if (modelTokens.length > 0 && versionTokens.length > 0) {
      return { modelTokens, versionTokens };
    }
  }

  return { modelTokens: tokens, versionTokens: [] };
}

function normalizeVersion(value: string | null): string | null {
  if (!value) return null;
  const cleaned = stripParentheses(value);
  const tokens = splitTokens(cleaned).filter((token) => !VERSION_FILTER_WORDS.has(normalizeToken(token)));
  const normalized = collapseSpaces(tokens.join(' '));
  return normalized.length > 0 ? normalized : null;
}

export function parseOlxVehicleParts(input: { brand: string; model: string; version?: string | null }): OlxModelParts {
  const brand = input.brand.trim();
  const rawModel = stripParentheses(input.model ?? '').trim();
  const rawTokens = splitTokens(rawModel);
  const strippedTokens = stripBrandPrefix(rawTokens, brand);

  const split = splitModelAndVersion(strippedTokens.length > 0 ? strippedTokens : rawTokens);
  const modelTokens = split.modelTokens.length > 0 ? split.modelTokens : rawTokens;

  const explicitVersion = normalizeVersion(input.version ?? null);
  const derivedVersion = normalizeVersion(split.versionTokens.join(' '));

  return {
    brand,
    model: collapseSpaces(modelTokens.join(' ')) || rawModel || brand,
    version: explicitVersion ?? derivedVersion
  };
}

export function buildOlxSearchQuery(parts: OlxModelParts): string {
  const tokens = [parts.brand, parts.model, parts.version].filter((token) => Boolean(token && token.trim().length > 0));
  return collapseSpaces(tokens.join(' '));
}

export function buildVersionTokens(version: string | null): string[] {
  if (!version) return [];
  const normalized = normalizeComparable(version);
  if (!normalized) return [];

  return splitTokens(normalized).filter((token) => token.length > 0 && !VERSION_FILTER_WORDS.has(token));
}

export function matchesVersion(title: string, versionTokens: string[]): boolean {
  if (versionTokens.length === 0) return true;
  const normalizedTitle = ` ${normalizeComparable(title)} `;
  return versionTokens.every((token) => normalizedTitle.includes(` ${token} `));
}

export function normalizeSearchText(value: string): string {
  return normalizeComparable(value).toUpperCase();
}
