import type { Prisma } from '@prisma/client';
import { prisma } from '../../infra/database/prisma/client';
import { AnuncioBloqueadoError, baixarFotos, lerAnuncio, type AnuncioLido } from './anuncio-reader';
import { getOrCreateDossie, toDossieDTO, type DossieDTO } from './dossie.service';
import { lookupFipe, type FipeResult } from './fipe';
import { completeJson, type ChatMessage } from './openai';
import { arr, faixa, nullable, num, obj, str } from './schema';

// Analise de um anuncio especifico: le o link (ou texto + fotos enviados), identifica o carro,
// compara o preco com a FIPE, pede a IA uma vistoria das fotos e da descricao e junta o dossie do modelo/ano.

const MAX_FOTOS = 8;
const MAX_FOTO_DATA_URL = 3_500_000; // ~2,6 MB de imagem

export class AnaliseInvalidaError extends Error {}
export { AnuncioBloqueadoError };

const GRAVIDADE = { type: 'string', enum: ['baixa', 'media', 'alta', 'critica'] };

const IDENTIFICACAO_SCHEMA = obj({
  marca: nullable(str('Marca como usada no Brasil, ex.: "Jeep", "Chevrolet".')),
  modelo: nullable(str('Modelo sem versao, ex.: "Compass", "Onix".')),
  ano_modelo: nullable(num()),
  versao: nullable(str()),
  km_anunciado: nullable(num()),
  preco_anunciado: nullable(num('Preco pedido em reais, sem centavos.')),
  cidade: nullable(str()),
  uf: nullable(str()),
  tipo_vendedor: { type: 'string', enum: ['particular', 'loja', 'desconhecido'] }
});

const ANALISE_SCHEMA = obj({
  resumo: str('3 a 5 frases com a conclusao da vistoria remota, citando as evidencias principais.'),
  score_confianca: num('0 a 100: confianca de que o anuncio e legitimo e o carro corresponde ao anunciado.'),
  recomendacao: { type: 'string', enum: ['seguir', 'seguir_com_cautela', 'evitar'] },
  km: obj({
    km_anunciado: nullable(num()),
    leitura_odometro: nullable(str('Valor lido no painel em alguma foto, citando a foto. null se nao aparece.')),
    indicios_desgaste: str('Volante, manopla, pedais, bancos, borrachas: o que as fotos mostram, citando as fotos.'),
    compatibilidade: { type: 'string', enum: ['compativel', 'suspeito', 'incompativel', 'sem_evidencia'] },
    justificativa: str()
  }),
  alertas: arr(
    obj({
      categoria: {
        type: 'string',
        enum: ['golpe', 'km', 'preco', 'divergencia', 'estrutura', 'mecanica', 'documentacao', 'outro']
      },
      gravidade: GRAVIDADE,
      titulo: str(),
      evidencia: str('O que exatamente foi visto e onde (ex.: "foto 3: tonalidade diferente na porta traseira").'),
      como_verificar: str('Como o comprador confirma pessoalmente ou por documento.')
    }),
    'Do mais grave ao menos grave. Somente com evidencia no texto ou nas fotos.'
  ),
  pontos_positivos: arr(str('Somente com evidencia (ex.: "foto 5: pneus com sulco aparente e mesma marca").')),
  fotos: arr(obj({ foto: num('Numero da foto, a partir de 1.'), observacao: str() })),
  perguntas_ao_vendedor: arr(str()),
  checklist_vistoria: arr(str('Itens para conferir no carro, priorizando os defeitos cronicos do modelo.')),
  custo_imediato_estimado_brl: nullable(faixa('Reparos visiveis ou provaveis logo apos a compra.'))
});

const PROMPT_ANALISE = `Voce e um perito em vistoria automotiva e em fraudes de anuncios de carros usados no Brasil.
Voce recebe o texto de um anuncio, as fotos numeradas e dados calculados pelo sistema (FIPE e diferenca de preco).
Faca uma vistoria remota: o objetivo e proteger o comprador.

VERIFIQUE
1. Quilometragem: leia o odometro se aparecer; compare o desgaste de volante, manopla, pedais, banco do motorista
   e borrachas com a km anunciada. Km baixa com volante liso/brilhante e pedal gasto = suspeito.
2. Golpe: preco muito abaixo da FIPE, pedido de sinal/PIX/deposito antecipado, vendedor "fora da cidade" ou que
   so fala por mensagem, pressa, texto generico ou copiado, fotos de carros diferentes (cor, rodas, placa ou interior
   mudando entre fotos), fotos de catalogo, placa escondida em todas as fotos, anuncio de loja com preco de particular.
3. Divergencias: ano/versao anunciados x itens visiveis (rodas, farois, lanternas, central, painel, bancos).
4. Estrutura: diferenca de tonalidade entre pecas, frestas irregulares, parafusos de paralama/capo mexidos,
   solda ou massa aparente, farol novo de um lado so, sinais de enchente (oxidacao, barro no carpete).
5. Mecanica/estado: vazamentos visiveis, pneus desalinhados ou de marcas diferentes, luzes de alerta no painel.

REGRAS
- Toda conclusao cita a evidencia e o numero da foto. Se as fotos nao permitem avaliar, diga "sem evidencia".
- Nao invente defeitos. Nao afirme golpe com certeza: indique o risco e como confirmar.
- Use os defeitos cronicos do modelo (quando informados) para montar o checklist da vistoria presencial.
- score_confianca: 80-100 sem sinais relevantes; 50-79 pontos a esclarecer; abaixo de 50 sinais fortes de risco.
- Portugues do Brasil, direto e tecnico.`;

type Identificacao = {
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

export type PrecoVsFipe = {
  preco: number;
  fipe_min: number;
  fipe_max: number;
  diferenca_pct: number; // em relacao a faixa FIPE (0 se estiver dentro)
  situacao: 'muito_abaixo' | 'abaixo' | 'dentro' | 'acima';
};

export type AnaliseDTO = {
  id: string;
  url: string | null;
  fonte: AnuncioLido['fonte'] | 'manual';
  titulo: string;
  fotos: string[];
  identificacao: Identificacao;
  fipe: FipeResult | null;
  preco_vs_fipe: PrecoVsFipe | null;
  analise: Record<string, unknown>;
  dossie: DossieDTO | null;
  dossie_erro: string | null;
};

function compararPreco(preco: number | null, fipe: FipeResult | null): PrecoVsFipe | null {
  if (!preco || !fipe) return null;
  const { min, max } = fipe.faixa;
  const diff = preco < min ? (preco - min) / min : preco > max ? (preco - max) / max : 0;
  const situacao = diff <= -0.2 ? 'muito_abaixo' : diff < 0 ? 'abaixo' : diff > 0 ? 'acima' : 'dentro';
  return { preco, fipe_min: min, fipe_max: max, diferenca_pct: Math.round(diff * 1000) / 10, situacao };
}

function validarFotos(fotos: unknown): string[] {
  if (fotos === undefined || fotos === null) return [];
  if (!Array.isArray(fotos)) throw new AnaliseInvalidaError('Fotos invalidas.');
  if (fotos.length > MAX_FOTOS) throw new AnaliseInvalidaError(`Envie no maximo ${MAX_FOTOS} fotos.`);
  return fotos.map((f) => {
    if (typeof f !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(f)) {
      throw new AnaliseInvalidaError('Envie fotos em JPG, PNG ou WEBP.');
    }
    if (f.length > MAX_FOTO_DATA_URL) throw new AnaliseInvalidaError('Uma das fotos e grande demais.');
    return f;
  });
}

async function identificar(texto: string): Promise<Identificacao> {
  const content = await completeJson(
    [
      {
        role: 'system',
        content:
          'Extraia os dados do anuncio de carro. Use null quando o dado nao estiver no texto. Nao invente. ' +
          'Preco e km como numeros inteiros (ex.: "R$ 89.900" -> 89900; "45 mil km" -> 45000).'
      },
      { role: 'user', content: texto.slice(0, 12_000) }
    ],
    'identificacao_anuncio',
    IDENTIFICACAO_SCHEMA,
    { reasoningEffort: 'low' }
  );
  return JSON.parse(content) as Identificacao;
}

export async function analisarAnuncio(input: {
  url?: unknown;
  texto?: unknown;
  fotos?: unknown;
  uf?: unknown;
}): Promise<AnaliseDTO> {
  const uf = typeof input.uf === 'string' && input.uf.trim() ? input.uf.trim().toUpperCase() : 'SP';
  const url = typeof input.url === 'string' && input.url.trim() ? input.url.trim() : null;
  const textoUsuario = typeof input.texto === 'string' ? input.texto.trim().slice(0, 12_000) : '';
  const fotosUsuario = validarFotos(input.fotos);

  let lido: AnuncioLido | null = null;
  if (url && !textoUsuario && fotosUsuario.length === 0) {
    lido = await lerAnuncio(url);
  }

  const texto = [lido?.texto, textoUsuario].filter(Boolean).join('\n\n');
  const fotosLink = lido ? await baixarFotos(lido.fotos, lido.url) : [];
  const fotos = [...fotosUsuario, ...fotosLink].slice(0, MAX_FOTOS);

  if (texto.length < 30 && fotos.length === 0) {
    throw new AnaliseInvalidaError('Envie o link do anuncio, ou cole o texto do anuncio e/ou envie fotos.');
  }

  const identificacao = texto.length >= 30
    ? await identificar(texto)
    : ({ marca: null, modelo: null, ano_modelo: null, versao: null, km_anunciado: null, preco_anunciado: null,
        cidade: null, uf: null, tipo_vendedor: 'desconhecido' } satisfies Identificacao);

  const { marca, modelo, ano_modelo: ano } = identificacao;
  const consultaDossie = marca && modelo && ano ? `${marca} ${modelo} ${ano}` : null;

  // O dossie do modelo/ano roda em paralelo com a vistoria (pode vir do acervo na hora).
  const dossiePromise = consultaDossie
    ? getOrCreateDossie(consultaDossie).then(
        (r) => ({ ok: true as const, dto: toDossieDTO(r.row, uf, r.cache) }),
        (err: unknown) => ({ ok: false as const, erro: err instanceof Error ? err.message : 'falha' })
      )
    : Promise.resolve({ ok: false as const, erro: 'Nao foi possivel identificar marca, modelo e ano no anuncio.' });

  let fipe: FipeResult | null = null;
  if (marca && modelo && ano) {
    fipe = await lookupFipe(marca, modelo, ano).catch(() => null);
  }
  const precoVsFipe = compararPreco(identificacao.preco_anunciado, fipe);

  const contexto = [
    `ANUNCIO${lido ? ` (${lido.url})` : ''}:\n${texto || '(sem texto; analise apenas as fotos)'}`,
    `DADOS EXTRAIDOS: ${JSON.stringify(identificacao)}`,
    fipe
      ? `FIPE (${fipe.referencia}) para ${ano}: ${fipe.versoes.map((v) => `${v.nome} R$ ${v.preco}`).join('; ')}`
      : 'FIPE: nao encontrada para este modelo/ano.',
    precoVsFipe
      ? `PRECO x FIPE (calculado pelo sistema): ${precoVsFipe.situacao}, ${precoVsFipe.diferenca_pct}% em relacao a faixa FIPE.`
      : '',
    `FOTOS: ${fotos.length} foto(s), numeradas na ordem abaixo.`
  ]
    .filter(Boolean)
    .join('\n\n');

  const userContent: Exclude<ChatMessage['content'], string> = [{ type: 'text', text: contexto }];
  fotos.forEach((foto, i) => {
    userContent.push({ type: 'text', text: `Foto ${i + 1}:` });
    userContent.push({ type: 'image_url', image_url: { url: foto, detail: 'high' } });
  });

  const [analiseRaw, dossieResult] = await Promise.all([
    completeJson(
      [
        { role: 'system', content: PROMPT_ANALISE },
        { role: 'user', content: userContent }
      ],
      'analise_anuncio',
      ANALISE_SCHEMA
    ),
    dossiePromise
  ]);
  const analise = JSON.parse(analiseRaw) as Record<string, unknown>;

  const fotosExibicao = lido?.fotos ?? [];
  const saved = await prisma.analiseAnuncio.create({
    data: {
      url,
      dados: { identificacao, fipe, preco_vs_fipe: precoVsFipe, analise, fotos: fotosExibicao } as unknown as Prisma.InputJsonValue
    }
  });

  return {
    id: saved.id,
    url,
    fonte: lido?.fonte ?? 'manual',
    titulo: lido?.titulo || [marca, modelo, ano].filter(Boolean).join(' ') || 'Anuncio',
    fotos: fotosExibicao,
    identificacao,
    fipe,
    preco_vs_fipe: precoVsFipe,
    analise,
    dossie: dossieResult.ok ? dossieResult.dto : null,
    dossie_erro: dossieResult.ok ? null : dossieResult.erro
  };
}
