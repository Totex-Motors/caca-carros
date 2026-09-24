// Configuracao da extensao guardada no chrome.storage.local (fica so neste navegador).

export const DEFAULT_API_BASE = 'https://carros.grupocardoso.online';

export type Config = {
  apiBase: string;
  token: string | null;
  email: string | null;
  uf: string;
};

export async function getConfig(): Promise<Config> {
  const data = await chrome.storage.local.get(['apiBase', 'token', 'email', 'uf']);
  return {
    apiBase: (data.apiBase as string | undefined) || DEFAULT_API_BASE,
    token: (data.token as string | undefined) ?? null,
    email: (data.email as string | undefined) ?? null,
    uf: (data.uf as string | undefined) || 'SP'
  };
}

export async function setConfig(patch: Partial<Config>): Promise<void> {
  await chrome.storage.local.set(patch);
}

/** O backend do caca-carros fica em /api no mesmo subdominio do site. */
export function apiUrl(apiBase: string, path: string): string {
  return `${apiBase.replace(/\/+$/, '')}/api${path}`;
}
