import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { 
  Users, TrendingUp, Landmark, ShieldCheck, 
  User, CheckCircle, AlertTriangle, FileText, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getRemainingBusinessDays } from './ReclamacionesAdmin';

const STAGE_LABELS: Record<string, string> = {
  NUEVO_CONTACTO: 'Nuevo Contacto',
  CONTACTADO: 'Contactado',
  COTIZANDO: 'Cotizando',
  CERRADO_GANADO: 'Cerrado Ganado',
  CERRADO_PERDIDO: 'Cerrado Perdido'
};

const STAGE_COLORS: Record<string, string> = {
  NUEVO_CONTACTO: 'bg-sky-500',
  CONTACTADO: 'bg-indigo-500',
  COTIZANDO: 'bg-amber-500',
  CERRADO_GANADO: 'bg-emerald-500',
  CERRADO_PERDIDO: 'bg-rose-500'
};

const DashboardComercial: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  
  // Alertas de Reclamaciones (solo SUPER_ADMIN o ADMIN)
  const [reclamacionesAlerts, setReclamacionesAlerts] = useState<any[]>([]);

  useEffect(() => {
    fetchCommercialData();
    if (user?.rol === 'SUPER_ADMIN' || user?.rol === 'ADMIN') {
      api.get('/reclamaciones')
        .then(res => {
          const pending = res.data.filter((c: any) => c.estado === 'PENDIENTE');
          setReclamacionesAlerts(pending);
        })
        .catch(err => console.error('Error fetching claims for alerts:', err));
    }
  }, [user]);

  const fetchCommercialData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/dashboards/comercial');
      setData(res.data);
    } catch (err) {
      console.error('Error fetching commercial dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-500 font-semibold">Cargando métricas comerciales...</div>;
  }

  if (!data) {
    return <div className="text-center py-12 text-slate-500 font-semibold">No se pudieron cargar los datos del dashboard.</div>;
  }

  const criticalClaims = reclamacionesAlerts.map(c => ({
    ...c,
    remaining: getRemainingBusinessDays(c.createdAt)
  })).sort((a, b) => a.remaining - b.remaining);

  const criticalCount = criticalClaims.filter(c => c.remaining <= 3).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <TrendingUp className="text-sky-600" size={26} /> Dashboard Comercial
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Métricas de conversión de prospectos, rendimiento del equipo de ventas y cotizaciones para {user?.empresa?.razonSocial || 'Super Admin'}.
        </p>
      </div>

      {/* Alerta de Libro de Reclamaciones */}
      {(user?.rol === 'SUPER_ADMIN' || user?.rol === 'ADMIN') && criticalClaims.length > 0 && (
        <div className="mb-6 p-4 rounded-xl border border-rose-200 bg-rose-50/50 backdrop-blur text-rose-900 shadow-sm animate-slide-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h4 className="font-bold text-sm text-rose-800">
                Alerta de Respuestas Pendientes a Reclamos (INDECOPI)
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                Tiene <strong>{reclamacionesAlerts.length} hojas de reclamación pendientes</strong> de respuesta oficial.
                {criticalCount > 0 && ` ¡Atención! ${criticalCount} de ellas están en estado Crítico (≤ 3 días hábiles).`}
              </p>
              
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {criticalClaims.slice(0, 4).map(c => {
                  const isOverdue = c.remaining < 0;
                  const isCritical = c.remaining <= 3;
                  return (
                    <div 
                      key={c.id} 
                      className={`text-xs p-2 rounded-lg border flex justify-between items-center ${
                        isOverdue 
                          ? 'bg-rose-100/80 border-rose-200 text-rose-800 font-semibold' 
                          : isCritical 
                            ? 'bg-amber-100/80 border-amber-200 text-amber-800 font-semibold animate-pulse'
                            : 'bg-slate-100/80 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div>
                        <span className="font-bold">{c.numeroReclamacion}</span>
                        <span className="mx-1.5 opacity-50">|</span>
                        <span>{c.nombres} {c.apellidos.charAt(0)}.</span>
                      </div>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-white/60">
                        {isOverdue 
                          ? `VENCIDO hace ${Math.abs(c.remaining)}d` 
                          : `${c.remaining}d hábiles`
                        }
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <button 
              onClick={() => navigate('/reclamaciones-admin')} 
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-1.5 px-3 rounded-lg shrink-0 transition"
            >
              Atender Reclamos
            </button>
          </div>
        </div>
      )}

      {/* Grid de KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-icon bg-blue-500 text-white">
            <Users size={22} />
          </div>
          <div className="stat-info">
            <small className="text-slate-400 text-xs font-semibold block uppercase">Leads Nuevos (Mes)</small>
            <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{data.leadsNuevosMes}</h3>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon bg-emerald-500 text-white">
            <TrendingUp size={22} />
          </div>
          <div className="stat-info">
            <small className="text-slate-400 text-xs font-semibold block uppercase">Tasa de Conversión</small>
            <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{data.tasaConversion}%</h3>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon bg-indigo-500 text-white">
            <ShieldCheck size={22} />
          </div>
          <div className="stat-info">
            <small className="text-slate-400 text-xs font-semibold block uppercase">Cotizaciones Aprobadas</small>
            <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{data.cotizacionesStats.aprobada}</h3>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon bg-purple-500 text-white">
            <FileText size={22} />
          </div>
          <div className="stat-info">
            <small className="text-slate-400 text-xs font-semibold block uppercase">Total Cotizaciones</small>
            <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{data.cotizacionesStats.total}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Embudo de Prospectos */}
        <div className="card lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="text-md font-bold text-slate-800 border-b pb-3 mb-4">
              Embudo de Prospectos
            </h3>
            <div className="space-y-4">
              {Object.keys(STAGE_LABELS).map(key => {
                const found = data.leadsPorEstado.find((s: any) => s.estado === key);
                const count = found ? found._count : 0;
                const percentage = data.totalLeads > 0 ? (count / data.totalLeads) * 100 : 0;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                      <span>{STAGE_LABELS[key]}</span>
                      <span>{count} ({Math.round(percentage)}%)</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${STAGE_COLORS[key]} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-6 flex justify-between items-center">
            <div>
              <div className="text-slate-400 text-xxs font-bold uppercase">Total Prospectos</div>
              <div className="text-lg font-bold text-slate-800 mt-0.5">{data.totalLeads} Leads</div>
            </div>
            <button className="secondary px-3 py-1.5 text-xs flex items-center gap-1" onClick={() => navigate('/leads')}>
              Ver Tablero <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Rendimiento de Ventas por Vendedor */}
        <div className="card lg:col-span-2">
          <h3 className="text-md font-bold text-slate-800 border-b pb-3 mb-4">
            Rendimiento Comercial por Vendedor
          </h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th>Cotizaciones</th>
                  <th>Aprobadas</th>
                  <th>Conversión</th>
                  <th>Total Vendido (USD)</th>
                  <th>Utilidad (USD)</th>
                </tr>
              </thead>
              <tbody>
                {data.rendimientoVendedores.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-400 text-xs">
                      No hay vendedores registrados en este período.
                    </td>
                  </tr>
                ) : (
                  data.rendimientoVendedores.map((v: any) => (
                    <tr key={v.vendedorId} className="hover:bg-slate-50">
                      <td>
                        <div className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                          <User size={13} className="text-slate-400" />
                          {v.nombre}
                        </div>
                        <div className="text-xxs text-slate-400 font-mono">@{v.username}</div>
                      </td>
                      <td className="text-slate-700 text-sm font-semibold">{v.totalCotizaciones}</td>
                      <td className="text-slate-700 text-sm font-semibold">{v.cotizacionesAprobadas}</td>
                      <td>
                        <span className="bg-sky-50 text-sky-700 font-bold px-2 py-0.5 rounded text-xs">
                          {v.tasaConversion.toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-slate-800 text-sm font-bold">
                        ${v.totalVendido.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="text-emerald-600 text-sm font-bold">
                        ${v.utilidadTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        .stat-card {
          background: white;
          padding: 1.25rem;
          border-radius: 1rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
          border: 1px solid var(--border);
        }
        .stat-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .text-xxs { font-size: 0.65rem; }
      `}</style>
    </div>
  );
};

export default DashboardComercial;
