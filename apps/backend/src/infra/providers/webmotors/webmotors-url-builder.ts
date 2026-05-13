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
const DEFAULT_LOCATION = 'S\u00e3o Paulo';

const STATE_NAME_BY_CODE: Record<string, string> = {
  ac: 'Acre',
  al: 'Alagoas',
  ap: 'Amap\u00e1',
  am: 'Amazonas',
  ba: 'Bahia',
  ce: 'Cear\u00e1',
  df: 'Distrito Federal',
  es: 'Esp\u00edrito Santo',
  go: 'Goi\u00e1s',
  ma: 'Maranh\u00e3o',
  mt: 'Mato Grosso',
  ms: 'Mato Grosso do Sul',
  mg: 'Minas Gerais',
  pa: 'Par\u00e1',
  pb: 'Para\u00edba',
  pr: 'Paran\u00e1',
  pe: 'Pernambuco',
  pi: 'Piau\u00ed',
  rj: 'Rio de Janeiro',
  rn: 'Rio Grande do Norte',
  rs: 'Rio Grande do Sul',
  ro: 'Rond\u00f4nia',
  rr: 'Roraima',
  sc: 'Santa Catarina',
  sp: 'S\u00e3o Paulo',
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

  const modelSlug = model.modelSlug || slugify(params.model);
  const modelParam = model.modelParam || slugify(params.model).toUpperCase();
  const brandSlug = brand.slug || slugify(params.brand);

  const url = new URL(
    `https://www.webmotors.com.br/${segment}/${location.stateCode}/${brandSlug}/${modelSlug}`
  );

  const autocompleteModel = model.displayModel || params.model.trim();
  const autocompleteTerm = [brand.display, autocompleteModel].filter(Boolean).join(' ').trim();

  url.searchParams.set('lkid', lkid);
  url.searchParams.set('tipoveiculo', tipoveiculo);
  url.searchParams.set('estadocidade', location.location);

  if (autocompleteTerm) {
    url.searchParams.set('autocompleteTerm', autocompleteTerm);
    url.searchParams.set('autocomplete', autocompleteTerm);
  }

  if (brand.param) url.searchParams.set('marca1', brand.param);
  if (modelParam) url.searchParams.set('modelo1', modelParam);

  const yearTo = params.yearTo ?? params.yearFrom;
  if (params.yearFrom) url.searchParams.set('anode', String(params.yearFrom));
  if (yearTo) url.searchParams.set('anoate', String(yearTo));

  const maxPrice = toPositiveInteger(params.maxPrice);
  if (maxPrice !== null) {
    url.searchParams.set('precoate', String(maxPrice));
  }

  const mileageFrom = toPositiveInteger(params.mileageFrom ?? null);
  if (mileageFrom !== null) url.searchParams.set('kmde', String(mileageFrom));

  const mileageTo = toPositiveInteger(params.mileageTo ?? null);
  if (mileageTo !== null) url.searchParams.set('kmate', String(mileageTo));

  url.searchParams.set('page', '1');

  return url.toString();
}
