import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, Trash2, Save, X } from 'lucide-react';

interface CotizacionFormProps {
  onClose: () => void;
  onSave: () => void;
  initialData?: any;
  defaultModalidad?: 'MARITIMO' | 'AEREO';
  viewOnly?: boolean;
}

const CotizacionForm: React.FC<CotizacionFormProps> = ({ onClose, onSave, initialData, defaultModalidad, viewOnly }) => {
  const [clientes, setClientes] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [origenes, setOrigenes] = useState<any[]>([]);
  const [destinos, setDestinos] = useState<any[]>([]);
  
  const [clienteId, setClienteId] = useState(initialData?.clienteId || '');
  const [leadId, setLeadId] = useState(initialData?.leadId || '');
  const [moneda, setMoneda] = useState(initialData?.moneda || 'USD');
  const [tipoCarga, setTipoCarga] = useState(initialData?.tipoCarga || '');
  const [incoterm, setIncoterm] = useState(initialData?.incoterm || '');
  const [origenId, setOrigenId] = useState(initialData?.origenId || '');
  const [destinoId, setDestinoId] = useState(initialData?.destinoId || '');
  const [referencia, setReferencia] = useState(initialData?.referencia || '');
  const [selectedTarget, setSelectedTarget] = useState(() => {
    if (initialData?.clienteId) return `client:${initialData.clienteId}`;
    if (initialData?.leadId) return `lead:${initialData.leadId}`;
    return '';
  });
  const [lineas, setLineas] = useState<any[]>([]);

  // New state variables for air cargo
  const [modalidad, setModalidad] = useState<'MARITIMO' | 'AEREO'>(
    initialData?.modalidad || defaultModalidad || 'MARITIMO'
  );
  const [itemsAereo, setItemsAereo] = useState<any[]>(() => {
    if (initialData?.itemsAereo) {
      try {
        const parsed = typeof initialData.itemsAereo === 'string' 
          ? JSON.parse(initialData.itemsAereo) 
          : initialData.itemsAereo;
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return [{ peso: '', largo: '', ancho: '', alto: '', cantidad: 1 }];
  });
  const [divisorVolumetrico, setDivisorVolumetrico] = useState<number>(6000);

  const getMonedaSymbol = (m: string) => {
    if (m === 'PEN') return 'S/';
    if (m === 'EUR') return '€';
    return '$';
  };
  
  const [loading, setLoading] = useState(true);
  const [showNewConceptInput, setShowNewConceptInput] = useState<string | null>(null);
  const [newConceptName, setNewConceptName] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [cRes, pRes, catRes, lRes, oRes, dRes] = await Promise.all([
        api.get('/clientes'),
        api.get('/proveedores'),
        api.get('/categorias'),
        api.get('/leads'),
        api.get('/origenes'),
        api.get('/destinos')
      ]);
      setClientes(cRes.data);
      setLeads(lRes.data);
      setProveedores(pRes.data);
      setCategorias(catRes.data);
      setOrigenes(oRes.data);
      setDestinos(dRes.data);

      if (!initialData) {
        const defaultLineas: any[] = [];
        catRes.data.forEach((cat: any) => {
          if (cat.conceptos) {
            cat.conceptos.forEach((con: any) => {
              if (con.incluirPorDefecto && con.modalidad === modalidad) {
                defaultLineas.push({
                  conceptoId: con.id,
                  categoriaNombre: cat.nombre,
                  conceptoNombre: con.nombre,
                  proveedorId: '',
                  costo: 0,
                  precioVenta: 0,
                  valorVenta: 0,
                  igv: 0,
                  utilidad: 0,
                  margen: 0,
                  afectoIGV: cat.afectoIGV,
                  calculaTarifaBase: con.calculaTarifaBase || false,
                  tarifaBaseCosto: 0,
                  tarifaBaseVenta: 0
                });
              }
            });
          }
        });
        setLineas(defaultLineas);
      } else {
        setLineas((initialData.lineas || []).map((l: any) => ({
          ...l,
          categoriaNombre: l.concepto?.categoria?.nombre || 'S/C',
          conceptoNombre: l.concepto?.nombre || 'S/C',
          afectoIGV: l.concepto?.categoria?.afectoIGV ?? true,
          calculaTarifaBase: l.concepto?.calculaTarifaBase || false,
          tarifaBaseCosto: l.tarifaBaseCosto || 0,
          tarifaBaseVenta: l.tarifaBaseVenta || 0
        })));

        // Infer divisorVolumetrico
        if (initialData.itemsAereo && initialData.pesoVolumetrico && Array.isArray(initialData.itemsAereo)) {
          const items = initialData.itemsAereo;
          let sum5000 = 0;
          let sum6000 = 0;
          items.forEach((item: any) => {
            const qty = parseFloat(item.cantidad) || 0;
            const l = parseFloat(item.largo) || 0;
            const w = parseFloat(item.ancho) || 0;
            const h = parseFloat(item.alto) || 0;
            sum5000 += ((l * w * h) / 5000) * qty;
            sum6000 += ((l * w * h) / 6000) * qty;
          });
          const diff5000 = Math.abs(sum5000 - initialData.pesoVolumetrico);
          const diff6000 = Math.abs(sum6000 - initialData.pesoVolumetrico);
          if (diff5000 < diff6000) {
            setDivisorVolumetrico(5000);
          } else {
            setDivisorVolumetrico(6000);
          }
        }
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  // Calculate cargo totals
  let totalBultos = 0;
  let pesoRealTotal = 0;
  let pesoVolumetricoTotal = 0;
  let volumenTotal = 0;
  let pesoFacturable = 0;

  if (modalidad === 'AEREO') {
    itemsAereo.forEach((item) => {
      const qty = parseFloat(item.cantidad) || 0;
      const w = parseFloat(item.peso) || 0;
      const l = parseFloat(item.largo) || 0;
      const wDim = parseFloat(item.ancho) || 0;
      const h = parseFloat(item.alto) || 0;

      totalBultos += qty;
      pesoRealTotal += w * qty;
      pesoVolumetricoTotal += ((l * wDim * h) / divisorVolumetrico) * qty;
      volumenTotal += ((l * wDim * h) / 1000000) * qty;
    });
    pesoFacturable = Math.max(pesoRealTotal, pesoVolumetricoTotal);
  }

  const recalculateLines = (currentLines: any[], pFact: number) => {
    return currentLines.map((linea: any) => {
      if (linea.calculaTarifaBase) {
        const tCosto = parseFloat(linea.tarifaBaseCosto) || 0;
        const tVenta = parseFloat(linea.tarifaBaseVenta) || 0;
        const costo = tCosto * pFact;
        const precioVenta = tVenta * pFact;
        
        let valorVenta, igv;
        if (linea.afectoIGV) {
          valorVenta = precioVenta / 1.18;
          igv = valorVenta * 0.18;
        } else {
          valorVenta = precioVenta;
          igv = 0;
        }
        const utilidad = valorVenta - costo;
        const margen = valorVenta > 0 ? (utilidad / valorVenta) * 100 : 0;
        
        return {
          ...linea,
          costo,
          precioVenta,
          valorVenta,
          igv,
          utilidad,
          margen
        };
      }
      return linea;
    });
  };

  // Keep lines recalculated when cargo totals change
  useEffect(() => {
    if (modalidad === 'AEREO') {
      setLineas(prev => recalculateLines(prev, pesoFacturable));
    }
  }, [pesoFacturable, modalidad]);

  const handleLineChange = (index: number, field: string, value: any) => {
    const newLineas = [...lineas];
    const linea = { ...newLineas[index], [field]: value };

    if (field === 'tarifaBaseCosto' || field === 'tarifaBaseVenta') {
      const tCosto = field === 'tarifaBaseCosto' ? parseFloat(value) || 0 : linea.tarifaBaseCosto;
      const tVenta = field === 'tarifaBaseVenta' ? parseFloat(value) || 0 : linea.tarifaBaseVenta;
      
      const costo = tCosto * pesoFacturable;
      const precioVenta = tVenta * pesoFacturable;
      
      let valorVenta, igv;
      if (linea.afectoIGV) {
        valorVenta = precioVenta / 1.18;
        igv = valorVenta * 0.18;
      } else {
        valorVenta = precioVenta;
        igv = 0;
      }
      
      const utilidad = valorVenta - costo;
      const margen = valorVenta > 0 ? (utilidad / valorVenta) * 100 : 0;

      linea.tarifaBaseCosto = tCosto;
      linea.tarifaBaseVenta = tVenta;
      linea.costo = costo;
      linea.precioVenta = precioVenta;
      linea.valorVenta = valorVenta;
      linea.igv = igv;
      linea.utilidad = utilidad;
      linea.margen = margen;
    } else if (field === 'precioVenta' || field === 'costo') {
      const precioVenta = field === 'precioVenta' ? parseFloat(value) || 0 : linea.precioVenta;
      const costo = field === 'costo' ? parseFloat(value) || 0 : linea.costo;
      
      let valorVenta, igv;
      if (linea.afectoIGV) {
        valorVenta = precioVenta / 1.18;
        igv = valorVenta * 0.18;
      } else {
        valorVenta = precioVenta;
        igv = 0;
      }
      
      const utilidad = valorVenta - costo;
      const margen = valorVenta > 0 ? (utilidad / valorVenta) * 100 : 0;

      linea.valorVenta = valorVenta;
      linea.igv = igv;
      linea.utilidad = utilidad;
      linea.margen = margen;
      linea.precioVenta = precioVenta;
      linea.costo = costo;
    }

    newLineas[index] = linea;
    setLineas(newLineas);
  };

  const handleItemChange = (itemIndex: number, field: string, value: any) => {
    const newItems = [...itemsAereo];
    newItems[itemIndex] = { ...newItems[itemIndex], [field]: value };
    setItemsAereo(newItems);
  };

  const addItem = () => {
    setItemsAereo([...itemsAereo, { peso: '', largo: '', ancho: '', alto: '', cantidad: 1 }]);
  };

  const removeItem = (itemIndex: number) => {
    if (itemsAereo.length === 1) {
      setItemsAereo([{ peso: '', largo: '', ancho: '', alto: '', cantidad: 1 }]);
    } else {
      setItemsAereo(itemsAereo.filter((_, i) => i !== itemIndex));
    }
  };

  const addLine = (concepto: any, categoria: any) => {
    const isBase = concepto.calculaTarifaBase || false;
    setLineas([...lineas, {
      categoriaId: categoria.id,
      categoriaNombre: categoria.nombre,
      conceptoId: concepto.id,
      conceptoNombre: concepto.nombre,
      proveedorId: '',
      costo: 0,
      precioVenta: 0,
      valorVenta: 0,
      igv: 0,
      utilidad: 0,
      margen: 0,
      afectoIGV: categoria.afectoIGV,
      calculaTarifaBase: isBase,
      tarifaBaseCosto: 0,
      tarifaBaseVenta: 0
    }]);
  };

  const removeLine = (index: number) => {
    setLineas(lineas.filter((_, i) => i !== index));
  };

  const handleCreateOrigen = async () => {
    const nombre = prompt('Ingrese el nombre del nuevo origen (ej. Shanghai):');
    if (!nombre || !nombre.trim()) return;
    try {
      const res = await api.post('/origenes', { nombre: nombre.trim() });
      const nuevoOrigen = res.data;
      setOrigenes(prev => [...prev, nuevoOrigen].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setOrigenId(nuevoOrigen.id);
    } catch (err) {
      alert('Error al crear origen');
    }
  };

  const handleCreateDestino = async () => {
    const nombre = prompt('Ingrese el nombre del nuevo destino (ej. Callao):');
    if (!nombre || !nombre.trim()) return;
    try {
      const res = await api.post('/destinos', { nombre: nombre.trim() });
      const nuevoDestino = res.data;
      setDestinos(prev => [...prev, nuevoDestino].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setDestinoId(nuevoDestino.id);
    } catch (err) {
      alert('Error al crear destino');
    }
  };

  const handleCreateConcept = async (categoriaId: string) => {
    if (!newConceptName.trim()) return;
    try {
      const response = await api.post(`/categorias/${categoriaId}/conceptos`, {
        nombre: newConceptName,
        incluirPorDefecto: false,
        modalidad,
        calculaTarifaBase: false
      });
      
      const newConcept = response.data;
      // Refresh categories to include the new concept
      const catRes = await api.get('/categorias');
      const updatedCategorias = catRes.data;
      setCategorias(updatedCategorias);
      
      // Automatically add the new concept to the quotation
      const category = updatedCategorias.find((c: any) => c.id === categoriaId);
      addLine(newConcept, category);
      
      setNewConceptName('');
      setShowNewConceptInput(null);
    } catch (err) {
      alert('Error al crear concepto');
    }
  };

  const totals = lineas.reduce((acc, l) => ({
    precioTotal: acc.precioTotal + (l.precioVenta || 0),
    totalVenta: acc.totalVenta + (l.valorVenta || 0),
    igv: acc.igv + (l.igv || 0),
    utilidad: acc.utilidad + (l.utilidad || 0)
  }), { precioTotal: 0, totalVenta: 0, igv: 0, utilidad: 0 });

  const porcentajeUtilidad = totals.totalVenta > 0 ? (totals.utilidad / totals.totalVenta) * 100 : 0;

  const handleTargetChange = (val: string) => {
    setSelectedTarget(val);
    if (val.startsWith('client:')) {
      setClienteId(val.replace('client:', ''));
      setLeadId('');
    } else if (val.startsWith('lead:')) {
      setLeadId(val.replace('lead:', ''));
      setClienteId('');
    } else {
      setClienteId('');
      setLeadId('');
    }
  };

  const handleSubmit = async () => {
    if (!clienteId && !leadId) return alert('Seleccione un cliente o prospecto');

    if (modalidad === 'AEREO') {
      for (const item of itemsAereo) {
        if (!item.peso || !item.largo || !item.ancho || !item.alto || !item.cantidad) {
          return alert('Por favor, complete todos los campos obligatorios de la carga aérea.');
        }
      }
    }

    try {
      const data = { 
        clienteId: clienteId || null, 
        leadId: leadId || null, 
        moneda,
        lineas: lineas.map(l => ({
          ...l,
          tarifaBaseCosto: l.tarifaBaseCosto || 0,
          tarifaBaseVenta: l.tarifaBaseVenta || 0,
          calculaTarifaBase: l.calculaTarifaBase || false
        })),
        tipoCarga: tipoCarga || null,
        incoterm: incoterm || null,
        origenId: origenId || null,
        destinoId: destinoId || null,
        referencia: referencia || null,
        modalidad,
        pesoTotal: modalidad === 'AEREO' ? pesoRealTotal : null,
        pesoVolumetrico: modalidad === 'AEREO' ? pesoVolumetricoTotal : null,
        pesoFacturable: modalidad === 'AEREO' ? pesoFacturable : null,
        itemsAereo: modalidad === 'AEREO' ? itemsAereo : null,
        divisorVolumetrico: modalidad === 'AEREO' ? divisorVolumetrico : undefined
      };
      if (initialData) {
        await api.put(`/cotizaciones/${initialData.id}`, data);
      } else {
        await api.post('/cotizaciones', data);
      }
      onSave();
    } catch (err) {
      alert('Error al guardar cotización');
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="modal-overlay">
      <div className="modal-content large">
        <div className="modal-header">
          <h2>
            {viewOnly ? 'Detalle de Cotización' : (initialData ? 'Editar Cotización' : 'Nueva Cotización')}
            <span style={{ marginLeft: '10px', fontSize: '0.85rem', color: 'var(--text-light)', background: '#e2e8f0', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}>
              {modalidad === 'AEREO' ? '✈️ AÉREA' : '🚢 MARÍTIMA'}
            </span>
          </h2>
          <button className="icon-btn" onClick={onClose}><X /></button>
        </div>

        <div className="modal-body">
          {initialData && (
            <div className="quote-meta-banner" style={{
              display: 'flex',
              gap: '2.5rem',
              background: '#f1f5f9',
              padding: '0.75rem 1.25rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              marginBottom: '1.5rem',
              fontSize: '0.825rem',
              color: '#334155'
            }}>
              <div><strong>Nro. Cotiz:</strong> #{String(initialData.numero).padStart(5, '0')}</div>
              <div><strong>Fecha:</strong> {new Date(initialData.createdAt).toLocaleDateString()} {new Date(initialData.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
              <div><strong>Usuario Creador:</strong> {initialData.vendedor ? `${initialData.vendedor.nombres} ${initialData.vendedor.apellidos}` : 'Sistema'}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="form-section" style={{ minWidth: '350px', marginBottom: 0 }}>
              <label>Cliente / Prospecto *</label>
              <select 
                value={selectedTarget} 
                onChange={(e) => handleTargetChange(e.target.value)} 
                disabled={viewOnly}
                required
              >
                <option value="">-- Seleccione Cliente o Lead --</option>
                <optgroup label="Clientes Oficiales">
                  {clientes.map(c => (
                    <option key={`client:${c.id}`} value={`client:${c.id}`}>
                      🏢 {c.razonSocial} (RUC: {c.ruc})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Leads / Prospectos">
                  {leads.map(l => (
                    <option key={`lead:${l.id}`} value={`lead:${l.id}`}>
                      👤 {l.nombre || l.contacto} ({l.contacto} - {l.estado})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="form-section" style={{ minWidth: '150px', marginBottom: 0 }}>
              <label>Moneda de Cotización *</label>
              <select 
                value={moneda} 
                onChange={(e) => setMoneda(e.target.value)} 
                disabled={viewOnly}
                required
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="PEN">PEN (S/)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div className="form-section" style={{ minWidth: '180px', marginBottom: 0 }}>
              <label>Tipo de Carga</label>
              <select
                value={tipoCarga}
                onChange={(e) => setTipoCarga(e.target.value)}
                disabled={viewOnly}
              >
                <option value="">Seleccionar</option>
                <option value="LCL">LCL (Carga Suelta)</option>
                <option value="FCL">FCL (Contenedor Lleno)</option>
              </select>
            </div>

            <div className="form-section" style={{ minWidth: '150px', marginBottom: 0 }}>
              <label>Incoterm</label>
              <select
                value={incoterm}
                onChange={(e) => setIncoterm(e.target.value)}
                disabled={viewOnly}
              >
                <option value="">Seleccionar</option>
                <option value="EXW">EXW</option>
                <option value="FOB">FOB</option>
                <option value="FCA">FCA</option>
              </select>
            </div>

            <div className="form-section" style={{ minWidth: '220px', marginBottom: 0 }}>
              <label>Origen</label>
              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                <select
                  value={origenId}
                  onChange={(e) => setOrigenId(e.target.value)}
                  disabled={viewOnly}
                  style={{ flex: 1 }}
                >
                  <option value="">Seleccionar</option>
                  {origenes.map(o => (
                    <option key={o.id} value={o.id}>{o.nombre}</option>
                  ))}
                </select>
                {!viewOnly && (
                  <button 
                    type="button" 
                    className="icon-btn primary" 
                    onClick={handleCreateOrigen}
                    style={{ padding: '0.5rem', height: '38px', width: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--primary)', color: 'white' }}
                    title="Crear Origen"
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="form-section" style={{ minWidth: '220px', marginBottom: 0 }}>
              <label>Destino</label>
              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                <select
                  value={destinoId}
                  onChange={(e) => setDestinoId(e.target.value)}
                  disabled={viewOnly}
                  style={{ flex: 1 }}
                >
                  <option value="">Seleccionar</option>
                  {destinos.map(d => (
                    <option key={d.id} value={d.id}>{d.nombre}</option>
                  ))}
                </select>
                {!viewOnly && (
                  <button 
                    type="button" 
                    className="icon-btn primary" 
                    onClick={handleCreateDestino}
                    style={{ padding: '0.5rem', height: '38px', width: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--primary)', color: 'white' }}
                    title="Crear Destino"
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Referencia</label>
            <textarea
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Digite los detalles o la referencia de la cotización..."
              rows={3}
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                resize: 'vertical',
                fontFamily: 'inherit',
                fontSize: '0.875rem'
              }}
              disabled={viewOnly}
            />
          </div>

          {modalidad === 'AEREO' && (
            <div className="air-cargo-panel mb-6" style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                  ✈️ Detalle de Carga / Bultos Aéreos
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569' }}>
                    Divisor Volumétrico:
                  </label>
                  <select
                    value={divisorVolumetrico}
                    onChange={(e) => setDivisorVolumetrico(parseInt(e.target.value))}
                    disabled={viewOnly}
                    style={{ width: '180px', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white' }}
                  >
                    <option value={6000}>1:6000 (Estándar IATA)</option>
                    <option value={5000}>1:5000 (Courier Express)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {itemsAereo.map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    background: 'white',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    flexWrap: 'wrap',
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, color: '#64748b' }}>#{idx + 1}</span>
                      {!viewOnly && (
                        <button 
                          type="button" 
                          className="icon-btn danger" 
                          onClick={() => removeItem(idx)}
                          style={{ padding: '0.25rem' }}
                          title="Eliminar Bulto"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div style={{ minWidth: '120px', flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>
                        Peso Unit. (kg) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.peso}
                        placeholder="0.00"
                        disabled={viewOnly}
                        onChange={(e) => handleItemChange(idx, 'peso', e.target.value)}
                        required
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 3, minWidth: '220px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>
                          Largo (cm) *
                        </label>
                        <input
                          type="number"
                          value={item.largo}
                          placeholder="cm"
                          disabled={viewOnly}
                          onChange={(e) => handleItemChange(idx, 'largo', e.target.value)}
                          required
                        />
                      </div>
                      <span style={{ marginTop: '14px', fontWeight: 'bold', color: '#94a3b8' }}>x</span>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>
                          Ancho (cm) *
                        </label>
                        <input
                          type="number"
                          value={item.ancho}
                          placeholder="cm"
                          disabled={viewOnly}
                          onChange={(e) => handleItemChange(idx, 'ancho', e.target.value)}
                          required
                        />
                      </div>
                      <span style={{ marginTop: '14px', fontWeight: 'bold', color: '#94a3b8' }}>x</span>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>
                          Alto (cm) *
                        </label>
                        <input
                          type="number"
                          value={item.alto}
                          placeholder="cm"
                          disabled={viewOnly}
                          onChange={(e) => handleItemChange(idx, 'alto', e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ minWidth: '110px' }}>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>
                        Cant. Bultos *
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(226, 232, 240, 0.9)', borderRadius: '8px', overflow: 'hidden', height: '38px' }}>
                        {!viewOnly && (
                          <button
                            type="button"
                            onClick={() => handleItemChange(idx, 'cantidad', Math.max(1, (parseInt(item.cantidad) || 1) - 1))}
                            style={{ padding: '0.25rem 0.5rem', background: '#f1f5f9', borderRadius: 0, height: '36px', minWidth: '30px' }}
                          >
                            -
                          </button>
                        )}
                        <input
                          type="number"
                          value={item.cantidad}
                          disabled={viewOnly}
                          onChange={(e) => handleItemChange(idx, 'cantidad', Math.max(1, parseInt(e.target.value) || 1))}
                          style={{ textAlign: 'center', border: 'none', borderRadius: 0, padding: 0, height: '36px', width: '40px', background: 'transparent' }}
                          required
                        />
                        {!viewOnly && (
                          <button
                            type="button"
                            onClick={() => handleItemChange(idx, 'cantidad', (parseInt(item.cantidad) || 1) + 1)}
                            style={{ padding: '0.25rem 0.5rem', background: '#f1f5f9', borderRadius: 0, height: '36px', minWidth: '30px' }}
                          >
                            +
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {!viewOnly && (
                <button
                  type="button"
                  className="btn-outline sm mt-4"
                  onClick={addItem}
                  style={{ background: 'white' }}
                >
                  <Plus size={14} /> Agregar Otro Bulto
                </button>
              )}

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '1rem',
                marginTop: '1rem',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div style={{ textAlign: 'center', flex: 1, minWidth: '80px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>TOTAL BULTOS</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{totalBultos}</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1, minWidth: '90px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>PESO REAL TOTAL</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{pesoRealTotal.toFixed(2)} kg</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1, minWidth: '100px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>PESO VOLUMÉTRICO</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{pesoVolumetricoTotal.toFixed(2)} kg</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1, minWidth: '90px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>VOLUMEN TOTAL</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{volumenTotal.toFixed(3)} m³</div>
                </div>
                <div style={{
                  textAlign: 'center',
                  flex: 1,
                  minWidth: '120px',
                  borderLeft: '2px dashed #cbd5e1',
                  paddingLeft: '0.5rem',
                  backgroundColor: '#e0f2fe',
                  borderRadius: '4px',
                  padding: '0.25rem'
                }}>
                  <div style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: 700 }}>PESO FACTURABLE</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0284c7' }}>{pesoFacturable.toFixed(2)} kg</div>
                </div>
              </div>
            </div>
          )}

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Categoría / Concepto</th>
                  <th>Proveedor</th>
                  <th>Costo ({getMonedaSymbol(moneda)})</th>
                  <th>Precio Venta ({getMonedaSymbol(moneda)})</th>
                  <th>Valor Venta ({getMonedaSymbol(moneda)})</th>
                  <th>Utilidad ({getMonedaSymbol(moneda)})</th>
                  <th>Margen %</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((linea, index) => (
                  <tr key={index}>
                    <td>
                      <div className="concept-info">
                        <small>{linea.categoriaNombre}</small>
                        <div>
                          {linea.conceptoNombre}
                          {linea.calculaTarifaBase && (
                            <span style={{ marginLeft: '6px', fontSize: '0.65rem', backgroundColor: '#ddd6fe', color: '#6d28d9', padding: '1px 4px', borderRadius: '4px', fontWeight: 'bold' }}>
                              TARIFA BASE
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <select 
                        value={linea.proveedorId} 
                        onChange={(e) => handleLineChange(index, 'proveedorId', e.target.value)}
                        disabled={viewOnly}
                      >
                        <option value="">Seleccionar</option>
                        {proveedores.map(p => (
                          <option key={p.id} value={p.id}>{p.razonSocial}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {linea.calculaTarifaBase ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8rem', color: '#64748b', marginRight: '4px' }}>Tarifa:</span>
                            <input 
                              type="number" 
                              step="0.01"
                              value={linea.tarifaBaseCosto} 
                              onChange={(e) => handleLineChange(index, 'tarifaBaseCosto', e.target.value)} 
                              disabled={viewOnly}
                              style={{ width: '80px', padding: '0.25rem' }}
                            />
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#475569', fontStyle: 'italic' }}>
                            Total: {getMonedaSymbol(moneda)} {linea.costo.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <input 
                          type="number" 
                          value={linea.costo} 
                          onChange={(e) => handleLineChange(index, 'costo', e.target.value)} 
                          disabled={viewOnly}
                        />
                      )}
                    </td>
                    <td>
                      {linea.calculaTarifaBase ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8rem', color: '#64748b', marginRight: '4px' }}>Tarifa:</span>
                            <input 
                              type="number" 
                              step="0.01"
                              value={linea.tarifaBaseVenta} 
                              onChange={(e) => handleLineChange(index, 'tarifaBaseVenta', e.target.value)} 
                              disabled={viewOnly}
                              style={{ width: '80px', padding: '0.25rem' }}
                            />
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#475569', fontStyle: 'italic' }}>
                            Total: {getMonedaSymbol(moneda)} {linea.precioVenta.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <input 
                          type="number" 
                          value={linea.precioVenta} 
                          onChange={(e) => handleLineChange(index, 'precioVenta', e.target.value)} 
                          disabled={viewOnly}
                        />
                      )}
                    </td>
                    <td>{linea.valorVenta.toFixed(2)}</td>
                    <td>{linea.utilidad.toFixed(2)}</td>
                    <td>{linea.margen.toFixed(1)}%</td>
                    <td>
                      {!viewOnly && (
                        <button className="icon-btn danger" onClick={() => removeLine(index)}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!viewOnly && (
            <div className="add-concepts-section">
              <h4>Agregar Conceptos</h4>
              <div className="categories-grid">
                {categorias.map(cat => {
                  const availableConcepts = cat.conceptos.filter((con: any) => 
                    !lineas.some(l => l.conceptoId === con.id) && con.modalidad === modalidad
                  );
                  
                  return (
                    <div key={cat.id} className="cat-group">
                      <h6>{cat.nombre}</h6>
                      <div className="concepts-list">
                        {availableConcepts.map((con: any) => (
                          <button 
                            key={con.id} 
                            className="tag-btn" 
                            onClick={() => addLine(con, cat)}
                          >
                            <Plus size={14} /> {con.nombre}
                          </button>
                        ))}
                        
                        {showNewConceptInput === cat.id ? (
                          <div className="new-concept-inline">
                            <input 
                              autoFocus
                              type="text" 
                              placeholder="Nuevo concepto..." 
                              value={newConceptName}
                              onChange={(e) => setNewConceptName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateConcept(cat.id);
                                if (e.key === 'Escape') setShowNewConceptInput(null);
                              }}
                            />
                            <button className="small-primary" onClick={() => handleCreateConcept(cat.id)}>OK</button>
                            <button className="small-ghost" onClick={() => setShowNewConceptInput(null)}>X</button>
                          </div>
                        ) : (
                          <button 
                            className="tag-btn add-new-btn" 
                            onClick={() => {
                              setShowNewConceptInput(cat.id);
                              setNewConceptName('');
                            }}
                          >
                            <Plus size={14} /> <em>Nuevo...</em>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="totals-section">
            <div className="totals-grid">
              <div className="total-item">
                <label>Total Venta</label>
                <span>{getMonedaSymbol(moneda)} {totals.totalVenta.toFixed(2)}</span>
              </div>
              <div className="total-item">
                <label>IGV (18%)</label>
                <span>{getMonedaSymbol(moneda)} {totals.igv.toFixed(2)}</span>
              </div>
              <div className="total-item highlight">
                <label>Precio Total</label>
                <span>{getMonedaSymbol(moneda)} {totals.precioTotal.toFixed(2)}</span>
              </div>
              <div className="total-item">
                <label>Utilidad</label>
                <span>{getMonedaSymbol(moneda)} {totals.utilidad.toFixed(2)}</span>
              </div>
              <div className="total-item">
                <label>% Utilidad</label>
                <span>{porcentajeUtilidad.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-outline" onClick={onClose}>Cerrar</button>
          {!viewOnly && (
            <button className="primary" onClick={handleSubmit}>
              <Save size={18} /> Guardar Cotización
            </button>
          )}
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }
        .modal-content.large {
          width: 95%;
          max-width: 1200px;
          max-height: 90vh;
          background: white;
          border-radius: 1rem;
          display: flex;
          flex-direction: column;
        }
        .modal-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }
        .form-section {
          margin-bottom: 1.5rem;
          max-width: 300px;
        }
        .concept-info small {
          color: var(--text-light);
          display: block;
          text-transform: uppercase;
          font-size: 0.65rem;
        }
        .add-concepts-section {
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border);
        }
        .categories-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-top: 1rem;
        }
        .concepts-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 0.75rem;
        }
        .tag-btn {
          padding: 0.5rem 1rem;
          font-size: 0.9rem;
          background: #f1f5f9;
          border: 1px solid var(--border);
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          transition: all 0.2s;
          font-weight: 500;
        }
        .tag-btn:hover {
          background: var(--secondary);
          color: white;
          transform: translateY(-2px);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .tag-btn.add-new-btn {
          background: transparent;
          border-style: dashed;
          color: var(--text-light);
        }
        .new-concept-inline {
          display: flex;
          gap: 0.25rem;
          align-items: center;
        }
        .new-concept-inline input {
          padding: 0.4rem;
          font-size: 0.85rem;
          width: 150px;
          border-radius: 4px;
        }
        .small-primary {
          background: var(--primary);
          color: white;
          padding: 0.4rem 0.6rem;
          border-radius: 4px;
          font-size: 0.8rem;
        }
        .small-ghost {
          background: transparent;
          color: var(--text-light);
          padding: 0.4rem;
          font-size: 0.8rem;
        }
        .cat-group h6 {
          font-size: 1rem;
          color: var(--primary);
          margin-bottom: 0.5rem;
          font-weight: 600;
        }
        .totals-section {
          margin-top: 2rem;
          background: #f8fafc;
          padding: 1.5rem;
          border-radius: 0.75rem;
        }
        .totals-grid {
          display: flex;
          justify-content: flex-end;
          gap: 3rem;
        }
        .total-item {
          text-align: right;
        }
        .total-item label {
          display: block;
          color: var(--text-light);
          font-size: 0.75rem;
          margin-bottom: 0.25rem;
        }
        .total-item span {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--primary);
        }
        .total-item.highlight span {
          color: var(--secondary);
          font-size: 1.5rem;
        }
        .modal-footer {
          padding: 1.5rem;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
        }
        .icon-btn {
          padding: 0.5rem;
          border-radius: 4px;
        }
        .icon-btn.danger {
          color: var(--danger);
          background: #fee2e2;
        }
        .btn-outline {
          background: transparent;
          border: 1px solid var(--border);
        }
      `}</style>
    </div>
  );
};

export default CotizacionForm;
