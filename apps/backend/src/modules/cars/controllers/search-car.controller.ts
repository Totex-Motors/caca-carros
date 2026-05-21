import type { Request, Response } from 'express';
import type { Car, WantedCar, WantedCarCondition, WantedCarStatus } from '@prisma/client';
import { prisma } from '../../../infra/database/prisma/client';
import { mapExternalCarToCreateInput } from '../../../core/cars/mappers/external-car.mapper';
import { SearchCarService } from '../../../core/cars/services/search-car.service';
import { SearchOlxService } from '../../../core/cars/services/search-olx.service';
import { parseVehicleModelAndVersion } from '../../../core/cars/utils/vehicle-model-parser';

type CarDTO = {
  title: string;
  price: number;
  year: number;
  km: number | null;
  fuel_type: string | null;
  transmission: string | null;
  city: string | null;
  state: string | null;
  photos: string[];
  url: string;
};

type WantedCarDTO = {
  id: string;
  brand: string;
  model: string;
  version: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  seller?: string | null;
  condition: WantedCarCondition | null;
  yearFrom: number;
  yearTo: number | null;
  mileageFrom: number | null;
  mileageTo: number | null;
  maxPrice: number;
  status: WantedCarStatus;
  createdAt: string;
  cars?: CarDTO[];
};

type ManualSearchBody = {
  wantedCarId?: unknown;
  city?: unknown;
  state?: unknown;
};

function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/\/\/[^@\s]+@/g, '//***@')
    .replace(/\b[^\s:@]+:[^\s@]+@/g, '***:***@')
    .trim();
}

function toSafeErrorDetails(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) {
    return sanitizeErrorMessage(error.message);
  }
  if (typeof error === 'string') {
    return sanitizeErrorMessage(error);
  }
  try {
    return sanitizeErrorMessage(JSON.stringify(error));
  } catch {
    return null;
  }
}

function isOlxDebugEnabled(): boolean {
  const flag = process.env.OLX_DEBUG_ERRORS ?? 'false';
  return flag.toLowerCase() === 'true';
}

function mapCarToDto(car: Car): CarDTO {
  const rawPhotos = Array.isArray(car.photos) ? car.photos : [];
  const photos = rawPhotos.length > 0
    ? rawPhotos
    : car.image
      ? [car.image]
      : [];

  return {
    title: car.title ?? `${car.brand} ${car.model}`.trim(),
    price: car.price,
    year: car.year,
    km: car.mileage ?? null,
    fuel_type: car.fuel ?? null,
    transmission: car.transmission ?? null,
    city: car.city ?? null,
    state: car.state ?? null,
    photos,
    url: car.url
  };
}

function mapWantedToDto(wanted: WantedCar & { cars?: Car[] }): WantedCarDTO {
  return {
    id: wanted.id,
    brand: wanted.brand,
    model: wanted.model,
    version: wanted.version ?? null,
    clientName: (wanted as any).clientName ?? null,
    clientPhone: (wanted as any).clientPhone ?? null,
    seller: (wanted as any).seller ?? null,
    condition: wanted.condition ?? null,
    yearFrom: wanted.yearFrom,
    yearTo: wanted.yearTo,
    mileageFrom: wanted.mileageFrom,
    mileageTo: wanted.mileageTo,
    maxPrice: wanted.maxPrice,
    status: wanted.status,
    createdAt: wanted.createdAt.toISOString(),
    cars: wanted.cars ? wanted.cars.map(mapCarToDto) : undefined
  };
}

function parseOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  return parsed;
}

export class SearchCarController {
  constructor(
    private readonly searchService = new SearchCarService(),
    private readonly searchOlxService = new SearchOlxService()
  ) {}

  async createWanted(req: Request, res: Response): Promise<Response> {
    const { brand, model, version, condition, year, yearFrom, yearTo, maxPrice, mileageFrom, mileageTo, clientName, clientPhone, seller } = req.body as {
      brand?: unknown;
      model?: unknown;
      version?: unknown;
      condition?: unknown;
      year?: unknown;
      yearFrom?: unknown;
      yearTo?: unknown;
      maxPrice?: unknown;
      mileageFrom?: unknown;
      mileageTo?: unknown;
      clientName?: unknown;
      clientPhone?: unknown;
      seller?: unknown;
    };

    if (typeof brand !== 'string' || typeof model !== 'string') {
      return res.status(400).json({ message: 'brand and model are required' });
    }

    const parsedModel = await parseVehicleModelAndVersion(brand, [model, typeof version === 'string' ? version : ''].filter(Boolean).join(' '));
    const resolvedModel = parsedModel.model.trim();
    const resolvedVersion = parsedModel.version;

    if (!resolvedModel) {
      return res.status(400).json({ message: 'model is invalid' });
    }

    const resolvedYearFromRaw = yearFrom ?? year ?? null;
    const resolvedYearToRaw = yearTo ?? null;

    const yearFromNumber = resolvedYearFromRaw === null || resolvedYearFromRaw === undefined || resolvedYearFromRaw === ''
      ? null
      : Number(resolvedYearFromRaw);
    const yearToNumber = resolvedYearToRaw === null || resolvedYearToRaw === undefined || resolvedYearToRaw === ''
      ? null
      : Number(resolvedYearToRaw);

    const currentYear = new Date().getFullYear();
    let resolvedYearFrom = yearFromNumber;
    let resolvedYearTo = yearToNumber;

    if (resolvedYearFrom === null && resolvedYearTo === null) {
      resolvedYearFrom = 1900;
      resolvedYearTo = currentYear;
    } else if (resolvedYearFrom !== null && resolvedYearTo === null) {
      resolvedYearTo = resolvedYearFrom;
    } else if (resolvedYearFrom === null && resolvedYearTo !== null) {
      resolvedYearFrom = resolvedYearTo;
    }

    if (!Number.isInteger(resolvedYearFrom) || !Number.isInteger(resolvedYearTo) || (resolvedYearFrom as number) > (resolvedYearTo as number)) {
      return res.status(400).json({ message: 'yearFrom/yearTo must be integers and yearFrom <= yearTo' });
    }

    const maxPriceNumber = maxPrice === undefined || maxPrice === null || maxPrice === '' ? null : Number(maxPrice);
    const defaultMaxPrice = 2147483647;
    const resolvedMaxPrice = Number.isFinite(maxPriceNumber as number) && (maxPriceNumber as number) > 0
      ? Math.trunc(maxPriceNumber as number)
      : defaultMaxPrice;

    const mileageFromNumber = mileageFrom === undefined || mileageFrom === null || mileageFrom === '' ? null : Number(mileageFrom);
    const mileageToNumber = mileageTo === undefined || mileageTo === null || mileageTo === '' ? null : Number(mileageTo);

    const hasMileage = mileageFromNumber !== null || mileageToNumber !== null;
    if (mileageFromNumber !== null && !Number.isInteger(mileageFromNumber)) {
      return res.status(400).json({ message: 'mileageFrom must be an integer when provided' });
    }
    if (mileageToNumber !== null && !Number.isInteger(mileageToNumber)) {
      return res.status(400).json({ message: 'mileageTo must be an integer when provided' });
    }
    if (mileageFromNumber !== null && mileageToNumber !== null && mileageFromNumber > mileageToNumber) {
      return res.status(400).json({ message: 'mileageFrom must be <= mileageTo' });
    }

    const resolvedCondition = typeof condition === 'string' && condition.trim() !== ''
      ? condition.trim().toUpperCase()
      : null;

    if (resolvedCondition !== null && resolvedCondition !== 'NEW' && resolvedCondition !== 'USED') {
      return res.status(400).json({ message: 'condition must be NEW or USED when provided' });
    }

    const wanted = await prisma.wantedCar.create({
      data: {
        brand: brand.trim(),
        model: resolvedModel,
        version: resolvedVersion,
        clientName: typeof clientName === 'string' && clientName.trim() !== '' ? clientName.trim() : null,
        clientPhone: typeof clientPhone === 'string' && clientPhone.trim() !== '' ? clientPhone.trim() : null,
        seller: typeof seller === 'string' && seller.trim() !== '' ? seller.trim() : null,
        condition: resolvedCondition as WantedCarCondition | null,
        yearFrom: resolvedYearFrom as number,
        yearTo: resolvedYearTo as number,
        mileageFrom: hasMileage ? (mileageFromNumber as number) : null,
        mileageTo: hasMileage ? (mileageToNumber as number) : null,
        maxPrice: resolvedMaxPrice,
        status: 'PENDING'
      }
    });

    const wantedWithCars = await prisma.wantedCar.findUnique({
      where: { id: wanted.id },
      include: { cars: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } } }
    });

    if (!wantedWithCars) {
      return res.status(404).json({ message: 'WantedCar not found' });
    }

    return res.status(201).json(mapWantedToDto(wantedWithCars));
  }

  async updateWanted(req: Request, res: Response): Promise<Response> {
    const { id } = req.params as { id?: string };
    const { clientName, clientPhone, seller } = req.body as { clientName?: unknown; clientPhone?: unknown; seller?: unknown };

    if (!id) return res.status(400).json({ message: 'id is required' });

    const wanted = await prisma.wantedCar.findUnique({ where: { id }, include: { cars: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } } } });
    if (!wanted) return res.status(404).json({ message: 'WantedCar not found' });

    const updated = await prisma.wantedCar.update({
      where: { id },
      data: {
        clientName: typeof clientName === 'string' && clientName.trim() !== '' ? clientName.trim() : null,
        clientPhone: typeof clientPhone === 'string' && clientPhone.trim() !== '' ? clientPhone.trim() : null,
        seller: typeof seller === 'string' && seller.trim() !== '' ? seller.trim() : null
      },
      include: { cars: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } } }
    });

    return res.json(mapWantedToDto(updated));
  }

  async manualSearch(req: Request, res: Response): Promise<Response> {
    const { wantedCarId, city, state } = req.body as ManualSearchBody;

    if (typeof wantedCarId !== 'string') {
      return res.status(400).json({ message: 'wantedCarId is required' });
    }

    const wanted = await prisma.wantedCar.findUnique({ where: { id: wantedCarId } });
    if (!wanted) return res.status(404).json({ message: 'WantedCar not found' });

    if (!process.env.APIFY_TOKEN) {
      return res.status(500).json({ message: 'APIFY_TOKEN nao configurado.' });
    }

    const resolvedCity = typeof city === 'string' && city.trim().length > 0 ? city.trim() : null;
    const resolvedState = typeof state === 'string' && state.trim().length > 0 ? state.trim() : null;

    try {
      const results = await this.searchService.execute({
        brand: wanted.brand,
        model: wanted.model,
        version: wanted.version ?? null,
        condition: wanted.condition,
        yearFrom: wanted.yearFrom,
        yearTo: wanted.yearTo,
        maxPrice: wanted.maxPrice,
        mileageFrom: wanted.mileageFrom,
        mileageTo: wanted.mileageTo,
        city: resolvedCity,
        state: resolvedState
      });

      if (results.length === 0) {
        return res.json({
          wantedCarId: wanted.id,
          adsFound: 0,
          carsSaved: 0,
          message: 'Nenhum anuncio encontrado.'
        });
      }

      const savedCount = await prisma.$transaction(async (tx) => {
        const created = await tx.car.createMany({
          data: results.map((car) => mapExternalCarToCreateInput(car, wanted)),
          skipDuplicates: true
        });

        await tx.wantedCar.update({ where: { id: wanted.id }, data: { status: 'FOUND' } });

        return created.count;
      });

      const message = savedCount > 0
        ? `Busca concluida. ${savedCount} anuncios salvos.`
        : 'Busca concluida, mas nenhum anuncio novo foi salvo.';

      console.info('[SearchCarController] manual search done', {
        wantedCarId: wanted.id,
        adsFound: results.length,
        carsSaved: savedCount
      });

      return res.json({
        wantedCarId: wanted.id,
        adsFound: results.length,
        carsSaved: savedCount,
        message
      });
    } catch (error) {
      console.error('[SearchCarController] manual search failed', error);
      return res.status(500).json({ message: 'Falha ao buscar anuncios externos.' });
    }
  }

  async manualSearchOlx(req: Request, res: Response): Promise<Response> {
    const { wantedCarId, city, state } = req.body as ManualSearchBody;

    if (typeof wantedCarId !== 'string') {
      return res.status(400).json({ message: 'wantedCarId is required' });
    }

    const wanted = await prisma.wantedCar.findUnique({ where: { id: wantedCarId } });
    if (!wanted) return res.status(404).json({ message: 'WantedCar not found' });

    const resolvedCity = typeof city === 'string' && city.trim().length > 0 ? city.trim() : null;
    const resolvedState = typeof state === 'string' && state.trim().length > 0 ? state.trim() : null;

    try {
      const debugEnabled = isOlxDebugEnabled();
      const searchResponse = debugEnabled
        ? await this.searchOlxService.executeWithDebug({
          brand: wanted.brand,
          model: wanted.model,
          version: wanted.version ?? null,
          condition: wanted.condition,
          yearFrom: wanted.yearFrom,
          yearTo: wanted.yearTo,
          maxPrice: wanted.maxPrice,
          mileageFrom: wanted.mileageFrom,
          mileageTo: wanted.mileageTo,
          city: resolvedCity,
          state: resolvedState
        })
        : { results: await this.searchOlxService.execute({
          brand: wanted.brand,
          model: wanted.model,
          version: wanted.version ?? null,
          condition: wanted.condition,
          yearFrom: wanted.yearFrom,
          yearTo: wanted.yearTo,
          maxPrice: wanted.maxPrice,
          mileageFrom: wanted.mileageFrom,
          mileageTo: wanted.mileageTo,
          city: resolvedCity,
          state: resolvedState
        }) };

      const results = searchResponse.results;

      if (results.length === 0) {
        return res.json({
          wantedCarId: wanted.id,
          adsFound: 0,
          carsSaved: 0,
          message: 'Nenhum anuncio encontrado na OLX.',
          ...(debugEnabled && searchResponse.debug ? { debug: searchResponse.debug } : {})
        });
      }

      const savedCount = await prisma.$transaction(async (tx) => {
        const created = await tx.car.createMany({
          data: results.map((car) => mapExternalCarToCreateInput(car, wanted)),
          skipDuplicates: true
        });

        await tx.wantedCar.update({ where: { id: wanted.id }, data: { status: 'FOUND' } });

        return created.count;
      });

      const message = savedCount > 0
        ? `Busca OLX concluida. ${savedCount} anuncios salvos.`
        : 'Busca OLX concluida, mas nenhum anuncio novo foi salvo.';

      console.info('[SearchCarController] manual search olx done', {
        wantedCarId: wanted.id,
        adsFound: results.length,
        carsSaved: savedCount
      });

      return res.json({
        wantedCarId: wanted.id,
        adsFound: results.length,
        carsSaved: savedCount,
        message,
        ...(debugEnabled && searchResponse.debug ? { debug: searchResponse.debug } : {})
      });
    } catch (error) {
      console.error('[SearchCarController] manual search olx failed', error);
      const details = isOlxDebugEnabled() ? toSafeErrorDetails(error) : null;
      return res.status(500).json({
        message: 'Falha ao buscar anuncios na OLX.',
        ...(details ? { details } : {})
      });
    }
  }

  async updateWantedStatus(req: Request, res: Response): Promise<Response> {
    const { id } = req.params as { id?: string };
    const { status } = req.body as { status?: unknown };

    if (!id) return res.status(400).json({ message: 'id is required' });
    if (typeof status !== 'string') {
      return res.status(400).json({ message: 'status is required' });
    }

    const allowed = new Set(['PENDING', 'FOUND', 'BOUGHT', 'ARCHIVED']);
    if (!allowed.has(status)) {
      return res.status(400).json({ message: 'invalid status' });
    }

    const wanted = await prisma.wantedCar.findUnique({ where: { id } });
    if (!wanted) return res.status(404).json({ message: 'WantedCar not found' });

    const updated = await prisma.wantedCar.update({
      where: { id },
      data: { status: status as unknown as WantedCarStatus },
      include: { cars: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } } }
    });

    return res.json(mapWantedToDto(updated));
  }

  async listWanted(req: Request, res: Response): Promise<Response> {
    const wanted = await prisma.wantedCar.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        cars: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    return res.json(wanted.map(mapWantedToDto));
  }

  async listWantedCars(req: Request, res: Response): Promise<Response> {
    const { id } = req.params as { id?: string };

    if (!id) return res.status(400).json({ message: 'id is required' });

    const page = parseOptionalInt(req.query.page) ?? 1;
    const limit = parseOptionalInt(req.query.limit) ?? 10;

    if (page < 1 || limit < 1) {
      return res.status(400).json({ message: 'page and limit must be positive integers' });
    }

    const safeLimit = Math.min(limit, 50);
    const offset = (page - 1) * safeLimit;

    const wanted = await prisma.wantedCar.findUnique({ where: { id }, select: { id: true } });
    if (!wanted) return res.status(404).json({ message: 'WantedCar not found' });

    const [total, cars] = await prisma.$transaction([
      prisma.car.count({ where: { wantedCarId: id, deletedAt: null } }),
      prisma.car.findMany({
        where: { wantedCarId: id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: safeLimit
      })
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / safeLimit);

    return res.json({
      data: cars.map(mapCarToDto),
      page,
      limit: safeLimit,
      total,
      totalPages
    });
  }
}
