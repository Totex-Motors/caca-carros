export type Tema = 'light' | 'dark';

const CHAVE = 'caca:tema';

function salvo(): Tema | null {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
}

/** Tema escolhido pelo usuario; sem escolha, segue o sistema operacional. */
export function temaAtual(): Tema {
  return salvo() ?? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function aplicarTema(tema: Tema) {
  document.documentElement.dataset.theme = tema;
}

export function salvarTema(tema: Tema) {
  aplicarTema(tema);
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    // armazenamento indisponivel: vale so nesta aba
  }
}
