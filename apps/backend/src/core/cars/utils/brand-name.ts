// A tabela FIPE nomeia algumas marcas com prefixo ("GM - Chevrolet", "VW - VolksWagen"). Os portais usam o nome
// comercial ("chevrolet", "volkswagen") nas URLs, entao a busca precisa do nome sem o prefixo.
const NOMES_COMERCIAIS: Record<string, string> = {
  'gm - chevrolet': 'Chevrolet',
  'vw - volkswagen': 'Volkswagen',
  'caoa chery': 'Chery',
  'caoa chery/chery': 'Chery'
};

export function canonicalBrandName(brand: string): string {
  const limpo = brand.trim().replace(/\s+/g, ' ');
  const conhecido = NOMES_COMERCIAIS[limpo.toLowerCase()];
  if (conhecido) return conhecido;
  // Outros casos no formato "SIGLA - Nome": fica com o nome.
  const partes = limpo.split(' - ');
  return partes.length === 2 && partes[1] ? partes[1] : limpo;
}
