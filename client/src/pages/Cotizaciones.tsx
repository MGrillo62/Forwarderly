import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Plus, Eye, Edit, CheckCircle, XCircle, Send, FileText, X, Copy, Search, ArrowUpDown, Trash2 } from 'lucide-react';
import { generateQuotationPDF } from '../utils/pdfGenerator';
import { getBase64ImageFromUrl } from '../utils/logoHelper';
import CotizacionForm from '../components/CotizacionForm';

const Cotizaciones: React.FC = () => {
  const { token, activeEmpresa, user } = useAuth();
  const [cotizaciones, setCotizaciones] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedCot, setSelectedCot] = useState<any>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Search & Sorting States
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('numero');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // States for lead-to-client conversion
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [conversionLead, setConversionLead] = useState<any>(null);
  const [conversionCotId, setConversionCotId] = useState<string | null>(null);
  const [conversionForm, setConversionForm] = useState({
    ruc: '', razonSocial: '', direccion: '', contacto: '', correo: '', celular: ''
  });
  const [conversionCrearOrden, setConversionCrearOrden] = useState(true);

  // States for Duplicar Cotización modal
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateSourceCot, setDuplicateSourceCot] = useState<any>(null);
  const [duplicateTargetType, setDuplicateTargetType] = useState<'same' | 'cliente' | 'lead'>('same');
  const [duplicateTargetId, setDuplicateTargetId] = useState('');

  useEffect(() => {
    fetchCotizaciones();
    fetchClientesYLeads();
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

  const fetchClientesYLeads = async () => {
    try {
      const cRes = await api.get('/clientes');
      const lRes = await api.get('/leads');
      setClientes(cRes.data);
      setLeads(lRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadPDF = async (cot: any) => {
    try {
      const logoBase64 = activeEmpresa?.logoUrl ? await getBase64ImageFromUrl(activeEmpresa.logoUrl) : null;
      generateQuotationPDF(cot, logoBase64, user);
    } catch (err) {
      console.error('Error generating PDF:', err);
      generateQuotationPDF(cot, null, user);
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

    let crearOrdenImmediately = false;
    if (estado === 'APROBADA') {
      crearOrdenImmediately = window.confirm('¿Desea crear inmediatamente la Orden de Importación para esta cotización aprobada?');
    }

    try {
      await api.put(`/cotizaciones/${id}`, { estado, crearOrdenImmediately });
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
        clientConversion: conversionForm,
        crearOrdenImmediately: conversionCrearOrden
      });
      setShowConversionModal(false);
      setConversionLead(null);
      setConversionCotId(null);
      fetchCotizaciones();
      alert('Cotización aprobada y convertida a Cliente Oficial con éxito.');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al realizar conversión de Lead a Cliente');
    }
  };

  const handleDuplicateClick = (cot: any) => {
    setDuplicateSourceCot(cot);
    setDuplicateTargetType('same');
    setDuplicateTargetId('');
    setShowDuplicateModal(true);
  };

  const handleDuplicateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!duplicateSourceCot) return;

    let payload: any = {};
    if (duplicateTargetType === 'cliente') {
      if (!duplicateTargetId) return alert('Por favor seleccione el cliente destino');
      payload = { clienteId: duplicateTargetId, leadId: null };
    } else if (duplicateTargetType === 'lead') {
      if (!duplicateTargetId) return alert('Por favor seleccione el prospecto destino');
      payload = { leadId: duplicateTargetId, clienteId: null };
    }

    try {
      await api.post(`/cotizaciones/${duplicateSourceCot.id}/duplicar`, payload);
      setShowDuplicateModal(false);
      setDuplicateSourceCot(null);
      fetchCotizaciones();
      alert('Cotización duplicada con éxito como Borrador.');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al duplicar cotización');
    }
  };

  const handleDeleteCotizacion = async (id: string) => {
    if (!window.confirm('¿Está seguro de que desea eliminar permanentemente esta cotización? Esta acción no se puede deshacer y desvinculará las órdenes asociadas.')) return;

    try {
      await api.delete(`/cotizaciones/${id}`);
      fetchCotizaciones();
      alert('Cotización eliminada con éxito.');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al eliminar la cotización');
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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter and Sort Cotizaciones
  const filteredAndSorted = cotizaciones
    .filter(cot => {
      const search = searchTerm.toLowerCase();
      const nroStr = String(cot.numero).padStart(5, '0');
      const clienteName = cot.cliente?.razonSocial || cot.lead?.nombre || cot.lead?.contacto || '';
      const vendedorName = cot.vendedor?.nombres || '';
      return (
        nroStr.includes(search) ||
        clienteName.toLowerCase().includes(search) ||
        vendedorName.toLowerCase().includes(search) ||
        cot.estado.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'cliente') {
        aVal = a.cliente?.razonSocial || a.lead?.nombre || '';
        bVal = b.cliente?.razonSocial || b.lead?.nombre || '';
      } else if (sortField === 'vendedor') {
        aVal = a.vendedor?.nombres || '';
        bVal = b.vendedor?.nombres || '';
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

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
        <div>
          <h1>Cotizaciones</h1>
          <p className="subtitle">Gestione propuestas comerciales, duplicados inteligentes y órdenes asociadas</p>
        </div>
        <button className="primary icon-left" onClick={handleNew}>
          <Plus size={18} /> Nueva Cotización
        </button>
      </div>

      {/* Filters card */}
      <div className="card mb-4" style={{ padding: '1rem' }}>
        <div className="search-box" style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Buscar por N° Cotización, Cliente/Prospecto, Vendedor o Estado..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '38px', width: '100%' }}
          />
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th className="sortable-header" onClick={() => handleSort('numero')}>
                  <div className="flex-center gap-1">Nro <ArrowUpDown size={14} /></div>
                </th>
                <th className="sortable-header" onClick={() => handleSort('cliente')}>
                  <div className="flex-center gap-1">Cliente / Prospecto <ArrowUpDown size={14} /></div>
                </th>
                <th className="sortable-header" onClick={() => handleSort('createdAt')}>
                  <div className="flex-center gap-1">Fecha <ArrowUpDown size={14} /></div>
                </th>
                <th className="sortable-header" onClick={() => handleSort('vendedor')}>
                  <div className="flex-center gap-1">Vendedor <ArrowUpDown size={14} /></div>
                </th>
                <th className="sortable-header" onClick={() => handleSort('precioTotal')}>
                  <div className="flex-center gap-1">Total <ArrowUpDown size={14} /></div>
                </th>
                <th className="sortable-header" onClick={() => handleSort('estado')}>
                  <div className="flex-center gap-1">Estado <ArrowUpDown size={14} /></div>
                </th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((cot) => (
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
                    <td>
                      <span className="font-semibold text-slate-800">
                        {cot.moneda === 'PEN' ? 'S/' : cot.moneda === 'EUR' ? '€' : '$'} {cot.precioTotal.toFixed(2)}
                      </span>
                    </td>
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
                        
                        {/* Duplicate Button */}
                        <button title="Duplicar / Copiar Cotización" className="info" onClick={() => handleDuplicateClick(cot)}>
                          <Copy size={16} />
                        </button>

                        <button title="Descargar PDF" className="info" onClick={() => handleDownloadPDF(cot)}>
                          <FileText size={16} />
                        </button>

                        {user?.rol === 'SUPER_ADMIN' && (
                          <button title="Eliminar Cotización" className="danger" onClick={() => handleDeleteCotizacion(cot.id)}>
                            <Trash2 size={16} />
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
              {filteredAndSorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-4">No se encontraron cotizaciones.</td>
                </tr>
              )}
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

      {/* Conversion modal */}
      {showConversionModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px', width: '90%' }}>
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
                      value={conversionForm.ruc}
                      onChange={(e) => setConversionForm({ ...conversionForm, ruc: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Razón Social *</label>
                    <input 
                      type="text" 
                      required 
                      value={conversionForm.razonSocial}
                      onChange={(e) => setConversionForm({ ...conversionForm, razonSocial: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Nombre de Contacto *</label>
                    <input 
                      type="text" 
                      required 
                      value={conversionForm.contacto}
                      onChange={(e) => setConversionForm({ ...conversionForm, contacto: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Celular</label>
                    <input 
                      type="text" 
                      value={conversionForm.celular}
                      onChange={(e) => setConversionForm({ ...conversionForm, celular: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Correo Electrónico</label>
                    <input 
                      type="email" 
                      value={conversionForm.correo}
                      onChange={(e) => setConversionForm({ ...conversionForm, correo: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Dirección Fiscal *</label>
                    <input 
                      type="text" 
                      required 
                      value={conversionForm.direccion}
                      onChange={(e) => setConversionForm({ ...conversionForm, direccion: e.target.value })}
                    />
                  </div>
                </div>

                {/* Conditional Order prompt in conversion modal */}
                <div className="form-group mt-4" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    id="conversionCrearOrden"
                    checked={conversionCrearOrden}
                    onChange={(e) => setConversionCrearOrden(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="conversionCrearOrden" style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                    Crear inmediatamente la Orden de Importación asociada
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={() => setShowConversionModal(false)}>Cancelar</button>
                <button type="submit" className="primary">Convertir, Aprobar y Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate Cotización Modal */}
      {showDuplicateModal && duplicateSourceCot && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="font-bold text-lg text-slate-800">
                📋 Duplicar Cotización N° {String(duplicateSourceCot.numero).padStart(5, '0')}
              </h3>
              <button className="icon-btn" onClick={() => setShowDuplicateModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleDuplicateSubmit}>
              <div className="modal-body">
                <p className="text-sm text-slate-500 mb-4">
                  Se creará una copia idéntica de esta cotización en estado <strong>BORRADOR</strong>. Elija a quién irá dirigida:
                </p>

                <div className="form-group mb-4">
                  <label className="block mb-2 font-semibold">Cliente/Prospecto Destino</label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="duplicateTarget"
                        checked={duplicateTargetType === 'same'}
                        onChange={() => { setDuplicateTargetType('same'); setDuplicateTargetId(''); }}
                        style={{ cursor: 'pointer' }}
                      />
                      Mismo Cliente / Prospecto original
                    </label>

                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="duplicateTarget"
                        checked={duplicateTargetType === 'cliente'}
                        onChange={() => { setDuplicateTargetType('cliente'); setDuplicateTargetId(''); }}
                        style={{ cursor: 'pointer' }}
                      />
                      Asociar a OTRO Cliente
                    </label>

                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="duplicateTarget"
                        checked={duplicateTargetType === 'lead'}
                        onChange={() => { setDuplicateTargetType('lead'); setDuplicateTargetId(''); }}
                        style={{ cursor: 'pointer' }}
                      />
                      Asociar a OTRO Prospecto
                    </label>
                  </div>
                </div>

                {duplicateTargetType === 'cliente' && (
                  <div className="form-group mb-4">
                    <label>Seleccione el Cliente Destino</label>
                    <select
                      required
                      value={duplicateTargetId}
                      onChange={(e) => setDuplicateTargetId(e.target.value)}
                    >
                      <option value="">-- Seleccionar Cliente --</option>
                      {clientes.map(c => (
                        <option key={c.id} value={c.id}>{c.razonSocial} (RUC: {c.ruc})</option>
                      ))}
                    </select>
                  </div>
                )}

                {duplicateTargetType === 'lead' && (
                  <div className="form-group mb-4">
                    <label>Seleccione el Prospecto Destino</label>
                    <select
                      required
                      value={duplicateTargetId}
                      onChange={(e) => setDuplicateTargetId(e.target.value)}
                    >
                      <option value="">-- Seleccionar Prospecto --</option>
                      {leads.map(l => (
                        <option key={l.id} value={l.id}>{l.nombre || l.razonSocial || l.contacto}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={() => setShowDuplicateModal(false)}>Cancelar</button>
                <button type="submit" className="primary">Duplicar Cotización</button>
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
