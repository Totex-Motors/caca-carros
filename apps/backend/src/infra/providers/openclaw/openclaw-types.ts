export type OpenClawPortal = 'OLX' | 'MERCADO_LIVRE' | 'FACEBOOK_MARKETPLACE';

export type OpenClawField =
  | 'title'
  | 'price'
  | 'url'
  | 'images'
  | 'km'
  | 'year'
  | 'fuel'
  | 'color'
  | 'description'
  | 'location'
  | 'postedAt'
  | 'transmission';

export type OpenClawHint = {
  field: OpenClawField;
  value?: string | number | string[] | null;
  selector?: string | null;
  confidence?: number | null;
};

export type OpenClawAnalysisInput = {
  portal: OpenClawPortal;
  url: string;
  html?: string | null;
  missingFields: OpenClawField[];
  context?: Record<string, string>;
};

export type OpenClawAnalysisResult = {
  hints: OpenClawHint[];
  raw?: unknown;
};
