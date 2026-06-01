import type { SearchCarParams } from '../../../core/cars/interfaces/search-car';
import type { MercadoLivreSearchFilters } from './mercadolivre-types';

const BASE_URL = 'https://lista.mercadolivre.com.br/veiculos/carros-caminhonetes';

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function toPositiveInteger(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.trunc(value);
}

function resolveConditionSegment(condition: MercadoLivreSearchFilters['condition']): string | null {
  if (condition === 'NEW') return '0km-em-sao-paulo';
  if (condition === 'USED') return 'usado-em-sao-paulo';
  return null;
}

function resolveSellerTypeSegment(sellerType: MercadoLivreSearchFilters['sellerType']): string | null {
  if (sellerType === 'PRIVATE') return 'particular';
  if (sellerType === 'PROFESSIONAL') return 'concessionaria';
  return null;
}

function buildFilterSuffix(filters: MercadoLivreSearchFilters): string {
  const suffixParts: string[] = [];

  const yearFrom = toPositiveInteger(filters.yearMin);
  const yearTo = toPositiveInteger(filters.yearMax ?? filters.yearMin);
  if (yearFrom !== null || yearTo !== null) {
    const from = yearFrom ?? yearTo ?? new Date().getFullYear();
    const to = yearTo ?? yearFrom ?? from;
    suffixParts.push(`YearRange_${from}-${to}`);
  }

  const priceMax = toPositiveInteger(filters.priceMax);
  if (priceMax !== null) {
    suffixParts.push(`PriceRange_0BRL-${priceMax}BRL`);
  }

  const kmMin = toPositiveInteger(filters.kmMin);
  const kmMax = toPositiveInteger(filters.kmMax);
  if (kmMin !== null || kmMax !== null) {
    const from = kmMin ?? 0;
    const to = kmMax ?? kmMin ?? from;
    suffixParts.push(`KILOMETERS_${from}km-${to}km`);
  }

  return suffixParts.length > 0 ? `_${suffixParts.join('_')}` : '';
}

export function normalizeMercadoLivreFilters(params: SearchCarParams): MercadoLivreSearchFilters {
  const yearMin = toPositiveInteger(params.yearFrom) ?? null;
  const yearMax = toPositiveInteger(params.yearTo ?? params.yearFrom) ?? yearMin;

  return {
    state: params.state ?? 'sp',
    brand: params.brand,
    model: params.model,
    version: params.version,
    priceMin: null,
    priceMax: toPositiveInteger(params.maxPrice),
    kmMin: toPositiveInteger(params.mileageFrom ?? null),
    kmMax: toPositiveInteger(params.mileageTo ?? null),
    yearMin,
    yearMax,
    condition: params.condition,
    sellerType: params.sellerType
  };
}

export function buildMercadoLivreSearchUrl(filters: MercadoLivreSearchFilters): string {
  const brandSlug = slugify(filters.brand) || 'carros';
  const modelSlug = slugify(filters.model) || brandSlug;
  const conditionSegment = resolveConditionSegment(filters.condition);
  const sellerTypeSegment = resolveSellerTypeSegment(filters.sellerType);
  const filterSuffix = buildFilterSuffix(filters);

  const branchSegments = [BASE_URL, brandSlug, conditionSegment ? modelSlug : `${modelSlug}-em-sao-paulo`];

  if (conditionSegment) {
    branchSegments.push(conditionSegment);
  }

  if (sellerTypeSegment) {
    branchSegments.push(sellerTypeSegment);
  }

  const leafSlug = `${brandSlug}-${modelSlug}${filterSuffix}_NoIndex_True`;
  return `${branchSegments.join('/')}/${leafSlug}`;
}