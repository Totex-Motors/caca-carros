export type WantedCarStatus = 'PENDING' | 'FOUND' | 'BOUGHT' | 'ARCHIVED';
export type WantedCarCondition = 'NEW' | 'USED';
export type WantedCarSellerType = 'PRIVATE' | 'PROFESSIONAL';

export type JwtToken = string;

export type WantedCarDTO = {
  id: string;
  brand: string;
  model: string;
  version: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  seller?: string | null;
  sellerType?: WantedCarSellerType | null;
  condition: WantedCarCondition | null;
  yearFrom: number;
  yearTo: number | null;
  mileageFrom: number | null;
  mileageTo: number | null;
  maxPrice: number;
  status: WantedCarStatus;
  createdAt: string;
  searching: boolean;
  state?: string | null;
  city?: string | null;
  lastSearch?: LastSearchDTO | null;
  cars?: CarDTO[];
};

export type PortalSearchStatus = 'ok' | 'vazio' | 'erro' | 'nao_configurado';

// Resultado da ultima busca automatica, por portal (fica em memoria no servidor).
export type LastSearchDTO = {
  finishedAt: string;
  portais: Record<string, { status: PortalSearchStatus; count?: number; mensagem?: string }>;
};

export type CarDTO = {
  title: string;
  year: number;
  price: number;
  km: number | null;
  fuel_type: string | null;
  transmission: string | null;
  city: string | null;
  state: string | null;
  photos: string[];
  url: string;
  portal: string | null;
};
