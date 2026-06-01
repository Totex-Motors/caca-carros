import type { ExternalCar } from '../interfaces/car';
import type { SearchCarParams } from '../interfaces/search-car';
import { OlxProvider } from '../../../infra/providers/olx/olx.provider';
import type { OlxScrapeDebug } from '../../../infra/providers/olx/olx-types';

export type SearchOlxResult = {
  results: ExternalCar[];
  debug?: OlxScrapeDebug;
};

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

  async executeWithDebug(params: SearchCarParams): Promise<SearchOlxResult> {
    try {
      const { cars, debug } = await this.olxProvider.searchWithDebug(params);
      return { results: cars, debug };
    } catch (error) {
      console.error('[SearchOlxService] failed', error);
      throw error;
    }
  }
}
