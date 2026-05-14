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
  LogOut
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
    { name: 'Dashboard', icon: LayoutDashboard, path: '/', roles: ['SUPER_ADMIN', 'ADMIN', 'VENDEDOR'] },
    { name: 'Empresas', icon: Building2, path: '/empresas', roles: ['SUPER_ADMIN'] },
    { name: 'Clientes', icon: Users, path: '/clientes', roles: ['ADMIN', 'VENDEDOR'] },
    { name: 'Proveedores', icon: Truck, path: '/proveedores', roles: ['ADMIN', 'VENDEDOR'] },
    { name: 'Cotizaciones', icon: FileText, path: '/cotizaciones', roles: ['ADMIN', 'VENDEDOR'] },
    { name: 'Órdenes', icon: Package, path: '/ordenes', roles: ['ADMIN', 'VENDEDOR'] },
    { name: 'Categorías', icon: Tags, path: '/categorias', roles: ['ADMIN'] },
    { name: 'Usuarios', icon: Users, path: '/usuarios', roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Mi Perfil', icon: Settings, path: '/perfil', roles: ['SUPER_ADMIN', 'ADMIN', 'VENDEDOR'] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(rol));

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && <span className="brand-name">IMPORT PERÚ</span>}
        <button onClick={() => setCollapsed(!collapsed)} className="toggle-btn">
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
      
      <nav className="sidebar-nav">
        {filteredMenu.map((item) => (
          <div 
            key={item.name}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <item.icon size={22} />
            {!collapsed && <span>{item.name}</span>}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="nav-item logout" onClick={() => {
          localStorage.removeItem('token');
          navigate('/login');
        }}>
          <LogOut size={22} />
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
        }
        .nav-item {
          display: flex;
          align-items: center;
          padding: 0.75rem 1.5rem;
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
