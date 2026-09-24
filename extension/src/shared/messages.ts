import type { Analise } from './types';

// Dados capturados na pagina do anuncio pelo content script.
export type Captura = {
  url: string;
  portal: string;
  titulo: string;
  texto: string;
  fotos: string[]; // URLs das fotos do anuncio
};

// Content script -> service worker (via porta, que mantem o worker vivo durante a analise).
export type PedidoAnalise = { type: 'ANALISAR'; captura: Captura };

// Service worker -> content script.
export type RespostaAnalise =
  | { type: 'ETAPA'; etapa: string }
  | { type: 'RESULTADO'; analise: Analise; fotosEnviadas: string[] }
  | { type: 'ERRO'; mensagem: string; precisaLogin?: boolean };

export const PORTA_ANALISE = 'autoexpert-analise';
