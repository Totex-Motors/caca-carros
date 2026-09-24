// Aliquota geral de IPVA para automoveis de passeio (gasolina/flex), por UF.
// Valores de referencia: podem mudar a cada ano e variam por combustivel, potencia e isencoes.
// Revise anualmente com a Sefaz de cada estado.
export const ALIQUOTAS_IPVA: Record<string, number> = {
  AC: 0.02, AL: 0.03, AM: 0.03, AP: 0.03, BA: 0.025, CE: 0.03, DF: 0.035, ES: 0.02,
  GO: 0.0375, MA: 0.025, MG: 0.04, MS: 0.03, MT: 0.03, PA: 0.025, PB: 0.025, PE: 0.024,
  PI: 0.025, PR: 0.019, RJ: 0.04, RN: 0.03, RO: 0.03, RR: 0.03, RS: 0.03, SC: 0.02,
  SE: 0.025, SP: 0.04, TO: 0.02
};

export type IpvaResult = {
  uf: string;
  aliquota: number;
  faixa: { min: number; max: number };
  observacao: string;
};

export function calcularIpva(uf: string, faixaFipe: { min: number; max: number }, ano: number): IpvaResult | null {
  const aliquota = ALIQUOTAS_IPVA[uf];
  if (aliquota === undefined) return null;

  const idade = new Date().getFullYear() - ano;
  const observacoes = [
    `Aliquota geral de ${(aliquota * 100).toFixed(2).replace('.', ',')}% sobre o valor FIPE em ${uf}.`,
    'A base oficial e a tabela publicada pela Sefaz, que pode diferir levemente da FIPE do mes.'
  ];
  if (idade >= 15) {
    observacoes.push('Muitos estados isentam veiculos com 15 a 20 anos ou mais: confira a regra do seu estado.');
  }

  return {
    uf,
    aliquota,
    faixa: {
      min: Math.round(faixaFipe.min * aliquota),
      max: Math.round(faixaFipe.max * aliquota)
    },
    observacao: observacoes.join(' ')
  };
}
