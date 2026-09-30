import { api } from './api';
import type { RespostaItem, Visita } from './dossie-types';

export type NovaVisita = {
  marca: string;
  modelo: string;
  ano: number;
  versao?: string | null;
  wantedCarId?: string | null;
  analiseId?: string | null;
  anuncioUrl?: string | null;
};

export type RespostaEnvio = { item: string; resposta?: RespostaItem | null; observacao?: string; fotos?: string[] };

export const criarVisita = (body: NovaVisita) => api.post<Visita>('/visitas', body).then((r) => r.data);
export const obterVisita = (id: string) => api.get<Visita>(`/visitas/${id}`).then((r) => r.data);
export const listarVisitas = (filtro: { wantedCarId?: string; analiseId?: string }) =>
  api.get<Visita[]>('/visitas', { params: filtro }).then((r) => r.data);
export const responderVisita = (id: string, respostas: RespostaEnvio[]) =>
  api.patch<Visita>(`/visitas/${id}/respostas`, { respostas }).then((r) => r.data);
export const concluirVisita = (id: string) => api.post<Visita>(`/visitas/${id}/concluir`).then((r) => r.data);
export const reabrirVisita = (id: string) => api.post<Visita>(`/visitas/${id}/reabrir`).then((r) => r.data);

export const CLASSIFICACAO_VISITA = {
  aprovado: { label: 'Aprovado na visita', icone: '✅', tone: 'seguir' },
  aprovado_com_ressalvas: { label: 'Aprovado com ressalvas', icone: '⚠️', tone: 'seguir_com_cautela' },
  reprovado: { label: 'Reprovado na visita', icone: '⛔', tone: 'evitar' }
} as const;
