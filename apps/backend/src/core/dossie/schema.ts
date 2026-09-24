// JSON Schema (modo "strict" da OpenAI) do dossie gerado pela IA.
// Em modo strict todo campo e obrigatorio; campos opcionais usam null.
// Mantenha em sincronia com apps/frontend/src/services/dossie-types.ts.

export type Schema = Record<string, unknown>;

export const str = (description?: string): Schema => ({ type: 'string', ...(description ? { description } : {}) });
export const num = (description?: string): Schema => ({ type: 'number', ...(description ? { description } : {}) });
export const nullable = (schema: Schema): Schema => ({ anyOf: [schema, { type: 'null' }] });
export const arr = (items: Schema, description?: string): Schema => ({ type: 'array', items, ...(description ? { description } : {}) });
export const obj = (properties: Record<string, Schema>, description?: string): Schema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
  ...(description ? { description } : {})
});
export const faixa = (description?: string) => obj({ min: num(), max: num() }, description);

export const DOSSIE_SCHEMA = obj({
  veiculo: obj({
    marca: str('Marca oficial no Brasil, ex.: "Jeep", "Honda", "Chevrolet".'),
    modelo: str('Nome do modelo sem versao, ex.: "Compass", "Civic".'),
    ano: num('Ano-modelo consultado.'),
    geracao: str('Geracao/codigo de projeto e periodo, ex.: "1a geracao (MP), 2016-2021".'),
    versoes_comuns: arr(str(), 'Versoes vendidas no Brasil nesse ano-modelo.')
  }),
  resumo: str('3 a 5 frases tecnicas sobre o modelo nesse ano. Sem adjetivos vazios.'),
  motorizacoes: arr(obj({
    nome: str('Ex.: "2.0 Tigershark Flex".'),
    codigo_motor: nullable(str('Codigo do fabricante, ex.: "EA211", "R18Z1".')),
    cilindrada_cc: nullable(num()),
    potencia_cv: nullable(str('Com rotacao e combustivel, ex.: "166 cv (E) a 6.200 rpm".')),
    torque_kgfm: nullable(str('Com rotacao, ex.: "20,5 kgfm (E) a 4.000 rpm".')),
    combustivel: str(),
    comando_valvulas: { type: 'string', enum: ['correia', 'corrente', 'correia_banhada_oleo', 'desconhecido'] },
    intervalo_troca_comando_km: nullable(num('Intervalo recomendado de troca da correia/kit. null para corrente sem troca programada.')),
    custo_troca_comando_brl: nullable(faixa('Custo tipico em oficina independente (pecas + mao de obra).')),
    impacto_financeiro_comando: str('Explique o impacto financeiro do tipo de comando para o dono.'),
    observacoes: str('Pontos de engenharia relevantes: injecao direta, turbo, arrefecimento, etc.')
  })),
  cambios: arr(obj({
    tipo: str('Ex.: "Automatico convencional", "CVT", "Dupla embreagem", "Manual".'),
    fabricante_modelo: str('Ex.: "Aisin AW6F25 (6 marchas)", "ZF 9HP48". Use "nao confirmado" se nao souber.'),
    marchas: nullable(num()),
    troca_fluido_km: nullable(num('Intervalo recomendado na pratica (nao o "lifetime" do manual).')),
    pontos_atencao: str()
  })),
  suspensao: obj({ dianteira: str(), traseira: str(), pontos_atencao: str() }),
  consumo: obj({
    combustivel_referencia: str('Combustivel dos numeros abaixo, ex.: "Gasolina".'),
    inmetro_cidade_kml: nullable(num()),
    inmetro_estrada_kml: nullable(num()),
    real_cidade_kml: nullable(faixa('Faixa relatada por donos no uso real.')),
    real_estrada_kml: nullable(faixa())
  }),
  defeitos_cronicos: arr(obj({
    titulo: str(),
    sintoma: str('O que o comprador percebe.'),
    causa: str('Causa tecnica.'),
    km_tipico: str('Quando costuma aparecer, ex.: "60-90 mil km".'),
    gravidade: { type: 'string', enum: ['baixa', 'media', 'alta', 'critica'] },
    custo_reparo_brl: faixa()
  }), 'Problemas recorrentes conhecidos desse modelo/ano, do mais grave ao menos grave.'),
  plano_manutencao_20k: arr(obj({
    km: num('Quilometragem relativa a partir da compra: 10000 ou 20000 (ou outra marcacao relevante).'),
    itens: arr(str()),
    custo_estimado_brl: faixa('Oficina independente, pecas de boa procedencia.')
  }), 'Plano para os proximos 20.000 km apos a compra.'),
  pecas_desgaste: arr(obj({
    peca: str('Ex.: "Pastilhas dianteiras", "Discos dianteiros (par)", "Amortecedores dianteiros (par)", "Jogo de pneus".'),
    custo_brl: faixa('Peca + mao de obra, oficina independente.'),
    durabilidade_km: str()
  })),
  seguro_anual_estimado_brl: obj({
    min: num(),
    max: num(),
    observacao: str('Premissas: perfil, regiao, e por que varia.')
  }),
  veredito: obj({
    nota: num('0 a 10, considerando confiabilidade e custo de propriedade.'),
    resumo: str(),
    indicado_para: arr(str()),
    nao_indicado_para: arr(str())
  }),
  confianca: obj({
    nivel: { type: 'string', enum: ['alta', 'media', 'baixa'] },
    observacao: str('Quais dados sao menos certos e devem ser confirmados.')
  })
});
