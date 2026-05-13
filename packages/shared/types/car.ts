export type WantedCarStatus = 'PENDING' | 'FOUND' | 'BOUGHT' | 'ARCHIVED';
export type WantedCarCondition = 'NEW' | 'USED';

export type JwtToken = string;

export type WantedCarDTO = {
  id: string;
  brand: string;
  model: string;
  version: string | null;
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

export type CarDTO = {
  title: string;
  year: number;
  price: number;
  km: number | null;
  fuel_type: string | null;
  transmission: string | null;
  city: string | null;
  state: string | null;
  photos: string[];
  url: string;
};
