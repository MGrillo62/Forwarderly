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

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode, roles: string[] }) => {
  const { token, user, loading } = useAuth();
  
  if (loading) return <div>Cargando...</div>;
  if (!token) return <Navigate to="/login" />;
  if (user && !roles.includes(user.rol)) return <Navigate to="/" />;
  
  return <>{children}</>;
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();

  if (!user) return <>{children}</>;

  return (
    <div className="app-container">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} rol={user.rol} />
      <main className={`main-content ${collapsed ? 'collapsed' : ''}`}>
        <header className="app-header">
          <div className="header-user">
            <span>Hola, <strong>{user.nombres} {user.apellidos}</strong></span>
            <small>{user.empresa?.razonSocial || 'Sistema'}</small>
          </div>
        </header>
        {children}
      </main>

      <style>{`
        .app-header {
          display: flex;
          justify-content: flex-end;
          padding-bottom: 2rem;
          margin-bottom: 2rem;
          border-bottom: 1px solid var(--border);
        }
        .header-user {
          text-align: right;
        }
        .header-user span {
          display: block;
          font-size: 0.9rem;
        }
        .header-user small {
          color: var(--text-light);
          font-size: 0.75rem;
        }
      `}</style>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'VENDEDOR']}>
              <Layout><Dashboard /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/empresas" element={
            <ProtectedRoute roles={['SUPER_ADMIN']}>
              <Layout><Empresas /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/clientes" element={
            <ProtectedRoute roles={['ADMIN', 'VENDEDOR']}>
              <Layout><Clientes /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/proveedores" element={
            <ProtectedRoute roles={['ADMIN', 'VENDEDOR']}>
              <Layout><Proveedores /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/cotizaciones" element={
            <ProtectedRoute roles={['ADMIN', 'VENDEDOR']}>
              <Layout><Cotizaciones /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/ordenes" element={
            <ProtectedRoute roles={['ADMIN', 'VENDEDOR']}>
              <Layout><Ordenes /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/categorias" element={
            <ProtectedRoute roles={['ADMIN']}>
              <Layout><Categorias /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/usuarios" element={
            <ProtectedRoute roles={['ADMIN']}>
              <Layout><Usuarios /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/perfil" element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'VENDEDOR']}>
              <Layout><Perfil /></Layout>
            </ProtectedRoute>
          } />

        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
