import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

// Portais onde o botao aparece. O botao so e exibido em paginas de anuncio (ver src/content/portals.ts).
const PORTAIS = [
  'https://www.webmotors.com.br/*',
  'https://www.olx.com.br/*',
  'https://*.olx.com.br/*',
  'https://www.mobiauto.com.br/*',
  'https://carro.mercadolivre.com.br/*',
  'https://*.mercadolivre.com.br/*',
  'https://www.icarros.com.br/*',
  'https://www.kavak.com/*'
];

// EXT_DEV_HOST (ex.: http://localhost/*) so em builds de teste local, com servidor e pagina de anuncio falsa em http.
const DEV = process.env.EXT_DEV_HOST ? [process.env.EXT_DEV_HOST] : [];

export default defineManifest({
  manifest_version: 3,
  name: 'AutoExpert AI',
  description: 'Vistoria com IA do anúncio aberto: preço x FIPE, km pelas fotos, sinais de golpe e dossiê técnico do modelo.',
  version: pkg.version,
  action: { default_popup: 'src/popup/index.html', default_title: 'AutoExpert AI' },
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  content_scripts: [{ matches: [...PORTAIS, ...DEV], js: ['src/content/index.tsx'], run_at: 'document_idle' }],
  permissions: ['storage'],
  // Fotos vem de CDNs variadas dos portais; o service worker baixa e reduz antes de enviar ao servidor.
  host_permissions: ['https://*/*', ...DEV]
});
