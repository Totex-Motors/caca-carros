const FIPE_BASE_URL = 'https://parallelum.com.br/fipe/api/v1/carros';

export type FipeBrand = {
  codigo: string;
  nome: string;
};

export type FipeModel = {
  codigo: string;
  nome: string;
};

export type FipeYear = {
  codigo: string;
  nome: string;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`FIPE request failed (${response.status}): ${text}`);
  }
  return response.json() as Promise<T>;
}

export async function getFipeBrands(): Promise<FipeBrand[]> {
  const data = await fetchJson<FipeBrand[]>(`${FIPE_BASE_URL}/marcas`);
  return data.map((brand) => ({
    codigo: String(brand.codigo),
    nome: String(brand.nome)
  }));
}

export async function getFipeModels(brandCode: string): Promise<FipeModel[]> {
  const data = await fetchJson<{ modelos?: FipeModel[] }>(`${FIPE_BASE_URL}/marcas/${brandCode}/modelos`);
  return (data.modelos ?? []).map((model) => ({
    codigo: String(model.codigo),
    nome: String(model.nome)
  }));
}

export async function getFipeYears(brandCode: string, modelCode: string): Promise<FipeYear[]> {
  const data = await fetchJson<FipeYear[]>(`${FIPE_BASE_URL}/marcas/${brandCode}/modelos/${modelCode}/anos`);
  return data.map((year) => ({
    codigo: String(year.codigo),
    nome: String(year.nome)
  }));
}
