import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, X, Trash2, Calculator, Info, Package, DollarSign, TrendingUp,
  Upload, FileSpreadsheet, Edit2, Eye, Ship, Landmark, Save, Printer,
  Download, ChevronRight, ArrowUpRight
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
    <div className="min-h-screen bg-[#F8FAFC] p-8 font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Costeo de Importación</h1>
          <p className="text-slate-500 font-semibold text-xs tracking-widest mt-1">SISTEMA ESTRATÉGICO DE ANÁLISIS DE COSTOS</p>
        </div>
        <button className="bg-[#4F46E5] text-white px-8 py-3.5 rounded-2xl font-black shadow-xl shadow-indigo-100 hover:scale-105 transition-all flex items-center gap-3" onClick={() => setShowModal(true)}>
          <Plus size={20} /> NUEVO COSTEO
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {costeos.map((c) => (
          <div key={c.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase tracking-widest">{c.codigo}</span>
              <div className="flex gap-2">
                <button onClick={() => viewCosteo(c)} className="text-slate-400 hover:text-indigo-600"><Eye size={16} /></button>
                <button onClick={() => editCosteo(c)} className="text-slate-400 hover:text-emerald-600"><Edit2 size={16} /></button>
                <button onClick={() => { if(window.confirm('Eliminar?')) api.delete(`/costeos/${c.id}`).then(fetchCosteos) }} className="text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button>
              </div>
            </div>
            <h3 className="font-black text-slate-800 mb-4 truncate text-sm uppercase">{c.clienteNombre || c.cliente?.razonSocial}</h3>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Inversión Soles</p>
                <p className="text-xl font-black text-slate-900">S/ {formatNum(c.costoTotalImportacion * (c.tipoCambio || 1))}</p>
              </div>
              <div className={`text-[10px] font-black px-3 py-1 rounded-full ${c.canal === 'VERDE' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>{c.canal || 'PENDIENTE'}</div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-0">
          <div className="bg-[#F8FAFC] w-full h-full flex flex-col shadow-2xl relative overflow-hidden">
            
            {/* Header Exact from Image */}
            <div className="bg-white px-10 py-6 flex justify-between items-center shrink-0 border-b border-slate-100">
              <div className="flex items-center gap-6">
                <h2 className="text-3xl font-black text-[#1E293B] tracking-tight">NUEVO COSTEO ESTRATÉGICO</h2>
                <span className="bg-[#FEF3C7] text-[#D97706] text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest">DRAFTING</span>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={exportPDF} className="flex items-center gap-2 px-6 py-3 border border-slate-200 rounded-xl text-[#4F46E5] font-black text-sm hover:bg-slate-50 transition-all"><Download size={18} /> Descargar PDF</button>
                <button onClick={handleSave} className="flex items-center gap-2 px-8 py-3 bg-[#1E293B] text-white rounded-xl font-black text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"><Save size={18} /> Guardar Costeo</button>
                <button onClick={() => { setShowModal(false); resetForm(); }} className="ml-4 p-2 text-slate-400 hover:text-rose-600 transition-all"><X size={32} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
              <div className="max-w-[1400px] mx-auto">
                
                {/* Metrics Row from Image */}
                <div className="grid grid-cols-4 gap-6 mb-8">
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">TOTAL INVESTMENT (PEN)</p>
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-black text-slate-900 leading-none">S/ {formatNum(totals.cTotalPEN)}</span>
                      <span className="text-emerald-500 text-[10px] font-black flex items-center mb-1"><ArrowUpRight size={14} /> 4.2%</span>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">FOB VALUE (USD)</p>
                    <p className="text-3xl font-black text-slate-900 leading-none">$ {formatNum(totals.totalFC)}</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">ROI RATIO</p>
                    <p className="text-3xl font-black text-slate-900 leading-none">{formatNum(totals.ratio)}x</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">MARGEN PROMEDIO</p>
                    <p className="text-3xl font-black text-emerald-500 leading-none">{formatNum(totals.margProm)}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-8">
                  {/* Left Column (8) */}
                  <div className="col-span-8 space-y-8">
                    
                    {/* Detalle de Mercadería */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-8 py-6 flex justify-between items-center border-b border-slate-50">
                        <h3 className="font-black text-slate-800 text-lg">Detalle de Mercadería</h3>
                        <div className="flex items-center gap-4">
                          <button onClick={downloadTemplate} className="p-2 text-slate-400 hover:text-emerald-600 transition-all" title="Bajar Plantilla"><Download size={18} /></button>
                          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-indigo-600 transition-all" title="Subir Excel"><Upload size={18} /></button>
                          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
                          <button onClick={addItem} className="flex items-center gap-2 text-[#4F46E5] font-black text-sm uppercase tracking-widest"><Plus size={18} /> Agregar Producto</button>
                        </div>
                      </div>
                      <div className="p-0">
                        <table className="w-full text-xs">
                          <thead className="bg-[#F8FAFC] text-slate-400 font-black uppercase text-[10px]">
                            <tr><th className="px-8 py-4 text-left">SKU</th><th className="px-8 py-4 text-left">DESCRIPTION</th><th className="px-8 py-4 text-center">QTY</th><th className="px-8 py-4 text-right">PRICE (USD)</th><th className="px-8 py-4 text-right">TOTAL (PEN)</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {items.map((it, idx) => {
                              const calc = totals.finalItems[idx];
                              return (
                                <tr key={idx} className="group">
                                  <td className="px-8 py-5"><input type="text" value={it.sku} onChange={(e) => updateItem(idx, 'sku', e.target.value)} className="bg-transparent border-0 font-bold w-16" placeholder="SKU" disabled={isViewing} /></td>
                                  <td className="px-8 py-5"><input type="text" value={it.producto} onChange={(e) => updateItem(idx, 'producto', e.target.value)} className="bg-transparent border-0 font-bold text-slate-700 w-full" placeholder="Producto..." disabled={isViewing} /></td>
                                  <td className="px-8 py-5 text-center"><input type="number" value={it.cantidad || ''} onChange={(e) => updateItem(idx, 'cantidad', parseFloat(e.target.value) || 0)} className="bg-transparent border-0 font-bold w-12 text-center" disabled={isViewing} /></td>
                                  <td className="px-8 py-5 text-right font-bold text-slate-800">$ {formatNum(it.valorUnitario || 0)}</td>
                                  <td className="px-8 py-5 text-right"><p className="text-[10px] font-black text-slate-400 uppercase">S/</p><p className="font-black text-slate-900 text-sm">{formatNum(calc?.costoTotalSoles || 0)}</p></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Tributos Aduaneros from Image */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-8 py-6 border-b border-slate-50"><h3 className="font-black text-slate-800 text-lg">Tributos Aduaneros</h3></div>
                      <div className="p-8 grid grid-cols-2 gap-12 items-center">
                        <div className="space-y-4">
                          {[
                            { l: 'Ad Valorem (6%)', v: totals.adValoremG },
                            { l: 'IGV (16%)', v: totals.igv },
                            { l: 'IPM (2%)', v: totals.ipm },
                            { l: 'Percepción (3.5%)', v: totals.perc }
                          ].map((t, i) => (
                            <div key={i} className="flex justify-between items-center font-bold text-slate-500 text-sm">
                              <span>{t.l}</span>
                              <span className="text-slate-800">S/ {formatNum(t.v * Number(formData.tipoCambio || 1))}</span>
                            </div>
                          ))}
                        </div>
                        <div className="bg-[#F0F9FF] p-10 rounded-[2rem] text-center border border-indigo-50">
                          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">TOTAL IMPUESTOS</p>
                          <p className="text-4xl font-black text-slate-900">S/ {formatNum((totals.adValoremG + totals.igv + totals.ipm + totals.perc) * (formData.tipoCambio || 1))}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column (4) */}
                  <div className="col-span-4 space-y-8">
                    
                    {/* Información de Operación */}
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                      <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Información de Operación</h3>
                      {!isViewing && !isEditing && (
                        <div className="mb-6"><label className="text-[9px] font-black text-slate-400 uppercase mb-1 block"> Vincular Cotización / Orden</label><select value={formData.ordenId} onChange={(e) => handleOrdenChange(e.target.value)} className="w-full bg-slate-50 border-0 rounded-xl px-4 py-2 text-xs font-bold">{ordenes.map(o => <option key={o.id} value={o.id}>{o.anio}-{o.correlativo}</option>)}</select></div>
                      )}
                      <div className="grid grid-cols-2 gap-y-6">
                        <div className="col-span-2"><p className="text-[9px] font-black text-slate-400 uppercase">CLIENTE</p><p className="font-black text-slate-800 uppercase text-sm">{formData.clienteNombre || 'SELECCIONAR'}</p></div>
                        <div><p className="text-[9px] font-black text-slate-400 uppercase">TIPO DE CAMBIO</p><div className="flex items-center gap-1"><span className="text-indigo-500 font-bold text-xs">S/</span><input type="number" step="0.001" value={formData.tipoCambio || ''} onChange={(e) => setFormData({...formData, tipoCambio: parseFloat(e.target.value) || 0})} className="bg-transparent border-0 font-black text-slate-800 w-16 p-0 text-sm" disabled={isViewing} /></div></div>
                        <div><p className="text-[9px] font-black text-slate-400 uppercase">INCOTERM</p><select value={formData.incoterm} onChange={(e) => setFormData({...formData, incoterm: e.target.value})} className="bg-transparent border-0 font-black text-[#4F46E5] p-0 text-sm" disabled={isViewing}><option value="FOB">FOB</option><option value="EXW">EXW</option></select></div>
                        <div><p className="text-[9px] font-black text-slate-400 uppercase">CANAL</p><div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${formData.canal === 'VERDE' ? 'bg-emerald-500' : 'bg-orange-500'}`}></span><select value={formData.canal} onChange={(e) => setFormData({...formData, canal: e.target.value})} className="bg-transparent border-0 font-black text-slate-800 p-0 text-xs" disabled={isViewing}><option value="VERDE">VERDE</option><option value="ROJO">ROJO</option></select></div></div>
                        <div><p className="text-[9px] font-black text-slate-400 uppercase">MODALIDAD</p><p className="font-bold text-slate-600 text-xs">Aéreo / Marítimo</p></div>
                      </div>
                    </div>

                    {/* Logística Operativa */}
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                      <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">LOGÍSTICA OPERATIVA</h3>
                      <div className="space-y-5">
                        <div className="flex justify-between items-center"><span className="font-bold text-slate-500 text-xs">Flete Internacional</span><div className="flex items-center gap-1 font-black text-slate-800 text-sm"><span>$</span><input type="number" value={formData.fleteInternacional || ''} onChange={(e) => setFormData({...formData, fleteInternacional: parseFloat(e.target.value) || 0})} className="bg-transparent border-0 p-0 text-right w-16" disabled={isViewing} /></div></div>
                        <div className="flex justify-between items-center"><span className="font-bold text-slate-500 text-xs">Seguro (1.2%)</span><div className="flex items-center gap-1 font-black text-slate-800 text-sm"><span>$</span><input type="number" value={formData.seguro || ''} onChange={(e) => setFormData({...formData, seguro: parseFloat(e.target.value) || 0})} className="bg-transparent border-0 p-0 text-right w-16" disabled={isViewing} /></div></div>
                        <div className="flex justify-between items-center"><span className="font-bold text-slate-500 text-xs">Gastos Puerto</span><div className="flex items-center gap-1 font-black text-slate-800 text-sm"><span>$</span><input type="number" value={formData.gastosLocales || ''} onChange={(e) => setFormData({...formData, gastosLocales: parseFloat(e.target.value) || 0})} className="bg-transparent border-0 p-0 text-right w-16" disabled={isViewing} /></div></div>
                        <div className="pt-6 border-t border-slate-50 flex justify-between items-center">
                          <span className="font-black text-slate-900 text-xs uppercase">Total Operativos</span>
                          <span className="font-black text-slate-900 text-sm">S/ {formatNum((Number(formData.fleteInternacional || 0) + Number(formData.seguro || 0) + Number(formData.gastosLocales || 0)) * (formData.tipoCambio || 1))}</span>
                        </div>
                      </div>
                    </div>

                    {/* Rentabilidad Estimada Dark Card */}
                    <div className="bg-[#1E293B] p-10 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-all"><TrendingUp size={120} /></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">RENTABILIDAD ESTIMADA</p>
                      <div className="mb-10">
                        <p className="text-[11px] font-bold text-indigo-400 mb-2">Precio Venta Objetivo (PEN)</p>
                        <p className="text-4xl font-black tracking-tighter">S/ {formatNum(totals.ingTotalPEN)}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-8 pt-8 border-t border-white/5">
                        <div><p className="text-[10px] font-black text-slate-500 uppercase mb-1">UTILIDAD NETA</p><p className="text-xl font-black text-emerald-400">S/ {formatNum(totals.uTotalPEN)}</p></div>
                        <div><p className="text-[10px] font-black text-slate-500 uppercase mb-1">MARGEN REAL</p><p className="text-xl font-black text-indigo-400">{formatNum(totals.margProm)}%</p></div>
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
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; }
        @keyframes slideIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .modal-animate { animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
};

export default Costeos;
