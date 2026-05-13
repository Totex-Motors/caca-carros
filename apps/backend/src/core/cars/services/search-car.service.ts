import type { ExternalCar } from '../interfaces/car';
import type { SearchCarParams } from '../interfaces/search-car';
import { WebmotorsProvider } from '../../../infra/providers/webmotors/webmotors.provider';

export class SearchCarService {
  constructor(private readonly webmotorsProvider = new WebmotorsProvider()) {}

  async execute(params: SearchCarParams): Promise<ExternalCar[]> {
    try {
      return await this.webmotorsProvider.search(params);
    } catch (error) {
      console.error('[SearchCarService] failed', error);
      throw error;
    }
  }
}
