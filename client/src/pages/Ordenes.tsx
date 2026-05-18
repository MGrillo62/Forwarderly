import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  Filter, 
  DollarSign, 
  Clock, 
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  FileText,
  X,
  Layers,
  Activity
} from 'lucide-react';

const Ordenes: React.FC = () => {
  const { token } = useAuth();
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrden, setSelectedOrden] = useState<any>(null);
  
  // Advanced Cobros Modal States
  const [showCobrosModal, setShowCobrosModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'registrar' | 'historial'>('registrar');
  const [checkedLineas, setCheckedLineas] = useState<string[]>([]);
  const [cobrosList, setCobrosList] = useState<any[]>([]);
  const [tipoCambioInput, setTipoCambioInput] = useState('3.75');
  const [incluirTributos, setIncluirTributos] = useState(true);
  const [referenciaInput, setReferenciaInput] = useState('');
  
  // Document data mapped per individual concept line
  const [lineasDocs, setLineasDocs] = useState<{
    [lineaId: string]: {
      tipoDocumento: string;
      nroDocumento: string;
      fechaDocumento: string;
    }
  }>({});
  
  const [cobroForm, setCobroForm] = useState({
    moneda: 'USD',
    monto: '',
    metodo: 'TRANSFERENCIA'
  });

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

  const handleOpenCobros = async (orden: any) => {
    setSelectedOrden(orden);
    const allIds = orden.cotizacion?.lineas?.map((l: any) => l.id) || [];
    setCheckedLineas(allIds);
    setReferenciaInput('');
    setIncluirTributos(true);
    
    // Initialize concept document details mapping
    const initialDocs: any = {};
    orden.cotizacion?.lineas?.forEach((l: any) => {
      initialDocs[l.id] = {
        tipoDocumento: 'FACTURA',
        nroDocumento: '',
        fechaDocumento: new Date().toISOString().split('T')[0]
      };
    });
    setLineasDocs(initialDocs);

    // Default form currency to order/quote currency
    const orderMoneda = orden.cotizacion?.moneda || 'USD';
    setCobroForm({
      moneda: orderMoneda === 'PEN' ? 'PEN' : orderMoneda,
      monto: '',
      metodo: 'TRANSFERENCIA'
    });
    
    try {
      const res = await api.get(`/ordenes/${orden.id}/cobros`);
      setCobrosList(res.data);
    } catch (err) {
      console.error(err);
      setCobrosList([]);
    }
    
    setActiveTab('registrar');
    setShowCobrosModal(true);
  };

  const handleLineaDocChange = (lineaId: string, field: string, value: string) => {
    setLineasDocs(prev => ({
      ...prev,
      [lineaId]: {
        ...(prev[lineaId] || { tipoDocumento: 'FACTURA', nroDocumento: '', fechaDocumento: new Date().toISOString().split('T')[0] }),
        [field]: value
      }
    }));
  };

  const handleRegisterCobro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cobroForm.monto || parseFloat(cobroForm.monto) <= 0) {
      return alert('Por favor ingrese un monto de cobro válido.');
    }

    try {
      // Build concept-specific document mappings for checked lines
      const detailsMap: any = {};
      checkedLineas.forEach(id => {
        if (lineasDocs[id]) {
          detailsMap[id] = lineasDocs[id];
        }
      });

      const payload = {
        moneda: cobroForm.moneda,
        monto: cobroForm.monto,
        metodo: cobroForm.metodo,
        lineasIds: checkedLineas,
        referencia: referenciaInput || null,
        detallesLineas: detailsMap,
        tipoCambio: tipoCambioInput
      };
      
      await api.post(`/ordenes/${selectedOrden.id}/cobros`, payload);
      
      // Refresh list
      const res = await api.get(`/ordenes/${selectedOrden.id}/cobros`);
      setCobrosList(res.data);
      
      setCobroForm(prev => ({ ...prev, monto: '' }));
      setReferenciaInput('');
      fetchOrdenes();
      alert('Cobro registrado exitosamente.');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al registrar cobro');
    }
  };

  const handleDeleteCobro = async (cobroId: string) => {
    if (!window.confirm('¿Seguro que desea eliminar este cobro registrado?')) return;
    try {
      await api.delete(`/ordenes/cobros/${cobroId}`);
      const res = await api.get(`/ordenes/${selectedOrden.id}/cobros`);
      setCobrosList(res.data);
      fetchOrdenes();
      alert('Cobro eliminado exitosamente.');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al eliminar cobro');
    }
  };

  const toggleLineaCheck = (id: string) => {
    if (checkedLineas.includes(id)) {
      setCheckedLineas(checkedLineas.filter(x => x !== id));
    } else {
      setCheckedLineas([...checkedLineas, id]);
    }
  };

  const getCanalBadge = (canal: string) => {
    switch (canal) {
      case 'VERDE': return 'badge-green';
      case 'AMARILLO': return 'badge-orange';
      case 'ROJO': return 'badge-red';
      case 'SIN_CANAL': return 'badge-gray';
      default: return 'badge-gray';
    }
  };

  // Calculations for Advanced Cobros Modal
  const orderMoneda = selectedOrden?.cotizacion?.moneda || 'USD';
  const checkedLinesObjects = selectedOrden?.cotizacion?.lineas?.filter((l: any) => checkedLineas.includes(l.id)) || [];
  
  // Total base concept values
  const totalBaseA_Cobrar = checkedLinesObjects.reduce((acc: number, l: any) => acc + l.precioVenta, 0);

  // Customs taxes (Tributos Aduaneros) in PEN
  const costeo = selectedOrden?.costeo;
  const adValoremGlobal = costeo?.adValoremGlobal || 0;
  const costeoIgv = costeo?.igv || 0;
  const costeoIpm = costeo?.ipm || 0;
  const costeoPercepcion = costeo?.percepcionMonto || 0;
  const tcCosteo = costeo?.tipoCambio || 1;

  const adValoremPEN = adValoremGlobal * tcCosteo;
  const igvPEN = costeoIgv * tcCosteo;
  const ipmPEN = costeoIpm * tcCosteo;
  const percepcionPEN = costeoPercepcion * tcCosteo;
  const totalTributosPEN = adValoremPEN + igvPEN + ipmPEN + percepcionPEN;

  // Soles Taxes to collect based on single check
  const totalTaxA_Cobrar = (costeo && incluirTributos) ? totalTributosPEN : 0;

  // Collections received split
  const legacySolesReceived = selectedOrden?.pagos?.reduce((acc: number, p: any) => acc + p.monto, 0) || 0;
  
  const cobrosUSD_Received = cobrosList.filter(c => c.moneda === 'USD').reduce((acc, c) => acc + c.monto, 0);
  const cobrosEUR_Received = cobrosList.filter(c => c.moneda === 'EUR').reduce((acc, c) => acc + c.monto, 0);
  const cobrosPEN_Received = cobrosList.filter(c => c.moneda === 'PEN').reduce((acc, c) => acc + c.monto, 0) + legacySolesReceived;

  // Pending calculations split
  const pendingForeign = orderMoneda !== 'PEN' 
    ? totalBaseA_Cobrar - (orderMoneda === 'USD' ? cobrosUSD_Received : cobrosEUR_Received)
    : 0;

  const pendingSoles = orderMoneda !== 'PEN'
    ? totalTaxA_Cobrar - cobrosPEN_Received
    : (totalBaseA_Cobrar + totalTaxA_Cobrar) - cobrosPEN_Received;

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

      <div className="card animate-fade-in">
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
                <th>Avance Cobros</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((o) => {
                const totalPagadoSoles = 
                  (o.pagos?.reduce((acc: number, p: any) => acc + p.monto, 0) || 0) +
                  (o.cobros?.reduce((acc: number, c: any) => {
                    if (c.moneda === 'PEN') return acc + c.monto;
                    return acc + (c.monto * (c.tipoCambio || 1));
                  }, 0) || 0);
                
                // Get correct exchange rate to convert base commercial values to Soles
                const tcRef = o.costeo?.tipoCambio || o.cobros?.[0]?.tipoCambio || 3.75;
                const baseQuoteSoles = o.cotizacion?.moneda === 'PEN' 
                  ? (o.cotizacion?.precioTotal || 0)
                  : (o.cotizacion?.precioTotal || 0) * tcRef;

                const totalTributosPEN = o.costeo 
                  ? ((o.costeo.adValoremGlobal || 0) + (o.costeo.igv || 0) + (o.costeo.ipm || 0) + (o.costeo.percepcionMonto || 0)) * (o.costeo.tipoCambio || 1)
                  : 0;

                const totalOrdenSoles = baseQuoteSoles + totalTributosPEN;
                const porcentajePago = Math.min((totalPagadoSoles / (totalOrdenSoles || 1)) * 100, 100);

                return (
                  <tr key={o.id}>
                    <td>
                      <div className="order-id">
                        <strong>ORD-{o.correlativo}-{o.anio}</strong>
                        <small>Ref. Cot: {String(o.cotizacion?.numero).padStart(5, '0')}</small>
                      </div>
                    </td>
                    <td>
                      <div className="order-id">
                        <strong className="text-slate-800">{o.cotizacion?.cliente?.razonSocial || o.cotizacion?.lead?.nombre || o.cotizacion?.lead?.contacto}</strong>
                        {o.proveedorExtranjero && <small style={{ display: 'block', color: 'var(--text-light)', fontSize: '0.7rem', marginTop: '2px' }}>Prov: {o.proveedorExtranjero}</small>}
                        {o.nroFacturaComercial && <small style={{ display: 'block', color: 'var(--text-light)', fontSize: '0.7rem' }}>Fact: {o.nroFacturaComercial}</small>}
                      </div>
                    </td>
                    <td>
                      <div className="tracking-info">
                        <div>BL: {o.nroBL || '-'}</div>
                        <div>DAM: {o.nroDAM || '-'}</div>
                        {(o.tipoCarga || o.nroContenedor) && (
                          <div style={{ color: 'var(--primary)', fontWeight: '600', fontSize: '0.7rem', marginTop: '2px' }}>
                            {o.tipoCarga ? `[${o.tipoCarga}] ` : ''}{o.nroContenedor || ''}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      {o.canal && <span className={`canal-dot ${getCanalBadge(o.canal)}`}></span>}
                      {o.canal === 'AMARILLO' ? 'NARANJA' : (o.canal || '-')}
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
                        <small className="font-bold text-slate-700">{porcentajePago.toFixed(0)}% cobrado</small>
                      </div>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button title="Actualizar Tracking" onClick={() => setSelectedOrden(o)}>
                          <Clock size={16} />
                        </button>
                        <button title="Gestión de Cobros" className="success btn-glow" onClick={() => handleOpenCobros(o)}>
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

      {/* Legacy/Tracking Modal */}
      {selectedOrden && !showCobrosModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-slide-in">
            <div className="modal-header">
              <h3>Actualizar Tracking ORD-{selectedOrden.correlativo}</h3>
              <button className="icon-btn" onClick={() => setSelectedOrden(null)}><X size={18} /></button>
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
                    <option value="AMARILLO">Naranja</option>
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
                <div className="form-group">
                  <label>Proveedor</label>
                  <input 
                    type="text" 
                    placeholder="Proveedor Extranjero"
                    value={selectedOrden.proveedorExtranjero || ''} 
                    onChange={(e) => setSelectedOrden({...selectedOrden, proveedorExtranjero: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Invoice / Factura</label>
                  <input 
                    type="text" 
                    placeholder="Nro Factura Comercial"
                    value={selectedOrden.nroFacturaComercial || ''} 
                    onChange={(e) => setSelectedOrden({...selectedOrden, nroFacturaComercial: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Tipo de Carga</label>
                  <select 
                    value={selectedOrden.tipoCarga || ''}
                    onChange={(e) => setSelectedOrden({...selectedOrden, tipoCarga: e.target.value})}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="FCL">FCL</option>
                    <option value="LCL">LCL</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Nro. de Contenedor</label>
                  <input 
                    type="text" 
                    placeholder="Contenedor"
                    value={selectedOrden.nroContenedor || ''} 
                    onChange={(e) => setSelectedOrden({...selectedOrden, nroContenedor: e.target.value})}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setSelectedOrden(null)}>Cancelar</button>
              <button className="primary" onClick={() => {
                const { 
                  nroBL, nroDAM, canal, estado, fechaETD, fechaETA,
                  proveedorExtranjero, nroFacturaComercial, tipoCarga, nroContenedor
                } = selectedOrden;
                handleUpdateOrden(selectedOrden.id, { 
                  nroBL, nroDAM, canal, estado, fechaETD, fechaETA,
                  proveedorExtranjero, nroFacturaComercial, tipoCarga, nroContenedor
                });
              }}>Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* Advanced multi-currency Cobros Modal */}
      {showCobrosModal && selectedOrden && (
        <div className="modal-overlay">
          <div className="modal-content large animate-slide-in" style={{ maxWidth: '1000px', width: '95%' }}>
            <div className="modal-header">
              <div>
                <h3 className="text-xl font-black text-slate-800">
                  💳 Gestión Integral de Cobros — ORD-{selectedOrden.correlativo}
                </h3>
                <p className="text-xs text-slate-500">
                  Cliente: <strong>{selectedOrden.cotizacion?.cliente?.razonSocial || selectedOrden.cotizacion?.lead?.nombre}</strong> | Moneda Base: <strong>{orderMoneda}</strong>
                </p>
              </div>
              <button className="icon-btn" onClick={() => { setShowCobrosModal(false); setSelectedOrden(null); }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="modal-tabs">
              <button 
                className={`tab-btn ${activeTab === 'registrar' ? 'active' : ''}`}
                onClick={() => setActiveTab('registrar')}
              >
                <Layers size={16} /> Registrar Cobranza
              </button>
              <button 
                className={`tab-btn ${activeTab === 'historial' ? 'active' : ''}`}
                onClick={() => setActiveTab('historial')}
              >
                <Activity size={16} /> Historial de Cobros ({cobrosList.length})
              </button>
            </div>

            {activeTab === 'registrar' ? (
              <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '1.5rem' }}>
                  
                  {/* Left Column: Grid of Concepts & Tributos */}
                  <div>
                    <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5 text-sm uppercase tracking-wider">
                      📋 Conceptos del Despacho a Cobrar
                    </h4>
                    <p className="text-xs text-slate-400 mb-3">
                      Marque los conceptos comerciales que incluye en esta cobranza y defina sus documentos específicos.
                    </p>
                    <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      <table className="dense-table" style={{ width: '100%' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '40px' }} className="text-center">Cobrar</th>
                            <th>Concepto</th>
                            <th className="text-right">Venta ({orderMoneda})</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedOrden.cotizacion?.lineas?.map((l: any) => (
                            <React.Fragment key={l.id}>
                              <tr className={checkedLineas.includes(l.id) ? 'checked-row' : ''}>
                                <td className="text-center" style={{ verticalAlign: 'middle' }}>
                                  <input 
                                    type="checkbox"
                                    checked={checkedLineas.includes(l.id)}
                                    onChange={() => toggleLineaCheck(l.id)}
                                  />
                                </td>
                                <td>
                                  <strong className="text-xs text-slate-700 block">{l.concepto?.nombre}</strong>
                                  {l.proveedor && <small className="text-slate-400 font-medium">Prov: {l.proveedor.razonSocial}</small>}
                                </td>
                                <td className="text-right font-semibold text-slate-800 text-xs" style={{ verticalAlign: 'middle' }}>
                                  {orderMoneda === 'PEN' ? 'S/' : (orderMoneda === 'USD' ? '$' : '€')} {l.precioVenta.toFixed(2)}
                                </td>
                              </tr>
                              {checkedLineas.includes(l.id) && (
                                <tr className="bg-slate-50 border-b border-slate-200">
                                  <td colSpan={3} style={{ padding: '0.5rem 0.75rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                      <div className="form-group mb-0" style={{ flex: '1 1 100px', marginBottom: 0 }}>
                                        <label className="text-xxs uppercase tracking-wider text-slate-400 font-bold block mb-0.5">Tipo Doc.</label>
                                        <select 
                                          style={{ fontSize: '11px', padding: '3px 6px', height: 'auto', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                          value={lineasDocs[l.id]?.tipoDocumento || 'FACTURA'}
                                          onChange={(e) => handleLineaDocChange(l.id, 'tipoDocumento', e.target.value)}
                                        >
                                          <option value="FACTURA">Factura</option>
                                          <option value="BOLETA">Boleta</option>
                                          <option value="RECIBO">Recibo de Caja</option>
                                          <option value="NINGUNO">Ninguno</option>
                                        </select>
                                      </div>
                                      <div className="form-group mb-0" style={{ flex: '2 1 140px', marginBottom: 0 }}>
                                        <label className="text-xxs uppercase tracking-wider text-slate-400 font-bold block mb-0.5">Documento (Serie-Nro)</label>
                                        <input 
                                          type="text" 
                                          placeholder="F001-000214"
                                          style={{ fontSize: '11px', padding: '3px 6px', height: 'auto', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                          value={lineasDocs[l.id]?.nroDocumento || ''}
                                          onChange={(e) => handleLineaDocChange(l.id, 'nroDocumento', e.target.value)}
                                        />
                                      </div>
                                      <div className="form-group mb-0" style={{ flex: '1.5 1 110px', marginBottom: 0 }}>
                                        <label className="text-xxs uppercase tracking-wider text-slate-400 font-bold block mb-0.5">Fecha Doc.</label>
                                        <input 
                                          type="date" 
                                          style={{ fontSize: '11px', padding: '3px 6px', height: 'auto', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                          value={lineasDocs[l.id]?.fechaDocumento || ''}
                                          onChange={(e) => handleLineaDocChange(l.id, 'fechaDocumento', e.target.value)}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Tributos Aduaneros Section (Image 4 reference) */}
                    {selectedOrden.costeo && (
                      <div className="mt-4 p-4 border border-slate-200 rounded-lg bg-slate-50 animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
                            ⚖️ Tributos Aduaneros (Ref: {selectedOrden.costeo.codigo})
                          </h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <input 
                              type="checkbox"
                              id="cb-tributos"
                              checked={incluirTributos}
                              onChange={(e) => setIncluirTributos(e.target.checked)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            <label htmlFor="cb-tributos" className="text-xs font-black text-slate-700 cursor-pointer">
                              Incluir Tributos en Cobro
                            </label>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
                          <div>
                            <table className="dense-table" style={{ width: '100%', background: 'transparent' }}>
                              <tbody>
                                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td className="text-xs text-slate-500 py-1">Ad Valorem ({selectedOrden.costeo.adValoremGlobal ? 'Global' : '0%'})</td>
                                  <td className="text-right text-xs font-bold text-slate-700 py-1">S/ {adValoremPEN.toFixed(2)}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td className="text-xs text-slate-500 py-1">IGV Aduanas (16%)</td>
                                  <td className="text-right text-xs font-bold text-slate-700 py-1">S/ {igvPEN.toFixed(2)}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td className="text-xs text-slate-500 py-1">IPM (2%)</td>
                                  <td className="text-right text-xs font-bold text-slate-700 py-1">S/ {ipmPEN.toFixed(2)}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td className="text-xs text-slate-500 py-1">Percepción ({selectedOrden.costeo.percepcionPorcentaje}%)</td>
                                  <td className="text-right text-xs font-bold text-slate-700 py-1">S/ {percepcionPEN.toFixed(2)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Giant Total Impuestos box as shown in Image 4 */}
                          <div style={{
                            background: '#f0fdf4',
                            border: '2px solid #16a34a',
                            borderRadius: '12px',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            textAlign: 'center'
                          }}>
                            <span className="text-xxs font-black text-emerald-800 uppercase tracking-widest block mb-1">Total Impuestos (PEN)</span>
                            <div className="text-2xl font-black text-emerald-950">
                              S/ {totalTributosPEN.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Calculations & Form */}
                  <div>
                    {/* dynamic calculations grid */}
                    <div className="kpi-panel-small mb-4">
                      <div className="kpi-item-small">
                        <span className="kpi-lbl">Total a Cobrar</span>
                        <div className="kpi-val text-primary">
                          {orderMoneda !== 'PEN' && (
                            <div className="text-sm font-bold">
                              {orderMoneda === 'USD' ? '$' : '€'} {totalBaseA_Cobrar.toFixed(2)}
                            </div>
                          )}
                          <div className="text-xs font-bold text-amber-700">
                            S/ {totalTaxA_Cobrar.toFixed(2)} (Impuestos)
                          </div>
                        </div>
                      </div>

                      <div className="kpi-item-small">
                        <span className="kpi-lbl">Pagos Recibidos</span>
                        <div className="kpi-val text-success">
                          {orderMoneda === 'USD' && cobrosUSD_Received > 0 && (
                            <div className="text-sm font-bold">$ {cobrosUSD_Received.toFixed(2)}</div>
                          )}
                          {orderMoneda === 'EUR' && cobrosEUR_Received > 0 && (
                            <div className="text-sm font-bold">€ {cobrosEUR_Received.toFixed(2)}</div>
                          )}
                          <div className="text-xs font-bold text-emerald-700">
                            S/ {cobrosPEN_Received.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="kpi-item-small">
                        <span className="kpi-lbl">Saldo Pendiente</span>
                        <div className="kpi-val text-danger">
                          {orderMoneda !== 'PEN' && (
                            <div className={`text-sm font-black ${pendingForeign <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {orderMoneda === 'USD' ? '$' : '€'} {pendingForeign.toFixed(2)}
                            </div>
                          )}
                          <div className={`text-xs font-black ${pendingSoles <= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            S/ {pendingSoles.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Collection Registration Form */}
                    <form onSubmit={handleRegisterCobro} className="cobros-form">
                      <h5 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-3">
                        ⚡ Registrar Nueva Transacción
                      </h5>
                      <div className="grid-2">
                        <div className="form-group">
                          <label>Moneda de Pago *</label>
                          <select 
                            value={cobroForm.moneda}
                            onChange={(e) => setCobroForm({ ...cobroForm, moneda: e.target.value })}
                            required
                          >
                            {orderMoneda !== 'PEN' && <option value={orderMoneda}>{orderMoneda}</option>}
                            <option value="PEN">PEN (Soles)</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label>Monto a Cobrar *</label>
                          <input 
                            type="number" 
                            step="0.01" 
                            required 
                            placeholder="Monto"
                            value={cobroForm.monto}
                            onChange={(e) => setCobroForm({ ...cobroForm, monto: e.target.value })}
                          />
                        </div>

                        <div className="form-group">
                          <label>Método de Pago *</label>
                          <select 
                            value={cobroForm.metodo}
                            onChange={(e) => setCobroForm({ ...cobroForm, metodo: e.target.value })}
                            required
                          >
                            <option value="EFECTIVO">Efectivo</option>
                            <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                            <option value="TARJETA_CREDITO">Tarjeta de Crédito</option>
                            <option value="TARJETA_DEBITO">Tarjeta de Débito</option>
                            <option value="YAPE">Yape</option>
                            <option value="PLIN">Plin</option>
                            <option value="SIP">SIP</option>
                          </select>
                        </div>

                        {cobroForm.moneda !== 'PEN' ? (
                          <div className="form-group">
                            <label>Tipo de Cambio (TC) *</label>
                            <input 
                              type="number" 
                              step="0.0001" 
                              required 
                              value={tipoCambioInput}
                              onChange={(e) => setTipoCambioInput(e.target.value)}
                            />
                          </div>
                        ) : (
                          <div className="form-group">
                            <label>Tipo de Cambio Ref.</label>
                            <input 
                              type="number" 
                              disabled 
                              value={tipoCambioInput}
                            />
                          </div>
                        )}

                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label>Nro. de Referencia (Opcional)</label>
                          <input 
                            type="text" 
                            placeholder="Ej. Nro Operación Bancaria, Yape Ref"
                            value={referenciaInput}
                            onChange={(e) => setReferenciaInput(e.target.value)}
                          />
                        </div>
                      </div>
                      <button type="submit" className="primary full-width mt-3 icon-left">
                        <Plus size={16} /> Guardar Cobranza
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ) : (
              // Historial Tab
              <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                <h4 className="font-bold text-slate-800 mb-3 text-sm uppercase tracking-wider">
                  🕒 Historial de Transacciones Registradas
                </h4>
                {cobrosList.length === 0 && legacySolesReceived === 0 ? (
                  <div className="p-8 text-center text-slate-400 bg-slate-50 rounded border border-dashed border-slate-200">
                    No se han registrado cobros ni pagos anteriores para esta orden.
                  </div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Método / Referencia</th>
                          <th>Conceptos y Facturación</th>
                          <th className="text-right">Cobrado</th>
                          <th className="text-right">T.C.</th>
                          <th className="text-right">Equivalente PEN</th>
                          <th style={{ width: '50px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Render legacy payments if any */}
                        {selectedOrden.pagos?.map((p: any) => (
                          <tr key={`legacy-${p.id}`} style={{ background: '#f8fafc' }}>
                            <td className="text-xs">{new Date(p.fecha).toLocaleDateString()}</td>
                            <td>
                              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-xxs font-bold uppercase tracking-wider mr-2">
                                {p.modo}
                              </span>
                            </td>
                            <td className="text-xs text-slate-400 italic">Pago Legacy Registrado</td>
                            <td className="text-right text-xs font-bold text-emerald-700">S/ {p.monto.toFixed(2)}</td>
                            <td className="text-right text-xs text-slate-400">-</td>
                            <td className="text-right text-xs font-bold text-slate-700">S/ {p.monto.toFixed(2)}</td>
                            <td></td>
                          </tr>
                        ))}
                        {/* Render advanced cobros */}
                        {cobrosList.map((c: any) => {
                          const equiv = c.moneda === 'PEN' ? c.monto : c.monto * (c.tipoCambio || 1);
                          
                          // Parse individual concept line billing documents
                          let details: any = null;
                          try {
                            if (c.detallesLineas) {
                              details = typeof c.detallesLineas === 'string' ? JSON.parse(c.detallesLineas) : c.detallesLineas;
                            }
                          } catch (err) {}

                          return (
                            <tr key={c.id}>
                              <td className="text-xs">
                                {new Date(c.createdAt).toLocaleDateString()} {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td>
                                <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xxs font-black uppercase tracking-wider block mb-1" style={{ width: 'fit-content' }}>
                                  {c.metodo}
                                </span>
                                {c.referencia && (
                                  <small className="text-slate-500 font-bold block">
                                    Ref: <strong>{c.referencia}</strong>
                                  </small>
                                )}
                              </td>
                              <td className="text-xs font-semibold text-slate-700">
                                {details && Object.keys(details).length > 0 ? (
                                  <div className="space-y-1.5">
                                    {Object.keys(details).map(lineId => {
                                      const conceptObj = selectedOrden.cotizacion?.lineas?.find((x: any) => x.id === lineId);
                                      const doc = details[lineId];
                                      return (
                                        <div key={lineId} style={{ display: 'flex', flexDirection: 'column', padding: '3px 6px', background: '#f8fafc', borderRadius: '4px' }}>
                                          <span className="text-xxs font-bold text-slate-600">
                                            📦 {conceptObj?.concepto?.nombre || 'Concepto Comercial'}
                                          </span>
                                          {doc?.nroDocumento ? (
                                            <small className="text-xxs text-slate-500">
                                              📄 {doc.tipoDocumento}: <strong>{doc.nroDocumento}</strong> ({new Date(doc.fechaDocumento).toLocaleDateString()})
                                            </small>
                                          ) : (
                                            <small className="text-xxs text-slate-400 italic">Cobrado sin comprobante</small>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">No concept breakdown</span>
                                )}
                              </td>
                              <td className="text-right text-xs font-bold text-slate-800">
                                {c.moneda === 'PEN' ? 'S/' : (c.moneda === 'USD' ? '$' : '€')} {c.monto.toFixed(2)}
                              </td>
                              <td className="text-right text-xs text-slate-500 font-semibold">{c.tipoCambio.toFixed(4)}</td>
                              <td className="text-right text-xs font-bold text-slate-700">S/ {equiv.toFixed(2)}</td>
                              <td className="text-center">
                                <button 
                                  className="icon-btn text-rose-500 hover:bg-rose-50 p-1 rounded" 
                                  title="Eliminar registro"
                                  onClick={() => handleDeleteCobro(c.id)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
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
        .badge-orange { background: #f97316; }
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
        
        /* Advanced Cobros Styles */
        .modal-tabs {
          display: flex;
          border-bottom: 2px solid #f1f5f9;
          margin-bottom: 1.5rem;
          gap: 1rem;
        }
        .tab-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border: none;
          background: none;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-light);
          cursor: pointer;
          border-bottom: 3px solid transparent;
          transition: all 0.3s;
        }
        .tab-btn.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
        }
        .dense-table th, .dense-table td {
          padding: 0.5rem 0.75rem;
          font-size: 0.75rem;
        }
        .dense-table tr.checked-row {
          background: #f0fdf4;
        }
        .kpi-panel-small {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }
        .kpi-item-small {
          background: #f8fafc;
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 0.5rem;
          text-align: center;
        }
        .kpi-lbl {
          display: block;
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--text-light);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.25rem;
        }
        .kpi-val {
          font-size: 0.8rem;
          font-weight: 800;
        }
        .cobros-form {
          background: #f8fafc;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 1rem;
        }
        .btn-glow:hover {
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
        }
        .text-xxs {
          font-size: 0.65rem;
        }
        .text-emerald-950 {
          color: #022c22;
        }
      `}</style>
    </div>
  );
};

export default Ordenes;
