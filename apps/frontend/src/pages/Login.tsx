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
      setError('Login inválido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <h1 className="title">Caça Carros</h1>

      <div className="card" style={{ maxWidth: 420 }}>
        <h2 style={{ marginTop: 0 }}>Login</h2>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <label>Senha</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="senha" type="password" />
          </div>

          {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

          <div style={{ marginTop: 16 }}>
            <button disabled={loading} type="submit">{loading ? 'Entrando...' : 'Entrar'}</button>
          </div>
          <div className="muted" style={{ marginTop: 10 }}>
            Use o usuário criado no seed (ADMIN_EMAIL/ADMIN_PASSWORD).
          </div>
        </form>
      </div>
    </div>
  );
}
