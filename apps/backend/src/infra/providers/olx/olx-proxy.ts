export type OlxProxyConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  server: string;
};

type OlxProxyCredentials = {
  host: string;
  ports: number[];
  username: string;
  password: string;
};

function readEnv(name: string): string | null {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

function parsePortList(value: string | null): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry > 0 && Number.isInteger(entry))
    .map((entry) => Math.trunc(entry));
}

function loadProxyCredentials(): OlxProxyCredentials {
  const host = readEnv('PROXY_HOST');
  const user = readEnv('PROXY_USER');
  const pass = readEnv('PROXY_PASS');
  const ports = parsePortList(readEnv('PROXY_PORTS'));
  const port = readEnv('PROXY_PORT');

  if (!host) throw new Error('PROXY_HOST is required');
  if (!user) throw new Error('PROXY_USER is required');
  if (!pass) throw new Error('PROXY_PASS is required');

  if (ports.length === 0) {
    const parsed = port ? Number(port) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error('PROXY_PORT is required when PROXY_PORTS is not set');
    }
    ports.push(Math.trunc(parsed));
  }

  return {
    host,
    ports,
    username: user,
    password: pass
  };
}

function toProxyConfig(credentials: OlxProxyCredentials, port: number): OlxProxyConfig {
  return {
    host: credentials.host,
    port,
    username: credentials.username,
    password: credentials.password,
    server: `http://${credentials.host}:${port}`
  };
}

export class OlxProxyPool {
  private _credentials: OlxProxyCredentials | undefined;
  private readonly _explicitCredentials: OlxProxyCredentials | undefined;
  private readonly sessionPorts = new Map<string, number>();
  private nextIndex = 0;

  constructor(credentials?: OlxProxyCredentials) {
    this._explicitCredentials = credentials;
  }

  private get credentials(): OlxProxyCredentials {
    if (!this._credentials) {
      this._credentials = this._explicitCredentials ?? loadProxyCredentials();
    }
    return this._credentials;
  }

  getProxy(sessionId?: string): OlxProxyConfig {
    if (sessionId) {
      const existing = this.sessionPorts.get(sessionId);
      if (existing) {
        return toProxyConfig(this.credentials, existing);
      }
    }

    const ports = this.credentials.ports;
    const port = ports[this.nextIndex % ports.length];
    this.nextIndex = (this.nextIndex + 1) % ports.length;

    if (sessionId) {
      this.sessionPorts.set(sessionId, port);
    }

    return toProxyConfig(this.credentials, port);
  }
}
