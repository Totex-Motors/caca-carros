import { Navigate, Route, Routes } from 'react-router-dom';
import { Consulta } from './pages/Consulta';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { VisitaPage } from './pages/Visita';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Home />} />
      <Route path="/consulta" element={<Consulta />} />
      <Route path="/visita/:id" element={<VisitaPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
