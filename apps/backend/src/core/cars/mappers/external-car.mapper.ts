import type { ExternalCar } from '../interfaces/car';

type WantedCarLike = {
  id: string;
  brand: string;
  model: string;
};

function readEnv(name: string): string | null {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

function isOlxSource(url: string): boolean {
  return url.includes('olx.com.br');
}

function isOlxImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.endsWith('.svg')) return false;

  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes('olx');
  } catch {
    return false;
  }
}

function normalizeFallbackPhoto(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('http')) return null;
  return value;
}

function normalizePhotos(photos: string[], sourceUrl: string): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  const filterOlx = isOlxSource(sourceUrl);

  for (const photo of photos) {
    if (!photo || typeof photo !== 'string') continue;
    const normalized = photo.startsWith('//') ? `https:${photo}` : photo;
    if (!normalized.startsWith('http')) continue;
    if (filterOlx && !isOlxImage(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }

  return output;
}

export function mapExternalCarToCreateInput(external: ExternalCar, wanted: WantedCarLike, portal?: string | null) {
  const photos = normalizePhotos(external.photos, external.url);
  const fallbackPhoto = normalizeFallbackPhoto(readEnv('DEFAULT_CAR_PHOTO_URL'));
  const resolvedPhotos = photos.length > 0 ? photos : fallbackPhoto ? [fallbackPhoto] : [];
  const title = external.title.trim().length > 0 ? external.title : `${wanted.brand} ${wanted.model}`.trim();

  const currentYear = new Date().getFullYear();
  const km = external.km !== null && external.km >= 0 && external.km <= 1_500_000 ? external.km : null;
  const price = external.price >= 0 && external.price <= 50_000_000 ? external.price : 0;
  const year = external.year >= 1900 && external.year <= currentYear + 2 ? external.year : currentYear;

  return {
    brand: wanted.brand,
    model: wanted.model,
    title,
    year,
    price,
    mileage: km,
    fuel: external.fuel_type ?? null,
    transmission: external.transmission ?? null,
    city: external.city ?? null,
    state: external.state ?? null,
    photos: resolvedPhotos,
    url: external.url,
    image: resolvedPhotos[0] ?? null,
    portal: portal ?? null,
    wantedCarId: wanted.id
  };
}
