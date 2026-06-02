import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data } = await api.post<{ token: string }>('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      navigate('/');
    } catch {
      setError('Email ou senha inválidos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div className="app-header" style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 className="title" style={{ fontSize: '2.8rem', marginBottom: 8 }}>Caça Carros</h1>
          <p className="app-subtitle">Encontre o carro ideal para seu cliente</p>
        </div>

        <div className="card" style={{ padding: 32 }}>
          <h2 style={{ marginTop: 0, marginBottom: 24, fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Entrar na conta
          </h2>

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="field">
              <label>Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            {error && <div className="error">{error}</div>}

            <button
              disabled={loading}
              type="submit"
              style={{ marginTop: 8, height: 48, fontSize: 15, borderRadius: 16 }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
