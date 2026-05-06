import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../infra/database/prisma/client';
import { SearchExternalCarsService } from '../../../core/cars/services/search-external-cars.service';
import { WatchCarService } from '../../../core/cars/services/watch-car.service';

export class SearchCarController {
  constructor(
    private readonly searchExternalCarsService = new SearchExternalCarsService(),
    private readonly watchCarService = new WatchCarService()
  ) {}

  async createWanted(req: Request, res: Response): Promise<Response> {
    const { brand, model, year, yearFrom, yearTo, maxPrice, mileageFrom, mileageTo } = req.body as {
      brand?: unknown;
      model?: unknown;
      year?: unknown;
      yearFrom?: unknown;
      yearTo?: unknown;
      maxPrice?: unknown;
      mileageFrom?: unknown;
      mileageTo?: unknown;
    };

    if (typeof brand !== 'string' || typeof model !== 'string') {
      return res.status(400).json({ message: 'brand and model are required' });
    }

    const resolvedYearFromRaw = yearFrom ?? year;
    const resolvedYearToRaw = yearTo;

    const yearFromNumber = Number(resolvedYearFromRaw);
    const yearToNumber = Number(resolvedYearToRaw ?? resolvedYearFromRaw);
    const maxPriceNumber = Number(maxPrice);

    if (!Number.isInteger(yearFromNumber) || !Number.isInteger(yearToNumber) || yearFromNumber > yearToNumber) {
      return res.status(400).json({ message: 'yearFrom/yearTo must be integers and yearFrom <= yearTo' });
    }

    if (!Number.isFinite(maxPriceNumber) || maxPriceNumber <= 0) {
      return res.status(400).json({ message: 'maxPrice must be a positive number' });
    }

    const mileageFromNumber = mileageFrom === undefined || mileageFrom === null || mileageFrom === '' ? null : Number(mileageFrom);
    const mileageToNumber = mileageTo === undefined || mileageTo === null || mileageTo === '' ? null : Number(mileageTo);

    const hasMileage = mileageFromNumber !== null || mileageToNumber !== null;
    if (hasMileage) {
      if (!Number.isInteger(mileageFromNumber) || !Number.isInteger(mileageToNumber)) {
        return res.status(400).json({ message: 'mileageFrom/mileageTo must be integers when provided' });
      }
      if ((mileageFromNumber as number) > (mileageToNumber as number)) {
        return res.status(400).json({ message: 'mileageFrom must be <= mileageTo' });
      }
    }

    const wanted = await prisma.wantedCar.create({
      data: {
        brand: brand.trim(),
        model: model.trim(),
        yearFrom: yearFromNumber,
        yearTo: yearToNumber,
        mileageFrom: hasMileage ? (mileageFromNumber as number) : null,
        mileageTo: hasMileage ? (mileageToNumber as number) : null,
        maxPrice: Math.trunc(maxPriceNumber),
        status: 'PENDING'
      }
    });

    const results = await this.searchExternalCarsService.execute({
      brand: wanted.brand,
      model: wanted.model,
      yearFrom: wanted.yearFrom,
      yearTo: wanted.yearTo,
      mileageFrom: wanted.mileageFrom,
      mileageTo: wanted.mileageTo,
      maxPrice: wanted.maxPrice
    });

    if (results.length === 0) {
      await this.watchCarService.execute(wanted.id);
      const wantedWithCars = await prisma.wantedCar.findUnique({
        where: { id: wanted.id },
        include: { cars: { where: { deletedAt: null } } }
      });
      return res.status(201).json(wantedWithCars);
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.car.createMany({
        data: results.map((car) => ({
          brand: car.brand,
          model: car.model,
          year: car.year,
          price: car.price,
          mileage: car.mileage ?? undefined,
          fuel: car.fuel ?? undefined,
          url: car.url,
          image: car.image ?? undefined,
          wantedCarId: wanted.id
        })),
        skipDuplicates: true
      });

      await tx.wantedCar.update({
        where: { id: wanted.id },
        data: { status: 'FOUND' }
      });
    });

    const wantedWithCars = await prisma.wantedCar.findUnique({
      where: { id: wanted.id },
      include: { cars: { where: { deletedAt: null } } }
    });

    return res.status(201).json(wantedWithCars);
  }

  async manualSearch(req: Request, res: Response): Promise<Response> {
    const { wantedCarId } = req.body as { wantedCarId?: unknown };

    if (typeof wantedCarId === 'string') {
      const wanted = await prisma.wantedCar.findUnique({ where: { id: wantedCarId } });
      if (!wanted) return res.status(404).json({ message: 'WantedCar not found' });

      const results = await this.searchExternalCarsService.execute({
        brand: wanted.brand,
        model: wanted.model,
        yearFrom: wanted.yearFrom,
        yearTo: wanted.yearTo,
        mileageFrom: wanted.mileageFrom,
        mileageTo: wanted.mileageTo,
        maxPrice: wanted.maxPrice
      });

      if (results.length > 0) {
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          await tx.car.createMany({
            data: results.map((car) => ({
              brand: car.brand,
              model: car.model,
              year: car.year,
              price: car.price,
              mileage: car.mileage ?? undefined,
              fuel: car.fuel ?? undefined,
              url: car.url,
              image: car.image ?? undefined,
              wantedCarId: wanted.id
            })),
            skipDuplicates: true
          });

          await tx.wantedCar.update({ where: { id: wanted.id }, data: { status: 'FOUND' } });
        });
      }

      const wantedWithCars = await prisma.wantedCar.findUnique({
        where: { id: wanted.id },
        include: { cars: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } } }
      });

      return res.json(wantedWithCars);
    }

    const wantedCars = await prisma.wantedCar.findMany({ where: { status: 'PENDING' } });

    let totalCarsSaved = 0;
    let totalWantedUpdated = 0;

    for (const wanted of wantedCars) {
      const results = await this.searchExternalCarsService.execute({
        brand: wanted.brand,
        model: wanted.model,
        yearFrom: wanted.yearFrom,
        yearTo: wanted.yearTo,
        mileageFrom: wanted.mileageFrom,
        mileageTo: wanted.mileageTo,
        maxPrice: wanted.maxPrice
      });

      if (results.length === 0) continue;

      const saved = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const created = await tx.car.createMany({
          data: results.map((car) => ({
            brand: car.brand,
            model: car.model,
            year: car.year,
            price: car.price,
            mileage: car.mileage ?? undefined,
            fuel: car.fuel ?? undefined,
            url: car.url,
            image: car.image ?? undefined,
            wantedCarId: wanted.id
          })),
          skipDuplicates: true
        });

        await tx.wantedCar.update({
          where: { id: wanted.id },
          data: { status: 'FOUND' }
        });

        return created.count;
      });

      totalCarsSaved += saved;
      totalWantedUpdated += 1;
    }

    return res.json({ wantedCarsProcessed: wantedCars.length, wantedCarsUpdated: totalWantedUpdated, carsSaved: totalCarsSaved });
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

    return res.json(wanted);
  }
}
