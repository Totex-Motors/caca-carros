import express, { Router, type NextFunction, type Request, type Response } from 'express';
import { asyncHandler } from '../../infra/http/async-handler';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { OpenAIConfigError } from '../../core/dossie/openai';
import {
  concluirVisita,
  criarVisita,
  listarVisitas,
  obterVisita,
  reabrirVisita,
  responderVisita,
  VisitaInvalidaError,
  VisitaNaoEncontradaError
} from '../../core/visita/visita.service';

export const visitaRoutes = Router();

visitaRoutes.use(authMiddleware);

function texto(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

/** Cria a visita: { marca, modelo, ano, versao?, wantedCarId?, analiseId?, anuncioUrl? }. */
visitaRoutes.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = req.body as Record<string, unknown>;
    const marca = texto(b.marca, 40);
    const modelo = texto(b.modelo, 60);
    const ano = Number(b.ano);
    if (!marca || !modelo) throw new VisitaInvalidaError('Informe marca e modelo.');
    if (!Number.isInteger(ano) || ano < 1950 || ano > new Date().getFullYear() + 1) throw new VisitaInvalidaError('Ano invalido.');
    const dto = await criarVisita({
      marca,
      modelo,
      ano,
      versao: texto(b.versao, 80),
      wantedCarId: texto(b.wantedCarId, 64),
      analiseId: texto(b.analiseId, 64),
      anuncioUrl: texto(b.anuncioUrl, 2000)
    });
    return res.status(201).json(dto);
  })
);

/** Lista resumida (sem itens): ?wantedCarId= ou ?analiseId=. */
visitaRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const wantedCarId = texto(req.query.wantedCarId, 64) ?? undefined;
    const analiseId = texto(req.query.analiseId, 64) ?? undefined;
    if (!wantedCarId && !analiseId) throw new VisitaInvalidaError('Informe wantedCarId ou analiseId.');
    return res.json(await listarVisitas({ wantedCarId, analiseId }));
  })
);

visitaRoutes.get('/:id', asyncHandler(async (req, res) => res.json(await obterVisita(req.params.id))));

/** Respostas (salvamento automatico): { respostas: [{ item, resposta?, observacao?, fotos? }] }. Fotos pedem corpo maior. */
visitaRoutes.patch(
  '/:id/respostas',
  express.json({ limit: '20mb' }),
  asyncHandler(async (req, res) => res.json(await responderVisita(req.params.id, (req.body as { respostas?: unknown }).respostas)))
);

visitaRoutes.post('/:id/concluir', asyncHandler(async (req, res) => res.json(await concluirVisita(req.params.id))));
visitaRoutes.post('/:id/reabrir', asyncHandler(async (req, res) => res.json(await reabrirVisita(req.params.id))));

visitaRoutes.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof VisitaInvalidaError) return res.status(400).json({ message: err.message });
  if (err instanceof VisitaNaoEncontradaError) return res.status(404).json({ message: 'Visita nao encontrada.' });
  if (err instanceof OpenAIConfigError) {
    return res.status(503).json({ message: 'Servico de IA nao configurado: verifique OPENAI_API_KEY.' });
  }
  if ((err as { type?: string })?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Fotos grandes demais. Envie ate 3 fotos por item.' });
  }
  console.error('[visita] falha', err);
  return res.status(500).json({ message: 'Nao foi possivel concluir agora. Tente novamente em instantes.' });
});
