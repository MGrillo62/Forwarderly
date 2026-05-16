import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { 
  FileText, 
  Package, 
  Users, 
  TrendingUp, 
  Clock, 
  AlertCircle
} from 'lucide-react';

const Dashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [stats, setStats] = useState({
    cotizaciones: 0,
    ordenes: 0,
    clientes: 0,
    montoTotal: 0,
    costeos: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const endpoints = [];
      if (user?.rol !== 'IMPORTADOR') {
        endpoints.push(api.get('/cotizaciones'), api.get('/ordenes'), api.get('/clientes'));
      }
      endpoints.push(api.get('/costeos'));

      const results = await Promise.all(endpoints);
      
      if (user?.rol !== 'IMPORTADOR') {
        const [cotRes, ordRes, cliRes, costRes] = results;
        setStats({
          cotizaciones: cotRes.data.length,
          ordenes: ordRes.data.length,
          clientes: cliRes.data.length,
          montoTotal: ordRes.data.reduce((acc: number, o: any) => acc + (o.cotizacion?.precioTotal || 0), 0),
          costeos: costRes.data.length
        });
      } else {
        const [costRes] = results;
        setStats({
          cotizaciones: 0,
          ordenes: 0,
          clientes: 0,
          montoTotal: 0,
          costeos: costRes.data.length
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="dashboard-welcome">
        <h1>Bienvenido de nuevo, {user?.nombres}</h1>
        <p>Resumen del sistema para {user?.empresa?.razonSocial || 'Super Admin'}</p>
      </div>

      <div className="stats-grid">
        {user?.rol !== 'IMPORTADOR' && (
          <>
            <div className="stat-card">
              <div className="stat-icon blue">
                <FileText />
              </div>
              <div className="stat-info">
                <small>Cotizaciones</small>
                <h3>{stats.cotizaciones}</h3>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon green">
                <Package />
              </div>
              <div className="stat-info">
                <small>Órdenes Activas</small>
                <h3>{stats.ordenes}</h3>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon purple">
                <Users />
              </div>
              <div className="stat-info">
                <small>Clientes</small>
                <h3>{stats.clientes}</h3>
              </div>
            </div>
          </>
        )}

        <div className="stat-card">
          <div className="stat-icon orange">
            <TrendingUp />
          </div>
          <div className="stat-info">
            <small>Costeos de Importación</small>
            <h3>{stats.costeos}</h3>
          </div>
        </div>
      </div>

      <div className="dashboard-row">
        <div className="card main-chart">
          <h3>Actividad Reciente</h3>
          <div className="placeholder-chart">
            <p>Gráfica de rendimiento (Próximamente)</p>
          </div>
        </div>
        
        <div className="card side-list">
          <h3>Alertas de Importación</h3>
          <div className="alert-item">
            <Clock className="icon-warning" size={18} />
            <div>
              <strong>ETA Próxima</strong>
              <small>Orden ORD-123 llega en 2 días</small>
            </div>
          </div>
          <div className="alert-item">
            <AlertCircle className="icon-danger" size={18} />
            <div>
              <strong>Pago Pendiente</strong>
              <small>ORD-456 requiere pago total para despacho</small>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .dashboard-welcome {
          margin-bottom: 2rem;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        .stat-card {
          background: white;
          padding: 1.5rem;
          border-radius: 1rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        .stat-icon {
          width: 50px;
          height: 50px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .stat-icon.blue { background: #3b82f6; }
        .stat-icon.green { background: #10b981; }
        .stat-icon.purple { background: #8b5cf6; }
        .stat-icon.orange { background: #f59e0b; }
        
        .stat-info small { color: var(--text-light); }
        .stat-info h3 { font-size: 1.5rem; margin-top: 0.25rem; }

        .dashboard-row {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.5rem;
        }
        .placeholder-chart {
          height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8fafc;
          border-radius: 0.5rem;
          margin-top: 1rem;
          color: var(--text-light);
        }
        .alert-item {
          display: flex;
          gap: 1rem;
          padding: 1rem 0;
          border-bottom: 1px solid var(--border);
        }
        .alert-item:last-child { border: none; }
        .alert-item strong { display: block; font-size: 0.9rem; }
        .alert-item small { color: var(--text-light); font-size: 0.8rem; }
        .icon-warning { color: #f59e0b; }
        .icon-danger { color: #ef4444; }

        @media (max-width: 1024px) {
          .dashboard-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
