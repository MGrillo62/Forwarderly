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
  UserCheck
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
          background-color: var(--primary);
          color: white;
          position: fixed;
          left: 0;
          top: 0;
          display: flex;
          flex-direction: column;
          transition: var(--transition);
          z-index: 1000;
        }
        .sidebar.collapsed {
          width: var(--sidebar-collapsed-width);
        }
        .sidebar-header {
          padding: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .brand-name {
          font-weight: 800;
          font-size: 1.25rem;
          letter-spacing: 1px;
        }
        .toggle-btn {
          background: rgba(255,255,255,0.1);
          color: white;
          padding: 0.25rem;
          border-radius: 4px;
        }
        .sidebar-nav {
          flex: 1;
          padding: 1rem 0;
          overflow-y: auto;
        }
        .group-header {
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: rgba(255, 255, 255, 0.4);
          padding: 1.25rem 1.5rem 0.5rem 1.5rem;
        }
        .group-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
          margin: 0.75rem 0.5rem;
        }
        .nav-item {
          display: flex;
          align-items: center;
          padding: 0.65rem 1.5rem;
          cursor: pointer;
          transition: background 0.2s;
          gap: 1rem;
          white-space: nowrap;
        }
        .nav-item:hover {
          background: rgba(255,255,255,0.05);
        }
        .nav-item.active {
          background: var(--secondary);
          color: white;
        }
        .sidebar-footer {
          border-top: 1px solid rgba(255,255,255,0.1);
          padding: 1rem 0;
        }
        .logout {
          color: #fda4af;
        }
      `}</style>
    </div>
  );
};

export default Sidebar;
