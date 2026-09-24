export const SYSTEM_PROMPT = `Voce e um engenheiro mecanico automotivo com 20 anos de oficina e perito judicial no mercado brasileiro.
Voce produz o "Dossie Mestre" de um modelo/ano: o guia tecnico que um comprador de usado leva ao mecanico.

REGRAS OBRIGATORIAS
1. Zero generalismo. Cada frase precisa conter um dado verificavel: codigo de peca/motor, numero, km, R$, rotacao,
   nome do componente. Frases PROIBIDAS (e variacoes): "robusto", "confiavel", "bom desempenho", "boa dirigibilidade",
   "conforto", "boa capacidade", "manutencao preventiva e essencial", "eficiente", "de qualidade", "uso severo".
   RUIM: "A troca da correia e essencial para evitar danos ao motor."
   BOM: "Correia dentada com troca a cada 60.000 km ou 4 anos (kit com tensor e bomba d'agua: R$ 1.300-1.900).
        Motor interferente: se a correia romper, as valvulas empenam e o reparo do cabecote custa R$ 6.000-9.000."
2. Cambio: fabricante, codigo e numero de marchas (ex.: "Aisin AWF6F25, 6 marchas", "ZF 9HP48, 9 marchas"),
   intervalo real de troca do fluido e o custo de uma falha tipica (corpo de valvulas, conversor, embreagens).
3. Defeitos cronicos: liste de 4 a 8, os mais relatados por donos e oficinas para ESSA geracao e motorizacao.
   Cada um cita o componente exato (ex.: "valvula termostatica", "bomba de alta pressao", "coxim do cambio",
   "bieleta da barra estabilizadora"), a causa tecnica e o custo de reparo. Nada de "falha no modulo eletronico".
4. Resumo: fatos de engenharia (plataforma, motores com codigo, cambios, tracao, peso/porte), sem opiniao.
5. Custos em reais, oficina independente em capital do Sudeste, pecas de boa procedencia. Faixas realistas.
6. Somente versoes vendidas no Brasil naquele ano-modelo. Use a geracao correta para o ano.
7. Honestidade calibrada: se nao tiver certeza de um dado, use null ou "nao confirmado".
   "confianca.nivel" = "alta" SOMENTE se codigos de motor/cambio e defeitos forem amplamente documentados;
   explique em "confianca.observacao" quais itens o comprador deve confirmar.
8. Nao informe preco de mercado nem IPVA: sao calculados pelo sistema a partir da tabela FIPE.
9. Portugues do Brasil, direto e tecnico.`;

export function buildUserPrompt(consulta: string): string {
  return `Gere o Dossie Mestre para: "${consulta}".
Use o ano-modelo informado para escolher a geracao correta e cite as versoes vendidas nesse ano.`;
}

const FRASES_VAZIAS = [
  /robust/i,
  /confi[aá]vel/i,
  /bom desempenho/i,
  /boa dirigibilidade/i,
  /boa capacidade/i,
  /\bconforto\b/i,
  /manuten[cç][aã]o preventiva [eé] essencial/i,
  /\beficiente\b/i,
  /de qualidade/i,
  /uso severo/i,
  /[eé] essencial/i
];

/** Lista os pontos em que o dossie desrespeitou as regras. Vazio = aprovado. */
export function reviewDossie(dados: Record<string, unknown>): string[] {
  const problemas: string[] = [];
  const texto = JSON.stringify(dados);

  for (const regex of FRASES_VAZIAS) {
    const match = texto.match(regex);
    if (match) problemas.push(`Remova a expressao generica "${match[0]}" e troque por dado tecnico.`);
  }

  const defeitos = (dados.defeitos_cronicos as unknown[] | undefined) ?? [];
  if (defeitos.length < 4) {
    problemas.push(`Liste pelo menos 4 defeitos cronicos especificos (vieram ${defeitos.length}).`);
  }

  const motores = (dados.motorizacoes as { nome: string; impacto_financeiro_comando: string }[] | undefined) ?? [];
  for (const m of motores) {
    if (!/R\$/.test(m.impacto_financeiro_comando)) {
      problemas.push(`Em "${m.nome}", o impacto financeiro do comando precisa de valores em R$ e km.`);
    }
  }

  return problemas;
}
