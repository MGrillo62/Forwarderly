import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Plus, Eye, Edit, CheckCircle, XCircle, Send, FileText, X } from 'lucide-react';
import { generateQuotationPDF } from '../utils/pdfGenerator';
import CotizacionForm from '../components/CotizacionForm';

const Cotizaciones: React.FC = () => {
  const { token } = useAuth();
  const [cotizaciones, setCotizaciones] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedCot, setSelectedCot] = useState<any>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // States for lead-to-client conversion
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [conversionLead, setConversionLead] = useState<any>(null);
  const [conversionCotId, setConversionCotId] = useState<string | null>(null);
  const [conversionForm, setConversionForm] = useState({
    ruc: '', razonSocial: '', direccion: '', contacto: '', correo: '', celular: ''
  });

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
    const cot = cotizaciones.find(c => c.id === id);
    
    // Intercept with conversion modal if approving a lead quote
    if (estado === 'APROBADA' && cot && cot.leadId && !cot.clienteId) {
      setConversionLead(cot.lead);
      setConversionCotId(id);
      setConversionForm({
        ruc: cot.lead.ruc || '',
        razonSocial: cot.lead.razonSocial || cot.lead.nombre || '',
        direccion: cot.lead.direccion || '',
        contacto: cot.lead.contacto || '',
        correo: cot.lead.correo || '',
        celular: cot.lead.celular || ''
      });
      setShowConversionModal(true);
      return;
    }

    if (!window.confirm(`¿Seguro que desea cambiar el estado a ${estado}?`)) return;
    try {
      await api.put(`/cotizaciones/${id}`, { estado });
      fetchCotizaciones();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al actualizar estado');
    }
  };

  const handleConversionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversionForm.ruc || !conversionForm.razonSocial || !conversionForm.direccion || !conversionForm.contacto) {
      return alert('Por favor llene todos los campos obligatorios.');
    }

    try {
      await api.put(`/cotizaciones/${conversionCotId}`, {
        estado: 'APROBADA',
        clientConversion: conversionForm
      });
      setShowConversionModal(false);
      setConversionLead(null);
      setConversionCotId(null);
      fetchCotizaciones();
      alert('Cotización aprobada. El Prospecto se ha convertido en Cliente Oficial con éxito.');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al realizar conversión de Lead a Cliente');
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const handleView = (cot: any) => {
    setSelectedCot(cot);
    setViewOnly(true);
    setShowForm(true);
  };

  const handleEdit = (cot: any) => {
    setSelectedCot(cot);
    setViewOnly(false);
    setShowForm(true);
  };

  const handleNew = () => {
    setSelectedCot(null);
    setViewOnly(false);
    setShowForm(true);
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

  const StatusStepper = ({ currentStatus, historial }: { currentStatus: string, historial: any[] }) => {
    const steps = ['BORRADOR', 'ENVIADA', 'APROBADA'];
    const currentIndex = steps.indexOf(currentStatus);
    const isRejected = currentStatus === 'RECHAZADA';

    const getStepInfo = (stepName: string) => {
      return historial?.find(h => h.estado === stepName);
    };

    return (
      <div className="status-stepper">
        {steps.map((step, idx) => {
          const info = getStepInfo(step);
          return (
            <React.Fragment key={step}>
              <div className={`step-item ${idx <= currentIndex ? 'active' : 'pending'} ${step === currentStatus ? 'current' : ''}`}>
                <div className="step-circle">{idx + 1}</div>
                <div className="step-content">
                  <span className="step-label">{step}</span>
                  {info && (
                    <div className="step-details">
                      <div className="step-user">{info.usuario?.nombres}</div>
                      <div className="step-time">
                        {new Date(info.fechaHora).toLocaleDateString()} {new Date(info.fechaHora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {idx < steps.length - 1 && <div className={`step-line ${idx < currentIndex ? 'active' : 'pending'}`}></div>}
            </React.Fragment>
          );
        })}
        {isRejected && (
          <>
            <div className="step-line active danger"></div>
            <div className="step-item active danger">
              <div className="step-circle">X</div>
              <div className="step-content">
                <span className="step-label">RECHAZADA</span>
                {getStepInfo('RECHAZADA') && (
                  <div className="step-details">
                    <div className="step-user">{getStepInfo('RECHAZADA').usuario?.nombres}</div>
                    <div className="step-time">
                      {new Date(getStepInfo('RECHAZADA').fechaHora).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h1>Cotizaciones</h1>
        <button className="primary icon-left" onClick={handleNew}>
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
                <React.Fragment key={cot.id}>
                  <tr>
                    <td><strong>{String(cot.numero).padStart(5, '0')}</strong></td>
                    <td>
                      {cot.cliente?.razonSocial || (
                        <span className="flex items-center gap-1.5 font-semibold text-amber-700">
                          👤 {cot.lead?.nombre || cot.lead?.contacto}
                          <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-xxs font-extrabold uppercase shadow-sm">PROSPECTO</span>
                        </span>
                      )}
                    </td>
                    <td>{new Date(cot.createdAt).toLocaleDateString()}</td>
                    <td>{cot.vendedor?.nombres}</td>
                    <td>S/ {cot.precioTotal.toFixed(2)}</td>
                    <td>
                      <span 
                        className={`status-badge ${getStatusClass(cot.estado)}`}
                        onClick={() => toggleRow(cot.id)}
                        style={{ cursor: 'pointer' }}
                        title="Ver historial de estados"
                      >
                        {cot.estado}
                      </span>
                    </td>
                    <td>
                      <div className="actions-cell">
                        {(cot.estado === 'BORRADOR' || cot.estado === 'ENVIADA') && (
                          <button title="Editar" onClick={() => handleEdit(cot)}>
                            <Edit size={16} />
                          </button>
                        )}
                        {cot.estado === 'BORRADOR' && (
                          <button title="Enviar" onClick={() => handleUpdateStatus(cot.id, 'ENVIADA')}>
                            <Send size={16} />
                          </button>
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
                        <button title="Ver" onClick={() => handleView(cot)}>
                          <Eye size={16} />
                        </button>
                        {(cot.estado === 'ENVIADA' || cot.estado === 'APROBADA' || cot.estado === 'RECHAZADA') && (
                          <button title="Descargar PDF" className="info" onClick={() => generateQuotationPDF(cot)}>
                            <FileText size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedRow === cot.id && (
                    <tr className="stepper-row">
                      <td colSpan={7}>
                        <StatusStepper currentStatus={cot.estado} historial={cot.historial} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <CotizacionForm 
          initialData={selectedCot} 
          viewOnly={viewOnly}
          onClose={() => setShowForm(false)} 
          onSave={() => { setShowForm(false); fetchCotizaciones(); }} 
        />
      )}

      {showConversionModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                🌟 Conversión Inteligente: De Prospecto a Cliente
              </h3>
              <button className="icon-btn" onClick={() => setShowConversionModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConversionSubmit}>
              <div className="modal-body">
                <p className="text-xs text-slate-500 mb-4 bg-blue-50 text-blue-700 p-2.5 rounded border border-blue-200">
                  La cotización está vinculada a un <strong>Prospecto</strong>. Para poder aprobar la cotización y generar su orden de importación, el sistema exige la conversión del Prospecto a <strong>Cliente Oficial</strong> con todos sus datos fiscales validados.
                </p>
                <div className="grid-2">
                  <div className="form-group">
                    <label>RUC / Tax ID *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Ej. 20123456789"
                      value={conversionForm.ruc}
                      onChange={(e) => setConversionForm({ ...conversionForm, ruc: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Razón Social *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Ej. Importaciones Peru SAC"
                      value={conversionForm.razonSocial}
                      onChange={(e) => setConversionForm({ ...conversionForm, razonSocial: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Nombre de Contacto *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Ej. Juan Pérez"
                      value={conversionForm.contacto}
                      onChange={(e) => setConversionForm({ ...conversionForm, contacto: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Celular</label>
                    <input 
                      type="text" 
                      placeholder="Ej. 987654321"
                      value={conversionForm.celular}
                      onChange={(e) => setConversionForm({ ...conversionForm, celular: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Correo Electrónico</label>
                    <input 
                      type="email" 
                      placeholder="contacto@empresa.com"
                      value={conversionForm.correo}
                      onChange={(e) => setConversionForm({ ...conversionForm, correo: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Dirección Fiscal *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Av. Las Magnolias 123, Lima"
                      value={conversionForm.direccion}
                      onChange={(e) => setConversionForm({ ...conversionForm, direccion: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={() => setShowConversionModal(false)}>Cancelar</button>
                <button type="submit" className="primary">Convertir y Aprobar</button>
              </div>
            </form>
          </div>
        </div>
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
        .actions-cell button.info { color: #3b82f6; }

        .history-row { background: #f8fafc; }
        .history-container { padding: 1rem 2rem; }
        .history-container h4 { font-size: 0.875rem; margin-bottom: 1rem; color: var(--text-light); }
        .history-timeline { display: flex; flex-direction: column; gap: 0.75rem; }
        .history-item { display: flex; align-items: center; gap: 1rem; position: relative; }
        .history-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--secondary); }
        .history-info { display: flex; gap: 1rem; align-items: center; font-size: 0.8rem; }
        .status-text { font-weight: 700; text-transform: uppercase; width: 80px; }
        .history-user { color: var(--text-dark); font-weight: 600; }
        .history-date { color: var(--text-light); }

        .stepper-row {
          background: white;
        }
        .stepper-row td {
          padding-top: 0;
          padding-bottom: 1.5rem;
          border-top: none;
        }
        .status-stepper {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          padding-left: 1rem;
        }
        .step-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          color: var(--text-light);
          opacity: 0.4;
          transition: all 0.3s;
          min-width: 120px;
        }
        .step-item.active {
          opacity: 1;
          color: var(--primary);
        }
        .step-item.current {
          font-weight: 700;
        }
        .step-item.danger {
          color: var(--danger);
        }
        .step-circle {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: currentColor;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          margin-top: 2px;
          flex-shrink: 0;
        }
        .step-content {
          display: flex;
          flex-direction: column;
        }
        .step-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .step-details {
          font-size: 0.65rem;
          color: var(--text-light);
          margin-top: 0.25rem;
          line-height: 1.2;
          font-weight: 400;
        }
        .step-user {
          color: var(--text-dark);
          font-weight: 600;
        }
        .step-line {
          height: 2px;
          width: 40px;
          background: #e2e8f0;
          margin-top: 12px;
        }
        .step-line.active {
          background: var(--primary);
        }
        .step-line.danger {
          background: var(--danger);
        }
      `}</style>
    </div>
  );
};

export default Cotizaciones;
