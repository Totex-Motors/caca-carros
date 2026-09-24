import axios from 'axios';
import { api } from './api';
import type { Analise, Dossie } from './dossie-types';

// Geracao com IA pode levar alguns minutos.
const LONG_TIMEOUT = 6 * 60 * 1000;

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

export function readUf(): string {
  try {
    return localStorage.getItem('dossie:uf') ?? 'SP';
  } catch {
    return 'SP';
  }
}

export function saveUf(uf: string) {
  try {
    localStorage.setItem('dossie:uf', uf);
  } catch {
    // armazenamento indisponivel: vale so nesta sessao
  }
}

export async function fetchDossie(consulta: string, uf: string): Promise<Dossie> {
  const { data } = await api.post<Dossie>('/dossie', { consulta, uf }, { timeout: LONG_TIMEOUT });
  return data;
}

export async function fetchWantedDossie(wantedId: string, uf: string): Promise<Dossie> {
  const { data } = await api.get<Dossie>(`/dossie/wanted/${wantedId}`, { params: { uf }, timeout: LONG_TIMEOUT });
  return data;
}

export async function fetchAnalise(body: { url?: string; texto?: string; fotos?: string[]; uf: string }): Promise<Analise> {
  const { data } = await api.post<Analise>('/dossie/analise', body, { timeout: LONG_TIMEOUT });
  return data;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: unknown } | undefined)?.message;
    if (typeof message === 'string') return message;
    if (error.code === 'ECONNABORTED') return 'A análise demorou demais. Tente novamente.';
    if (!error.response) return 'Não foi possível falar com o servidor. Confira sua internet e se está em carros.grupocardoso.online.';
  }
  return fallback;
}

export function isBlockedError(error: unknown): boolean {
  return axios.isAxiosError(error) && (error.response?.data as { code?: unknown } | undefined)?.code === 'ANUNCIO_BLOQUEADO';
}

/** Reduz a foto para no maximo 1280 px e JPEG ~82% (evita enviar arquivos de 5-10 MB do celular). */
export function resizePhoto(file: File, maxSize = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Imagem invalida'));
    };
    img.src = url;
  });
}
