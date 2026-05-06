export type WantedCarStatus = 'PENDING' | 'FOUND';

export type JwtToken = string;

export type WantedCarDTO = {
  id: string;
  brand: string;
  model: string;
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
  id: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  mileage: number | null;
  fuel: string | null;
  url: string;
  image: string | null;
  createdAt: string;
  wantedCarId: string;
};
