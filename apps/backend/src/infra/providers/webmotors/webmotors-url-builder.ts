import type { SearchCarParams } from '../../../core/cars/interfaces/search-car';
import { normalizeWebmotorsModel } from './webmotors-model-normalizer';

type VehicleSearchType = {
  segment: string;
  lkid: string;
  tipoveiculo: string;
};

type LocationInfo = {
  stateCode: string;
  location: string;
};

const DEFAULT_STATE_CODE = 'sp';
const DEFAULT_LOCATION = 'São Paulo';

const STATE_NAME_BY_CODE: Record<string, string> = {
  ac: 'Acre',
  al: 'Alagoas',
  ap: 'Amapá',
  am: 'Amazonas',
  ba: 'Bahia',
  ce: 'Ceará',
  df: 'Distrito Federal',
  es: 'Espírito Santo',
  go: 'Goiás',
  ma: 'Maranhão',
  mt: 'Mato Grosso',
  ms: 'Mato Grosso do Sul',
  mg: 'Minas Gerais',
  pa: 'Pará',
  pb: 'Paraíba',
  pr: 'Paraná',
  pe: 'Pernambuco',
  pi: 'Piauí',
  rj: 'Rio de Janeiro',
  rn: 'Rio Grande do Norte',
  rs: 'Rio Grande do Sul',
  ro: 'Rondônia',
  rr: 'Roraima',
  sc: 'Santa Catarina',
  sp: 'São Paulo',
  se: 'Sergipe',
  to: 'Tocantins'
};

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function normalizeStateCode(state: string | null): string {
  if (!state) return DEFAULT_STATE_CODE;
  const trimmed = state.trim().toLowerCase();
  if (trimmed.length === 2 && /^[a-z]{2}$/.test(trimmed)) return trimmed;
  return DEFAULT_STATE_CODE;
}

function resolveLocation(city: string | null, state: string | null): LocationInfo {
  const stateCode = normalizeStateCode(state);
  const cityValue = city && city.trim().length > 0 ? city.trim() : null;

  if (cityValue) {
    return { stateCode, location: cityValue };
  }

  return {
    stateCode,
    location: STATE_NAME_BY_CODE[stateCode] ?? DEFAULT_LOCATION
  };
}

function resolveVehicleType(condition: SearchCarParams['condition']): VehicleSearchType {
  if (condition === 'NEW') {
    return { segment: 'carros-novos', lkid: '1001', tipoveiculo: 'carros-novos' };
  }

  if (condition === 'USED') {
    return { segment: 'carros-usados', lkid: '1000', tipoveiculo: 'carros-usados' };
  }

  return { segment: 'carros', lkid: '1705', tipoveiculo: 'carros' };
}

function resolveSellerType(sellerType: SearchCarParams['sellerType']): string | null {
  if (sellerType === 'PRIVATE') return 'Pessoa Física';
  if (sellerType === 'PROFESSIONAL') return 'Concessionária|Loja';
  return null;
}

function normalizeBrand(brand: string): { slug: string; param: string; display: string } {
  const display = brand.trim();
  const slug = slugify(display);
  const param = slug ? slug.toUpperCase() : display.toUpperCase();
  return { slug, param, display };
}

function toPositiveInteger(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) return null;
  if (value <= 0) return null;
  return Math.trunc(value);
}

export function buildWebmotorsSearchUrl(params: SearchCarParams): string {
  const { segment, lkid, tipoveiculo } = resolveVehicleType(params.condition);
  const location = resolveLocation(params.city, params.state);
  const brand = normalizeBrand(params.brand);
  const model = normalizeWebmotorsModel(params.model);

  const baseModelSlug = model.modelSlug || slugify(params.model);
  const baseModelParam = model.modelParam || slugify(params.model).toUpperCase();
  const brandSlug = brand.slug || slugify(params.brand);

  // Include version in model slug and param (e.g. Dolphin + Mini → dolphin-mini / DOLPHIN MINI)
  const modelSlug = params.version ? slugify(`${params.model} ${params.version.trim()}`) : baseModelSlug;
  const modelParam = params.version ? `${baseModelParam} ${params.version.trim().toUpperCase()}` : baseModelParam;

  const url = new URL(
    `https://www.webmotors.com.br/${segment}/${location.stateCode}/${brandSlug}/${modelSlug}`
  );

  const autocompleteModel = model.displayModel || params.model.trim();
  const versionSuffix = params.version ? ` ${params.version.trim()}` : '';
  const autocompleteTerm = [brand.display, autocompleteModel].filter(Boolean).join(' ').trim() + versionSuffix;

  url.searchParams.set('lkid', lkid);
  url.searchParams.set('tipoveiculo', tipoveiculo);
  url.searchParams.set('estadocidade', location.location);

  if (autocompleteTerm) {
    url.searchParams.set('autocompleteTerm', autocompleteTerm);
    url.searchParams.set('autocomplete', autocompleteTerm);
  }

  if (brand.param) url.searchParams.set('marca1', brand.param);
  if (modelParam) url.searchParams.set('modelo1', modelParam);

  const sellerType = resolveSellerType(params.sellerType);
  if (sellerType) url.searchParams.set('anunciante', sellerType);

  const yearFrom = params.yearFrom && params.yearFrom > 1900 ? params.yearFrom : null;
  const yearTo = yearFrom !== null ? (params.yearTo ?? params.yearFrom) : null;
  if (yearFrom !== null) url.searchParams.set('anode', String(yearFrom));
  if (yearTo !== null) url.searchParams.set('anoate', String(yearTo));

  const maxPrice = toPositiveInteger(params.maxPrice);
  if (maxPrice !== null) {
    url.searchParams.set('precoate', String(maxPrice));
  }

  url.searchParams.set('page', '1');

  return url.toString();
}
