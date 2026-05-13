export type VehicleModelParseResult = {
  original: string;
  model: string;
  version: string | null;
};

type ParallelumBrand = {
  codigo: string;
  nome: string;
};

type ParallelumModel = {
  codigo: string;
  nome: string;
};

const FIPE_BASE_URL = 'https://parallelum.com.br/fipe/api/v1/carros';

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

const SOFT_VERSION_SPLIT_MARKERS = new Set([
  'mini',
  'premium',
  'sport',
  'touring',
  'limited',
  'longitude',
  'trailhawk'
]);

let brandsCache: Promise<ParallelumBrand[]> | null = null;
const modelsCache = new Map<string, Promise<ParallelumModel[]>>();

function fetchJson<T>(url: string): Promise<T> {
  return fetch(url).then(async (response) => {
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Parallelum request failed (${response.status}): ${text}`);
    }

    return response.json() as Promise<T>;
  });
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

function normalizeToken(token: string): string {
  return token
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();
}

function stripParenthesesKeepingContent(value: string): string {
  return value.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
}

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function splitTokens(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

function stripIgnoredVersionTokens(tokens: string[]): string[] {
  return tokens.filter((token) => !VERSION_FILTER_WORDS.has(normalizeToken(token)));
}

function getTokenCount(value: string): number {
  return splitTokens(normalizeComparable(value)).length;
}

function shouldTokenStartVersion(rawToken: string, normalizedToken: string, index: number): boolean {
  if (index <= 0) return false;
  if (!normalizedToken) return false;

  if (VERSION_FILTER_WORDS.has(normalizedToken) || VERSION_SPLIT_MARKERS.has(normalizedToken)) {
    return true;
  }

  if (/^\d+[.,]\d+$/.test(rawToken)) {
    return true;
  }

  if (/^\d+x\d+$/i.test(rawToken)) {
    return true;
  }

  if (/^\d+v$/i.test(rawToken)) {
    return true;
  }

  if (/^v\d+$/i.test(rawToken)) {
    return true;
  }

  if (/^\d+(?:cv|hp)$/i.test(rawToken)) {
    return true;
  }

  return false;
}

function getSplitMarkerPriority(rawToken: string, normalizedToken: string): number {
  if (!normalizedToken) return 0;

  if (SOFT_VERSION_SPLIT_MARKERS.has(normalizedToken)) {
    return 1;
  }

  if (
    /^\d+[.,]\d+$/.test(rawToken) ||
    /^\d+x\d+$/i.test(rawToken) ||
    /^\d+v$/i.test(rawToken) ||
    /^v\d+$/i.test(rawToken) ||
    /^\d+(?:cv|hp)$/i.test(rawToken)
  ) {
    return 2;
  }

  if (VERSION_SPLIT_MARKERS.has(normalizedToken)) {
    return 3;
  }

  if (VERSION_FILTER_WORDS.has(normalizedToken)) {
    return 0;
  }

  return 0;
}

function splitModelAndInlineVersion(tokens: string[]): { modelTokens: string[]; versionTokens: string[] } {
  for (let index = 1; index < tokens.length; index += 1) {
    const rawToken = tokens[index];
    const normalizedToken = normalizeToken(rawToken);
    if (!shouldTokenStartVersion(rawToken, normalizedToken, index)) {
      continue;
    }

    const modelTokens = tokens.slice(0, index);
    const versionTokens = tokens.slice(index);
    if (modelTokens.length === 0 || versionTokens.length === 0) {
      break;
    }

    return { modelTokens, versionTokens };
  }

  return { modelTokens: tokens, versionTokens: [] };
}

function mergeVersionSegments(...segments: Array<string | null>): string | null {
  const mergedTokens: string[] = [];
  const seen = new Set<string>();

  for (const segment of segments) {
    const normalized = normalizeVehicleVersion(segment);
    if (!normalized) continue;

    for (const token of splitTokens(normalized)) {
      const comparable = normalizeToken(token);
      if (!comparable || seen.has(comparable)) continue;
      seen.add(comparable);
      mergedTokens.push(token);
    }
  }

  const merged = collapseSpaces(mergedTokens.join(' '));
  return merged.length > 0 ? merged : null;
}

function startsWithTokens(tokens: string[], prefix: string[]): boolean {
  if (prefix.length === 0 || prefix.length > tokens.length) return false;

  for (let index = 0; index < prefix.length; index += 1) {
    if (tokens[index] !== prefix[index]) return false;
  }

  return true;
}

function inferOfficialModelFamilySplit(
  officialModelName: string,
  officialModels: ParallelumModel[]
): { modelTokens: string[]; versionTokens: string[] } | null {
  const officialOriginalTokens = splitTokens(stripParenthesesKeepingContent(officialModelName));
  const officialNormalizedTokens = officialOriginalTokens
    .map((token) => normalizeToken(token))
    .filter((token) => token.length > 0);

  if (officialOriginalTokens.length < 2 || officialOriginalTokens.length !== officialNormalizedTokens.length) {
    return null;
  }

  const normalizedCatalog = officialModels
    .map((model) => splitTokens(stripParenthesesKeepingContent(model.nome)).map((token) => normalizeToken(token)).filter((token) => token.length > 0))
    .filter((tokens) => tokens.length > 0);

  type CandidateSplit = {
    index: number;
    relatedVariants: number;
    priority: number;
  };

  let bestSpecificFamily: CandidateSplit | null = null;
  let bestGeneral: CandidateSplit | null = null;

  for (let index = 1; index < officialOriginalTokens.length; index += 1) {
    const rawToken = officialOriginalTokens[index];
    const normalizedToken = officialNormalizedTokens[index] ?? '';

    if (!shouldTokenStartVersion(rawToken, normalizedToken, index)) {
      continue;
    }

    const baseNormalizedPrefix = officialNormalizedTokens.slice(0, index);
    const seenTails = new Set<string>();

    for (const candidateTokens of normalizedCatalog) {
      if (!startsWithTokens(candidateTokens, baseNormalizedPrefix)) continue;
      if (candidateTokens.length <= index) continue;

      const tail = candidateTokens.slice(index).join(' ');
      if (tail.length > 0) seenTails.add(tail);
    }

    const relatedVariants = seenTails.size;
    if (relatedVariants === 0) continue;

    const priority = getSplitMarkerPriority(rawToken, normalizedToken);

    if (
      relatedVariants >= 2 &&
      (
        !bestSpecificFamily ||
        priority > bestSpecificFamily.priority ||
        (priority === bestSpecificFamily.priority && index > bestSpecificFamily.index) ||
        (
          priority === bestSpecificFamily.priority &&
          index === bestSpecificFamily.index &&
          relatedVariants > bestSpecificFamily.relatedVariants
        )
      )
    ) {
      bestSpecificFamily = { index, relatedVariants, priority };
    }

    if (
      !bestGeneral ||
      priority > bestGeneral.priority ||
      (priority === bestGeneral.priority && relatedVariants > bestGeneral.relatedVariants) ||
      (
        priority === bestGeneral.priority &&
        relatedVariants === bestGeneral.relatedVariants &&
        index > bestGeneral.index
      )
    ) {
      bestGeneral = { index, relatedVariants, priority };
    }
  }

  const best = bestSpecificFamily ?? bestGeneral;

  if (!best) return null;

  const modelTokens = officialOriginalTokens.slice(0, best.index);
  const versionTokens = officialOriginalTokens.slice(best.index);

  if (modelTokens.length === 0 || versionTokens.length === 0) {
    return null;
  }

  return { modelTokens, versionTokens };
}

async function loadParallelumBrands(): Promise<ParallelumBrand[]> {
  if (!brandsCache) {
    brandsCache = fetchJson<ParallelumBrand[]>(`${FIPE_BASE_URL}/marcas`);
  }

  return brandsCache;
}

async function loadParallelumModels(brandCode: string): Promise<ParallelumModel[]> {
  const cached = modelsCache.get(brandCode);
  if (cached) return cached;

  const promise = fetchJson<{ modelos?: ParallelumModel[] }>(`${FIPE_BASE_URL}/marcas/${brandCode}/modelos`).then((data) => data.modelos ?? []);
  modelsCache.set(brandCode, promise);
  return promise;
}

function findBestModelMatch(inputTokens: string[], officialModels: ParallelumModel[]): ParallelumModel | null {
  const orderedModels = [...officialModels].sort((left, right) => {
    const leftTokens = getTokenCount(left.nome);
    const rightTokens = getTokenCount(right.nome);
    if (rightTokens !== leftTokens) return rightTokens - leftTokens;
    return normalizeComparable(right.nome).length - normalizeComparable(left.nome).length;
  });

  for (const model of orderedModels) {
    const modelTokens = splitTokens(normalizeComparable(model.nome));
    if (modelTokens.length === 0 || modelTokens.length > inputTokens.length) continue;

    let matches = true;
    for (let index = 0; index < modelTokens.length; index += 1) {
      if (inputTokens[index] !== modelTokens[index]) {
        matches = false;
        break;
      }
    }

    if (matches) return model;
  }

  return null;
}

function findBrandMatch(brand: string, brands: ParallelumBrand[]): ParallelumBrand | null {
  const normalizedBrand = normalizeComparable(brand);
  if (!normalizedBrand) return null;

  return brands.find((candidate) => normalizeComparable(candidate.nome) === normalizedBrand) ?? null;
}

function stripMatchingBrandPrefix(tokens: string[], brand: string): string[] {
  const brandTokens = splitTokens(normalizeComparable(brand));
  if (brandTokens.length === 0 || brandTokens.length > tokens.length) return tokens;

  for (let index = 0; index < brandTokens.length; index += 1) {
    if (tokens[index] !== brandTokens[index]) {
      return tokens;
    }
  }

  return tokens.slice(brandTokens.length);
}

function normalizeVersionFromTail(tokens: string[]): string | null {
  const cleanedTokens = stripIgnoredVersionTokens(tokens);
  const normalized = collapseSpaces(cleanedTokens.join(' '));
  return normalized.length > 0 ? normalized : null;
}

export function normalizeVehicleVersion(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = stripParenthesesKeepingContent(value);
  const tokens = stripIgnoredVersionTokens(splitTokens(cleaned));
  const normalized = collapseSpaces(tokens.join(' '));
  return normalized.length > 0 ? normalized : null;
}

export async function parseVehicleModelAndVersion(brand: string, rawModel: string): Promise<VehicleModelParseResult> {
  const original = rawModel ?? '';

  const cleanedWorking = stripParenthesesKeepingContent(original);
  const workingTokens = splitTokens(cleanedWorking);
  const normalizedTokens = splitTokens(normalizeComparable(cleanedWorking));

  const brands = await loadParallelumBrands();
  const matchedBrand = findBrandMatch(brand, brands);

  const brandStrippedOriginalTokens = stripMatchingBrandPrefix(workingTokens, brand);
  const brandStrippedNormalizedTokens = stripMatchingBrandPrefix(normalizedTokens, brand);

  const modelCandidates = matchedBrand ? await loadParallelumModels(matchedBrand.codigo) : [];
  const matchedModel = modelCandidates.length > 0
    ? findBestModelMatch(brandStrippedNormalizedTokens, modelCandidates)
    : null;

  if (matchedModel) {
    const officialOriginalTokenCount = splitTokens(stripParenthesesKeepingContent(matchedModel.nome)).length;
    const versionTailTokens = brandStrippedOriginalTokens.slice(officialOriginalTokenCount);
    const splitOfficial =
      inferOfficialModelFamilySplit(matchedModel.nome, modelCandidates) ??
      splitModelAndInlineVersion(splitTokens(stripParenthesesKeepingContent(matchedModel.nome)));

    const resolvedModel = collapseSpaces(splitOfficial.modelTokens.join(' ')) || matchedModel.nome;
    const inlineVersion = collapseSpaces(splitOfficial.versionTokens.join(' '));
    const tailVersion = normalizeVersionFromTail(versionTailTokens);

    return {
      original,
      model: resolvedModel,
      version: mergeVersionSegments(inlineVersion, tailVersion)
    };
  }

  const fallbackTokens = brandStrippedOriginalTokens.length > 0 ? brandStrippedOriginalTokens : workingTokens;
  const splitFallback = splitModelAndInlineVersion(fallbackTokens);
  const fallbackModel = collapseSpaces(splitFallback.modelTokens.join(' ')) || collapseSpaces(fallbackTokens.join(' ')) || original.trim();
  const fallbackVersion = normalizeVersionFromTail(splitFallback.versionTokens);

  return {
    original,
    model: fallbackModel,
    version: fallbackVersion
  };
}
