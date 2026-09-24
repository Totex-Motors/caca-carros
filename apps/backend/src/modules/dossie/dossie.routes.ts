import express, { Router, type NextFunction, type Request, type Response } from 'express';
import { prisma } from '../../infra/database/prisma/client';
import { asyncHandler } from '../../infra/http/async-handler';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { AnaliseInvalidaError, AnuncioBloqueadoError, analisarAnuncio } from '../../core/dossie/analise';
import { UrlInvalidaError } from '../../core/dossie/anuncio-reader';
import { ConsultaInvalidaError, getOrCreateDossie, toDossieDTO } from '../../core/dossie/dossie.service';
import { OpenAIConfigError } from '../../core/dossie/openai';

export const dossieRoutes = Router();

dossieRoutes.use(authMiddleware);

function readUf(value: unknown): string {
  return typeof value === 'string' && /^[a-z]{2}$/i.test(value.trim()) ? value.trim().toUpperCase() : 'SP';
}

/** Consulta por texto: "Marca Modelo Ano". */
dossieRoutes.post(
  '/',
  asyncHandler(async (req, res) => {
    const { consulta, uf } = req.body as { consulta?: unknown; uf?: unknown };
    const { row, cache } = await getOrCreateDossie(consulta);
    return res.json(toDossieDTO(row, readUf(uf), cache));
  })
);

/** Dossie do carro desejado (modo completo): usa marca, modelo e ano do cadastro. */
dossieRoutes.get(
  '/wanted/:id',
  asyncHandler(async (req, res) => {
    const wanted = await prisma.wantedCar.findUnique({ where: { id: req.params.id } });
    if (!wanted) return res.status(404).json({ message: 'Carro nao encontrado.' });
    // Sem ano informado o cadastro guarda 1900 como ano minimo.
    const ano = wanted.yearFrom;
    if (ano < 1950) {
      return res.status(400).json({ message: 'Cadastre o ano do carro para gerar o dossie.' });
    }
    const { row, cache } = await getOrCreateDossie(`${wanted.brand} ${wanted.model} ${ano}`);
    return res.json(toDossieDTO(row, readUf(req.query.uf), cache));
  })
);

/** Analise de anuncio: { url } ou { texto, fotos[] (data URLs) }. Fotos precisam de um limite de corpo maior. */
dossieRoutes.post(
  '/analise',
  express.json({ limit: '30mb' }),
  asyncHandler(async (req, res) => {
    const body = req.body as { url?: unknown; texto?: unknown; fotos?: unknown; uf?: unknown };
    return res.json(await analisarAnuncio({ ...body, uf: readUf(body.uf) }));
  })
);

dossieRoutes.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ConsultaInvalidaError || err instanceof AnaliseInvalidaError || err instanceof UrlInvalidaError) {
    return res.status(400).json({ message: err.message });
  }
  if (err instanceof AnuncioBloqueadoError) {
    return res.status(422).json({ message: err.message, code: 'ANUNCIO_BLOQUEADO' });
  }
  if (err instanceof OpenAIConfigError) {
    console.error('[dossie] OpenAI nao configurada', err.message);
    return res.status(503).json({ message: 'Servico de IA nao configurado: verifique OPENAI_API_KEY e os modelos liberados.' });
  }
  if ((err as { type?: string })?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Fotos grandes demais. Envie ate 8 fotos.' });
  }
  console.error('[dossie] falha', err);
  return res.status(500).json({ message: 'Nao foi possivel concluir a analise agora. Tente novamente em instantes.' });
});
