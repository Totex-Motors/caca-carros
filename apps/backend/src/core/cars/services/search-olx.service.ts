import type { ExternalCar } from '../interfaces/car';
import type { SearchCarParams } from '../interfaces/search-car';
import { OlxProvider } from '../../../infra/providers/olx/olx.provider';

export class SearchOlxService {
  constructor(private readonly olxProvider = new OlxProvider()) {}

  async execute(params: SearchCarParams): Promise<ExternalCar[]> {
    try {
      return await this.olxProvider.search(params);
    } catch (error) {
      console.error('[SearchOlxService] failed', error);
      throw error;
    }
  }
}
