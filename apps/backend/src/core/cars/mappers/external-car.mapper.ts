import type { WantedCar } from '@prisma/client';
import type { ExternalCar } from '../interfaces/car';

function normalizePhotos(photos: string[]): string[] {
  const output: string[] = [];
  const seen = new Set<string>();

  for (const photo of photos) {
    if (!photo || typeof photo !== 'string') continue;
    if (!photo.startsWith('http')) continue;
    if (seen.has(photo)) continue;
    seen.add(photo);
    output.push(photo);
  }

  return output;
}

export function mapExternalCarToCreateInput(external: ExternalCar, wanted: WantedCar) {
  const photos = normalizePhotos(external.photos);
  const title = external.title.trim().length > 0 ? external.title : `${wanted.brand} ${wanted.model}`.trim();

  return {
    brand: wanted.brand,
    model: wanted.model,
    title,
    year: external.year,
    price: external.price,
    mileage: external.km ?? null,
    fuel: external.fuel_type ?? null,
    transmission: external.transmission ?? null,
    city: external.city ?? null,
    state: external.state ?? null,
    photos,
    url: external.url,
    image: photos[0] ?? null,
    wantedCarId: wanted.id
  };
}
