export type SearchCarParams = {
  brand: string;
  model: string;
  condition: 'NEW' | 'USED' | null;
  yearFrom: number;
  yearTo: number | null;
  maxPrice: number;
  mileageFrom: number | null;
  mileageTo: number | null;
  city: string | null;
  state: string | null;
};
