export type SearchCarParams = {
  brand: string;
  model: string;
  version: string | null;
  condition: 'NEW' | 'USED' | null;
  sellerType: 'PRIVATE' | 'PROFESSIONAL' | null;
  yearFrom: number;
  yearTo: number | null;
  maxPrice: number;
  mileageFrom: number | null;
  mileageTo: number | null;
  city: string | null;
  state: string | null;
};
