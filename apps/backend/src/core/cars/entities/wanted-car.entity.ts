import type { WantedCarStatus } from '@prisma/client';

export type WantedCarEntity = {
  id: string;
  brand: string;
  model: string;
  version: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  seller?: string | null;
  yearFrom: number;
  yearTo: number | null;
  mileageFrom: number | null;
  mileageTo: number | null;
  maxPrice: number;
  status: WantedCarStatus;
  createdAt: Date;
};
