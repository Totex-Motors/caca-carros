import { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import { apiUrl, DEFAULT_API_BASE, getConfig, setConfig, type Config } from '../shared/config';

const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

function Popup() {
  const [config, setLocal] = useState<Config | null>(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    getConfig().then((c) => {
      setLocal(c);
      setApiBase(c.apiBase);
      setEmail(c.email ?? '');
    });
  }, []);

  async function entrar(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const base = apiBase.trim().replace(/\/+$/, '') || DEFAULT_API_BASE;
      const res = await fetch(apiUrl(base, '/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: senha, rememberMe: true })
      });
      if (!res.ok) {
        setErro(res.status === 401 || res.status === 500 ? 'E-mail ou senha incorretos.' : `Erro do servidor (HTTP ${res.status}).`);
        return;
      }
      const { token } = (await res.json()) as { token: string };
      await setConfig({ apiBase: base, token, email: email.trim() });
      setSenha('');
      setLocal(await getConfig());
    } catch {
      setErro('Não foi possível acessar o servidor. Confira o endereço.');
    } finally {
      setCarregando(false);
    }
  }

  async function sair() {
    await setConfig({ token: null });
    setLocal(await getConfig());
  }

  async function mudarUf(uf: string) {
    await setConfig({ uf });
    setLocal(await getConfig());
  }

  if (!config) return null;

  return (
    <div className="w-[320px] space-y-3 bg-slate-50 p-4 font-sans text-[13px] text-slate-900">
      <div>
        <div className="text-base font-extrabold text-brand-dark">AutoExpert AI</div>
        <div className="text-[12px] text-slate-500">
          Abra um anúncio na Webmotors, OLX, Mobiauto, Mercado Livre, iCarros ou Kavak e clique no botão 🔍 AutoExpert.
        </div>
      </div>

      {config.token ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
          <div>
            Conectado como <strong>{config.email}</strong>
            <div className="text-[11px] text-slate-500">{config.apiBase}</div>
          </div>
          <label className="block">
            <span className="text-[11px] font-bold uppercase text-slate-500">Estado para o IPVA</span>
            <select
              value={config.uf}
              onChange={(e) => mudarUf(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1.5"
            >
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <button type="button" onClick={sair} className="text-[12px] font-bold text-red-700">Sair</button>
        </div>
      ) : (
        <form onSubmit={entrar} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <div className="font-bold">Entre com seu login do caça-carros</div>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            className="block w-full rounded-lg border border-slate-300 px-2 py-1.5"
          />
          <input
            type="password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha"
            className="block w-full rounded-lg border border-slate-300 px-2 py-1.5"
          />
          <details className="text-[11px] text-slate-500">
            <summary className="cursor-pointer">Endereço do servidor</summary>
            <input
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[12px]"
            />
          </details>
          {erro && <div className="rounded-lg bg-red-50 p-2 text-red-700">{erro}</div>}
          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-lg bg-gradient-to-r from-brand to-brand-dark py-2 font-extrabold text-white disabled:opacity-60"
          >
            {carregando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Popup />);
