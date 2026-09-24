import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { salvarTema, temaAtual, type Tema } from '../services/theme';

export function TopNav() {
  const [tema, setTema] = useState<Tema>(temaAtual);

  function alternar() {
    const novo: Tema = tema === 'dark' ? 'light' : 'dark';
    salvarTema(novo);
    setTema(novo);
  }

  return (
    <nav className="top-nav" aria-label="Modo">
      <div className="top-nav-tabs">
        <NavLink to="/consulta" className={({ isActive }) => (isActive ? 'active' : '')}>
          🔎 Consulta
        </NavLink>
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          🚗 Completo
        </NavLink>
      </div>
      <button type="button" className="secondary theme-toggle" onClick={alternar} aria-label="Alternar tema claro/escuro">
        {tema === 'dark' ? '☀️ Claro' : '🌙 Escuro'}
      </button>
    </nav>
  );
}
