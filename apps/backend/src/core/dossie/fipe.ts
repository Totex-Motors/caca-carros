// Precos da tabela FIPE via fipeX (https://api.fipex.com.br/v1/docs): gratuita, sem chave,
// limite de 10 requisicoes/s por IP. Uma unica busca traz todas as versoes do modelo/ano.

const SEARCH_URL = 'https://api.fipex.com.br/v1/search';

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

type SearchItem = {
  make_name: string;
  model_name: string;
  model_year: number;
  fuel_name: string;
  fipe_code: string;
  latest_market_price_cents: number;
  ref_month: number;
  ref_year: number;
  type_name: string;
};

export type FipeResult = {
  referencia: string;
  versoes: { nome: string; codigo_fipe: string; preco: number; combustivel: string }[];
  faixa: { min: number; max: number };
};

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// A FIPE usa nomes como "GM - Chevrolet" e "VW - VolksWagen".
function sameMake(fipeMake: string, marca: string): boolean {
  const a = normalize(fipeMake);
  const b = normalize(marca);
  return a === b || a.split(' ').includes(b) || b.split(' ').includes(a);
}

// "COMPASS LIMITED 2.0..." comeca com as palavras de "Compass".
function sameModel(fipeModel: string, modelo: string): boolean {
  const words = normalize(fipeModel).split(' ');
  return normalize(modelo).split(' ').every((w, i) => words[i] === w);
}

/** Versoes do modelo no ano informado com o preco FIPE mais recente. null se nada for encontrado. */
export async function lookupFipe(marca: string, modelo: string, ano: number): Promise<FipeResult | null> {
  const params = new URLSearchParams({
    q: `${marca} ${modelo}`,
    limit: '50',
    'filters[0].field': 'year',
    'filters[0].op': '=',
    'filters[0].value': String(ano)
  });
  const res = await fetch(`${SEARCH_URL}?${params}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`fipeX HTTP ${res.status}`);
  const body = (await res.json()) as { data: SearchItem[] };

  const matches = body.data.filter(
    (item) =>
      item.type_name === 'carro' &&
      item.model_year === ano &&
      item.latest_market_price_cents > 0 &&
      sameMake(item.make_name, marca) &&
      sameModel(item.model_name, modelo)
  );
  if (matches.length === 0) return null;

  const versoes = matches
    .map((item) => ({
      nome: item.model_name,
      codigo_fipe: item.fipe_code,
      preco: item.latest_market_price_cents / 100,
      combustivel: item.fuel_name.trim()
    }))
    .sort((a, b) => a.preco - b.preco);

  const { ref_month, ref_year } = matches[0];
  return {
    referencia: `${MESES[ref_month - 1]} de ${ref_year}`,
    versoes,
    faixa: { min: versoes[0].preco, max: versoes[versoes.length - 1].preco }
  };
}
