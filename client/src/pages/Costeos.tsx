import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, X, Trash2, Calculator, Info, Package, DollarSign, TrendingUp,
  Upload, FileSpreadsheet, Edit2, Eye, Ship, Landmark, Save, Printer,
  Download, ChevronRight, ArrowUpRight, FileDown
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    const doc = new jsPDF(); doc.text("COSTEO DE IMPORTACIÓN", 15, 15);
    autoTable(doc, { startY: 25, head: [['SKU', 'Producto', 'Cant', 'Costo PEN']], body: (isViewing ? items : totals.finalItems).map((i: any) => [i.sku, i.producto, i.cantidad, formatNum(i.costoUnitarioSoles)]) });
    doc.save("Costeo.pdf");
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
        {costeos.map((c) => (
          <div key={c.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
            <div className="flex justify-between items-start mb-6">
              <span className="text-[10px] font-black bg-slate-50 text-slate-400 px-4 py-1.5 rounded-full uppercase tracking-widest">{c.codigo}</span>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => viewCosteo(c)} className="p-2 text-slate-300 hover:text-indigo-600"><Eye size={18} /></button>
                <button onClick={() => editCosteo(c)} className="p-2 text-slate-300 hover:text-emerald-600"><Edit2 size={18} /></button>
                <button onClick={() => { if(window.confirm('Eliminar?')) api.delete(`/costeos/${c.id}`).then(fetchCosteos) }} className="p-2 text-slate-300 hover:text-rose-600"><Trash2 size={18} /></button>
              </div>
            </div>
            <h3 className="font-black text-slate-800 mb-4 truncate text-base uppercase tracking-tight">{c.clienteNombre || c.cliente?.razonSocial}</h3>
            <div className="mb-4">
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
            </div>
            <div className="pt-4 border-t border-slate-50 flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Inversión Soles</p>
                <p className="text-2xl font-black text-[#0F172A] leading-none">S/ {formatNum(c.costoTotalImportacion * (c.tipoCambio || 1))}</p>
              </div>
              <div className={`text-[10px] font-black px-4 py-1.5 rounded-full ${
                c.canal === 'VERDE' ? 'bg-emerald-50 text-emerald-600' :
                c.canal === 'AMARILLO' ? 'bg-orange-50 text-orange-600' :
                c.canal === 'ROJO' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'
              }`}>{c.canal === 'AMARILLO' ? 'NARANJA' : (c.canal || 'S/C')}</div>
            </div>
          </div>
        ))}
      </div>

      {/* FULL SCREEN MODAL - REDESIGNED FOR MAX ROBUSTNESS */}
      {showModal && (
        <div className="modal-container-fixed">
          <div className="modal-inner-full">
            
            {/* Header */}
            <div className="bg-white px-10 py-6 flex justify-between items-center shrink-0 border-b border-slate-100 shadow-sm z-10">
              <div className="flex items-center gap-8">
                <h2 className="text-3xl font-black text-[#1E293B] tracking-tighter">{isEditing ? 'EDITAR COSTEO' : isViewing ? 'DETALLE COSTEO' : 'NUEVO COSTEO ESTRATÉGICO'}</h2>
                <button
                  onClick={() => {
                    const nuevoEstado = formData.estado === 'BORRADOR' ? 'TERMINADO' : 'BORRADOR';
                    setFormData({...formData, estado: nuevoEstado});
                    if (isEditing && selectedCosteo) handleCambiarEstado(selectedCosteo.id, nuevoEstado);
                  }}
                  className={`text-[11px] font-black px-5 py-1.5 rounded-full uppercase tracking-widest transition-all hover:scale-105 ${
                    formData.estado === 'TERMINADO'
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-700 hover:text-white'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-700 hover:text-white'
                  }`}
                  disabled={isViewing}
                >
                  {formData.estado === 'TERMINADO' ? '✓ TERMINADO' : '⏳ BORRADOR'}
                </button>
              </div>
              <div className="flex items-center gap-5">
                <button onClick={exportPDF} className="flex items-center gap-2 px-6 py-3.5 border-2 border-slate-100 rounded-2xl text-[#4F46E5] font-black text-xs hover:bg-slate-50 transition-all uppercase tracking-[0.2em]"><FileDown size={18} /> PDF</button>
                {!isViewing && (
                  <button onClick={handleSave} className="flex items-center gap-3 px-10 py-4 bg-[#0F172A] text-white rounded-2xl font-black text-xs hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200 uppercase tracking-[0.2em]"><Save size={20} /> Guardar Costeo</button>
                )}
                <button onClick={() => { setShowModal(false); resetForm(); }} className="ml-6 p-2 text-slate-300 hover:text-rose-600 transition-all"><X size={40} /></button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-10 custom-scrollbar relative">
              <div className="max-w-[1500px] mx-auto pb-20">
                
                {/* Metrics Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                  {[
                    { l: 'TOTAL INVESTMENT (PEN)', v: `S/ ${formatNum(totals.cTotalPEN)}`, trend: true },
                    { l: 'FOB VALUE (USD)', v: `$ ${formatNum(totals.totalFC)}` },
                    { l: 'ROI RATIO', v: `${formatNum(totals.ratio)}x` },
                    { l: 'MARGEN PROMEDIO', v: `${formatNum(totals.margProm)}%`, emerald: true }
                  ].map((m, i) => (
                    <div key={i} className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm relative group overflow-hidden">
                      <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:scale-110 transition-transform"><Calculator size={100} /></div>
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mb-4">{m.l}</p>
                      <div className="flex items-baseline gap-4">
                        <span className={`text-4xl font-black tracking-tighter ${m.emerald ? 'text-emerald-500' : 'text-[#0F172A]'}`}>{m.v}</span>
                        {m.trend && <span className="text-emerald-500 text-[11px] font-black flex items-center mb-1"><TrendingUp size={14} className="mr-1" /> 4.2%</span>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-12 gap-10">
                  {/* LEFT COLUMN (8/12) */}
                  <div className="col-span-12 xl:col-span-8 space-y-12">
                    
                    {/* Products Grid */}
                    <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-10 py-10 flex justify-between items-center border-b border-slate-50 bg-slate-50/20">
                        <h3 className="font-black text-[#1E293B] text-2xl tracking-tight">Detalle de Mercadería</h3>
                        <div className="flex items-center gap-4">
                          <button onClick={downloadTemplate} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all"><Download size={14} /> Plantilla</button>
                          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"><Upload size={14} /> Importar</button>
                          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
                          <button onClick={addItem} className="flex items-center gap-2 text-[#4F46E5] font-black text-[11px] uppercase tracking-[0.25em] ml-6 hover:scale-110 transition-all"><Plus size={22} /> Agregar Producto</button>
                        </div>
                      </div>
                      <div className="p-0">
                        <table className="w-full text-sm">
                          <thead className="bg-[#F8FAFC] text-slate-400 font-black uppercase text-[11px] border-b border-slate-100">
                            <tr>
                              <th className="px-4 py-6 text-left">SKU</th>
                              <th className="px-10 py-6 text-left">DESCRIPTION</th>
                              <th className="px-6 py-6 text-center">QTY</th>
                              <th className="px-6 py-6 text-right">PRICE ({formData.moneda})</th>
                              <th className="px-6 py-6 text-center">ADVALOREM (%)</th>
                              <th className="px-6 py-6 text-right">TOTAL ({formData.moneda})</th>
                              <th className="px-4 py-6 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {items.map((it, idx) => {
                              const calc = totals.finalItems[idx];
                              const isGlobalAVActive = Number(formData.adValoremGlobal) > 0;
                              return (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-4 py-7"><input type="text" value={it.sku} onChange={(e) => updateItem(idx, 'sku', e.target.value)} className="bg-transparent border-0 font-bold w-20 text-[#1E293B] focus:ring-0" placeholder="SKU" disabled={isViewing} /></td>
                                  <td className="px-6 py-7"><input type="text" value={it.producto} onChange={(e) => updateItem(idx, 'producto', e.target.value)} className="bg-transparent border-0 font-black text-slate-700 w-full focus:ring-0" placeholder="Descripción del producto..." disabled={isViewing} /></td>
                                  <td className="px-6 py-7 text-center"><input type="number" value={it.cantidad || ''} onChange={(e) => updateItem(idx, 'cantidad', parseFloat(e.target.value) || 0)} className="bg-slate-50/50 rounded-lg px-2 py-1 border-0 font-black text-[#0F172A] w-16 text-center" disabled={isViewing} /></td>
                                  <td className="px-6 py-7 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <span className="text-slate-400 font-black">{formData.moneda === 'EUR' ? '€' : '$'}</span>
                                      <input type="number" value={it.valorUnitario || ''} onChange={(e) => updateItem(idx, 'valorUnitario', parseFloat(e.target.value) || 0)} className="bg-slate-50/50 rounded-lg px-2 py-1 border-0 font-black text-[#0F172A] w-24 text-right" disabled={isViewing} />
                                    </div>
                                  </td>
                                  <td className="px-6 py-7 text-center">
                                    <input 
                                      type="number" 
                                      value={it.adValoremPorcentaje ?? ''} 
                                      onChange={(e) => updateItem(idx, 'adValoremPorcentaje', e.target.value === '' ? '' : parseFloat(e.target.value))} 
                                      className={`rounded-lg px-2 py-1 border-0 font-black w-16 text-center ${isGlobalAVActive ? 'bg-slate-100 text-slate-300' : 'bg-indigo-50 text-indigo-600'}`} 
                                      placeholder={isGlobalAVActive ? 'GLOBAL' : '0'}
                                      disabled={isViewing || isGlobalAVActive} 
                                    />
                                  </td>
                                  <td className="px-6 py-7 text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formData.moneda === 'EUR' ? '€' : '$'}</p>
                                    <p className="font-black text-[#1E293B] text-base leading-tight tracking-tight">{formatNum(Number(it.valorTotal) || 0)}</p>
                                  </td>
                                  <td className="px-4 py-7 text-center">
                                    {!isViewing && (
                                      <button onClick={() => removeItem(idx)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                                        <Trash2 size={16} />
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
                    <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-10 py-8 border-b border-slate-50 bg-slate-50/20 flex justify-between items-center">
                        <h3 className="font-black text-[#1E293B] text-2xl tracking-tight">Tributos Aduaneros</h3>
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-3">
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Percepción (%)</p>
                            <input 
                              type="number" 
                              value={formData.percepcionPorcentaje || ''} 
                              onChange={(e) => setFormData({...formData, percepcionPorcentaje: parseFloat(e.target.value) || 0})} 
                              className="bg-orange-50 text-orange-600 rounded-xl px-4 py-2 border-0 font-black w-20 text-center focus:ring-2 focus:ring-orange-400" 
                              placeholder="0.00"
                              disabled={isViewing}
                            />
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">ADValorem Global (%)</p>
                            <input 
                              type="number" 
                              value={formData.adValoremGlobal || ''} 
                              onChange={(e) => setFormData({...formData, adValoremGlobal: parseFloat(e.target.value) || 0})} 
                              className="bg-indigo-50 text-indigo-600 rounded-xl px-4 py-2 border-0 font-black w-24 text-center focus:ring-2 focus:ring-indigo-500" 
                              placeholder="0.00"
                              disabled={isViewing}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="p-12 grid grid-cols-2 gap-20 items-center">
                        <div className="space-y-6">
                          {[
                            { l: `Ad Valorem (${(Number(formData.adValoremGlobal) > 0 || !items.some(i => Number(i.adValoremPorcentaje) > 0)) ? (formData.adValoremGlobal || 0) : 'Variable'}%)`, v: totals.adValoremG },
                            { l: 'IGV (16%)', v: totals.igv },
                            { l: 'IPM (2%)', v: totals.ipm },
                            { l: `Percepción (${formData.percepcionPorcentaje || 0}%)`, v: totals.perc }
                          ].map((t, i) => (
                            <div key={i} className="flex justify-between items-center font-black text-slate-500 text-base">
                              <span className="opacity-50 text-sm">{t.l}</span>
                              <span className="text-[#1E293B]">S/ {formatNum(t.v * Number(formData.tipoCambio || 1))}</span>
                            </div>
                          ))}
                        </div>
                        <div className="bg-[#F0F9FF] p-16 rounded-[4rem] text-center border-2 border-indigo-50 shadow-inner relative overflow-hidden group">
                          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent"></div>
                          <p className="text-[12px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-4 relative z-10">TOTAL IMPUESTOS</p>
                          <p className="text-6xl font-black text-[#0F172A] tracking-tighter relative z-10 leading-none">S/ {formatNum((totals.adValoremG + totals.igv + totals.ipm + totals.perc) * (formData.tipoCambio || 1))}</p>
                        </div>
                      </div>
                    </div>

                    {/* Distribución de Costos y Proyección de Ventas */}
                    <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-10 py-8 border-b border-slate-50 bg-slate-50/20">
                        <h3 className="font-black text-[#1E293B] text-2xl tracking-tight">Distribución de Costos y Proyección de Ventas</h3>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">Análisis de rentabilidad por producto</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-[#F8FAFC] text-slate-400 font-black uppercase text-[10px] border-b border-slate-100">
                            <tr>
                              <th className="px-6 py-5 text-left whitespace-nowrap">PRODUCTO</th>
                              <th className="px-6 py-5 text-center whitespace-nowrap">CANT.</th>
                              <th className="px-6 py-5 text-right whitespace-nowrap">COSTO UNIT. ({formData.moneda})</th>
                              <th className="px-6 py-5 text-right whitespace-nowrap text-indigo-500">COSTO LOTE ({formData.moneda})</th>
                              <th className="px-6 py-5 text-right whitespace-nowrap">COSTO UNIT. (PEN)</th>
                              <th className="px-6 py-5 text-right whitespace-nowrap">PRECIO VENTA (PEN)</th>
                              <th className="px-6 py-5 text-right whitespace-nowrap">DESC. B2B (%)</th>
                              <th className="px-6 py-5 text-right whitespace-nowrap">MARGEN %</th>
                              <th className="px-6 py-5 text-right whitespace-nowrap">UTILIDAD UNIT. (PEN)</th>
                              <th className="px-6 py-5 text-right whitespace-nowrap">UTILIDAD TOTAL (PEN)</th>
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
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-6 py-5">
                                    <p className="font-black text-[#1E293B] text-sm leading-tight">{item.producto || '-'}</p>
                                    {item.sku && <p className="text-[10px] font-bold text-slate-400 mt-0.5">{item.sku}</p>}
                                  </td>
                                  <td className="px-6 py-5 text-center">
                                    <span className="font-black text-slate-600">{item.cantidad}</span>
                                  </td>
                                  <td className="px-6 py-5 text-right">
                                    <span className="font-black text-slate-700">{formData.moneda === 'EUR' ? '€' : '$'}{formatNum(costoUnitUSD)}</span>
                                  </td>
                                  <td className="px-6 py-5 text-right">
                                    <span className="font-black text-indigo-600 text-base">{formData.moneda === 'EUR' ? '€' : '$'}{formatNum(costoLoteUSD)}</span>
                                  </td>
                                  <td className="px-6 py-5 text-right">
                                    <span className="font-black text-slate-700">S/{formatNum(costoUnitPEN)}</span>
                                  </td>
                                  <td className="px-6 py-5 text-right">
                                    <input
                                      type="number"
                                      value={item.precioVentaPEN || ''}
                                      onChange={(e) => updateItem(idx, 'precioVentaPEN', parseFloat(e.target.value) || 0)}
                                      className="bg-slate-50 rounded-xl px-3 py-2 border-0 font-black text-[#1E293B] w-24 text-right focus:ring-2 focus:ring-indigo-400"
                                      placeholder="0"
                                      disabled={isViewing}
                                    />
                                  </td>
                                  <td className="px-6 py-5 text-right">
                                    <input
                                      type="number"
                                      value={item.descuentoPorcentaje || ''}
                                      onChange={(e) => updateItem(idx, 'descuentoPorcentaje', parseFloat(e.target.value) || 0)}
                                      className="bg-slate-50 rounded-xl px-3 py-2 border-0 font-black text-slate-600 w-20 text-right focus:ring-2 focus:ring-slate-300"
                                      placeholder="0.0"
                                      disabled={isViewing}
                                    />
                                  </td>
                                  <td className="px-6 py-5 text-right">
                                    <span className={`font-black text-base ${isPositive ? 'text-emerald-600' : 'text-rose-500'}`}>
                                      {formatNum(margen)}%
                                    </span>
                                  </td>
                                  <td className="px-6 py-5 text-right">
                                    <span className={`font-black text-base ${isPositive ? 'text-emerald-600' : 'text-rose-500'}`}>
                                      S/{formatNum(utilidadUnit)}
                                    </span>
                                  </td>
                                  <td className="px-6 py-5 text-right">
                                    <span className={`font-black text-base ${isPositive ? 'text-emerald-600' : 'text-rose-500'}`}>
                                      S/{formatNum(utilidadTotal)}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {totals.finalItems.length > 0 && (
                            <tfoot className="bg-[#F8FAFC] border-t-2 border-slate-200">
                              <tr>
                                <td colSpan={3} className="px-6 py-5 font-black text-slate-500 uppercase text-[11px] tracking-widest">TOTALES</td>
                                <td className="px-6 py-5 text-right font-black text-indigo-700 text-base">
                                  {formData.moneda === 'EUR' ? '€' : '$'}{formatNum(totals.finalItems.reduce((s: number, i: any) => s + (i.costoTotalUnitario || 0) * (Number(i.cantidad) || 0), 0))}
                                </td>
                                <td colSpan={4} className="px-6 py-5"></td>
                                <td className="px-6 py-5 text-right font-black text-emerald-700 text-base">
                                  S/{formatNum(totals.finalItems.reduce((s: number, i: any) => {
                                    const tc2 = Number(formData.tipoCambio || 1);
                                    const costoU = (i.costoTotalUnitario || 0) * tc2;
                                    const pvSinIGV = (Number(i.precioVentaPEN) || 0) / 1.18;
                                    const dsc = pvSinIGV * ((Number(i.descuentoPorcentaje) || 0) / 100);
                                    return s + (pvSinIGV - dsc - costoU);
                                  }, 0))}
                                </td>
                                <td className="px-6 py-5 text-right font-black text-emerald-700 text-base">
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
                  <div className="col-span-12 xl:col-span-4 space-y-12">
                    
                    {/* Operation Info */}
                    <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                      <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] mb-12 flex items-center gap-3"><Info size={22} className="text-indigo-600" /> Información de Operación</h3>
                      <div className="space-y-10">
                        <div className="grid grid-cols-2 gap-10">
                          <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">ORDEN DE IMPORTACIÓN (OPCIONAL)</p>
                            <select 
                              value={formData.ordenId} 
                              onChange={(e) => handleOrdenChange(e.target.value)} 
                              className="bg-slate-50/50 rounded-xl px-4 py-3 border-0 font-black text-[#1E293B] text-lg w-full focus:ring-0" 
                              disabled={isViewing}
                            >
                              <option value="">-- NINGUNA --</option>
                              {ordenes.map(o => (
                                <option key={o.id} value={o.id}>{o.correlativo}-{o.anio} | {o.cotizacion.cliente.razonSocial}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">CLIENTE</p>
                            <input 
                              type="text" 
                              value={formData.clienteNombre} 
                              onChange={(e) => setFormData({...formData, clienteNombre: e.target.value.toUpperCase()})} 
                              className="bg-slate-50/50 rounded-xl px-4 py-3 border-0 font-black text-[#1E293B] text-lg w-full focus:ring-2 focus:ring-indigo-500 uppercase" 
                              placeholder="NOMBRE DEL CLIENTE..." 
                              disabled={isViewing} 
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-10">
                          <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">MONEDA</p>
                            <select 
                              value={formData.moneda} 
                              onChange={(e) => setFormData({...formData, moneda: e.target.value})} 
                              className="bg-slate-50/50 rounded-xl px-4 py-3 border-0 font-black text-[#1E293B] text-xl w-full focus:ring-0" 
                              disabled={isViewing}
                            >
                              <option value="USD">USD - DÓLARES</option>
                              <option value="EUR">EUR - EUROS</option>
                            </select>
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">TIPO DE CAMBIO</p>
                            <div className="flex items-center gap-2 bg-slate-50/50 rounded-xl px-4 py-3">
                              <span className="text-indigo-500 font-black text-sm">S/</span>
                              <input type="number" step="0.001" value={formData.tipoCambio || ''} onChange={(e) => setFormData({...formData, tipoCambio: parseFloat(e.target.value) || 0})} className="bg-transparent border-0 font-black text-[#1E293B] text-2xl p-0 focus:ring-0 leading-none w-full" disabled={isViewing} />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-10">
                          <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">INCOTERM</p>
                            <select 
                              value={formData.incoterm} 
                              onChange={(e) => setFormData({...formData, incoterm: e.target.value})} 
                              className="bg-slate-50/50 rounded-xl px-4 py-3 border-0 font-black text-[#4F46E5] text-xl w-full focus:ring-0" 
                              disabled={isViewing}
                            >
                              <option value="FOB">FOB</option>
                              <option value="EXW">EXW</option>
                              <option value="FCA">FCA</option>
                            </select>
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">MODALIDAD</p>
                            <select 
                              value={formData.modalidad} 
                              onChange={(e) => setFormData({...formData, modalidad: e.target.value})} 
                              className="bg-slate-50/50 rounded-xl px-4 py-3 border-0 font-black text-slate-500 text-xl w-full focus:ring-0 uppercase" 
                              disabled={isViewing}
                            >
                              <option value="AEREO">AÉREO</option>
                              <option value="MARITIMO">MARÍTIMO</option>
                              <option value="MULTIMODAL">MULTIMODAL</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">CANAL ADUANA</p>
                          <div className="flex items-center gap-4">
                            <select 
                              value={formData.canal} 
                              onChange={(e) => setFormData({...formData, canal: e.target.value})} 
                              className="bg-slate-50/50 rounded-xl px-4 py-3 border-0 font-black text-[#1E293B] text-xl w-full focus:ring-0" 
                              disabled={isViewing}
                            >
                              <option value="VERDE">VERDE</option>
                              <option value="AMARILLO">NARANJA</option>
                              <option value="ROJO">ROJO</option>
                              <option value="SIN_CANAL">SIN CANAL</option>
                            </select>
                            <span className={`w-10 h-10 rounded-full shrink-0 ${
                              formData.canal === 'VERDE' ? 'bg-emerald-500 shadow-xl shadow-emerald-200' : 
                              formData.canal === 'AMARILLO' ? 'bg-orange-500 shadow-xl shadow-orange-200' : 
                              formData.canal === 'ROJO' ? 'bg-rose-500 shadow-xl shadow-rose-200' : 
                              'bg-slate-200 shadow-xl shadow-slate-100'
                            }`}></span>
                          </div>
                        </div>

                        {/* Dates row */}
                        <div className="grid grid-cols-2 gap-10">
                          <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">FECHA DE SALIDA</p>
                            <input 
                              type="date" 
                              value={formData.fechaEmbarque} 
                              onChange={(e) => setFormData({...formData, fechaEmbarque: e.target.value})} 
                              className="bg-slate-50/50 rounded-xl px-4 py-3 border-0 font-black text-[#1E293B] w-full focus:ring-2 focus:ring-indigo-500" 
                              disabled={isViewing} 
                            />
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">FECHA DE LLEGADA</p>
                            <input 
                              type="date" 
                              value={formData.fechaLlegada} 
                              onChange={(e) => setFormData({...formData, fechaLlegada: e.target.value})} 
                              className="bg-slate-50/50 rounded-xl px-4 py-3 border-0 font-black text-[#1E293B] w-full focus:ring-2 focus:ring-indigo-500" 
                              disabled={isViewing} 
                            />
                          </div>
                        </div>

                        {/* Proveedor / Invoice */}
                        <div className="grid grid-cols-2 gap-10">
                          <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">PROVEEDOR</p>
                            <input 
                              type="text" 
                              value={formData.proveedorExtranjero} 
                              onChange={(e) => setFormData({...formData, proveedorExtranjero: e.target.value})} 
                              className="bg-slate-50/50 rounded-xl px-4 py-3 border-0 font-black text-[#1E293B] w-full focus:ring-2 focus:ring-indigo-500 uppercase" 
                              placeholder="NOMBRE DEL PROVEEDOR..." 
                              disabled={isViewing} 
                            />
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">INVOICE / FACTURA</p>
                            <input 
                              type="text" 
                              value={formData.nroFacturaComercial} 
                              onChange={(e) => setFormData({...formData, nroFacturaComercial: e.target.value})} 
                              className="bg-slate-50/50 rounded-xl px-4 py-3 border-0 font-black text-[#1E293B] w-full focus:ring-2 focus:ring-indigo-500" 
                              placeholder="NRO. INVOICE..." 
                              disabled={isViewing} 
                            />
                          </div>
                        </div>

                        {/* NRO DAM / Observaciones */}
                        <div className="grid grid-cols-2 gap-10">
                          <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">NRO. DAM</p>
                            <input 
                              type="text" 
                              value={formData.nroDAM} 
                              onChange={(e) => setFormData({...formData, nroDAM: e.target.value})} 
                              className="bg-slate-50/50 rounded-xl px-4 py-3 border-0 font-black text-[#1E293B] w-full focus:ring-2 focus:ring-indigo-500" 
                              placeholder="NRO. DAM..." 
                              disabled={isViewing} 
                            />
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">OBSERVACIONES</p>
                            <input 
                              type="text" 
                              value={formData.observaciones} 
                              onChange={(e) => setFormData({...formData, observaciones: e.target.value})} 
                              className="bg-slate-50/50 rounded-xl px-4 py-3 border-0 font-bold text-[#1E293B] w-full focus:ring-2 focus:ring-indigo-500" 
                              placeholder="Observaciones..." 
                              disabled={isViewing} 
                            />
                          </div>
                        </div>

                        {/* Tipo de Carga / Nro de Contenedor */}
                        <div className="grid grid-cols-2 gap-10">
                          <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">TIPO DE CARGA</p>
                            <select 
                              value={formData.tipoCarga} 
                              onChange={(e) => setFormData({...formData, tipoCarga: e.target.value})} 
                              className="bg-slate-50/50 rounded-xl px-4 py-3 border-0 font-black text-[#1E293B] w-full focus:ring-2 focus:ring-indigo-500" 
                              disabled={isViewing}
                            >
                              <option value="">SELECCIONAR...</option>
                              <option value="FCL">FCL</option>
                              <option value="LCL">LCL</option>
                            </select>
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">NRO. CONTENEDOR</p>
                            <input 
                              type="text" 
                              value={formData.nroContenedor || ''} 
                              onChange={(e) => setFormData({...formData, nroContenedor: e.target.value})} 
                              className="bg-slate-50/50 rounded-xl px-4 py-3 border-0 font-black text-[#1E293B] w-full focus:ring-2 focus:ring-indigo-500" 
                              placeholder="NRO. CONTENEDOR..." 
                              disabled={isViewing} 
                            />
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Logistics Card */}
                    <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                      <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] mb-12">LOGÍSTICA OPERATIVA</h3>
                      <div className="space-y-8">
                        {[
                          { l: 'Gastos de Origen', f: 'gastosOrigen', fobLocked: true },
                          { l: 'Flete Internacional', f: 'fleteInternacional' },
                          { l: 'Seguro (Auto: 2%)', f: 'seguro', placeholder: `${formatNum(totals.seguroVal)}` },
                          { l: 'Gastos Locales', f: 'gastosLocales' }
                        ].map((lo, i) => {
                          const isFobLocked = lo.fobLocked && formData.incoterm === 'FOB';
                          return (
                          <div key={i} className="flex justify-between items-center font-bold text-slate-600">
                            <div className="flex items-center gap-2">
                              <span className={`text-base ${isFobLocked ? 'opacity-40' : ''}`}>{lo.l}</span>
                              {isFobLocked && <span className="text-[9px] font-black bg-indigo-100 text-indigo-500 px-2 py-0.5 rounded-full uppercase">FOB</span>}
                            </div>
                            <div className="flex items-center gap-3 font-black text-[#1E293B]">
                              <span className={`text-sm ${isFobLocked ? 'text-slate-200' : 'text-slate-300'}`}>{formData.moneda === 'EUR' ? '€' : '$'}</span>
                              <input 
                                type="number" 
                                value={isFobLocked ? '' : ((formData as any)[lo.f] || '')} 
                                onChange={(e) => setFormData({...formData, [lo.f]: e.target.value === '' ? 0 : parseFloat(e.target.value)})} 
                                className={`rounded-lg px-2 py-1 border-0 text-right w-24 text-xl focus:ring-0 leading-none ${isFobLocked ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-slate-50/50'}`} 
                                placeholder={isFobLocked ? 'N/A (FOB)' : lo.placeholder}
                                disabled={isViewing || isFobLocked} 
                              />
                            </div>
                          </div>
                          );
                        })}
                        <div className="pt-10 border-t border-slate-50 flex justify-between items-center">
                          <span className="font-black text-[#1E293B] text-sm uppercase tracking-[0.2em] opacity-60">Total Operativos</span>
                          <span className="font-black text-[#1E293B] text-2xl tracking-tighter">
                            {formData.moneda === 'EUR' ? '€' : '$'} {formatNum(totals.totalOperativoOriginal)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Rentabilidad ESTIMADA - DARK CARD */}
                    <div className="bg-[#0F172A] p-12 rounded-[4rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] text-white relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:scale-150 transition-all duration-1000"><TrendingUp size={200} /></div>
                      <p className="text-[12px] font-black text-slate-500 uppercase tracking-[0.5em] mb-12 relative z-10">RENTABILIDAD ESTIMADA</p>
                      <div className="mb-14 relative z-10">
                        <p className="text-[13px] font-black text-indigo-400 mb-4 uppercase tracking-[0.2em]">Precio Venta Objetivo (PEN)</p>
                        <p className="text-6xl font-black tracking-tighter leading-none">S/ {formatNum(totals.ingTotalPEN)}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-12 pt-12 border-t border-white/5 relative z-10">
                        <div><p className="text-[11px] font-black text-slate-500 uppercase mb-3 tracking-widest">UTILIDAD NETA</p><p className="text-3xl font-black text-emerald-400 tracking-tighter leading-none">S/ {formatNum(totals.uTotalPEN)}</p></div>
                        <div><p className="text-[11px] font-black text-slate-500 uppercase mb-3 tracking-widest">MARGEN REAL</p><p className="text-3xl font-black text-indigo-400 tracking-tighter leading-none">{formatNum(totals.margProm)}%</p></div>
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
          background: rgba(15, 23, 42, 0.9) !important;
          backdrop-filter: blur(8px) !important;
          z-index: 10000 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .modal-inner-full {
          width: 100vw !important;
          height: 100vh !important;
          display: flex !important;
          flex-direction: column !important;
          background: #F8FAFC !important;
          position: relative !important;
          overflow: hidden !important;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

export default Costeos;
