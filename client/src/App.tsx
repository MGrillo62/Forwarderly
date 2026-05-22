import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cotizaciones from './pages/Cotizaciones';
import Ordenes from './pages/Ordenes';
import Clientes from './pages/Clientes';
import Proveedores from './pages/Proveedores';
import Categorias from './pages/Categorias';
import Usuarios from './pages/Usuarios';
import Perfil from './pages/Perfil';
import Empresas from './pages/Empresas';
import Costeos from './pages/Costeos';
import Leads from './pages/Leads';
import DashboardComercial from './pages/DashboardComercial';
import DashboardOperativo from './pages/DashboardOperativo';

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode, roles: string[] }) => {
  const { token, user, loading } = useAuth();
  
  if (loading) return <div>Cargando...</div>;
  if (!token) return <Navigate to="/login" />;
  if (user && !roles.includes(user.rol)) return <Navigate to="/" />;
  
  return <>{children}</>;
};

import api from './api/axios';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, selectedEmpresaId, setSelectedEmpresaId } = useAuth();
  const [empresas, setEmpresas] = useState<any[]>([]);

  React.useEffect(() => {
    if (user?.rol === 'SUPER_ADMIN') {
      api.get('/empresas').then(res => {
        setEmpresas(res.data);
        
        // Si el Super Admin no tiene una empresa seleccionada por defecto,
        // asignamos automáticamente la primera empresa de la lista para evitar errores.
        const currentSaved = localStorage.getItem('selectedEmpresaId');
        if (!currentSaved && res.data.length > 0) {
          setSelectedEmpresaId(res.data[0].id);
          window.location.reload();
        }
      }).catch(err => console.error(err));
    }
  }, [user, selectedEmpresaId, setSelectedEmpresaId]);

  if (!user) return <>{children}</>;

  return (
    <div className="app-container">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} rol={user.rol} />
      <main className={`main-content ${collapsed ? 'collapsed' : ''}`}>
        <header className="app-header">
          <div className="header-actions">
            {user.rol === 'SUPER_ADMIN' && (
              <div className="company-selector">
                <span className="label">Actuando como:</span>
                <select 
                  value={selectedEmpresaId || ''} 
                  onChange={(e) => {
                    setSelectedEmpresaId(e.target.value);
                    window.location.reload(); // Reload to refresh data with new header
                  }}
                >
                  <option value="">-- Seleccione Empresa --</option>
                  {empresas.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.razonSocial}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="header-user">
            <span>Hola, <strong>{user.nombres} {user.apellidos}</strong></span>
            <small>{user.rol === 'SUPER_ADMIN' ? 'Super Administrador' : (user.empresa?.razonSocial || 'Sistema')}</small>
          </div>
        </header>
        {children}
      </main>

      <style>{`
        .app-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 0 1.25rem 0;
          margin-bottom: 2rem;
          border-bottom: 1px solid rgba(226, 232, 240, 0.8);
        }
        .header-actions {
          display: flex;
          align-items: center;
        }
        .company-selector {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          background: rgba(241, 245, 249, 0.6);
          padding: 0.45rem 0.875rem;
          border-radius: 0.75rem;
          border: 1px solid rgba(226, 232, 240, 0.9);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .company-selector:hover {
          background: var(--white);
          border-color: var(--primary);
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.05);
        }
        .company-selector .label {
          font-size: 0.725rem;
          color: var(--text-light);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .company-selector select {
          border: none;
          background: transparent;
          font-weight: 700;
          color: var(--primary);
          outline: none;
          cursor: pointer;
          font-size: 0.825rem;
          padding: 0;
        }
        .header-user {
          text-align: right;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.25rem;
        }
        .header-user span {
          display: block;
          font-size: 0.875rem;
          color: var(--text-dark);
        }
        .header-user span strong {
          color: var(--primary);
          font-weight: 700;
        }
        .header-user small {
          color: var(--text-light);
          font-size: 0.725rem;
          font-weight: 600;
          background: rgba(241, 245, 249, 0.9);
          padding: 0.125rem 0.625rem;
          border-radius: 9999px;
          border: 1px solid rgba(226, 232, 240, 0.5);
          display: inline-block;
        }
      `}</style>
    </div>
  );
};

const DashboardRedirect = () => {
  const { user } = useAuth();
  if (user?.rol === 'IMPORTADOR') {
    return <Navigate to="/dashboard-operativo" replace />;
  }
  return <Navigate to="/dashboard-comercial" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'VENDEDOR', 'IMPORTADOR']}>
              <Layout><DashboardRedirect /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/dashboard-comercial" element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'VENDEDOR']}>
              <Layout><DashboardComercial /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/dashboard-operativo" element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'IMPORTADOR']}>
              <Layout><DashboardOperativo /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/leads" element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'VENDEDOR']}>
              <Layout><Leads /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/empresas" element={
            <ProtectedRoute roles={['SUPER_ADMIN']}>
              <Layout><Empresas /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/clientes" element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'VENDEDOR']}>
              <Layout><Clientes /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/proveedores" element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'VENDEDOR']}>
              <Layout><Proveedores /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/cotizaciones" element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'VENDEDOR']}>
              <Layout><Cotizaciones /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/ordenes" element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'VENDEDOR']}>
              <Layout><Ordenes /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/categorias" element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
              <Layout><Categorias /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/usuarios" element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
              <Layout><Usuarios /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/perfil" element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'VENDEDOR', 'IMPORTADOR']}>
              <Layout><Perfil /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/costeos" element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'IMPORTADOR']}>
              <Layout><Costeos /></Layout>
            </ProtectedRoute>
          } />

        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
