import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Plus, Eye, Edit, CheckCircle, XCircle, Send } from 'lucide-react';
import CotizacionForm from '../components/CotizacionForm';

const Cotizaciones: React.FC = () => {
  const { token } = useAuth();
  const [cotizaciones, setCotizaciones] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedCot, setSelectedCot] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCotizaciones();
  }, []);

  const fetchCotizaciones = async () => {
    try {
      const response = await api.get('/cotizaciones');
      setCotizaciones(response.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (id: string, estado: string) => {
    if (!window.confirm(`¿Seguro que desea cambiar el estado a ${estado}?`)) return;
    try {
      await api.put(`/cotizaciones/${id}`, { estado });
      fetchCotizaciones();
    } catch (err) {
      alert('Error al actualizar estado');
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'BORRADOR': return 'status-draft';
      case 'ENVIADA': return 'status-sent';
      case 'APROBADA': return 'status-approved';
      case 'RECHAZADA': return 'status-rejected';
      default: return '';
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Cotizaciones</h1>
        <button className="primary icon-left" onClick={() => { setSelectedCot(null); setShowForm(true); }}>
          <Plus size={18} /> Nueva Cotización
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nro</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Vendedor</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cotizaciones.map((cot) => (
                <tr key={cot.id}>
                  <td><strong>{String(cot.numero).padStart(5, '0')}</strong></td>
                  <td>{cot.cliente?.razonSocial}</td>
                  <td>{new Date(cot.createdAt).toLocaleDateString()}</td>
                  <td>{cot.vendedor?.nombres}</td>
                  <td>S/ {cot.precioTotal.toFixed(2)}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(cot.estado)}`}>
                      {cot.estado}
                    </span>
                  </td>
                  <td>
                    <div className="actions-cell">
                      {cot.estado === 'BORRADOR' && (
                        <>
                          <button title="Editar" onClick={() => { setSelectedCot(cot); setShowForm(true); }}>
                            <Edit size={16} />
                          </button>
                          <button title="Enviar" onClick={() => handleUpdateStatus(cot.id, 'ENVIADA')}>
                            <Send size={16} />
                          </button>
                        </>
                      )}
                      {cot.estado === 'ENVIADA' && (
                        <>
                          <button title="Aprobar" className="success" onClick={() => handleUpdateStatus(cot.id, 'APROBADA')}>
                            <CheckCircle size={16} />
                          </button>
                          <button title="Rechazar" className="danger" onClick={() => handleUpdateStatus(cot.id, 'RECHAZADA')}>
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                      <button title="Ver">
                        <Eye size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <CotizacionForm 
          initialData={selectedCot} 
          onClose={() => setShowForm(false)} 
          onSave={() => { setShowForm(false); fetchCotizaciones(); }} 
        />
      )}

      <style>{`
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        .icon-left {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 99px;
          font-size: 0.75rem;
          font-weight: 700;
        }
        .status-draft { background: #e2e8f0; color: #475569; }
        .status-sent { background: #dbeafe; color: #2563eb; }
        .status-approved { background: #dcfce7; color: #16a34a; }
        .status-rejected { background: #fee2e2; color: #dc2626; }
        
        .actions-cell {
          display: flex;
          gap: 0.5rem;
        }
        .actions-cell button {
          padding: 0.4rem;
          background: #f1f5f9;
          color: var(--text-dark);
        }
        .actions-cell button.success { color: var(--success); }
        .actions-cell button.danger { color: var(--danger); }
      `}</style>
    </div>
  );
};

export default Cotizaciones;
