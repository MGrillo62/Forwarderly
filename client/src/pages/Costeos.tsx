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
    gastosLocales: 0, adValoremGlobal: 0, percepcionPorcentaje: 0, fechaEmbarque: '', fechaLlegada: '', canal: '', nroDAM: ''
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
        clienteDocumento: orden.cotizacion.cliente.ruc, canal: orden.canal || '', nroDAM: orden.nroDAM || '',
        fechaEmbarque: orden.fechaETD ? format(new Date(orden.fechaETD), 'yyyy-MM-dd') : '',
        fechaLlegada: orden.fechaETA ? format(new Date(orden.fechaETA), 'yyyy-MM-dd') : '',
        gastosOrigen: orden.incoterm === 'FOB' ? 0 : formData.gastosOrigen
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
    const gOrigen = isFob ? 0 : Number(formData.gastosOrigen || 0);
    const cifG = (isFob ? totalFC : totalFC + gOrigen) + Number(formData.fleteInternacional || 0) + Number(formData.seguro || 0);
    const tc = Number(formData.tipoCambio || 1);
    const hasItemAV = items.some(i => i.adValoremPorcentaje !== '');
    let totalAV = 0;
    const finalItems = items.map(i => {
      const part = totalFC > 0 ? i.valorTotal / totalFC : 0;
      const cifH = cifG * part;
      const avM = hasItemAV ? cifH * (Number(i.adValoremPorcentaje || 0) / 100) : cifH * (Number(formData.adValoremGlobal || 0) / 100);
      totalAV += avM;
      const cTotal = i.valorTotal + (Number(formData.fleteInternacional || 0) + Number(formData.seguro || 0) + gOrigen + Number(formData.gastosLocales || 0)) * part + avM;
      const cUnit = Number(i.cantidad) > 0 ? cTotal / Number(i.cantidad) : 0;
      const valVenta = (Number(i.precioVentaPEN) * (1 - Number(i.descuentoPorcentaje) / 100)) / 1.18;
      const uUnit = valVenta - (cUnit * tc);
      return { ...i, adValoremMonto: avM, costoTotalUnitario: cUnit, costoUnitarioSoles: cUnit * tc, utilidadUnitarioPEN: uUnit, utilidadTotalPEN: uUnit * (Number(i.cantidad) || 0), margenPorcentaje: valVenta > 0 ? (uUnit / valVenta) * 100 : 0 };
    });
    const baseImp = cifG + (hasItemAV ? totalAV : cifG * (Number(formData.adValoremGlobal || 0) / 100));
    const igv = baseImp * 0.16; const ipm = baseImp * 0.02;
    const perc = (baseImp + igv + ipm) * (Number(formData.percepcionPorcentaje || 0) / 100);
    const cTotalImp = totalFC + gOrigen + Number(formData.fleteInternacional || 0) + Number(formData.seguro || 0) + (hasItemAV ? totalAV : baseImp - cifG) + Number(formData.gastosLocales || 0);
    const uTotalPEN = finalItems.reduce((sum, i) => sum + (i.utilidadTotalPEN || 0), 0);
    const ingTotalPEN = finalItems.reduce((sum, i) => sum + ((Number(i.precioVentaPEN) * (1 - Number(i.descuentoPorcentaje) / 100)) / 1.18) * Number(i.cantidad), 0);
    return { totalFC, cifG, adValoremG: hasItemAV ? totalAV : baseImp - cifG, igv, ipm, perc, cTotalImp, ratio: totalFC > 0 ? cTotalImp / totalFC : 0, finalItems, cTotalPEN: cTotalImp * tc, uTotalPEN, margProm: ingTotalPEN > 0 ? (uTotalPEN / ingTotalPEN) * 100 : 0, ingTotalPEN };
  }, [items, formData]);

  const handleSave = async () => {
    if (items.length === 0 || !formData.tipoCambio) return alert('Complete los datos');
    try {
      const p = { ...formData, items: totals.finalItems, totalFacturaComercial: totals.totalFC, adValoremGlobal: totals.adValoremG, cifGlobal: totals.cifG, baseImponible: totals.cifG + totals.adValoremG, igv: totals.igv, ipm: totals.ipm, percepcionMonto: totals.perc, costoTotalImportacion: totals.cTotalImp, ratioImportacion: totals.ratio };
      if (isEditing) await api.put(`/costeos/${selectedCosteo.id}`, p); else await api.post('/costeos', p);
      setShowModal(false); fetchCosteos(); resetForm();
    } catch (err) { alert('Error'); }
  };

  const resetForm = () => { setFormData({ clienteId: '', clienteNombre: '', clienteDocumento: '', ordenId: '', nroFacturaComercial: '', proveedorExtranjero: '', incoterm: 'FOB', moneda: 'USD', tipoCambio: 0, observaciones: '', gastosOrigen: 0, fleteInternacional: 0, seguro: 0, gastosLocales: 0, adValoremGlobal: 0, percepcionPorcentaje: 0, fechaEmbarque: '', fechaLlegada: '', canal: '', nroDAM: '' }); setItems([]); setIsViewing(false); setIsEditing(false); setSelectedCosteo(null); };

  const viewCosteo = (c: any) => { setSelectedCosteo(c); setIsViewing(true); setShowModal(true); setItems(c.items || []); setFormData({ ...formData, ...c, fechaEmbarque: c.fechaEmbarque ? format(new Date(c.fechaEmbarque), 'yyyy-MM-dd') : '', fechaLlegada: c.fechaLlegada ? format(new Date(c.fechaLlegada), 'yyyy-MM-dd') : '' }); };
  const editCosteo = (c: any) => { setSelectedCosteo(c); setIsEditing(true); setShowModal(true); setItems(c.items || []); setFormData({ ...formData, ...c, fechaEmbarque: c.fechaEmbarque ? format(new Date(c.fechaEmbarque), 'yyyy-MM-dd') : '', fechaLlegada: c.fechaLlegada ? format(new Date(c.fechaLlegada), 'yyyy-MM-dd') : '' }); };

  const handleFileUpload = (e: any) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = (evt) => {
      const b = evt.target?.result; const wb = XLSX.read(b, { type: 'binary' }); const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const ni = data.map((row: any) => ({ sku: row.SKU || '', producto: row.Producto, cantidad: row.Cantidad || 0, valorUnitario: row['Valor Unitario'] || 0, valorTotal: (row.Cantidad || 0) * (row['Valor Unitario'] || 0), adValoremPorcentaje: row['% AdValorem'] || '', precioVentaPEN: 0, descuentoPorcentaje: 0 }));
      setItems([...items, ...ni]);
    }; r.readAsBinaryString(f);
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
      {/* Main List View */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-[#0F172A] tracking-tight">Costeo de Importación</h1>
          <p className="text-slate-500 font-bold text-[10px] tracking-[0.3em] mt-1 uppercase">FORWARDERLY LOGISTICS SYSTEM</p>
        </div>
        <button 
          className="bg-[#4F46E5] text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 hover:scale-105 transition-all flex items-center gap-3 z-0" 
          onClick={() => setShowModal(true)}
        >
          <Plus size={24} /> NUEVO COSTEO
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {costeos.map((c) => (
          <div key={c.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-6">
              <span className="text-[10px] font-black bg-slate-50 text-slate-400 px-3 py-1 rounded-full uppercase tracking-widest">{c.codigo}</span>
              <div className="flex gap-2">
                <button onClick={() => viewCosteo(c)} className="p-2 text-slate-300 hover:text-indigo-600"><Eye size={16} /></button>
                <button onClick={() => editCosteo(c)} className="p-2 text-slate-300 hover:text-emerald-600"><Edit2 size={16} /></button>
                <button onClick={() => { if(window.confirm('Eliminar?')) api.delete(`/costeos/${c.id}`).then(fetchCosteos) }} className="p-2 text-slate-300 hover:text-rose-600"><Trash2 size={16} /></button>
              </div>
            </div>
            <h3 className="font-black text-slate-800 mb-4 truncate text-sm uppercase">{c.clienteNombre || c.cliente?.razonSocial}</h3>
            <div className="pt-4 border-t border-slate-50 flex justify-between items-end">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Inversión Soles</p>
                <p className="text-xl font-black text-slate-900 leading-none">S/ {formatNum(c.costoTotalImportacion * (c.tipoCambio || 1))}</p>
              </div>
              <div className={`text-[10px] font-black px-4 py-1.5 rounded-full ${c.canal === 'VERDE' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>{c.canal || 'PENDIENTE'}</div>
            </div>
          </div>
        ))}
      </div>

      {/* FULL SCREEN MODAL - CRITICAL FIX */}
      {showModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-0 m-0 overflow-hidden">
          <div className="bg-[#F8FAFC] w-full h-full flex flex-col shadow-2xl relative">
            
            {/* Header Exactly as Image */}
            <div className="bg-white px-10 py-6 flex justify-between items-center shrink-0 border-b border-slate-100">
              <div className="flex items-center gap-6">
                <h2 className="text-3xl font-black text-[#1E293B] tracking-tighter">NUEVO COSTEO ESTRATÉGICO</h2>
                <span className="bg-[#FEF3C7] text-[#D97706] text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest">DRAFTING</span>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={exportPDF} className="flex items-center gap-2 px-6 py-3 border-2 border-slate-200 rounded-xl text-[#4F46E5] font-black text-xs hover:bg-slate-50 transition-all uppercase tracking-widest"><FileDown size={18} /> Descargar PDF</button>
                {!isViewing && (
                  <button onClick={handleSave} className="flex items-center gap-2 px-10 py-3.5 bg-[#1E293B] text-white rounded-xl font-black text-xs hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 uppercase tracking-widest"><Save size={20} /> Guardar Costeo</button>
                )}
                <button onClick={() => { setShowModal(false); resetForm(); }} className="ml-4 p-2 text-slate-400 hover:text-rose-600 transition-all"><X size={36} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
              <div className="max-w-[1500px] mx-auto">
                
                {/* Metrics Row */}
                <div className="grid grid-cols-4 gap-8 mb-10">
                  {[
                    { l: 'TOTAL INVESTMENT (PEN)', v: `S/ ${formatNum(totals.cTotalPEN)}`, trend: true },
                    { l: 'FOB VALUE (USD)', v: `$ ${formatNum(totals.totalFC)}` },
                    { l: 'ROI RATIO', v: `${formatNum(totals.ratio)}x` },
                    { l: 'MARGEN PROMEDIO', v: `${formatNum(totals.margProm)}%`, emerald: true }
                  ].map((m, i) => (
                    <div key={i} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">{m.l}</p>
                      <div className="flex items-baseline gap-3">
                        <span className={`text-3xl font-black tracking-tighter ${m.emerald ? 'text-emerald-500' : 'text-[#1E293B]'}`}>{m.v}</span>
                        {m.trend && <span className="text-emerald-500 text-[10px] font-black flex items-center mb-1"><TrendingUp size={12} className="mr-1" /> 4.2%</span>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-12 gap-10">
                  {/* Left Column */}
                  <div className="col-span-12 xl:col-span-8 space-y-10">
                    
                    {/* Products Card */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-10 py-8 flex justify-between items-center border-b border-slate-50 bg-slate-50/30">
                        <h3 className="font-black text-[#1E293B] text-xl tracking-tight">Detalle de Mercadería</h3>
                        <div className="flex items-center gap-3">
                          <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all"><Download size={14} /> Plantilla</button>
                          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"><Upload size={14} /> Importar</button>
                          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
                          <button onClick={addItem} className="flex items-center gap-2 text-[#4F46E5] font-black text-xs uppercase tracking-[0.2em] ml-4 hover:scale-105 transition-all"><Plus size={20} /> Agregar Producto</button>
                        </div>
                      </div>
                      <table className="w-full text-xs">
                        <thead className="bg-[#F8FAFC] text-slate-400 font-black uppercase text-[10px] border-b border-slate-100">
                          <tr><th className="px-10 py-5 text-left">SKU</th><th className="px-10 py-5 text-left">DESCRIPTION</th><th className="px-10 py-5 text-center">QTY</th><th className="px-10 py-5 text-right">PRICE (USD)</th><th className="px-10 py-5 text-right">TOTAL (PEN)</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {items.map((it, idx) => {
                            const calc = totals.finalItems[idx];
                            return (
                              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-10 py-6"><input type="text" value={it.sku} onChange={(e) => updateItem(idx, 'sku', e.target.value)} className="bg-transparent border-0 font-bold w-20 text-[#1E293B]" disabled={isViewing} /></td>
                                <td className="px-10 py-6"><input type="text" value={it.producto} onChange={(e) => updateItem(idx, 'producto', e.target.value)} className="bg-transparent border-0 font-bold text-slate-700 w-full" disabled={isViewing} /></td>
                                <td className="px-10 py-6 text-center font-black text-slate-900">{it.cantidad || 0}</td>
                                <td className="px-10 py-6 text-right font-black text-slate-900">$ {formatNum(it.valorUnitario || 0)}</td>
                                <td className="px-10 py-6 text-right font-black text-[#1E293B] text-sm">S/ {formatNum(calc?.costoTotalSoles || 0)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Taxes Card */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-10 py-8 border-b border-slate-50 bg-slate-50/30"><h3 className="font-black text-[#1E293B] text-xl tracking-tight">Tributos Aduaneros</h3></div>
                      <div className="p-10 grid grid-cols-2 gap-16 items-center">
                        <div className="space-y-6">
                          {[
                            { l: 'Ad Valorem (6%)', v: totals.adValoremG },
                            { l: 'IGV (16%)', v: totals.igv },
                            { l: 'IPM (2%)', v: totals.ipm },
                            { l: 'Percepción (3.5%)', v: totals.perc }
                          ].map((t, i) => (
                            <div key={i} className="flex justify-between items-center font-black text-slate-500 text-sm">
                              <span className="opacity-60">{t.l}</span>
                              <span className="text-[#1E293B]">S/ {formatNum(t.v * Number(formData.tipoCambio || 1))}</span>
                            </div>
                          ))}
                        </div>
                        <div className="bg-[#F0F9FF] p-12 rounded-[3rem] text-center border-2 border-indigo-50 shadow-inner">
                          <p className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-3">TOTAL IMPUESTOS</p>
                          <p className="text-5xl font-black text-[#0F172A] tracking-tighter">S/ {formatNum((totals.adValoremG + totals.igv + totals.ipm + totals.perc) * (formData.tipoCambio || 1))}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="col-span-12 xl:col-span-4 space-y-10">
                    
                    {/* Operation Info */}
                    <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                      <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-10 flex items-center gap-2"><Info size={20} className="text-indigo-600" /> Información de Operación</h3>
                      <div className="space-y-8">
                        <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">CLIENTE</p><p className="font-black text-[#1E293B] text-lg uppercase tracking-tight">{formData.clienteNombre || 'CLIENTE NO SELECCIONADO'}</p></div>
                        <div className="grid grid-cols-2 gap-8">
                          <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">TIPO DE CAMBIO</p><div className="flex items-center gap-2"><span className="text-indigo-500 font-black text-sm">S/</span><input type="number" step="0.001" value={formData.tipoCambio || ''} onChange={(e) => setFormData({...formData, tipoCambio: parseFloat(e.target.value) || 0})} className="bg-transparent border-0 font-black text-[#1E293B] text-lg p-0 focus:ring-0" disabled={isViewing} /></div></div>
                          <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">INCOTERM</p><p className="font-black text-[#4F46E5] text-lg">FOB</p></div>
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                          <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">CANAL</p><div className="flex items-center gap-3"><span className={`w-3.5 h-3.5 rounded-full ${formData.canal === 'VERDE' ? 'bg-emerald-500 shadow-lg shadow-emerald-200' : 'bg-orange-500 shadow-lg shadow-orange-200'}`}></span><p className="font-black text-[#1E293B] text-lg tracking-tight uppercase">{formData.canal || 'PENDIENTE'}</p></div></div>
                          <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">MODALIDAD</p><p className="font-black text-slate-500 text-lg uppercase">AÉREO</p></div>
                        </div>
                      </div>
                    </div>

                    {/* Operational Logistics */}
                    <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                      <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-10">LOGÍSTICA OPERATIVA</h3>
                      <div className="space-y-6">
                        {[
                          { l: 'Flete Internacional', f: 'fleteInternacional' },
                          { l: 'Seguro (1.2%)', f: 'seguro' },
                          { l: 'Gastos Puerto', f: 'gastosLocales' }
                        ].map((lo, i) => (
                          <div key={i} className="flex justify-between items-center font-bold text-slate-600">
                            <span className="text-sm">{lo.l}</span>
                            <div className="flex items-center gap-2 font-black text-[#1E293B]">
                              <span className="text-slate-400 text-xs">$</span>
                              <input type="number" value={(formData as any)[lo.f] || ''} onChange={(e) => setFormData({...formData, [lo.f]: parseFloat(e.target.value) || 0})} className="bg-transparent border-0 p-0 text-right w-20 text-lg focus:ring-0" disabled={isViewing} />
                            </div>
                          </div>
                        ))}
                        <div className="pt-8 border-t border-slate-50 flex justify-between items-center">
                          <span className="font-black text-[#1E293B] text-sm uppercase tracking-widest">Total Operativos</span>
                          <span className="font-black text-[#1E293B] text-xl">S/ {formatNum((Number(formData.fleteInternacional || 0) + Number(formData.seguro || 0) + Number(formData.gastosLocales || 0)) * (formData.tipoCambio || 1))}</span>
                        </div>
                      </div>
                    </div>

                    {/* Profitability Dark Card */}
                    <div className="bg-[#1E293B] p-12 rounded-[3.5rem] shadow-2xl text-white relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-125 transition-all duration-700"><TrendingUp size={160} /></div>
                      <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] mb-10">RENTABILIDAD ESTIMADA</p>
                      <div className="mb-12 relative z-10">
                        <p className="text-xs font-bold text-indigo-400 mb-3 uppercase tracking-widest">Precio Venta Objetivo (PEN)</p>
                        <p className="text-5xl font-black tracking-tighter leading-none">S/ {formatNum(totals.ingTotalPEN)}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-12 pt-10 border-t border-white/5 relative z-10">
                        <div><p className="text-[11px] font-black text-slate-500 uppercase mb-2 tracking-widest">UTILIDAD NETA</p><p className="text-2xl font-black text-emerald-400 tracking-tight">S/ {formatNum(totals.uTotalPEN)}</p></div>
                        <div><p className="text-[11px] font-black text-slate-500 uppercase mb-2 tracking-widest">MARGEN REAL</p><p className="text-2xl font-black text-indigo-400 tracking-tight">{formatNum(totals.margProm)}%</p></div>
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
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

export default Costeos;
