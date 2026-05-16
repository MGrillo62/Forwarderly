import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  Filter, 
  DollarSign, 
  Clock, 
} from 'lucide-react';

const Ordenes: React.FC = () => {
  const { token } = useAuth();
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrden, setSelectedOrden] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    fetchOrdenes();
  }, []);

  const fetchOrdenes = async () => {
    try {
      const response = await api.get('/ordenes');
      setOrdenes(response.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateOrden = async (id: string, data: any) => {
    try {
      await api.put(`/ordenes/${id}`, data);
      fetchOrdenes();
      setSelectedOrden(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al actualizar orden');
    }
  };

  const getCanalBadge = (canal: string) => {
    switch (canal) {
      case 'VERDE': return 'badge-green';
      case 'AMARILLO': return 'badge-yellow';
      case 'ROJO': return 'badge-red';
      case 'SIN_CANAL': return 'badge-gray';
      default: return 'badge-gray';
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Órdenes de Importación</h1>
        <div className="filters-bar">
          <div className="search-input">
            <Search size={18} />
            <input type="text" placeholder="Buscar por BL, DAM, Cliente..." />
          </div>
          <button className="btn-outline icon-left"><Filter size={18} /> Filtros</button>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Orden</th>
                <th>Cliente</th>
                <th>Nro BL / DAM</th>
                <th>Canal</th>
                <th>ETD / ETA</th>
                <th>Estado</th>
                <th>Pago</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((o) => {
                const totalPagado = o.pagos?.reduce((acc: number, p: any) => acc + p.monto, 0) || 0;
                const totalOrden = o.cotizacion?.precioTotal || 0;
                const porcentajePago = (totalPagado / totalOrden) * 100;

                return (
                  <tr key={o.id}>
                    <td>
                      <div className="order-id">
                        <strong>ORD-{o.correlativo}-{o.anio}</strong>
                        <small>Ref: {o.cotizacion?.numero}</small>
                      </div>
                    </td>
                    <td>{o.cotizacion?.cliente?.razonSocial}</td>
                    <td>
                      <div className="tracking-info">
                        <div>BL: {o.nroBL || '-'}</div>
                        <div>DAM: {o.nroDAM || '-'}</div>
                      </div>
                    </td>
                    <td>
                      {o.canal && <span className={`canal-dot ${getCanalBadge(o.canal)}`}></span>}
                      {o.canal || '-'}
                    </td>
                    <td>
                      <div className="dates-info">
                        <small>ETD: {o.fechaETD ? new Date(o.fechaETD).toLocaleDateString() : '-'}</small>
                        <small>ETA: {o.fechaETA ? new Date(o.fechaETA).toLocaleDateString() : '-'}</small>
                      </div>
                    </td>
                    <td>
                      <span className="status-pill">{o.estado.replace(/_/g, ' ')}</span>
                    </td>
                    <td>
                      <div className="payment-progress">
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${porcentajePago}%` }}></div>
                        </div>
                        <small>{porcentajePago.toFixed(0)}% pagado</small>
                      </div>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button title="Actualizar Tracking" onClick={() => setSelectedOrden(o)}>
                          <Clock size={16} />
                        </button>
                        <button title="Pagos" className="success" onClick={() => { setSelectedOrden(o); setShowPaymentModal(true); }}>
                          <DollarSign size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrden && !showPaymentModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Actualizar Tracking ORD-{selectedOrden.correlativo}</h3>
              <button className="icon-btn" onClick={() => setSelectedOrden(null)}><Clock size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                <div className="form-group">
                  <label>Nro BL</label>
                  <input 
                    type="text" 
                    value={selectedOrden.nroBL || ''} 
                    onChange={(e) => setSelectedOrden({...selectedOrden, nroBL: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Nro DAM</label>
                  <input 
                    type="text" 
                    value={selectedOrden.nroDAM || ''}
                    onChange={(e) => setSelectedOrden({...selectedOrden, nroDAM: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Canal</label>
                  <select 
                    value={selectedOrden.canal || ''}
                    onChange={(e) => setSelectedOrden({...selectedOrden, canal: e.target.value})}
                  >
                    <option value="">Pendiente</option>
                    <option value="VERDE">Verde</option>
                    <option value="AMARILLO">Amarillo</option>
                    <option value="ROJO">Rojo</option>
                    <option value="SIN_CANAL">Sin Canal</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <select 
                    value={selectedOrden.estado}
                    onChange={(e) => setSelectedOrden({...selectedOrden, estado: e.target.value})}
                  >
                    <option value="COORDINACION_EMBARQUE">Coordinación de embarque</option>
                    <option value="EN_TRANSITO">En tránsito</option>
                    <option value="EN_PUERTO">En puerto</option>
                    <option value="NUMERADA">Numerada</option>
                    <option value="ENTREGADA">Entregada</option>
                    <option value="DESPACHO_CULMINADO">Despacho culminado</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Fecha ETD</label>
                  <input 
                    type="date" 
                    value={selectedOrden.fechaETD ? selectedOrden.fechaETD.split('T')[0] : ''} 
                    onChange={(e) => setSelectedOrden({...selectedOrden, fechaETD: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Fecha ETA</label>
                  <input 
                    type="date" 
                    value={selectedOrden.fechaETA ? selectedOrden.fechaETA.split('T')[0] : ''} 
                    onChange={(e) => setSelectedOrden({...selectedOrden, fechaETA: e.target.value})}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setSelectedOrden(null)}>Cancelar</button>
              <button className="primary" onClick={() => {
                const { nroBL, nroDAM, canal, estado, fechaETD, fechaETA } = selectedOrden;
                handleUpdateOrden(selectedOrden.id, { nroBL, nroDAM, canal, estado, fechaETD, fechaETA });
              }}>Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .filters-bar {
          display: flex;
          gap: 1rem;
        }
        .search-input {
          position: relative;
          width: 300px;
        }
        .search-input svg {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-light);
        }
        .search-input input {
          padding-left: 2.5rem;
        }
        .order-id strong { color: var(--primary); display: block; }
        .order-id small { color: var(--text-light); font-size: 0.7rem; }
        .tracking-info div { font-size: 0.75rem; }
        .dates-info { display: flex; flex-direction: column; }
        .dates-info small { font-size: 0.7rem; color: var(--text-light); }
        .canal-dot {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          margin-right: 0.5rem;
        }
        .badge-green { background: #10b981; }
        .badge-yellow { background: #fbbf24; }
        .badge-red { background: #ef4444; }
        .badge-gray { background: #94a3b8; }
        .status-pill {
          background: #f1f5f9;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.7rem;
          text-transform: uppercase;
          font-weight: 600;
        }
        .payment-progress { width: 100px; }
        .progress-bar {
          height: 6px;
          background: #e2e8f0;
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 2px;
        }
        .progress-fill { height: 100%; background: var(--success); }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
      `}</style>
    </div>
  );
};

export default Ordenes;
