import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Package, 
  Users, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Building2,
  Tags,
  Truck,
  LogOut,
  Calculator,
  TrendingUp,
  UserCheck,
  CreditCard
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  rol: string;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed, rol }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    // Dashboards
    { name: 'Dashboard Comercial', icon: TrendingUp, path: '/dashboard-comercial', roles: ['SUPER_ADMIN', 'ADMIN', 'VENDEDOR'], group: 'Dashboards' },
    { name: 'Dashboard Operativo', icon: LayoutDashboard, path: '/dashboard-operativo', roles: ['SUPER_ADMIN', 'ADMIN', 'IMPORTADOR'], group: 'Dashboards' },
    
    // Módulo Comercial
    { name: 'Leads o Prospectos', icon: Users, path: '/leads', roles: ['SUPER_ADMIN', 'ADMIN', 'VENDEDOR'], group: 'Módulo Comercial' },
    { name: 'Clientes', icon: UserCheck, path: '/clientes', roles: ['SUPER_ADMIN', 'ADMIN', 'VENDEDOR'], group: 'Módulo Comercial' },
    
    // Módulo Operativo
    { name: 'Cotizaciones', icon: FileText, path: '/cotizaciones', roles: ['SUPER_ADMIN', 'ADMIN', 'VENDEDOR'], group: 'Módulo Operativo' },
    { name: 'Órdenes', icon: Package, path: '/ordenes', roles: ['SUPER_ADMIN', 'ADMIN', 'VENDEDOR'], group: 'Módulo Operativo' },
    { name: 'Costeos', icon: Calculator, path: '/costeos', roles: ['SUPER_ADMIN', 'ADMIN', 'IMPORTADOR'], group: 'Módulo Operativo' },
    
    // Configuración
    { name: 'Empresas', icon: Building2, path: '/empresas', roles: ['SUPER_ADMIN'], group: 'Configuración' },
    { name: 'Cobros Suscripción', icon: CreditCard, path: '/suscripciones', roles: ['SUPER_ADMIN'], group: 'Configuración' },
    { name: 'Proveedores', icon: Truck, path: '/proveedores', roles: ['SUPER_ADMIN', 'ADMIN', 'VENDEDOR'], group: 'Configuración' },
    { name: 'Categorías', icon: Tags, path: '/categorias', roles: ['SUPER_ADMIN', 'ADMIN'], group: 'Configuración' },
    { name: 'Usuarios', icon: Users, path: '/usuarios', roles: ['SUPER_ADMIN', 'ADMIN'], group: 'Configuración' },
    { name: 'Mi Perfil', icon: Settings, path: '/perfil', roles: ['SUPER_ADMIN', 'ADMIN', 'VENDEDOR', 'IMPORTADOR'], group: 'Configuración' },
  ];


  const filteredMenu = menuItems.filter(item => item.roles.includes(rol));

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && <span className="brand-name">FORWARDERLY</span>}
        <button onClick={() => setCollapsed(!collapsed)} className="toggle-btn">
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
      
      <nav className="sidebar-nav">
        {filteredMenu.map((item, index) => {
          const showGroupHeader = index === 0 || filteredMenu[index - 1].group !== item.group;
          return (
            <React.Fragment key={item.name}>
              {showGroupHeader && !collapsed && (
                <div className="group-header">
                  {item.group}
                </div>
              )}
              {showGroupHeader && collapsed && (
                <div className="group-divider" />
              )}
              <div 
                className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <item.icon size={20} />
                {!collapsed && <span>{item.name}</span>}
              </div>
            </React.Fragment>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="nav-item logout" onClick={() => {
          localStorage.removeItem('token');
          localStorage.removeItem('selectedEmpresaId');
          navigate('/login');
        }}>
          <LogOut size={20} />
          {!collapsed && <span>Cerrar Sesión</span>}
        </div>
      </div>

      <style>{`
        .sidebar {
          width: var(--sidebar-width);
          height: 100vh;
          background: linear-gradient(180deg, #0F172A 0%, #020617 100%);
          color: #E2E8F0;
          position: fixed;
          left: 0;
          top: 0;
          display: flex;
          flex-direction: column;
          transition: var(--transition);
          z-index: 1000;
          border-right: 1px solid rgba(255, 255, 255, 0.06);
        }
        .sidebar.collapsed {
          width: var(--sidebar-collapsed-width);
        }
        .sidebar-header {
          padding: 1.25rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          min-height: 70px;
        }
        .brand-name {
          font-weight: 800;
          font-size: 1.15rem;
          letter-spacing: 1.5px;
          background: linear-gradient(90deg, #38BDF8 0%, #6366F1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .toggle-btn {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94A3B8;
          padding: 0.35rem;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        .toggle-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: white;
          transform: scale(1.05);
        }
        .sidebar-nav {
          flex: 1;
          padding: 1rem 0;
          overflow-y: auto;
        }
        /* Custom scrollbar for sidebar nav */
        .sidebar-nav::-webkit-scrollbar {
          width: 4px;
        }
        .sidebar-nav::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .sidebar-nav::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        .group-header {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: #475569;
          padding: 1.5rem 1.5rem 0.5rem 1.5rem;
        }
        .group-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.04);
          margin: 0.75rem 0.5rem;
        }
        .nav-item {
          display: flex;
          align-items: center;
          margin: 0.2rem 0.75rem;
          padding: 0.6rem 1rem;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          gap: 0.875rem;
          white-space: nowrap;
          border-radius: 0.75rem;
          color: #94A3B8;
          font-weight: 500;
          font-size: 0.875rem;
        }
        .nav-item:hover {
          background: rgba(255, 255, 255, 0.04);
          color: #F1F5F9;
          transform: translateX(2px);
        }
        .nav-item svg {
          transition: transform 0.2s ease;
        }
        .nav-item:hover svg {
          transform: scale(1.05);
        }
        .nav-item.active {
          background: linear-gradient(90deg, rgba(79, 70, 229, 0.95) 0%, rgba(99, 102, 241, 0.85) 100%);
          color: white;
          font-weight: 600;
          box-shadow: 0 4px 14px rgba(79, 70, 229, 0.25);
        }
        .nav-item.active svg {
          color: #38BDF8;
        }
        .sidebar-footer {
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          padding: 0.75rem 0;
        }
        .logout {
          color: #FCA5A5;
        }
        .logout:hover {
          background: rgba(239, 68, 68, 0.08);
          color: #EF4444;
        }
      `}</style>
    </div>
  );
};

export default Sidebar;
