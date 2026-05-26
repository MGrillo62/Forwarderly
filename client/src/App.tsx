import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
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
import Suscripciones from './pages/Suscripciones';
import { AlertTriangle, Lock, CreditCard } from 'lucide-react';
import api from './api/axios';

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode, roles: string[] }) => {
  const { token, user, loading } = useAuth();
  
  if (loading) return <div>Cargando...</div>;
  if (!token) return <Navigate to="/login" />;
  if (user && !roles.includes(user.rol)) return <Navigate to="/" />;
  
  return <>{children}</>;
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, selectedEmpresaId, setSelectedEmpresaId, activeEmpresa } = useAuth();
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [estadoSuscripcion, setEstadoSuscripcion] = useState<any>(null);
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user?.rol === 'SUPER_ADMIN') {
      api.get('/empresas').then(res => {
        setEmpresas(res.data);
        
        const currentSaved = localStorage.getItem('selectedEmpresaId');
        if (!currentSaved && res.data.length > 0) {
          setSelectedEmpresaId(res.data[0].id);
          window.location.reload();
        }
      }).catch(err => console.error(err));
    }
  }, [user, selectedEmpresaId, setSelectedEmpresaId]);

  React.useEffect(() => {
    if (user && user.rol !== 'SUPER_ADMIN') {
      api.get('/suscripciones/estado-actual')
        .then(res => {
          setEstadoSuscripcion(res.data);
        })
        .catch(err => console.error(err));
    }
  }, [user, location.pathname]);

  if (!user) return <>{children}</>;

  const isBillingPage = location.pathname === '/suscripciones';
  const isProfilePage = location.pathname === '/perfil';
  const requiresPayment = estadoSuscripcion && estadoSuscripcion.tieneAcceso === false;
  const isBlocked = requiresPayment && !isBillingPage && !isProfilePage;

  const showBanner = estadoSuscripcion && 
                     estadoSuscripcion.motivo === 'TRIAL_ACTIVO' && 
                     estadoSuscripcion.diasRestantesTrial <= 5 &&
                     !isBillingPage;

  return (
    <div className="app-container">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} rol={user.rol} />
      <main className={`main-content ${collapsed ? 'collapsed' : ''}`}>
        {/* Trial Ending Banner */}
        {showBanner && (
          <div className="trial-warning-banner animate-slide-in">
            <div className="banner-content">
              <AlertTriangle size={18} className="icon-pulse" />
              <span>
                ⏳ Tu periodo de prueba vencerá en <strong>{estadoSuscripcion.diasRestantesTrial} días</strong> ({new Date(estadoSuscripcion.fechaFinPrueba).toLocaleDateString()}). Realiza tu pago de suscripción para evitar interrupciones.
              </span>
            </div>
            <button className="banner-btn" onClick={() => navigate('/suscripciones')}>
              <CreditCard size={14} /> Pagar Ahora
            </button>
          </div>
        )}

        <header className="app-header">
          <div className="header-actions">
            {activeEmpresa?.logoUrl && (
              <img 
                src={activeEmpresa.logoUrl} 
                alt="Logo Empresa" 
                style={{
                  height: '36px',
                  maxWidth: '120px',
                  objectFit: 'contain',
                  marginRight: '1rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                  padding: '2px',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}
              />
            )}
            {user.rol === 'SUPER_ADMIN' && (
              <div className="company-selector">
                <span className="label">Actuando como:</span>
                <select 
                  value={selectedEmpresaId || ''} 
                  onChange={(e) => {
                    setSelectedEmpresaId(e.target.value);
                    window.location.reload();
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
        
        {/* Main page content or Blocked overlay */}
        {isBlocked ? (
          <div className="blocked-view-container animate-fade-in">
            <div className="blocked-card">
              <div className="lock-icon-wrapper">
                <Lock size={32} />
              </div>
              <h2>Acceso Restringido 💳</h2>
              <p>
                Tu periodo de prueba o suscripción mensual ha finalizado y el acceso a los módulos operativos se encuentra suspendido temporalmente.
              </p>
              <div className="blocked-action-wrapper">
                <button className="primary font-bold flex-align" onClick={() => navigate('/suscripciones')} style={{ gap: '0.5rem', width: '100%', justifyContent: 'center', padding: '0.75rem', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  <CreditCard size={18} /> Ir a Facturación y Pago
                </button>
              </div>
            </div>
          </div>
        ) : (
          children
        )}
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

        /* Trial Ending Banner */
        .trial-warning-banner {
          background: linear-gradient(90deg, #F59E0B 0%, #D97706 100%);
          border-radius: 0.5rem;
          padding: 0.75rem 1.25rem;
          margin-bottom: 1.5rem;
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
        }
        
        .banner-content {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }
        
        .banner-btn {
          background: white;
          color: #D97706;
          border: none;
          font-weight: 700;
          font-size: 0.75rem;
          padding: 0.4rem 0.8rem;
          border-radius: 0.375rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          transition: all 0.2s ease;
        }
        
        .banner-btn:hover {
          background: #FEF3C7;
          transform: translateY(-1px);
        }

        /* Blocked Access Overlay */
        .blocked-view-container {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3rem 1rem;
          min-height: 50vh;
        }
        
        .blocked-card {
          background: white;
          border: 1px solid rgba(226, 232, 240, 0.8);
          border-radius: 1rem;
          max-width: 450px;
          width: 100%;
          padding: 2.25rem;
          text-align: center;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }
        
        .lock-icon-wrapper {
          background: rgba(239, 68, 68, 0.08);
          color: #EF4444;
          width: 64px;
          height: 64px;
          border-radius: 9999px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem auto;
          box-shadow: 0 4px 10px rgba(239, 68, 68, 0.1);
        }
        
        .blocked-card h2 {
          color: var(--text-dark);
          font-size: 1.35rem;
          font-weight: 800;
          margin-bottom: 0.75rem;
        }
        
        .blocked-card p {
          color: var(--text-light);
          font-size: 0.875rem;
          line-height: 1.5;
          margin-bottom: 1.75rem;
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

          <Route path="/suscripciones" element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
              <Layout><Suscripciones /></Layout>
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
