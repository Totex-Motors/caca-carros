import type { Dossie as DossieRow, Prisma } from '@prisma/client';
import { prisma } from '../../infra/database/prisma/client';
import { lookupFipe, type FipeResult } from './fipe';
import { calcularIpva, type IpvaResult } from './ipva';
import { completeJson, OPENAI_MODEL, type ChatMessage } from './openai';
import { buildUserPrompt, reviewDossie, SYSTEM_PROMPT } from './prompt';
import { DOSSIE_SCHEMA } from './schema';

export type DossieDTO = {
  id: string;
  slug: string;
  consulta: string;
  created_at: string;
  modelo_ia: string;
  dados: Record<string, unknown>;
  fipe: FipeResult | null;
  ipva: IpvaResult | null;
  cache: boolean;
};

export class ConsultaInvalidaError extends Error {}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Valida "Marca Modelo Ano" e devolve o texto limpo e o ano. */
export function parseConsulta(raw: unknown): { consulta: string; ano: number } {
  const consulta = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  if (consulta.length < 4 || consulta.length > 80) {
    throw new ConsultaInvalidaError('Digite marca, modelo e ano. Ex.: "Jeep Compass 2018".');
  }
  const match = consulta.match(/\b(19[5-9]\d|20[0-4]\d)\b/);
  if (!match) throw new ConsultaInvalidaError('Inclua o ano-modelo na busca. Ex.: "Honda Civic 2015".');
  const ano = Number(match[1]);
  if (ano > new Date().getFullYear() + 1) throw new ConsultaInvalidaError('Ano-modelo invalido.');
  return { consulta, ano };
}

export function toDossieDTO(row: DossieRow, uf: string, cache: boolean): DossieDTO {
  const fipe = (row.fipe as FipeResult | null) ?? null;
  return {
    id: row.id,
    slug: row.slug,
    consulta: row.consulta,
    created_at: row.createdAt.toISOString(),
    modelo_ia: row.modeloIa,
    dados: row.dados as Record<string, unknown>,
    fipe,
    ipva: fipe ? calcularIpva(uf, fipe.faixa, row.ano) : null,
    cache
  };
}

async function saveAlias(alias: string, dossieId: string): Promise<void> {
  await prisma.dossieAlias.upsert({ where: { alias }, create: { alias, dossieId }, update: { dossieId } });
}

/**
 * Gera o dossie em modo JSON Schema strict. Se a revisao automatica apontar texto generico
 * ou dados faltando, pede uma reescrita (uma vez) com a lista de problemas.
 */
async function generate(consulta: string): Promise<Record<string, unknown>> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(consulta) }
  ];

  const first = await completeJson(messages, 'dossie_mestre', DOSSIE_SCHEMA);
  const dados = JSON.parse(first) as Record<string, unknown>;
  const problemas = reviewDossie(dados);
  if (problemas.length === 0) return dados;

  console.info('[dossie] revisao pediu reescrita', { consulta, problemas });
  const revised = await completeJson(
    [
      ...messages,
      { role: 'assistant', content: first },
      {
        role: 'user',
        content: `Revise o dossie inteiro corrigindo estes problemas, mantendo o que ja estava correto:\n- ${problemas.join('\n- ')}`
      }
    ],
    'dossie_mestre',
    DOSSIE_SCHEMA
  );
  return JSON.parse(revised) as Record<string, unknown>;
}

// Evita gerar o mesmo dossie duas vezes quando chegam pedidos simultaneos.
const inFlight = new Map<string, Promise<{ row: DossieRow; cache: boolean }>>();

/** Devolve o dossie do acervo ou gera um novo (OpenAI + FIPE) e salva. */
export async function getOrCreateDossie(consultaRaw: unknown): Promise<{ row: DossieRow; cache: boolean }> {
  const { consulta, ano } = parseConsulta(consultaRaw);
  const alias = slugify(consulta);

  const cached = await prisma.dossieAlias.findUnique({ where: { alias }, include: { dossie: true } });
  if (cached) return { row: cached.dossie, cache: true };

  // "compass 2018" sem a marca: se houver um unico dossie "*-compass-2018" no acervo, usa ele sem chamar a IA.
  const parecidos = await prisma.dossie.findMany({ where: { ano, slug: { endsWith: `-${alias}` } }, take: 2 });
  if (parecidos.length === 1) {
    await saveAlias(alias, parecidos[0].id);
    return { row: parecidos[0], cache: true };
  }

  const pending = inFlight.get(alias);
  if (pending) return pending;

  const task = (async () => {
    const dados = await generate(consulta);
    const veiculo = dados.veiculo as { marca: string; modelo: string; ano: number };
    veiculo.ano = ano;

    // Outra grafia do mesmo modelo/ano pode ja estar no acervo.
    const slug = slugify(`${veiculo.marca} ${veiculo.modelo} ${ano}`);
    const existing = await prisma.dossie.findUnique({ where: { slug } });
    if (existing) {
      await saveAlias(alias, existing.id);
      return { row: existing, cache: true };
    }

    let fipe: FipeResult | null = null;
    try {
      fipe = await lookupFipe(veiculo.marca, veiculo.modelo, ano);
    } catch (err) {
      console.error('[dossie] FIPE indisponivel', err);
    }

    const row = await prisma.dossie.create({
      data: {
        slug,
        consulta,
        marca: veiculo.marca,
        modelo: veiculo.modelo,
        ano,
        modeloIa: OPENAI_MODEL,
        dados: dados as Prisma.InputJsonValue,
        fipe: (fipe ?? undefined) as Prisma.InputJsonValue | undefined
      }
    });
    await Promise.all([saveAlias(alias, row.id), saveAlias(slug, row.id)]);
    return { row, cache: false };
  })();

  inFlight.set(alias, task);
  try {
    return await task;
  } finally {
    inFlight.delete(alias);
  }
}
