import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data } = await api.post<{ token: string }>('/auth/login', { email, password, rememberMe });
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
              type="button"
              onClick={() => setRememberMe((v) => !v)}
              style={{
                all: 'unset',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                cursor: 'pointer',
                width: 'fit-content',
                userSelect: 'none'
              }}
            >
              <span style={{
                width: 15,
                height: 15,
                borderRadius: 4,
                border: `2px solid ${rememberMe ? 'var(--primary)' : 'rgba(8,145,178,0.35)'}`,
                background: rememberMe ? 'var(--primary)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.15s, border-color 0.15s'
              }}>
                {rememberMe && (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Lembrar usuário</span>
            </button>

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
