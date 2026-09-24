// Formato das respostas de /dossie e /dossie/analise (apps/backend/src/core/dossie).
// Mantenha em sincronia com apps/backend/src/core/dossie/schema.ts e analise.ts.

export type Faixa = { min: number; max: number };

export type Gravidade = 'baixa' | 'media' | 'alta' | 'critica';

export type Motorizacao = {
  nome: string;
  codigo_motor: string | null;
  cilindrada_cc: number | null;
  potencia_cv: string | null;
  torque_kgfm: string | null;
  combustivel: string;
  comando_valvulas: 'correia' | 'corrente' | 'correia_banhada_oleo' | 'desconhecido';
  intervalo_troca_comando_km: number | null;
  custo_troca_comando_brl: Faixa | null;
  impacto_financeiro_comando: string;
  observacoes: string;
};

export type Cambio = {
  tipo: string;
  fabricante_modelo: string;
  marchas: number | null;
  troca_fluido_km: number | null;
  pontos_atencao: string;
};

export type DefeitoCronico = {
  titulo: string;
  sintoma: string;
  causa: string;
  km_tipico: string;
  gravidade: Gravidade;
  custo_reparo_brl: Faixa;
};

export type ItemRevisao = {
  km: number;
  itens: string[];
  custo_estimado_brl: Faixa;
};

export type PecaDesgaste = {
  peca: string;
  custo_brl: Faixa;
  durabilidade_km: string;
};

export type DossieIA = {
  veiculo: {
    marca: string;
    modelo: string;
    ano: number;
    geracao: string;
    versoes_comuns: string[];
  };
  resumo: string;
  motorizacoes: Motorizacao[];
  cambios: Cambio[];
  suspensao: { dianteira: string; traseira: string; pontos_atencao: string };
  consumo: {
    combustivel_referencia: string;
    inmetro_cidade_kml: number | null;
    inmetro_estrada_kml: number | null;
    real_cidade_kml: Faixa | null;
    real_estrada_kml: Faixa | null;
  };
  defeitos_cronicos: DefeitoCronico[];
  plano_manutencao_20k: ItemRevisao[];
  pecas_desgaste: PecaDesgaste[];
  seguro_anual_estimado_brl: Faixa & { observacao: string };
  veredito: {
    nota: number;
    resumo: string;
    indicado_para: string[];
    nao_indicado_para: string[];
  };
  confianca: { nivel: 'alta' | 'media' | 'baixa'; observacao: string };
};

// Dados calculados (nao vem da IA).
export type FipeVersao = { nome: string; codigo_fipe: string; preco: number; combustivel: string };

export type Fipe = {
  referencia: string;
  versoes: FipeVersao[];
  faixa: Faixa;
} | null;

export type Ipva = {
  uf: string;
  aliquota: number;
  faixa: Faixa;
  observacao: string;
} | null;

export type Dossie = {
  id: string;
  slug: string;
  consulta: string;
  created_at: string;
  modelo_ia: string;
  dados: DossieIA;
  fipe: Fipe;
  ipva: Ipva;
  cache: boolean;
};

export type CategoriaAlerta = 'golpe' | 'km' | 'preco' | 'divergencia' | 'estrutura' | 'mecanica' | 'documentacao' | 'outro';

export type AnaliseIA = {
  resumo: string;
  score_confianca: number;
  recomendacao: 'seguir' | 'seguir_com_cautela' | 'evitar';
  km: {
    km_anunciado: number | null;
    leitura_odometro: string | null;
    indicios_desgaste: string;
    compatibilidade: 'compativel' | 'suspeito' | 'incompativel' | 'sem_evidencia';
    justificativa: string;
  };
  alertas: { categoria: CategoriaAlerta; gravidade: Gravidade; titulo: string; evidencia: string; como_verificar: string }[];
  pontos_positivos: string[];
  fotos: { foto: number; observacao: string }[];
  perguntas_ao_vendedor: string[];
  checklist_vistoria: string[];
  custo_imediato_estimado_brl: Faixa | null;
};

export type PrecoVsFipe = {
  preco: number;
  fipe_min: number;
  fipe_max: number;
  diferenca_pct: number;
  situacao: 'muito_abaixo' | 'abaixo' | 'dentro' | 'acima';
};

export type Analise = {
  id: string;
  url: string | null;
  fonte: 'fetch' | 'navegador' | 'manual';
  titulo: string;
  fotos: string[];
  identificacao: {
    marca: string | null;
    modelo: string | null;
    ano_modelo: number | null;
    versao: string | null;
    km_anunciado: number | null;
    preco_anunciado: number | null;
    cidade: string | null;
    uf: string | null;
    tipo_vendedor: 'particular' | 'loja' | 'desconhecido';
  };
  fipe: Fipe;
  preco_vs_fipe: PrecoVsFipe | null;
  analise: AnaliseIA;
  dossie: Dossie | null;
  dossie_erro: string | null;
};
