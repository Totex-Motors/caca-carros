import type { ExternalCar } from '../interfaces/car';
import type { SearchCarParams } from '../interfaces/search-car';
import { ApifyProvider } from '../../../infra/providers/apify/apify.provider';

export class SearchCarService {
  constructor(private readonly apifyProvider = new ApifyProvider()) {}

  async execute(params: SearchCarParams): Promise<ExternalCar[]> {
    try {
      return await this.apifyProvider.search(params);
    } catch (error) {
      console.error('[SearchCarService] failed', error);
      throw error;
    }
  }
}
