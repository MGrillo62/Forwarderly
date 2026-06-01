import React, { useState, useEffect } from 'react';
import { BookOpen, Search, ShieldAlert, Clock, CheckCircle2, MessageSquare, AlertTriangle, Eye, X, Send } from 'lucide-react';
import api from '../api/axios';

// Helper to calculate remaining Peruvian business days (15 business days limit)
export const getRemainingBusinessDays = (createdAtStr: string | Date): number => {
  const created = new Date(createdAtStr);
  const today = new Date();
  
  if (today < created) return 15;

  let elapsedBusinessDays = 0;
  const curDate = new Date(created.getTime());
  
  while (curDate < today) {
    curDate.setDate(curDate.getDate() + 1);
    if (curDate > today) break;
    const day = curDate.getDay();
    if (day !== 0 && day !== 6) { // Skip Saturday (6) and Sunday (0)
      elapsedBusinessDays++;
    }
  }
  
  return 15 - elapsedBusinessDays;
};

const ReclamacionesAdmin: React.FC = () => {
  const [claims, setClaims] = useState<any[]>([]);
  const [filteredClaims, setFilteredClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  
  // Modal states
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [responseMsg, setResponseMsg] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchClaims();
  }, []);

  useEffect(() => {
    let result = [...claims];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => 
        c.numeroReclamacion.toLowerCase().includes(term) ||
        c.nombres.toLowerCase().includes(term) ||
        c.apellidos.toLowerCase().includes(term) ||
        c.nroDocumento.toLowerCase().includes(term)
      );
    }

    if (filterStatus) {
      result = result.filter(c => c.estado === filterStatus);
    }

    if (filterType) {
      result = result.filter(c => c.tipoReclamacion === filterType);
    }

    setFilteredClaims(result);
  }, [searchTerm, filterStatus, filterType, claims]);

  const fetchClaims = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reclamaciones');
      setClaims(res.data);
    } catch (err) {
      console.error('Error fetching claims:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenClaim = (claim: any) => {
    setSelectedClaim(claim);
    setResponseMsg(claim.respuesta || '');
    setError('');
    setSuccess('');
  };

  const handleSendResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!responseMsg.trim()) {
      setError('Por favor redacte una respuesta válida.');
      return;
    }

    setSubmitLoading(true);
    setError('');

    try {
      const res = await api.put(`/reclamaciones/${selectedClaim.id}`, {
        respuesta: responseMsg.trim(),
        estado: 'ATENDIDO'
      });
      
      setSuccess('Respuesta guardada con éxito. El estado se ha actualizado a ATENDIDO.');
      setSelectedClaim(res.data);
      // Refresh claims list
      fetchClaims();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al guardar la respuesta.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const getDeadlineBadge = (claim: any) => {
    if (claim.estado === 'ATENDIDO') {
      return (
        <span className="deadline-badge resolved flex-align" style={{ gap: '0.25rem' }}>
          <CheckCircle2 size={12} /> Resuelto
        </span>
      );
    }

    const remaining = getRemainingBusinessDays(claim.createdAt);
    
    if (remaining < 0) {
      return (
        <span className="deadline-badge overdue flex-align" style={{ gap: '0.25rem' }}>
          <ShieldAlert size={12} /> Vencido ({Math.abs(remaining)} d. hábiles de retraso)
        </span>
      );
    } else if (remaining <= 3) {
      return (
        <span className="deadline-badge critical flex-align animate-pulse" style={{ gap: '0.25rem' }}>
          <AlertTriangle size={12} /> Crítico ({remaining} d. hábiles restantes)
        </span>
      );
    } else if (remaining <= 7) {
      return (
        <span className="deadline-badge warning flex-align" style={{ gap: '0.25rem' }}>
          <Clock size={12} /> Por vencer ({remaining} d. hábiles restantes)
        </span>
      );
    } else {
      return (
        <span className="deadline-badge safe flex-align" style={{ gap: '0.25rem' }}>
          <Clock size={12} /> Al día ({remaining} d. hábiles restantes)
        </span>
      );
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>📕 Control y Administración del Libro de Reclamaciones</h1>
        <p className="subtitle">Gestione y responda de forma oficial a las quejas y reclamos registrados por los clientes.</p>
      </div>

      {/* Tarjeta de Resumen Rápido */}
      <div className="dashboard-summary-reclamaciones grid-3" style={{ marginBottom: '1.5rem', gap: '1rem' }}>
        <div className="card-summary info animate-slide-in">
          <div className="summary-title">Reclamaciones Totales</div>
          <div className="summary-value">{claims.length}</div>
        </div>
        <div className="card-summary pending animate-slide-in" style={{ animationDelay: '0.1s' }}>
          <div className="summary-title">Pendientes de Respuesta</div>
          <div className="summary-value">{claims.filter(c => c.estado === 'PENDIENTE').length}</div>
        </div>
        <div className="card-summary warning animate-slide-in" style={{ animationDelay: '0.2s' }}>
          <div className="summary-title">Casos Críticos (≤ 3 Días)</div>
          <div className="summary-value">
            {claims.filter(c => c.estado !== 'ATENDIDO' && getRemainingBusinessDays(c.createdAt) <= 3).length}
          </div>
        </div>
      </div>

      {/* Filtros e Historial */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div className="filters-row flex-align" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div className="search-box-wrapper" style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Buscar por código, reclamante, documento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">-- Todos los estados --</option>
              <option value="PENDIENTE">PENDIENTE</option>
              <option value="ATENDIDO">ATENDIDO</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">-- Todos los tipos --</option>
              <option value="RECLAMO">RECLAMO</option>
              <option value="QUEJA">QUEJA</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Resultados */}
      <div className="card animate-fade-in">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Fecha de Registro</th>
                <th>Consumidor</th>
                <th>Tipo</th>
                <th>Monto Reclamado</th>
                <th>Plazo de Respuesta (INDECOPI)</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                    Cargando hojas de reclamación...
                  </td>
                </tr>
              ) : filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                    No se encontraron quejas o reclamos en el sistema.
                  </td>
                </tr>
              ) : (
                filteredClaims.map(c => (
                  <tr key={c.id}>
                    <td>
                      <strong style={{ color: 'var(--primary)' }}>{c.numeroReclamacion}</strong>
                    </td>
                    <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div><strong>{c.nombres} {c.apellidos}</strong></div>
                      <small className="text-light" style={{ fontSize: '0.75rem' }}>{c.tipoDocumento}: {c.nroDocumento}</small>
                    </td>
                    <td>
                      <span className={`status-badge ${c.tipoReclamacion === 'RECLAMO' ? 'status-rejected' : 'status-pending'}`} style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>
                        {c.tipoReclamacion}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-dark)' }}>S/ {c.montoReclamado.toFixed(2)} PEN</strong>
                    </td>
                    <td>
                      {getDeadlineBadge(c)}
                    </td>
                    <td>
                      <button 
                        className="btn-outline font-bold flex-align" 
                        style={{ gap: '0.25rem', padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                        onClick={() => handleOpenClaim(c)}
                      >
                        <Eye size={14} /> Atender
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalle y Respuesta Administrativa */}
      {selectedClaim && (
        <div className="modal-overlay">
          <div className="modal-content animate-slide-in" style={{ maxWidth: '700px', width: '95%' }}>
            <div className="modal-header" style={{ paddingBottom: '0.75rem', borderBottom: '1px solid rgba(226,232,240,0.8)' }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BookOpen size={20} className="icon-blue" /> Detalle de Reclamación
                </h3>
                <small style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{selectedClaim.numeroReclamacion}</small>
              </div>
              <button className="icon-btn" onClick={() => setSelectedClaim(null)}><X size={18} /></button>
            </div>
            
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
              
              {/* Alerta de plazo */}
              <div style={{ marginBottom: '1.25rem' }}>
                {getDeadlineBadge(selectedClaim)}
              </div>

              {/* Grid de Datos del Reclamante */}
              <div className="info-section-modal">
                <h4>1. Datos del Consumidor</h4>
                <div className="grid-modal">
                  <div><strong>Nombres:</strong> {selectedClaim.nombres} {selectedClaim.apellidos}</div>
                  <div><strong>Documento:</strong> {selectedClaim.tipoDocumento}: {selectedClaim.nroDocumento}</div>
                  <div><strong>Domicilio:</strong> {selectedClaim.domicilio}</div>
                  <div><strong>Teléfono:</strong> {selectedClaim.telefono}</div>
                  <div className="full"><strong>Correo:</strong> {selectedClaim.correo}</div>
                  {selectedClaim.representante && <div className="full"><strong>Representante:</strong> {selectedClaim.representante}</div>}
                </div>
              </div>

              {/* Datos del bien */}
              <div className="info-section-modal">
                <h4>2. Datos del Bien Contratado</h4>
                <div className="grid-modal">
                  <div><strong>Tipo:</strong> {selectedClaim.tipoBien === 'PRODUCTO' ? 'Producto' : 'Servicio'}</div>
                  <div><strong>Monto:</strong> S/ {selectedClaim.montoReclamado.toFixed(2)} PEN</div>
                  <div className="full"><strong>Descripción:</strong> {selectedClaim.descripcionBien}</div>
                </div>
              </div>

              {/* Detalle */}
              <div className="info-section-modal">
                <h4>3. Detalle de Reclamación</h4>
                <div className="claim-box-modal">
                  <div className="badge-type uppercase font-bold" style={{ color: selectedClaim.tipoReclamacion === 'RECLAMO' ? '#EF4444' : '#F59E0B', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                    {selectedClaim.tipoReclamacion}
                  </div>
                  <div className="title-bold">Sustento del Consumidor:</div>
                  <p className="detail-text">{selectedClaim.detalle}</p>
                  
                  <div className="title-bold" style={{ marginTop: '0.75rem' }}>Pedido Solicitado:</div>
                  <p className="detail-text highlighted">{selectedClaim.pedido}</p>
                </div>
              </div>

              {/* Historial o Formulario de Respuesta */}
              <div className="info-section-modal" style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(226,232,240,0.8)', paddingTop: '1.25rem' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><MessageSquare size={16} /> Respuesta Formal del Proveedor</h4>
                
                {success && <div className="alert-success" style={{ padding: '0.75rem', fontSize: '0.85rem', marginBottom: '1rem' }}>{success}</div>}
                {error && <div className="error-message" style={{ padding: '0.75rem', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}

                {selectedClaim.estado === 'ATENDIDO' ? (
                  <div className="response-box-saved">
                    <div className="date-saved">Respuesta emitida el {new Date(selectedClaim.fechaRespuesta).toLocaleString()}</div>
                    <p className="response-text">{selectedClaim.respuesta}</p>
                  </div>
                ) : (
                  <form onSubmit={handleSendResponse}>
                    <div className="form-group">
                      <label>Redactar Respuesta Oficial para el Cliente *</label>
                      <textarea 
                        rows={4}
                        required
                        placeholder="Redacte la respuesta que da solución formal a la queja o reclamo..."
                        value={responseMsg}
                        onChange={(e) => setResponseMsg(e.target.value)}
                      />
                      <small style={{ color: 'var(--text-light)', display: 'block', marginTop: '0.35rem' }}>
                        Nota: Al hacer clic en "Guardar y Enviar", la respuesta quedará guardada de forma definitiva en la base de datos y se actualizará el estado de la hoja de reclamaciones.
                      </small>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                      <button 
                        type="submit" 
                        className="primary font-bold flex-align" 
                        style={{ gap: '0.5rem', padding: '0.6rem 1.5rem' }}
                        disabled={submitLoading}
                      >
                        <Send size={14} />
                        {submitLoading ? 'Enviando...' : 'Guardar y Enviar Respuesta'}
                      </button>
                    </div>
                  </form>
                )}
              </div>

            </div>
            
            <div className="modal-footer" style={{ borderTop: '1px solid rgba(226,232,240,0.8)', paddingTop: '0.75rem' }}>
              <button className="btn-outline" onClick={() => setSelectedClaim(null)}>Cerrar Ventana</button>
            </div>
          </div>
        </div>
      )}

      {/* Styled inline components */}
      <style>{`
        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }
        
        .grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
        }
        
        .card-summary {
          background: white;
          border: 1px solid rgba(226, 232, 240, 0.8);
          border-radius: 0.75rem;
          padding: 1.25rem 1.5rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        
        .card-summary.info {
          border-left: 4px solid var(--primary);
        }
        
        .card-summary.pending {
          border-left: 4px solid #f59e0b;
        }
        
        .card-summary.warning {
          border-left: 4px solid #ef4444;
        }
        
        .summary-title {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--text-light);
          letter-spacing: 0.5px;
        }
        
        .summary-value {
          font-size: 1.75rem;
          font-weight: 900;
          color: var(--text-dark);
          margin-top: 0.25rem;
        }
        
        .deadline-badge {
          display: inline-flex;
          padding: 0.35rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.725rem;
          font-weight: 700;
        }
        
        .deadline-badge.resolved {
          background: rgba(16, 185, 129, 0.08);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        
        .deadline-badge.overdue {
          background: rgba(239, 68, 68, 0.08);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        
        .deadline-badge.critical {
          background: rgba(239, 68, 68, 0.08);
          color: #d97706;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        
        .deadline-badge.warning {
          background: rgba(245, 158, 11, 0.08);
          color: #b45309;
          border: 1px solid rgba(245, 158, 11, 0.2);
        }
        
        .deadline-badge.safe {
          background: rgba(56, 189, 248, 0.08);
          color: #0284c7;
          border: 1px solid rgba(56, 189, 248, 0.2);
        }
        
        .info-section-modal {
          margin-bottom: 1.25rem;
        }
        
        .info-section-modal h4 {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-light);
          margin: 0 0 0.5rem 0;
          font-weight: 700;
        }
        
        .grid-modal {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem 1rem;
          background: #f8fafc;
          padding: 1rem;
          border-radius: 0.5rem;
          font-size: 0.825rem;
          color: var(--text-dark);
          border: 1px solid rgba(226, 232, 240, 0.8);
        }
        
        .grid-modal .full {
          grid-column: span 2;
        }
        
        .claim-box-modal {
          background: #f8fafc;
          border: 1px solid rgba(226, 232, 240, 0.8);
          padding: 1rem;
          border-radius: 0.5rem;
          font-size: 0.825rem;
        }
        
        .claim-box-modal .title-bold {
          font-weight: 700;
          color: var(--text-dark);
          margin-bottom: 0.25rem;
        }
        
        .claim-box-modal .detail-text {
          margin: 0 0 0.75rem 0;
          color: #334155;
          line-height: 1.5;
          white-space: pre-wrap;
        }
        
        .claim-box-modal .detail-text.highlighted {
          background: rgba(79, 70, 229, 0.03);
          border-left: 3px solid var(--primary);
          padding: 0.5rem 0.75rem;
          border-radius: 0 4px 4px 0;
          margin-bottom: 0;
        }
        
        .response-box-saved {
          background: rgba(16, 185, 129, 0.03);
          border: 1px solid rgba(16, 185, 129, 0.15);
          border-left: 4px solid #10b981;
          padding: 1rem;
          border-radius: 0.5rem;
          font-size: 0.85rem;
        }
        
        .date-saved {
          font-size: 0.725rem;
          color: #059669;
          font-weight: 700;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
        }
        
        .response-text {
          margin: 0;
          color: #065f46;
          line-height: 1.5;
          white-space: pre-wrap;
          font-weight: 500;
        }

        .alert-success {
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #bbf7d0;
          border-radius: 0.375rem;
          text-align: center;
          font-weight: 600;
        }
        
        @media (max-width: 600px) {
          .grid-3 {
            grid-template-columns: 1fr;
          }
          .grid-modal {
            grid-template-columns: 1fr;
          }
          .grid-modal .full {
            grid-column: span 1;
          }
        }
      `}</style>
    </div>
  );
};

export default ReclamacionesAdmin;
