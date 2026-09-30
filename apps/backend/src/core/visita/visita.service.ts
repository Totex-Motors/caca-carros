import type { Prisma, Visita as VisitaRow } from '@prisma/client';
import { prisma } from '../../infra/database/prisma/client';
import { getOrCreateDossie } from '../dossie/dossie.service';
import { completeJson } from '../dossie/openai';
import { arr, num, obj, str } from '../dossie/schema';
import {
  AREA_IDS,
  checklistBase,
  type AreaChecklist,
  type Checklist,
  type ItemChecklist,
  type RespostaItem
} from './checklist-base';

// Visita presencial: checklist base + itens especificos (defeitos cronicos do dossie e suspeitas da analise do
// anuncio), respostas com fotos e o parecer final da IA.

export class VisitaInvalidaError extends Error {}

const MAX_FOTOS_POR_ITEM = 3;
const MAX_FOTO_DATA_URL = 1_600_000; // ~1,2 MB de imagem (o site reduz para 1024 px antes de enviar)
const MAX_ITENS_IA = 18;

const GRAVIDADE = { type: 'string', enum: ['baixa', 'media', 'alta', 'critica'] };

const ITENS_SCHEMA = obj({
  itens: arr(
    obj({
      area: { type: 'string', enum: AREA_IDS },
      texto: str('O que verificar, em uma frase imperativa curta. Ex.: "Ouça o motor frio por 2 minutos: estalos metálicos".'),
      dica: str('Como verificar na pratica e o que significa encontrar o sinal. 1 a 2 frases.'),
      motivo: str('Por que este item entrou: o defeito cronico do modelo ou a suspeita do anuncio, com custo quando houver.'),
      origem: { type: 'string', enum: ['modelo', 'anuncio'] }
    }),
    `No maximo ${MAX_ITENS_IA} itens, do mais importante ao menos importante. Nao repita itens que ja estao na base.`
  ),
  perguntas_ao_vendedor: arr(str('Perguntas objetivas para fazer pessoalmente, na ordem em que devem ser feitas.'))
});

const PARECER_SCHEMA = obj({
  classificacao: { type: 'string', enum: ['aprovado', 'aprovado_com_ressalvas', 'reprovado'] },
  resumo: str('3 a 5 frases: estado geral, os achados que pesaram e a recomendacao ao comprador.'),
  apontamentos: arr(
    obj({
      area: str('Titulo da area do checklist.'),
      item: str('Texto do item respondido como problema.'),
      gravidade: GRAVIDADE,
      descricao: str('O que o comprador registrou e o que isso indica tecnicamente.'),
      custo_estimado_brl: obj({ min: num(), max: num() }, 'Custo tipico de reparo em oficina independente. 0 e 0 se nao se aplica.'),
      recomendacao: str('O que fazer: negociar, levar ao mecanico, exigir laudo, desistir.')
    }),
    'Um por item marcado como problema, do mais grave ao menos grave.'
  ),
  nao_verificados_relevantes: arr(str('Itens importantes que ficaram sem resposta e que precisam ser vistos antes de fechar.')),
  negociacao: str('Argumentos objetivos para negociar o preco com base nos achados, com valores. Ou "sem base para desconto".'),
  proximos_passos: arr(str('Ordem sugerida: scanner, laudo cautelar, mecanico de confianca, consulta de debitos...'))
});

const PROMPT_ITENS = `Voce e um perito em vistoria de carros usados no Brasil. Um comprador vai visitar o carro abaixo e ja tem um
checklist base (documentos, frente, laterais, traseira, vidros/pneus, interior, motor, test drive).
Acrescente APENAS o que e especifico deste caso:
1. origem "modelo": para cada defeito cronico relevante do dossie, um item que o comprador consiga verificar sem
   equipamento (ouvir, olhar, sentir, testar na direcao). Diga onde e como. Cite o custo do reparo no motivo.
2. origem "anuncio": para cada alerta, suspeita de funilaria ou area sem foto da analise do anuncio, um item
   "confira pessoalmente X em Y", dizendo exatamente o que procurar.
Regras: frases curtas e concretas; nada generico ("verifique o estado geral"); nao repita a base; escolha a area
certa; portugues do Brasil.`;

const PROMPT_PARECER = `Voce e um perito em vistoria de carros usados no Brasil. Receba o checklist respondido por um comprador
durante a visita ao carro e emita o parecer.
Regras:
- Baseie-se SOMENTE no que foi respondido e nas observacoes/fotos descritas. Nao invente achados.
- "reprovado" quando houver indicio de dano estrutural, enchente, airbag disparado, km adulterada, documentacao
  irregular ou defeito de motor/cambio caro. "aprovado_com_ressalvas" para problemas de desgaste e reparos
  previsiveis. "aprovado" quando nao houver problema relevante.
- Itens sem resposta nao sao problema, mas os importantes entram em nao_verificados_relevantes.
- Custos em reais para o Brasil, oficina independente. Portugues do Brasil, direto e tecnico.`;

export type VisitaDTO = {
  id: string;
  wanted_car_id: string | null;
  analise_id: string | null;
  anuncio_url: string | null;
  veiculo: { marca: string; modelo: string; ano: number; versao: string | null };
  status: 'em_andamento' | 'concluida';
  checklist: Checklist;
  parecer: Record<string, unknown> | null;
  progresso: { respondidos: number; total: number; problemas: number };
  created_at: string;
  updated_at: string;
};

function progresso(checklist: Checklist) {
  let total = 0;
  let respondidos = 0;
  let problemas = 0;
  for (const area of checklist.areas) {
    for (const item of area.itens) {
      total += 1;
      if (item.resposta) respondidos += 1;
      if (item.resposta === 'problema') problemas += 1;
    }
  }
  return { respondidos, total, problemas };
}

export function toVisitaDTO(row: VisitaRow): VisitaDTO {
  const checklist = row.checklist as unknown as Checklist;
  return {
    id: row.id,
    wanted_car_id: row.wantedCarId,
    analise_id: row.analiseId,
    anuncio_url: row.anuncioUrl,
    veiculo: { marca: row.marca, modelo: row.modelo, ano: row.ano, versao: row.versao },
    status: row.status === 'CONCLUIDA' ? 'concluida' : 'em_andamento',
    checklist,
    parecer: (row.parecer as Record<string, unknown> | null) ?? null,
    progresso: progresso(checklist),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString()
  };
}

type ItemIA = { area: string; texto: string; dica: string; motivo: string; origem: 'modelo' | 'anuncio' };

function resumirDossie(dados: Record<string, unknown>): string {
  const defeitos = (dados.defeitos_cronicos as Record<string, unknown>[] | undefined) ?? [];
  const linhas = defeitos.slice(0, 12).map((d) => {
    const custo = d.custo_reparo_brl as { min?: number; max?: number } | undefined;
    return `- ${d.titulo} [${d.gravidade}] sintoma: ${d.sintoma}; km tipica: ${d.km_tipico}; custo R$ ${custo?.min ?? '?'}-${custo?.max ?? '?'}`;
  });
  const motor = ((dados.motorizacoes as Record<string, unknown>[] | undefined) ?? [])
    .slice(0, 3)
    .map((m) => `- ${m.nome}: comando ${m.comando_valvulas}${m.intervalo_troca_comando_km ? ` (troca a cada ${m.intervalo_troca_comando_km} km)` : ''}; ${m.observacoes}`);
  const cambios = ((dados.cambios as Record<string, unknown>[] | undefined) ?? []).slice(0, 3).map((c) => `- ${c.tipo} ${c.fabricante_modelo}: ${c.pontos_atencao}`);
  const susp = dados.suspensao as { pontos_atencao?: string } | undefined;
  return [
    'DEFEITOS CRONICOS DO MODELO:',
    ...(linhas.length ? linhas : ['- (nenhum informado)']),
    'MOTORIZACOES:',
    ...motor,
    'CAMBIOS:',
    ...cambios,
    susp?.pontos_atencao ? `SUSPENSAO: ${susp.pontos_atencao}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

function resumirAnalise(dados: Record<string, unknown>): string {
  const analise = (dados.analise as Record<string, unknown> | undefined) ?? {};
  const alertas = ((analise.alertas as Record<string, unknown>[] | undefined) ?? []).map(
    (a) => `- [${a.gravidade}/${a.categoria}] ${a.titulo}: ${a.evidencia}. Verificar: ${a.como_verificar}`
  );
  const fun = analise.funilaria as { verificacoes?: Record<string, unknown>[]; areas_sem_foto?: string[]; avaliacao?: string } | undefined;
  const suspeitas = (fun?.verificacoes ?? [])
    .filter((v) => v.resultado === 'suspeito' || v.resultado === 'evidente')
    .map((v) => `- ${v.item} (${v.resultado}) em ${(v.pecas as string[] | undefined)?.join(', ') || 'peca nao informada'}: ${v.evidencia}`);
  const km = analise.km as { compatibilidade?: string; justificativa?: string } | undefined;
  return [
    `ALERTAS DA ANALISE DO ANUNCIO:`,
    ...(alertas.length ? alertas : ['- nenhum']),
    `FUNILARIA (avaliacao: ${fun?.avaliacao ?? 'nao avaliada'}):`,
    ...(suspeitas.length ? suspeitas : ['- sem suspeitas nas fotos']),
    `AREAS SEM FOTO NO ANUNCIO: ${fun?.areas_sem_foto?.join(', ') || 'nao informado'}`,
    km ? `QUILOMETRAGEM: ${km.compatibilidade}. ${km.justificativa ?? ''}` : '',
    `CHECKLIST SUGERIDO PELA ANALISE: ${((analise.checklist_vistoria as string[] | undefined) ?? []).join(' | ')}`
  ]
    .filter(Boolean)
    .join('\n');
}

function slugId(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function mesclarItens(checklist: Checklist, itens: ItemIA[]): void {
  const usados = new Set(checklist.areas.flatMap((a) => a.itens.map((i) => i.id)));
  for (const item of itens.slice(0, MAX_ITENS_IA)) {
    const area = checklist.areas.find((a) => a.id === item.area) ?? checklist.areas[checklist.areas.length - 1];
    let id = `${item.origem}_${slugId(item.texto)}`;
    let n = 2;
    while (usados.has(id)) id = `${item.origem}_${slugId(item.texto)}_${n++}`;
    usados.add(id);
    const novo: ItemChecklist = {
      id,
      texto: item.texto.trim(),
      dica: item.dica.trim(),
      origem: item.origem,
      motivo: item.motivo.trim(),
      resposta: null,
      observacao: '',
      fotos: []
    };
    // Itens especificos vao no topo da area: sao os que mais importam neste carro.
    const primeiroBase = area.itens.findIndex((i) => i.origem === 'base');
    area.itens.splice(primeiroBase === -1 ? area.itens.length : primeiroBase, 0, novo);
  }
}

export type CriarVisitaInput = {
  wantedCarId?: string | null;
  analiseId?: string | null;
  anuncioUrl?: string | null;
  marca: string;
  modelo: string;
  ano: number;
  versao?: string | null;
};

export async function criarVisita(input: CriarVisitaInput): Promise<VisitaDTO> {
  const checklist = checklistBase();

  const [dossie, analise] = await Promise.all([
    input.ano >= 1950
      ? getOrCreateDossie(`${input.marca} ${input.modelo} ${input.ano}`).then((r) => r.row.dados as Record<string, unknown>).catch((err) => {
          console.warn('[visita] dossie indisponivel', (err as Error).message);
          return null;
        })
      : Promise.resolve(null),
    input.analiseId ? prisma.analiseAnuncio.findUnique({ where: { id: input.analiseId } }) : Promise.resolve(null)
  ]);

  if (dossie || analise) {
    try {
      const contexto = [
        `CARRO: ${input.marca} ${input.modelo} ${input.ano}${input.versao ? ` ${input.versao}` : ''}`,
        dossie ? resumirDossie(dossie) : 'DOSSIE: indisponivel',
        analise ? resumirAnalise(analise.dados as Record<string, unknown>) : 'ANALISE DO ANUNCIO: nao ha (visita sem anuncio analisado)',
        `ITENS JA NA BASE (nao repetir): ${checklist.areas.flatMap((a) => a.itens.map((i) => i.texto)).join(' | ')}`
      ].join('\n\n');
      const raw = await completeJson(
        [
          { role: 'system', content: PROMPT_ITENS },
          { role: 'user', content: contexto }
        ],
        'itens_visita',
        ITENS_SCHEMA,
        { reasoningEffort: 'low' }
      );
      const parsed = JSON.parse(raw) as { itens: ItemIA[]; perguntas_ao_vendedor: string[] };
      mesclarItens(checklist, parsed.itens);
      checklist.perguntas_ao_vendedor = parsed.perguntas_ao_vendedor.slice(0, 12);
    } catch (err) {
      // Sem IA a visita segue com a base: melhor um checklist generico do que nenhum.
      console.error('[visita] itens especificos falharam', err);
    }
  }

  const row = await prisma.visita.create({
    data: {
      wantedCarId: input.wantedCarId ?? null,
      analiseId: input.analiseId ?? null,
      anuncioUrl: input.anuncioUrl ?? null,
      marca: input.marca,
      modelo: input.modelo,
      ano: input.ano,
      versao: input.versao ?? null,
      checklist: checklist as unknown as Prisma.InputJsonValue
    }
  });
  return toVisitaDTO(row);
}

export type RespostaInput = { item: string; resposta?: RespostaItem | null; observacao?: string; fotos?: string[] };

function validarFotos(fotos: unknown): string[] | undefined {
  if (fotos === undefined) return undefined;
  if (!Array.isArray(fotos)) throw new VisitaInvalidaError('Fotos invalidas.');
  if (fotos.length > MAX_FOTOS_POR_ITEM) throw new VisitaInvalidaError(`No maximo ${MAX_FOTOS_POR_ITEM} fotos por item.`);
  return fotos.map((f) => {
    if (typeof f !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(f)) {
      throw new VisitaInvalidaError('Envie fotos em JPG, PNG ou WEBP.');
    }
    if (f.length > MAX_FOTO_DATA_URL) throw new VisitaInvalidaError('Uma das fotos e grande demais.');
    return f;
  });
}

export async function responderVisita(id: string, respostas: unknown): Promise<VisitaDTO> {
  if (!Array.isArray(respostas) || respostas.length === 0) throw new VisitaInvalidaError('Envie ao menos uma resposta.');
  const row = await prisma.visita.findUnique({ where: { id } });
  if (!row) return Promise.reject(new VisitaNaoEncontradaError());
  if (row.status === 'CONCLUIDA') throw new VisitaInvalidaError('Esta visita ja foi concluida.');

  const checklist = row.checklist as unknown as Checklist;
  const porId = new Map<string, ItemChecklist>();
  for (const area of checklist.areas) for (const item of area.itens) porId.set(item.id, item);

  for (const r of respostas as RespostaInput[]) {
    if (!r || typeof r.item !== 'string') throw new VisitaInvalidaError('Resposta sem item.');
    const item = porId.get(r.item);
    if (!item) throw new VisitaInvalidaError(`Item desconhecido: ${r.item}`);
    if (r.resposta !== undefined) {
      if (r.resposta !== null && !['ok', 'problema', 'nao_aplica'].includes(r.resposta)) throw new VisitaInvalidaError('Resposta invalida.');
      item.resposta = r.resposta;
    }
    if (r.observacao !== undefined) {
      if (typeof r.observacao !== 'string') throw new VisitaInvalidaError('Observacao invalida.');
      item.observacao = r.observacao.slice(0, 1000);
    }
    const fotos = validarFotos(r.fotos);
    if (fotos) item.fotos = fotos;
  }

  const updated = await prisma.visita.update({ where: { id }, data: { checklist: checklist as unknown as Prisma.InputJsonValue } });
  return toVisitaDTO(updated);
}

export class VisitaNaoEncontradaError extends Error {}

function descreverRespostas(checklist: Checklist): string {
  const blocos: string[] = [];
  for (const area of checklist.areas) {
    const linhas = area.itens.map((i) => {
      const resp = i.resposta ?? 'sem_resposta';
      const extra = [i.observacao && `obs: ${i.observacao}`, i.fotos.length && `${i.fotos.length} foto(s) anexada(s)`, i.motivo && `contexto: ${i.motivo}`]
        .filter(Boolean)
        .join('; ');
      return `  - [${resp}] ${i.texto}${extra ? ` (${extra})` : ''}`;
    });
    blocos.push(`${area.titulo}:\n${linhas.join('\n')}`);
  }
  return blocos.join('\n');
}

export async function concluirVisita(id: string): Promise<VisitaDTO> {
  const row = await prisma.visita.findUnique({ where: { id } });
  if (!row) throw new VisitaNaoEncontradaError();
  const checklist = row.checklist as unknown as Checklist;
  const { respondidos } = progresso(checklist);
  if (respondidos === 0) throw new VisitaInvalidaError('Responda ao menos um item antes de concluir.');

  const fotosProblemas: { texto: string; foto: string }[] = [];
  for (const area of checklist.areas) {
    for (const item of area.itens) {
      if (item.resposta === 'problema') for (const foto of item.fotos.slice(0, 2)) fotosProblemas.push({ texto: item.texto, foto });
    }
  }
  const fotos = fotosProblemas.slice(0, 8);

  const raw = await completeJson(
    [
      { role: 'system', content: PROMPT_PARECER },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `CARRO: ${row.marca} ${row.modelo} ${row.ano}${row.versao ? ` ${row.versao}` : ''}\n\nCHECKLIST RESPONDIDO:\n${descreverRespostas(checklist)}${
              fotos.length ? `\n\nFOTOS DOS PROBLEMAS (na ordem): ${fotos.map((f, i) => `foto ${i + 1} = "${f.texto}"`).join('; ')}` : ''
            }`
          },
          ...fotos.map((f) => ({ type: 'image_url' as const, image_url: { url: f.foto, detail: 'low' as const } }))
        ]
      }
    ],
    'parecer_visita',
    PARECER_SCHEMA
  );
  const parecer = JSON.parse(raw) as Record<string, unknown>;
  const updated = await prisma.visita.update({ where: { id }, data: { status: 'CONCLUIDA', parecer: parecer as Prisma.InputJsonValue } });
  return toVisitaDTO(updated);
}

export async function reabrirVisita(id: string): Promise<VisitaDTO> {
  const row = await prisma.visita.findUnique({ where: { id } });
  if (!row) throw new VisitaNaoEncontradaError();
  const updated = await prisma.visita.update({ where: { id }, data: { status: 'EM_ANDAMENTO' } });
  return toVisitaDTO(updated);
}

export async function listarVisitas(filtro: { wantedCarId?: string; analiseId?: string }): Promise<VisitaDTO[]> {
  const rows = await prisma.visita.findMany({
    where: { ...(filtro.wantedCarId ? { wantedCarId: filtro.wantedCarId } : {}), ...(filtro.analiseId ? { analiseId: filtro.analiseId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  // Lista sem as fotos (pesadas): a tela da visita carrega a completa.
  return rows.map((r) => {
    const dto = toVisitaDTO(r);
    return { ...dto, checklist: { ...dto.checklist, areas: [] as AreaChecklist[] } };
  });
}

export async function obterVisita(id: string): Promise<VisitaDTO> {
  const row = await prisma.visita.findUnique({ where: { id } });
  if (!row) throw new VisitaNaoEncontradaError();
  return toVisitaDTO(row);
}
