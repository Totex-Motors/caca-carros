import type { ExternalCar } from '../interfaces/car';
import type { SearchCarParams } from '../interfaces/search-car';
import { MercadoLivreProvider } from '../../../infra/providers/mercadolivre/mercadolivre.provider';

export class SearchMercadoLivreService {
  constructor(private readonly mercadoLivreProvider = new MercadoLivreProvider()) {}

  async execute(params: SearchCarParams): Promise<ExternalCar[]> {
    try {
      return await this.mercadoLivreProvider.search(params);
    } catch (error) {
      console.error('[SearchMercadoLivreService] failed', error);
      throw error;
    }
  }
}