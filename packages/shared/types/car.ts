export type WantedCarStatus = 'PENDING' | 'FOUND' | 'BOUGHT' | 'ARCHIVED';
export type WantedCarCondition = 'NEW' | 'USED';
export type WantedCarSellerType = 'PRIVATE' | 'PROFESSIONAL';

export type JwtToken = string;

export type WantedCarDTO = {
  id: string;
  brand: string;
  model: string;
  version: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  seller?: string | null;
  sellerType?: WantedCarSellerType | null;
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
