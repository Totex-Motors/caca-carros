import type { ExternalCar } from '../interfaces/car';
import { OlxProvider } from '../../../infra/providers/apify/apify-cars.provider';

export class SearchExternalCarsService {
  constructor(private readonly olxProvider = new OlxProvider()) {}

  async execute(params: {
    brand: string;
    model: string;
    yearFrom: number;
    yearTo: number | null;
    maxPrice: number;
    mileageFrom: number | null;
    mileageTo: number | null;
  }): Promise<ExternalCar[]> {
    try {
      return await this.olxProvider.search(params);
    } catch (err) {
      console.error('[SearchExternalCarsService] external search failed', err);
      return [];
    }
  }
}
