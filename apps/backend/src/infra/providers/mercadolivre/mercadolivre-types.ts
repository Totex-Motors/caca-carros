export type MercadoLivreSearchFilters = {
  state: string;
  brand: string;
  model: string;
  version: string | null;
  priceMin: number | null;
  priceMax: number | null;
  kmMin: number | null;
  kmMax: number | null;
  yearMin: number | null;
  yearMax: number | null;
  condition: 'NEW' | 'USED' | null;
  sellerType: 'PRIVATE' | 'PROFESSIONAL' | null;
};

export type MercadoLivreScrapeOptions = {
  maxAds: number;
  maxPages: number;
  retryAttempts: number;
  sessionId?: string;
};

export type MercadoLivreScrapeDebugPage = {
  page: number;
  url: string;
  cardCount: number;
  collected: number;
};

export type MercadoLivreScrapeDebug = {
  pages: MercadoLivreScrapeDebugPage[];
  collected: number;
  detailAttempts: number;
  detailErrors: number;
};

export type MercadoLivreListing = {
  url: string;
  title: string;
  price: number | null;
  year: number | null;
  km: number | null;
  fuel: string | null;
  transmission: string | null;
  city: string | null;
  state: string | null;
  photos: string[];
};

export type MercadoLivreScrapeResult = {
  listings: MercadoLivreListing[];
  debug?: MercadoLivreScrapeDebug;
};