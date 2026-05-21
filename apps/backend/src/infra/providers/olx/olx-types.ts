export type OlxSearchFilters = {
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
};

export type OlxScrapeOptions = {
  maxAds: number;
  maxPages: number;
  retryAttempts: number;
  sessionId?: string;
};

export type OlxCardData = {
  url: string;
  title: string;
  priceText: string | null;
  locationText: string | null;
  dateText: string | null;
  kmText: string | null;
  yearText: string | null;
  fuelText: string | null;
  imageUrl: string | null;
};

export type OlxDetailData = {
  titleText: string | null;
  priceText: string | null;
  descriptionText: string | null;
  locationText: string | null;
  dateText: string | null;
  kmText: string | null;
  yearText: string | null;
  fuelText: string | null;
  colorText: string | null;
  transmissionText: string | null;
  photos: string[];
};

export type OlxListing = {
  url: string;
  title: string;
  price: number | null;
  year: number | null;
  km: number | null;
  fuel: string | null;
  color: string | null;
  description: string | null;
  location: string | null;
  postedAt: string | null;
  transmission: string | null;
  city: string | null;
  state: string | null;
  photos: string[];
};
