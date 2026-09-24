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

// Ponte site do caca-carros -> extensao: o site pede para o navegador do usuario abrir e ler o anuncio.
export const PORTA_CAPTURA = 'autoexpert-captura';
export type PedidoCaptura = { type: 'CAPTURAR_URL'; url: string };
export type RespostaCaptura =
  | { type: 'CAPTURA_OK'; captura: Captura; fotos: string[] }
  | { type: 'CAPTURA_ERRO'; mensagem: string };

// Service worker -> content script da aba do anuncio.
export type PedidoCapturaAba = { type: 'CAPTURAR_PAGINA' };

// Mensagens trocadas por window.postMessage entre a pagina do caca-carros e o content script da ponte.
export const ORIGEM_SITE = 'caca-carros';
export const ORIGEM_EXTENSAO = 'autoexpert-ext';
