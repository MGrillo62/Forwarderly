import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { 
  Package, Calculator, DollarSign, Percent, 
  MapPin, Clock, ArrowRight, Anchor, FileText, User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ORDEN_ESTADO_LABELS: Record<string, string> = {
  COORDINACION_EMBARQUE: 'Coordinación Embarque',
  EN_TRANSITO: 'En Tránsito',
  EN_PUERTO: 'En Puerto',
  NUMERADA: 'Numerada',
  ENTREGADA: 'Entregada',
  DESPACHO_CULMINADO: 'Despacho Culminado'
};

const ORDEN_ESTADO_COLORS: Record<string, string> = {
  COORDINACION_EMBARQUE: 'bg-blue-50 text-blue-700 border-blue-200',
  EN_TRANSITO: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  EN_PUERTO: 'bg-amber-50 text-amber-700 border-amber-200',
  NUMERADA: 'bg-purple-50 text-purple-700 border-purple-200',
  ENTREGADA: 'bg-sky-50 text-sky-700 border-sky-200',
  DESPACHO_CULMINADO: 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

const DashboardOperativo: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchOperationalData();
  }, []);

  const fetchOperationalData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/dashboards/operativo');
      setData(res.data);
    } catch (err) {
      console.error('Error fetching operational dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-500 font-semibold">Cargando métricas operativas...</div>;
  }

  if (!data) {
    return <div className="text-center py-12 text-slate-500 font-semibold">No se pudieron cargar los datos del dashboard operativo.</div>;
  }

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Package className="text-indigo-600" size={26} /> Dashboard Operativo
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Métricas de importación, costeo de productos, utilidades y logística en curso para {user?.empresa?.razonSocial || 'Super Admin'}.
        </p>
      </div>

      {/* Grid de KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-icon bg-indigo-500 text-white">
            <Package size={22} />
          </div>
          <div className="stat-info">
            <small className="text-slate-400 text-xs font-semibold block uppercase">Órdenes en Curso</small>
            <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{data.ordenes.enCurso}</h3>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon bg-sky-500 text-white">
            <Calculator size={22} />
          </div>
          <div className="stat-info">
            <small className="text-slate-400 text-xs font-semibold block uppercase">Costeos Activos</small>
            <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{data.costeos.borrador} <span className="text-xs text-slate-400 font-normal">borrador</span></h3>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon bg-emerald-500 text-white">
            <DollarSign size={22} />
          </div>
          <div className="stat-info">
            <small className="text-slate-400 text-xs font-semibold block uppercase">Utilidad Estimada</small>
            <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{formatCurrency(data.financiero.totalUtilidad)}</h3>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon bg-amber-500 text-white">
            <Percent size={22} />
          </div>
          <div className="stat-info">
            <small className="text-slate-400 text-xs font-semibold block uppercase">Margen Promedio</small>
            <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{data.financiero.margenPromedio}%</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Órdenes en curso (Logística) */}
        <div className="card">
          <div className="flex justify-between items-center border-b pb-3 mb-4">
            <h3 className="text-md font-bold text-slate-800 flex items-center gap-1.5">
              <Anchor size={18} className="text-sky-500" /> Control Logístico (Órdenes Activas)
            </h3>
            <button className="btn-outline py-1 px-2.5 text-xs rounded flex items-center gap-1" onClick={() => navigate('/ordenes')}>
              Ver Todo <ArrowRight size={12} />
            </button>
          </div>
          
          <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
            {data.ordenes.listadoActivas.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No hay operaciones ni órdenes de importación activas.
              </div>
            ) : (
              data.ordenes.listadoActivas.map((ord: any) => {
                const clientName = ord.cotizacion?.cliente?.razonSocial || ord.cotizacion?.lead?.nombre || ord.cotizacion?.lead?.contacto || 'Sin cliente';
                const isLead = !ord.cotizacion?.cliente;
                return (
                  <div key={ord.id} className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-mono font-bold text-slate-700 text-xs">
                          ORD-{ord.correlativo.toString().padStart(4, '0')}-{ord.anio}
                        </span>
                        <div className="text-xxs text-slate-400 font-medium">
                          Cotización: #{ord.cotizacion?.numero}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xxs font-bold border ${ORDEN_ESTADO_COLORS[ord.estado] || 'bg-slate-100 text-slate-600'}`}>
                        {ORDEN_ESTADO_LABELS[ord.estado] || ord.estado}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                      <div>
                        <div className="text-slate-400 text-xxs uppercase font-semibold">Cliente</div>
                        <div className="truncate font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                          <User size={10} className="text-slate-400" />
                          {clientName}
                          {isLead && <span className="bg-amber-100 text-amber-700 px-1 rounded text-xxs font-bold">Lead</span>}
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-400 text-xxs uppercase font-semibold">Documento / B/L</div>
                        <div className="truncate font-medium text-slate-700 mt-0.5">{ord.nroBL || 'Pendiente'}</div>
                      </div>

                      <div className="col-span-2 flex items-center gap-3 mt-2 text-xxs font-bold text-slate-400 uppercase tracking-wide">
                        <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                          <Clock size={11} /> ETD: {ord.fechaETD ? new Date(ord.fechaETD).toLocaleDateString() : 'Por confirmar'}
                        </span>
                        <span className="flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded text-indigo-600">
                          <Clock size={11} /> ETA: {ord.fechaETA ? new Date(ord.fechaETA).toLocaleDateString() : 'Por confirmar'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Costeos de importación recientes */}
        <div className="card">
          <div className="flex justify-between items-center border-b pb-3 mb-4">
            <h3 className="text-md font-bold text-slate-800 flex items-center gap-1.5">
              <Calculator size={18} className="text-indigo-500" /> Costeos y Liquidación
            </h3>
            <button className="btn-outline py-1 px-2.5 text-xs rounded flex items-center gap-1" onClick={() => navigate('/costeos')}>
              Ver Todo <ArrowRight size={12} />
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Código / SKU</th>
                  <th>Cliente</th>
                  <th>Incoterm</th>
                  <th>FOB Total</th>
                  <th>Costo Landed</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.costeos.listadoRecientes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-400 text-xs">
                      No hay costeos de importación registrados.
                    </td>
                  </tr>
                ) : (
                  data.costeos.listadoRecientes.map((cost: any) => (
                    <tr key={cost.id} className="hover:bg-slate-50">
                      <td>
                        <div className="font-bold text-slate-800 text-xs font-mono">{cost.codigo}</div>
                        <div className="text-xxs text-slate-400">{cost.modalidad}</div>
                      </td>
                      <td className="text-xs text-slate-600 truncate max-w-[120px]">
                        {cost.cliente?.razonSocial || cost.clienteNombre || 'Sin cliente'}
                      </td>
                      <td className="text-xs font-bold text-slate-700">{cost.incoterm}</td>
                      <td className="text-xs font-semibold text-slate-800">
                        {cost.totalFacturaComercial.toLocaleString('en-US', { style: 'currency', currency: cost.moneda })}
                      </td>
                      <td className="text-xs font-bold text-slate-900">
                        {cost.costoTotalImportacion.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </td>
                      <td>
                        <span className={`px-2 py-0.5 rounded text-xxs font-bold ${cost.estado === 'TERMINADO' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                          {cost.estado}
                        </span>
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

export default DashboardOperativo;
