import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, X, Trash2, Calculator, Info, Package, DollarSign, TrendingUp,
  Upload, FileSpreadsheet, Edit2, Eye, Ship, Landmark, Save, Printer,
  Download, ChevronRight, ArrowUpRight, FileDown, Search, Filter
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateCosteoReportPDF } from '../utils/costeoPdfGenerator';

interface Item {
  sku: string; producto: string; cantidad: number | ''; valorUnitario: number | ''; valorTotal: number;
  adValoremPorcentaje: number | ''; precioVentaPEN: number | ''; descuentoPorcentaje: number | '';
  participacionPorcentual?: number; cifOculto?: number; adValoremMonto?: number; fleteUnitario?: number;
  seguroUnitario?: number; gastosOrigenUnitario?: number; gastosLocalesUnitario?: number;
  costoTotalUnitario?: number; costoTotalTotal?: number; costoTotalSoles?: number; costoUnitarioSoles?: number;
  utilidadUnitarioPEN?: number; utilidadTotalPEN?: number; margenPorcentaje?: number;
}

const Costeos = () => {
  const { user } = useAuth();
  const [costeos, setCosteos] = useState<any[]>([]);
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCosteo, setSelectedCosteo] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [canalFilter, setCanalFilter] = useState('');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getClientName = (c: any) => {
    return c.clienteNombre || c.cliente?.razonSocial || c.orden?.cotizacion?.cliente?.razonSocial || c.orden?.cotizacion?.lead?.nombre || c.orden?.cotizacion?.lead?.contacto || '';
  };

  const filteredCosteos = costeos.filter(c => {
    const query = searchTerm.toLowerCase();
    const codigoStr = (c.codigo || '').toLowerCase();
    const clientName = getClientName(c).toLowerCase();
    const blStr = (c.nroBL || c.orden?.nroBL || '').toLowerCase();
    const damStr = (c.nroDAM || c.orden?.nroDAM || '').toLowerCase();
    const refOrdenStr = c.orden ? `ord-${c.orden.correlativo}-${c.orden.anio}`.toLowerCase() : '';

    const matchesSearch = codigoStr.includes(query) ||
                          clientName.includes(query) ||
                          blStr.includes(query) ||
                          damStr.includes(query) ||
                          refOrdenStr.includes(query);

    const matchesEstado = !estadoFilter || c.estado === estadoFilter;
    const matchesCanal = !canalFilter || c.canal === canalFilter;

    return matchesSearch && matchesEstado && matchesCanal;
  });

  const sortedCosteos = useMemo(() => {
    return [...filteredCosteos].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'cliente') {
        valA = getClientName(a);
        valB = getClientName(b);
      } else if (sortField === 'costeo') {
        valA = a.codigo || '';
        valB = b.codigo || '';
      } else if (sortField === 'canal') {
        valA = a.canal || '';
        valB = b.canal || '';
      } else if (sortField === 'inversion') {
        valA = (a.costoTotalImportacion || 0) * (a.tipoCambio || 1);
        valB = (b.costoTotalImportacion || 0) * (b.tipoCambio || 1);
      } else if (sortField === 'estado') {
        valA = a.estado || '';
        valB = b.estado || '';
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredCosteos, sortField, sortDirection]);

  const formatNum = (val: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  const [formData, setFormData] = useState({
    clienteId: '', clienteNombre: '', clienteDocumento: '', ordenId: '', nroFacturaComercial: '', proveedorExtranjero: '',
    incoterm: 'FOB', moneda: 'USD', tipoCambio: 0, observaciones: '', gastosOrigen: 0, fleteInternacional: 0, seguro: 0,
    gastosLocales: 0, adValoremGlobal: 0, percepcionPorcentaje: 0, fechaEmbarque: '', fechaLlegada: '', canal: 'VERDE', modalidad: 'AEREO', nroDAM: '', estado: 'BORRADOR',
    tipoCarga: '', nroContenedor: ''
  });

  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => { fetchCosteos(); fetchOrdenes(); }, []);

  const fetchCosteos = async () => {
    try { const res = await api.get('/costeos'); setCosteos(res.data); } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchOrdenes = async () => {
    try { const res = await api.get('/ordenes'); setOrdenes(res.data); } catch (err) { console.error(err); }
  };

  const handleOrdenChange = (ordenId: string) => {
    const orden = ordenes.find(o => o.id === ordenId);
    if (orden) {
      setFormData({
        ...formData, ordenId, clienteId: orden.cotizacion.clienteId, clienteNombre: orden.cotizacion.cliente.razonSocial,
        clienteDocumento: orden.cotizacion.cliente.ruc, canal: orden.canal || 'VERDE', nroDAM: orden.nroDAM || '',
        fechaEmbarque: orden.fechaETD ? format(new Date(orden.fechaETD), 'yyyy-MM-dd') : '',
        fechaLlegada: orden.fechaETA ? format(new Date(orden.fechaETA), 'yyyy-MM-dd') : '',
        gastosOrigen: orden.incoterm === 'FOB' ? 0 : formData.gastosOrigen,
        proveedorExtranjero: orden.proveedorExtranjero || '',
        nroFacturaComercial: orden.nroFacturaComercial || '',
        tipoCarga: orden.tipoCarga || '',
        nroContenedor: orden.nroContenedor || ''
      });
    } else { setFormData({ ...formData, ordenId: '' }); }
  };

  const addItem = () => setItems([...items, { sku: '', producto: '', cantidad: 0, valorUnitario: 0, valorTotal: 0, adValoremPorcentaje: '', precioVentaPEN: 0, descuentoPorcentaje: 0 }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: keyof Item, value: any) => {
    const newItems = [...items]; const item = { ...newItems[index], [field]: value };
    if (field === 'cantidad' || field === 'valorUnitario') { item.valorTotal = (Number(item.cantidad) || 0) * (Number(item.valorUnitario) || 0); }
    newItems[index] = item; setItems(newItems);
  };

  const totals = useMemo(() => {
    const totalFC = items.reduce((sum, i) => sum + (i.valorTotal || 0), 0);
    const isFob = formData.incoterm === 'FOB';
    const gOrigen = Number(formData.gastosOrigen || 0);
    
    // Seguro: if empty or 0, default to 2% of FOB
    const seguroVal = (!formData.seguro || Number(formData.seguro) === 0) ? totalFC * 0.02 : Number(formData.seguro);
    
    const cifG = (isFob ? totalFC : totalFC + gOrigen) + Number(formData.fleteInternacional || 0) + seguroVal;
    const tc = Number(formData.tipoCambio || 1);
    
    // ADValorem Exclusivity
    const hasItemAV = items.some(i => i.adValoremPorcentaje !== '' && Number(i.adValoremPorcentaje) > 0);
    const globalAV = Number(formData.adValoremGlobal || 0);
    const useGlobalAV = globalAV > 0 && !hasItemAV;
    
    let totalAV = 0;
    const finalItems = items.map(i => {
      const part = totalFC > 0 ? i.valorTotal / totalFC : 0;
      const cifH = cifG * part;
      
      let avM = 0;
      if (useGlobalAV) {
        avM = cifH * (globalAV / 100);
      } else {
        avM = cifH * (Number(i.adValoremPorcentaje || 0) / 100);
      }
      
      totalAV += avM;
      const cTotal = i.valorTotal + (Number(formData.fleteInternacional || 0) + seguroVal + gOrigen + Number(formData.gastosLocales || 0)) * part + avM;
      const cUnit = Number(i.cantidad) > 0 ? cTotal / Number(i.cantidad) : 0;
      const valVenta = (Number(i.precioVentaPEN) * (1 - Number(i.descuentoPorcentaje) / 100)) / 1.18;
      const uUnit = valVenta - (cUnit * tc);
      return { ...i, adValoremMonto: avM, costoTotalUnitario: cUnit, costoUnitarioSoles: cUnit * tc, utilidadUnitarioPEN: uUnit, utilidadTotalPEN: uUnit * (Number(i.cantidad) || 0), margenPorcentaje: valVenta > 0 ? (uUnit / valVenta) * 100 : 0 };
    });
    
    const actualAV = useGlobalAV ? cifG * (globalAV / 100) : totalAV;
    const baseImp = cifG + actualAV;
    const igv = baseImp * 0.16; const ipm = baseImp * 0.02;
    const perc = (baseImp + igv + ipm) * (Number(formData.percepcionPorcentaje || 0) / 100);
    const cTotalImp = totalFC + gOrigen + Number(formData.fleteInternacional || 0) + seguroVal + actualAV + Number(formData.gastosLocales || 0);
    const uTotalPEN = finalItems.reduce((sum, i) => sum + (i.utilidadTotalPEN || 0), 0);
    const ingTotalPEN = finalItems.reduce((sum, i) => sum + ((Number(i.precioVentaPEN) * (1 - Number(i.descuentoPorcentaje) / 100)) / 1.18) * Number(i.cantidad), 0);
    
    return { 
      totalFC, cifG, adValoremG: actualAV, igv, ipm, perc, cTotalImp, 
      ratio: totalFC > 0 ? cTotalImp / totalFC : 0, finalItems, 
      cTotalPEN: cTotalImp * tc, uTotalPEN, margProm: ingTotalPEN > 0 ? (uTotalPEN / ingTotalPEN) * 100 : 0, 
      ingTotalPEN, seguroVal, 
      totalOperativoOriginal: Number(formData.fleteInternacional || 0) + seguroVal + Number(formData.gastosLocales || 0) + gOrigen
    };
  }, [items, formData]);

  const handleSave = async () => {
    if (items.length === 0 || !formData.tipoCambio) return alert('Complete los datos: tipo de cambio y al menos un producto');
    try {
      const seguroFinal = totals.seguroVal;
      const gOrigenFinal = formData.incoterm === 'FOB' ? 0 : Number(formData.gastosOrigen || 0);
      const mappedItems = totals.finalItems.map((item: any) => {
        const part = totals.totalFC > 0 ? (item.valorTotal || 0) / totals.totalFC : 0;
        const tc = Number(formData.tipoCambio || 1);
        return {
          ...item,
          participacionPorcentual: part * 100,
          cifOculto: totals.cifG * part,
          fleteUnitario: Number(formData.fleteInternacional || 0) * part / Math.max(Number(item.cantidad) || 1, 1),
          seguroUnitario: seguroFinal * part / Math.max(Number(item.cantidad) || 1, 1),
          gastosOrigenUnitario: gOrigenFinal * part / Math.max(Number(item.cantidad) || 1, 1),
          gastosLocalesUnitario: Number(formData.gastosLocales || 0) * part / Math.max(Number(item.cantidad) || 1, 1),
          costoTotalSoles: (item.costoTotalUnitario || 0) * tc,
        };
      });
      const p = {
        ...formData,
        seguro: seguroFinal,
        gastosOrigen: gOrigenFinal,
        items: mappedItems,
        totalFacturaComercial: totals.totalFC,
        adValoremGlobal: totals.adValoremG,
        cifGlobal: totals.cifG,
        baseImponible: totals.cifG + totals.adValoremG,
        igv: totals.igv,
        ipm: totals.ipm,
        percepcionMonto: totals.perc,
        costoTotalImportacion: totals.cTotalImp,
        ratioImportacion: totals.ratio
      };
      if (isEditing) await api.put(`/costeos/${selectedCosteo.id}`, p);
      else await api.post('/costeos', p);
      setShowModal(false); fetchCosteos(); resetForm();
    } catch (err: any) {
      console.error(err);
      alert('Error al guardar: ' + (err.response?.data?.message || err.message || 'Error desconocido'));
    }
  };

  const resetForm = () => { setFormData({ clienteId: '', clienteNombre: '', clienteDocumento: '', ordenId: '', nroFacturaComercial: '', proveedorExtranjero: '', incoterm: 'FOB', moneda: 'USD', tipoCambio: 0, observaciones: '', gastosOrigen: 0, fleteInternacional: 0, seguro: 0, gastosLocales: 0, adValoremGlobal: 0, percepcionPorcentaje: 0, fechaEmbarque: '', fechaLlegada: '', canal: 'VERDE', modalidad: 'AEREO', nroDAM: '', estado: 'BORRADOR', tipoCarga: '', nroContenedor: '' }); setItems([]); setIsViewing(false); setIsEditing(false); setSelectedCosteo(null); };

  const handleCambiarEstado = async (id: string, nuevoEstado: string) => {
    try {
      await api.patch(`/costeos/${id}/estado`, { estado: nuevoEstado });
      fetchCosteos();
      if (selectedCosteo?.id === id) setSelectedCosteo({ ...selectedCosteo, estado: nuevoEstado });
    } catch (err) { alert('Error al cambiar estado'); }
  };

  const viewCosteo = (c: any) => { setSelectedCosteo(c); setIsViewing(true); setShowModal(true); setItems(c.items || []); setFormData({ ...formData, ...c, fechaEmbarque: c.fechaEmbarque ? format(new Date(c.fechaEmbarque), 'yyyy-MM-dd') : '', fechaLlegada: c.fechaLlegada ? format(new Date(c.fechaLlegada), 'yyyy-MM-dd') : '' }); };
  const editCosteo = (c: any) => { setSelectedCosteo(c); setIsEditing(true); setShowModal(true); setItems(c.items || []); setFormData({ ...formData, ...c, fechaEmbarque: c.fechaEmbarque ? format(new Date(c.fechaEmbarque), 'yyyy-MM-dd') : '', fechaLlegada: c.fechaLlegada ? format(new Date(c.fechaLlegada), 'yyyy-MM-dd') : '' }); };

  const handleFileUpload = (e: any) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = (evt) => {
      const b = evt.target?.result;
      const wb = XLSX.read(b, { type: 'binary' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const globalAVActive = Number(formData.adValoremGlobal) > 0;
      const ni = data.map((row: any) => ({
        sku: row.SKU || '',
        producto: row.Producto || '',
        cantidad: row.Cantidad || 0,
        valorUnitario: row['Valor Unitario'] || 0,
        valorTotal: (row.Cantidad || 0) * (row['Valor Unitario'] || 0),
        // If global AV active, ignore per-line AV from Excel
        adValoremPorcentaje: globalAVActive ? '' : (row['% AdValorem'] !== undefined && row['% AdValorem'] !== '' ? row['% AdValorem'] : ''),
        precioVentaPEN: 0,
        descuentoPorcentaje: 0
      }));
      setItems([...items, ...ni]);
    }; r.readAsBinaryString(f);
    if (e.target) e.target.value = '';
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{ SKU: 'SKU001', Producto: 'Ejemplo', Cantidad: 10, 'Valor Unitario': 100, '% AdValorem': 6 }]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Plantilla"); XLSX.writeFile(wb, "Plantilla_Costeo.xlsx");
  };

  const exportPDF = () => {
    generateCosteoReportPDF({
      ...formData,
      items: items
    });
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] p-8 font-sans">
      {/* Principal View */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-black text-[#0F172A] tracking-tight">Costeo de Importación</h1>
          <p className="text-slate-500 font-bold text-[10px] tracking-[0.3em] mt-1 uppercase opacity-60">SISTEMA ESTRATÉGICO DE ANÁLISIS DE COSTOS</p>
        </div>
        <button 
          className="bg-[#4F46E5] text-white px-10 py-4 rounded-2xl font-black shadow-2xl shadow-indigo-100 hover:scale-105 transition-all flex items-center gap-3" 
          onClick={() => { setShowModal(true); setIsViewing(false); setIsEditing(false); }}
        >
          <Plus size={24} /> NUEVO COSTEO
        </button>
      </div>

      {/* Premium Search and Filters Bar */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.5)',
        borderRadius: '20px',
        padding: '1rem',
        marginBottom: '2rem',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.05)',
        display: 'flex',
        gap: '1rem',
        alignItems: 'center',
        flexWrap: 'wrap'
      }} className="animate-fade-in">
        <div style={{
          position: 'relative',
          flex: '1 1 250px',
          display: 'flex',
          alignItems: 'center'
        }}>
          <Search size={18} style={{
            position: 'absolute',
            left: '1rem',
            color: '#94a3b8'
          }} />
          <input 
            type="text" 
            placeholder="Buscar por BL, DAM, Código, Cliente..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 1rem 0.65rem 2.75rem',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              fontSize: '0.85rem',
              outline: 'none',
              background: '#ffffff',
              color: '#1e293b',
              fontWeight: '600',
              transition: 'all 0.3s'
            }}
          />
        </div>

        <select 
          value={estadoFilter} 
          onChange={(e) => setEstadoFilter(e.target.value)}
          style={{
            padding: '0.65rem 1rem',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            background: '#ffffff',
            color: '#1e293b',
            fontSize: '0.85rem',
            fontWeight: '600',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="">Todos los Estados</option>
          <option value="BORRADOR">Borrador</option>
          <option value="TERMINADO">Terminado</option>
        </select>

        <select 
          value={canalFilter} 
          onChange={(e) => setCanalFilter(e.target.value)}
          style={{
            padding: '0.65rem 1rem',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            background: '#ffffff',
            color: '#1e293b',
            fontSize: '0.85rem',
            fontWeight: '600',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="">Todos los Canales</option>
          <option value="VERDE">Verde</option>
          <option value="AMARILLO">Naranja</option>
          <option value="ROJO">Rojo</option>
          <option value="SIN_CANAL">Sin Canal</option>
        </select>
      </div>

      <div className="card animate-fade-in">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('costeo')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Costeo {sortField === 'costeo' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('cliente')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Cliente {sortField === 'cliente' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th>Nro BL / DAM</th>
                <th onClick={() => handleSort('canal')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Canal {sortField === 'canal' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th>ETD / ETA</th>
                <th onClick={() => handleSort('estado')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Estado {sortField === 'estado' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('inversion')} style={{ cursor: 'pointer', userSelect: 'none' }} className="text-right">
                  Inversión Soles {sortField === 'inversion' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th style={{ width: '120px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedCosteos.map((c) => {
                const getCanalBadge = (canal: string) => {
                  switch (canal) {
                    case 'VERDE': return 'badge-green';
                    case 'AMARILLO': return 'badge-orange';
                    case 'ROJO': return 'badge-red';
                    case 'SIN_CANAL': return 'badge-gray';
                    default: return 'badge-gray';
                  }
                };

                return (
                  <tr key={c.id}>
                    <td>
                      <div className="order-id">
                        <strong>{c.codigo}</strong>
                        {c.orden && <small>Ref. Orden: ORD-{c.orden.correlativo}-{c.orden.anio}</small>}
                      </div>
                    </td>
                    <td>
                      <div className="order-id">
                        <strong className="text-slate-800">{c.clienteNombre || c.cliente?.razonSocial || c.orden?.cotizacion?.cliente?.razonSocial || c.orden?.cotizacion?.lead?.nombre}</strong>
                        {c.proveedorExtranjero && <small style={{ display: 'block', color: 'var(--text-light, #64748b)', fontSize: '0.7rem', marginTop: '2px' }}>Prov: {c.proveedorExtranjero}</small>}
                        {c.nroFacturaComercial && <small style={{ display: 'block', color: 'var(--text-light, #64748b)', fontSize: '0.7rem' }}>Fact: {c.nroFacturaComercial}</small>}
                      </div>
                    </td>
                    <td>
                      <div className="tracking-info">
                        <div>BL: {c.nroBL || c.orden?.nroBL || '-'}</div>
                        <div>DAM: {c.nroDAM || c.orden?.nroDAM || '-'}</div>
                        {(c.tipoCarga || c.nroContenedor || c.orden?.tipoCarga || c.orden?.nroContenedor) && (
                          <div style={{ color: 'var(--primary, #4f46e5)', fontWeight: '600', fontSize: '0.7rem', marginTop: '2px' }}>
                            {c.tipoCarga || c.orden?.tipoCarga ? `[${c.tipoCarga || c.orden?.tipoCarga}] ` : ''}{c.nroContenedor || c.orden?.nroContenedor || ''}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {c.canal && <span className={`canal-dot ${getCanalBadge(c.canal)}`}></span>}
                        <span className="text-slate-700 font-bold" style={{ fontSize: '0.75rem' }}>
                          {c.canal === 'AMARILLO' ? 'NARANJA' : (c.canal || '-')}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="dates-info">
                        <small>ETD: {c.fechaEmbarque ? new Date(c.fechaEmbarque).toLocaleDateString() : (c.orden?.fechaETD ? new Date(c.orden?.fechaETD).toLocaleDateString() : '-')}</small>
                        <small>ETA: {c.fechaLlegada ? new Date(c.fechaLlegada).toLocaleDateString() : (c.orden?.fechaETA ? new Date(c.orden?.fechaETA).toLocaleDateString() : '-')}</small>
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() => handleCambiarEstado(c.id, c.estado === 'BORRADOR' ? 'TERMINADO' : 'BORRADOR')}
                        className={`text-[10px] font-black px-4 py-1.5 rounded-full transition-all hover:scale-105 ${
                          c.estado === 'TERMINADO'
                            ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'
                            : 'bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white'
                        }`}
                      >
                        {c.estado === 'TERMINADO' ? '✓ TERMINADO' : '⏳ BORRADOR'}
                      </button>
                    </td>
                    <td className="text-right font-black text-slate-800 text-sm">
                      S/ {formatNum(c.costoTotalImportacion * (c.tipoCambio || 1))}
                    </td>
                    <td>
                      <div className="actions-cell" style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                        <button onClick={() => viewCosteo(c)} style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer' }} title="Ver">
                          <Eye size={16} className="text-[#64748b] hover:text-indigo-600" />
                        </button>
                        <button onClick={() => editCosteo(c)} style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer' }} title="Editar">
                          <Edit2 size={16} className="text-[#64748b] hover:text-emerald-600" />
                        </button>
                        <button onClick={() => generateCosteoReportPDF(c)} style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer' }} title="Exportar PDF">
                          <FileDown size={16} className="text-[#64748b] hover:text-indigo-500" />
                        </button>
                        <button onClick={() => { if (window.confirm('¿Eliminar costeo?')) api.delete(`/costeos/${c.id}`).then(fetchCosteos) }} style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer' }} title="Eliminar">
                          <Trash2 size={16} className="text-[#64748b] hover:text-rose-600" />
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
           {/* PREMIUM FLOATING MODAL REDESIGN */}
      {showModal && (
        <div className="modal-container-fixed">
          <div className="modal-inner-full">
            
            {/* Header */}
            <div className="bg-white/95 backdrop-blur-sm px-6 py-4 flex justify-between items-center shrink-0 border-b border-slate-100/80 shadow-sm z-10">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Calculator size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                    {isEditing ? 'Editar Costeo Estratégico' : isViewing ? 'Detalle de Costeo' : 'Nuevo Costeo Estratégico'}
                  </h2>
                  <p className="text-[10px] font-medium text-slate-400 tracking-wider uppercase mt-0.5">SISTEMA INTEGRADO DE IMPORTACIONES</p>
                </div>
                <button
                  onClick={() => {
                    const nuevoEstado = formData.estado === 'BORRADOR' ? 'TERMINADO' : 'BORRADOR';
                    setFormData({...formData, estado: nuevoEstado});
                    if (isEditing && selectedCosteo) handleCambiarEstado(selectedCosteo.id, nuevoEstado);
                  }}
                  className={`text-[9px] font-bold px-3 py-1 rounded-lg uppercase tracking-wider transition-all hover:scale-[1.02] cursor-pointer ${
                    formData.estado === 'TERMINADO'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50 hover:bg-emerald-100'
                      : 'bg-amber-50 text-amber-700 border border-amber-200/50 hover:bg-amber-100'
                  }`}
                  disabled={isViewing}
                >
                  {formData.estado === 'TERMINADO' ? '✓ TERMINADO' : '⏳ BORRADOR'}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={exportPDF} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-xl text-slate-700 bg-white font-semibold text-xs hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"><FileDown size={15} className="text-slate-500" /> Exportar PDF</button>
                {!isViewing && (
                  <button onClick={handleSave} className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 text-white rounded-xl font-semibold text-xs hover:bg-indigo-700 hover:shadow-md transition-all shadow-sm"><Save size={15} /> Guardar Costeo</button>
                )}
                <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all" title="Cerrar"><X size={18} /></button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-6 custom-scrollbar relative">
              <div className="max-w-[1400px] mx-auto pb-10">
                
                {/* Metrics Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { l: 'INVERSIÓN TOTAL (PEN)', v: `S/ ${formatNum(totals.cTotalPEN)}`, trend: true },
                    { l: 'VALOR FOB (USD)', v: `$ ${formatNum(totals.totalFC)}` },
                    { l: 'RATIO ROI', v: `${formatNum(totals.ratio)}x` },
                    { l: 'MARGEN PROMEDIO', v: `${formatNum(totals.margProm)}%`, emerald: true }
                  ].map((m, i) => (
                    <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100/80 shadow-sm relative group overflow-hidden hover:shadow-md transition-all">
                      <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-slate-400 group-hover:scale-110 transition-transform"><Calculator size={60} /></div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{m.l}</p>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-xl font-bold tracking-tight ${m.emerald ? 'text-emerald-600' : 'text-slate-800'}`}>{m.v}</span>
                        {m.trend && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[9px] font-medium ml-1">
                            <TrendingUp size={10} className="mr-0.5" /> 4.2%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-12 gap-6">
                  {/* LEFT COLUMN (8/12) */}
                  <div className="col-span-12 xl:col-span-8 space-y-6">
                    
                    {/* Products Grid */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 flex justify-between items-center border-b border-slate-100/60 bg-slate-50/30">
                        <div>
                          <h3 className="font-bold text-slate-800 text-sm tracking-tight">Detalle de Mercadería</h3>
                          <p className="text-[10px] text-slate-400 font-medium">Gestión de productos y valores de importación</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={downloadTemplate} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg text-[9px] font-semibold uppercase tracking-wider transition-all"><Download size={11} /> Plantilla</button>
                          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-lg text-[9px] font-semibold uppercase tracking-wider transition-all"><Upload size={11} /> Importar</button>
                          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
                          <button onClick={addItem} className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-semibold text-[9px] uppercase tracking-wider transition-all ml-2"><Plus size={16} /> Agregar Producto</button>
                        </div>
                      </div>
                      <div className="p-0 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-[#F8FAFC] text-slate-400 font-bold uppercase text-[9px] border-b border-slate-100 tracking-wider">
                            <tr>
                              <th className="px-3 py-2.5 text-left w-24">SKU</th>
                              <th className="px-4 py-2.5 text-left">DESCRIPCIÓN</th>
                              <th className="px-3 py-2.5 text-center w-16">CANT.</th>
                              <th className="px-4 py-2.5 text-right w-32">PRECIO ({formData.moneda})</th>
                              <th className="px-3 py-2.5 text-center w-24">ADVALOREM (%)</th>
                              <th className="px-4 py-2.5 text-right w-32">TOTAL ({formData.moneda})</th>
                              <th className="px-3 py-2.5 text-center w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {items.map((it, idx) => {
                              const calc = totals.finalItems[idx];
                              const isGlobalAVActive = Number(formData.adValoremGlobal) > 0;
                              return (
                                <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                                  <td className="px-3 py-2">
                                    <input 
                                      type="text" 
                                      value={it.sku} 
                                      onChange={(e) => updateItem(idx, 'sku', e.target.value)} 
                                      className="w-full px-2 py-1 text-xs font-semibold bg-slate-50/50 border border-slate-200/55 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all" 
                                      placeholder="SKU" 
                                      disabled={isViewing} 
                                    />
                                  </td>
                                  <td className="px-4 py-2">
                                    <input 
                                      type="text" 
                                      value={it.producto} 
                                      onChange={(e) => updateItem(idx, 'producto', e.target.value)} 
                                      className="w-full px-2 py-1 text-xs font-semibold bg-slate-50/50 border border-slate-200/55 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all" 
                                      placeholder="Descripción..." 
                                      disabled={isViewing} 
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <input 
                                      type="number" 
                                      value={it.cantidad || ''} 
                                      onChange={(e) => updateItem(idx, 'cantidad', parseFloat(e.target.value) || 0)} 
                                      className="w-16 px-2 py-1 text-xs font-semibold bg-slate-50/50 border border-slate-200/55 rounded-lg text-slate-800 text-center focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all" 
                                      disabled={isViewing} 
                                    />
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <span className="text-slate-400 font-bold">{formData.moneda === 'EUR' ? '€' : '$'}</span>
                                      <input 
                                        type="number" 
                                        value={it.valorUnitario || ''} 
                                        onChange={(e) => updateItem(idx, 'valorUnitario', parseFloat(e.target.value) || 0)} 
                                        className="w-24 px-2 py-1 text-xs font-semibold bg-slate-50/50 border border-slate-200/55 rounded-lg text-slate-800 text-right focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all" 
                                        disabled={isViewing} 
                                      />
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <input 
                                      type="number" 
                                      value={it.adValoremPorcentaje ?? ''} 
                                      onChange={(e) => updateItem(idx, 'adValoremPorcentaje', e.target.value === '' ? '' : parseFloat(e.target.value))} 
                                      className={`w-16 px-2 py-1 text-xs font-semibold rounded-lg text-center border outline-none transition-all focus:bg-white focus:ring-1 focus:ring-indigo-500/20 ${
                                        isGlobalAVActive 
                                          ? 'bg-slate-100 text-slate-400 border-slate-200' 
                                          : 'bg-indigo-50/50 text-indigo-700 border-indigo-200/50 focus:border-indigo-500'
                                      }`} 
                                      placeholder={isGlobalAVActive ? 'GLB' : '0'}
                                      disabled={isViewing || isGlobalAVActive} 
                                    />
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    <div className="py-1">
                                      <span className="text-[9px] text-slate-400 uppercase tracking-wider mr-1">{formData.moneda === 'EUR' ? '€' : '$'}</span>
                                      <span className="font-bold text-slate-700">{formatNum(Number(it.valorTotal) || 0)}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    {!isViewing && (
                                      <button onClick={() => removeItem(idx)} className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Taxes Section */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-100/60 bg-slate-50/30 flex justify-between items-center">
                        <div>
                          <h3 className="font-bold text-slate-800 text-sm tracking-tight">Tributos Aduaneros</h3>
                          <p className="text-[10px] text-slate-400 font-medium">Configuración de gravámenes arancelarios e impuestos</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Percepción (%)</p>
                            <input 
                              type="number" 
                              value={formData.percepcionPorcentaje || ''} 
                              onChange={(e) => setFormData({...formData, percepcionPorcentaje: parseFloat(e.target.value) || 0})} 
                              className="bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2 py-1 font-bold w-14 text-xs text-center focus:bg-white focus:border-indigo-500 outline-none transition-all" 
                              placeholder="0.0"
                              disabled={isViewing}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ADValorem Global (%)</p>
                            <input 
                              type="number" 
                              value={formData.adValoremGlobal || ''} 
                              onChange={(e) => setFormData({...formData, adValoremGlobal: parseFloat(e.target.value) || 0})} 
                              className="bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2 py-1 font-bold w-16 text-xs text-center focus:bg-white focus:border-indigo-500 outline-none transition-all" 
                              placeholder="0.0"
                              disabled={isViewing}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div className="space-y-3.5">
                          {[
                            { l: `Ad Valorem (${(Number(formData.adValoremGlobal) > 0 || !items.some(i => Number(i.adValoremPorcentaje) > 0)) ? (formData.adValoremGlobal || 0) : 'Variable'}%)`, v: totals.adValoremG },
                            { l: 'IGV (16%)', v: totals.igv },
                            { l: 'IPM (2%)', v: totals.ipm },
                            { l: `Percepción (${formData.percepcionPorcentaje || 0}%)`, v: totals.perc }
                          ].map((t, i) => (
                            <div key={i} className="flex justify-between items-center font-semibold text-slate-600 text-xs">
                              <span className="opacity-75">{t.l}</span>
                              <span className="text-slate-800 font-bold">S/ {formatNum(t.v * Number(formData.tipoCambio || 1))}</span>
                            </div>
                          ))}
                        </div>
                        <div className="bg-[#F8FAFC] border border-slate-200/50 p-6 rounded-2xl text-center relative overflow-hidden group">
                          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent"></div>
                          <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider mb-1.5 relative z-10">TOTAL IMPUESTOS</p>
                          <p className="text-3xl font-extrabold text-slate-900 tracking-tight relative z-10 leading-none">
                            S/ {formatNum((totals.adValoremG + totals.igv + totals.ipm + totals.perc) * (formData.tipoCambio || 1))}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Distribución de Costos y Proyección de Ventas */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-100/60 bg-slate-50/30">
                        <h3 className="font-bold text-slate-800 text-sm tracking-tight">Distribución de Costos y Proyección de Ventas</h3>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">Análisis de rentabilidad por producto y costos unitarios nacionalizados</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-[#F8FAFC] text-slate-400 font-bold uppercase text-[9px] border-b border-slate-100 tracking-wider">
                            <tr>
                              <th className="px-4 py-2.5 text-left whitespace-nowrap">PRODUCTO</th>
                              <th className="px-3 py-2.5 text-center whitespace-nowrap">CANT.</th>
                              <th className="px-3 py-2.5 text-right whitespace-nowrap">COSTO UNIT. ({formData.moneda})</th>
                              <th className="px-4 py-2.5 text-right whitespace-nowrap text-indigo-600">COSTO LOTE ({formData.moneda})</th>
                              <th className="px-3 py-2.5 text-right whitespace-nowrap">COSTO UNIT. (PEN)</th>
                              <th className="px-4 py-2.5 text-right whitespace-nowrap w-24">P. VENTA (PEN)</th>
                              <th className="px-4 py-2.5 text-right whitespace-nowrap w-20">DESC. B2B (%)</th>
                              <th className="px-3 py-2.5 text-right whitespace-nowrap">MARGEN %</th>
                              <th className="px-3 py-2.5 text-right whitespace-nowrap">UTILIDAD (PEN)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {totals.finalItems.map((item: any, idx: number) => {
                              const tc = Number(formData.tipoCambio || 1);
                              const costoUnitUSD = item.costoTotalUnitario || 0;
                              const costoLoteUSD = costoUnitUSD * (Number(item.cantidad) || 0);
                              const costoUnitPEN = costoUnitUSD * tc;
                              
                              const precioVenta = Number(item.precioVentaPEN) || 0;
                              const descPct = Number(item.descuentoPorcentaje) || 0;
                              const precioSinIGV = precioVenta / 1.18;
                              const descMonto = precioSinIGV * (descPct / 100);
                              const utilidadUnit = precioSinIGV - descMonto - costoUnitPEN;
                              const utilidadTotal = utilidadUnit * (Number(item.cantidad) || 0);
                              const margen = (precioSinIGV - descMonto) > 0 ? (utilidadUnit / (precioSinIGV - descMonto)) * 100 : 0;
                              const isPositive = utilidadUnit >= 0;
                              
                              return (
                                <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                                  <td className="px-4 py-2.5">
                                    <p className="font-semibold text-slate-800 text-xs leading-tight">{item.producto || '-'}</p>
                                    {item.sku && <p className="text-[9px] font-bold text-slate-400 mt-0.5">{item.sku}</p>}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <span className="font-bold text-slate-600">{item.cantidad}</span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    <span className="font-bold text-slate-700">{formData.moneda === 'EUR' ? '€' : '$'}{formatNum(costoUnitUSD)}</span>
                                  </td>
                                  <td className="px-4 py-2.5 text-right">
                                    <span className="font-bold text-indigo-600">{formData.moneda === 'EUR' ? '€' : '$'}{formatNum(costoLoteUSD)}</span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    <span className="font-bold text-slate-700">S/{formatNum(costoUnitPEN)}</span>
                                  </td>
                                  <td className="px-4 py-2">
                                    <input
                                      type="number"
                                      value={item.precioVentaPEN || ''}
                                      onChange={(e) => updateItem(idx, 'precioVentaPEN', parseFloat(e.target.value) || 0)}
                                      className="w-full bg-slate-50 border border-slate-200/60 rounded-lg px-2 py-1 text-xs font-semibold text-right focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                      placeholder="0"
                                      disabled={isViewing}
                                    />
                                  </td>
                                  <td className="px-4 py-2">
                                    <input
                                      type="number"
                                      value={item.descuentoPorcentaje || ''}
                                      onChange={(e) => updateItem(idx, 'descuentoPorcentaje', parseFloat(e.target.value) || 0)}
                                      className="w-full bg-slate-50 border border-slate-200/60 rounded-lg px-2 py-1 text-xs font-semibold text-right focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                      placeholder="0.0"
                                      disabled={isViewing}
                                    />
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    <span className={`font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-500'}`}>
                                      {formatNum(margen)}%
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    <div className="flex flex-col items-end">
                                      <span className={`font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-500'}`}>
                                        S/{formatNum(utilidadTotal)}
                                      </span>
                                      <span className="text-[8px] text-slate-400 mt-0.5">S/{formatNum(utilidadUnit)} u.</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {totals.finalItems.length > 0 && (
                            <tfoot className="bg-slate-50/80 border-t border-slate-200 font-semibold text-slate-700 text-xs">
                              <tr>
                                <td colSpan={3} className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">TOTALES</td>
                                <td className="px-4 py-2.5 text-right font-bold text-indigo-600">
                                  {formData.moneda === 'EUR' ? '€' : '$'}{formatNum(totals.finalItems.reduce((s: number, i: any) => s + (i.costoTotalUnitario || 0) * (Number(i.cantidad) || 0), 0))}
                                </td>
                                <td colSpan={4} className="px-3 py-2.5"></td>
                                <td className="px-3 py-2.5 text-right font-bold text-emerald-600">
                                  S/{formatNum(totals.finalItems.reduce((s: number, i: any) => {
                                    const tc2 = Number(formData.tipoCambio || 1);
                                    const costoU = (i.costoTotalUnitario || 0) * tc2;
                                    const pvSinIGV = (Number(i.precioVentaPEN) || 0) / 1.18;
                                    const dsc = pvSinIGV * ((Number(i.descuentoPorcentaje) || 0) / 100);
                                    return s + (pvSinIGV - dsc - costoU) * (Number(i.cantidad) || 0);
                                  }, 0))}
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN (4/12) */}
                  <div className="col-span-12 xl:col-span-4 space-y-6">
                    
                    {/* Operation Info */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <Info size={16} className="text-indigo-500" /> Información de Operación
                      </h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">ORDEN DE IMPORTACIÓN (OPC)</p>
                            <select 
                              value={formData.ordenId} 
                              onChange={(e) => handleOrdenChange(e.target.value)} 
                              className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" 
                              disabled={isViewing}
                            >
                              <option value="">-- NINGUNA --</option>
                              {ordenes.map(o => (
                                <option key={o.id} value={o.id}>{o.correlativo}-{o.anio} | {o.cotizacion.cliente.razonSocial}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">CLIENTE</p>
                            <input 
                              type="text" 
                              value={formData.clienteNombre} 
                              onChange={(e) => setFormData({...formData, clienteNombre: e.target.value.toUpperCase()})} 
                              className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all uppercase" 
                              placeholder="Nombre..." 
                              disabled={isViewing} 
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">MONEDA</p>
                            <select 
                              value={formData.moneda} 
                              onChange={(e) => setFormData({...formData, moneda: e.target.value})} 
                              className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" 
                              disabled={isViewing}
                            >
                              <option value="USD">USD - DÓLARES</option>
                              <option value="EUR">EUR - EUROS</option>
                            </select>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">TIPO DE CAMBIO</p>
                            <div className="flex items-center gap-1.5 bg-slate-50/50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                              <span className="text-indigo-500 font-bold text-xs">S/</span>
                              <input 
                                type="number" 
                                step="0.001" 
                                value={formData.tipoCambio || ''} 
                                onChange={(e) => setFormData({...formData, tipoCambio: parseFloat(e.target.value) || 0})} 
                                className="bg-transparent border-0 font-bold text-slate-800 text-xs p-0 focus:ring-0 w-full outline-none" 
                                disabled={isViewing} 
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">INCOTERM</p>
                            <select 
                              value={formData.incoterm} 
                              onChange={(e) => setFormData({...formData, incoterm: e.target.value})} 
                              className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-indigo-600 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" 
                              disabled={isViewing}
                            >
                              <option value="FOB">FOB</option>
                              <option value="EXW">EXW</option>
                              <option value="FCA">FCA</option>
                            </select>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">MODALIDAD</p>
                            <select 
                              value={formData.modalidad} 
                              onChange={(e) => setFormData({...formData, modalidad: e.target.value})} 
                              className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all uppercase" 
                              disabled={isViewing}
                            >
                              <option value="AEREO">AÉREO</option>
                              <option value="MARITIMO">MARÍTIMO</option>
                              <option value="MULTIMODAL">MULTIMODAL</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">CANAL ADUANA</p>
                          <div className="flex items-center gap-3">
                            <select 
                              value={formData.canal} 
                              onChange={(e) => setFormData({...formData, canal: e.target.value})} 
                              className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" 
                              disabled={isViewing}
                            >
                              <option value="VERDE">VERDE</option>
                              <option value="AMARILLO">NARANJA</option>
                              <option value="ROJO">ROJO</option>
                              <option value="SIN_CANAL">SIN CANAL</option>
                            </select>
                            <span className={`w-6 h-6 rounded-full shrink-0 border border-slate-200/50 shadow-sm ${
                              formData.canal === 'VERDE' ? 'bg-emerald-500 shadow-emerald-100' : 
                              formData.canal === 'AMARILLO' ? 'bg-orange-500 shadow-orange-100' : 
                              formData.canal === 'ROJO' ? 'bg-rose-500 shadow-rose-100' : 
                              'bg-slate-200 shadow-slate-50'
                            }`}></span>
                          </div>
                        </div>

                        {/* Dates row */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">FECHA DE SALIDA</p>
                            <input 
                              type="date" 
                              value={formData.fechaEmbarque} 
                              onChange={(e) => setFormData({...formData, fechaEmbarque: e.target.value})} 
                              className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" 
                              disabled={isViewing} 
                            />
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">FECHA DE LLEGADA</p>
                            <input 
                              type="date" 
                              value={formData.fechaLlegada} 
                              onChange={(e) => setFormData({...formData, fechaLlegada: e.target.value})} 
                              className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" 
                              disabled={isViewing} 
                            />
                          </div>
                        </div>

                        {/* Proveedor / Invoice */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">PROVEEDOR</p>
                            <input 
                              type="text" 
                              value={formData.proveedorExtranjero} 
                              onChange={(e) => setFormData({...formData, proveedorExtranjero: e.target.value})} 
                              className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all uppercase" 
                              placeholder="Nombre..." 
                              disabled={isViewing} 
                            />
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">INVOICE / FACTURA</p>
                            <input 
                              type="text" 
                              value={formData.nroFacturaComercial} 
                              onChange={(e) => setFormData({...formData, nroFacturaComercial: e.target.value})} 
                              className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" 
                              placeholder="Nro..." 
                              disabled={isViewing} 
                            />
                          </div>
                        </div>

                        {/* NRO DAM / Observaciones */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">NRO. DAM</p>
                            <input 
                              type="text" 
                              value={formData.nroDAM} 
                              onChange={(e) => setFormData({...formData, nroDAM: e.target.value})} 
                              className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" 
                              placeholder="Nro..." 
                              disabled={isViewing} 
                            />
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">OBSERVACIONES</p>
                            <input 
                              type="text" 
                              value={formData.observaciones} 
                              onChange={(e) => setFormData({...formData, observaciones: e.target.value})} 
                              className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" 
                              placeholder="Notas..." 
                              disabled={isViewing} 
                            />
                          </div>
                        </div>

                        {/* Tipo de Carga / Nro de Contenedor */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">TIPO DE CARGA</p>
                            <select 
                              value={formData.tipoCarga} 
                              onChange={(e) => setFormData({...formData, tipoCarga: e.target.value})} 
                              className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" 
                              disabled={isViewing}
                            >
                              <option value="">SELECCIONAR...</option>
                              <option value="FCL">FCL</option>
                              <option value="LCL">LCL</option>
                            </select>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">NRO. CONTENEDOR</p>
                            <input 
                              type="text" 
                              value={formData.nroContenedor || ''} 
                              onChange={(e) => setFormData({...formData, nroContenedor: e.target.value})} 
                              className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" 
                              placeholder="Nro..." 
                              disabled={isViewing} 
                            />
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Logistics Card */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-6">LOGÍSTICA OPERATIVA</h3>
                      <div className="space-y-4">
                        {[
                          { l: 'Gastos de Origen', f: 'gastosOrigen', fobLocked: true },
                          { l: 'Flete Internacional', f: 'fleteInternacional' },
                          { l: 'Seguro (Auto: 2%)', f: 'seguro', placeholder: `${formatNum(totals.seguroVal)}` },
                          { l: 'Gastos Locales', f: 'gastosLocales' }
                        ].map((lo, i) => {
                          const isFobLocked = lo.fobLocked && formData.incoterm === 'FOB';
                          return (
                          <div key={i} className="flex justify-between items-center text-xs font-semibold text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <span className={`${isFobLocked ? 'opacity-40' : ''}`}>{lo.l}</span>
                              {isFobLocked && <span className="text-[8px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.25 rounded-md uppercase">FOB</span>}
                            </div>
                            <div className="flex items-center gap-1.5 font-bold text-slate-700">
                              <span className={`text-[10px] ${isFobLocked ? 'text-slate-350' : 'text-slate-400'}`}>{formData.moneda === 'EUR' ? '€' : '$'}</span>
                              <input 
                                type="number" 
                                value={isFobLocked ? '' : ((formData as any)[lo.f] || '')} 
                                onChange={(e) => setFormData({...formData, [lo.f]: e.target.value === '' ? 0 : parseFloat(e.target.value)})} 
                                className={`rounded-lg px-2 py-1 text-right w-20 text-xs border focus:outline-none transition-all ${
                                  isFobLocked 
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                                    : 'bg-slate-50/50 border-slate-200/60 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                                }`} 
                                placeholder={isFobLocked ? 'N/A' : lo.placeholder}
                                disabled={isViewing || isFobLocked} 
                              />
                            </div>
                          </div>
                          );
                        })}
                        <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                          <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">Total Operativos</span>
                          <span className="font-bold text-slate-800 text-lg">
                            {formData.moneda === 'EUR' ? '€' : '$'} {formatNum(totals.totalOperativoOriginal)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Rentabilidad ESTIMADA - DEEP GRADIENT CARD */}
                    <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 p-6 rounded-2xl shadow-xl border border-slate-800/80 text-white relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-slate-400 group-hover:scale-125 transition-all duration-1000"><TrendingUp size={100} /></div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6 relative z-10">RENTABILIDAD ESTIMADA</p>
                      <div className="mb-8 relative z-10">
                        <p className="text-[10px] font-bold text-indigo-300 mb-1.5 uppercase tracking-wider">Ingreso de Venta Objetivo (PEN)</p>
                        <p className="text-3xl font-extrabold tracking-tight leading-none">S/ {formatNum(totals.ingTotalPEN)}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-5 border-t border-white/5 relative z-10">
                        <div>
                          <p className="text-[9px] font-bold text-slate-500 uppercase mb-1 tracking-wider">UTILIDAD NETA</p>
                          <p className="text-lg font-bold text-emerald-400 leading-none">S/ {formatNum(totals.uTotalPEN)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-500 uppercase mb-1 tracking-wider">MARGEN PROMEDIO</p>
                          <p className="text-lg font-bold text-indigo-300 leading-none">{formatNum(totals.margProm)}%</p>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .modal-container-fixed {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          background: rgba(15, 23, 42, 0.65) !important;
          backdrop-filter: blur(12px) !important;
          z-index: 10000 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .modal-inner-full {
          width: 95vw !important;
          max-width: 1460px !important;
          height: 90vh !important;
          display: flex !important;
          flex-direction: column !important;
          background: #F8FAFC !important;
          position: relative !important;
          border-radius: 1.5rem !important;
          border: 1px solid rgba(226, 232, 240, 0.8) !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
          overflow: hidden !important;
          animation: modal-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        @keyframes modal-slide-up {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        .order-id strong { color: var(--primary, #4f46e5); display: block; }
        .order-id small { color: var(--text-light, #64748b); font-size: 0.7rem; }
        .tracking-info div { font-size: 0.75rem; }
        .dates-info { display: flex; flex-direction: column; }
        .dates-info small { font-size: 0.7rem; color: var(--text-light, #64748b); }
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
      `}</style>
    </div>
  );
};

export default Costeos;
