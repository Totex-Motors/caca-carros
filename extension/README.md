# Extensão AutoExpert AI (Chrome)

Botão flutuante nos anúncios da Webmotors, OLX, Mobiauto, Mercado Livre, iCarros e Kavak. Ao clicar, a extensão lê o
anúncio **no seu próprio navegador** (sem bloqueio de robô), captura texto e fotos e envia ao servidor do caça-carros,
que faz a vistoria com IA: preço x FIPE, km pelas fotos, divergências, funilaria, sinais de golpe e dossiê do modelo.

- **Sem chave da OpenAI na extensão.** Ela usa o seu login do caça-carros; quem chama a IA é o servidor.
- Captura híbrida: dados estruturados (JSON-LD) e Open Graph quando existem, texto visível da página como fallback
  universal (a IA separa preço, km, versão e descrição) e as fotos grandes da galeria (até 8, reduzidas para 1280 px).
- Interface em Shadow DOM: o CSS do portal não interfere no painel e vice-versa.
- **Ponte com o site:** com a extensão instalada, colar um link em `carros.grupocardoso.online/consulta` (ou clicar em
  "Analisar" num anúncio encontrado) faz a extensão abrir o anúncio numa aba em segundo plano, com o seu login no
  portal, ler texto e fotos e fechar a aba. Assim os portais não bloqueiam a leitura.

## Instalar (modo desenvolvedor)

1. `npm install && npm run build` nesta pasta (gera `dist/`), ou use o `.zip` já compilado.
2. No Chrome, abra `chrome://extensions`, ligue **Modo do desenvolvedor** e clique em **Carregar sem compactação**.
3. Selecione a pasta `dist/` (ou a pasta extraída do `.zip`).
4. Clique no ícone da extensão e entre com o e-mail e a senha do caça-carros.
   O servidor padrão é `https://carros.grupocardoso.online` (dá para trocar em "Endereço do servidor").

## Desenvolvimento

- `npm run dev`: build com recarga automática (CRXJS).
- Teste local com servidor em http: `EXT_DEV_HOST='http://localhost/*' npx vite build` libera `localhost`
  para o content script e para o service worker. Não use essa variável no build distribuído.

## Estrutura

| Caminho | O que faz |
|---|---|
| `manifest.config.ts` | Manifest V3 (portais, permissões) |
| `src/content/capture.ts` | Detecta página de anúncio e captura texto e fotos |
| `src/content/Drawer.tsx` | Painel lateral com o resultado |
| `src/background/index.ts` | Baixa e reduz as fotos, chama `POST /api/dossie/analise` |
| `src/popup/main.tsx` | Login e estado para o IPVA |
| `src/bridge/index.ts` | Ponte com o site do caça-carros (`window.postMessage`) |
