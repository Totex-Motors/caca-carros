import { NavLink } from 'react-router-dom';

export function TopNav() {
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
    </nav>
  );
}
