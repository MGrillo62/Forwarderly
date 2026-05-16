import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, X, Trash2, Calculator, Info, Package, DollarSign, TrendingUp,
  Upload, FileSpreadsheet, Edit2, Eye, Ship, Landmark, Save, Printer
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Item {
  sku: string;
  producto: string;
  cantidad: number | '';
  valorUnitario: number | '';
  valorTotal: number;
  adValoremPorcentaje: number | '';
  precioVentaPEN: number | '';
  descuentoPorcentaje: number | '';
  
  participacionPorcentual?: number;
  cifOculto?: number;
  adValoremMonto?: number;
  fleteUnitario?: number;
  seguroUnitario?: number;
  gastosOrigenUnitario?: number;
  gastosLocalesUnitario?: number;
  costoTotalUnitario?: number;
  costoTotalTotal?: number;
  costoTotalSoles?: number;
  costoUnitarioSoles?: number;
  utilidadUnitarioPEN?: number;
  utilidadTotalPEN?: number;
  margenPorcentaje?: number;
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

  useEffect(() => {
    fetchCosteos(); fetchOrdenes();
  }, []);

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

    return { totalFC, cifG, adValoremG: hasItemAV ? totalAV : baseImp - cifG, igv, ipm, perc, cTotalImp, ratio: totalFC > 0 ? cTotalImp / totalFC : 0, finalItems, cTotalPEN: cTotalImp * tc, uTotalPEN, margProm: ingTotalPEN > 0 ? (uTotalPEN / ingTotalPEN) * 100 : 0 };
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

  const exportPDF = () => {
    const doc = new jsPDF(); doc.text("COSTEO DE IMPORTACIÓN", 15, 15);
    autoTable(doc, { startY: 25, head: [['SKU', 'Producto', 'Cant', 'Costo PEN']], body: (isViewing ? items : totals.finalItems).map((i: any) => [i.sku, i.producto, i.cantidad, formatNum(i.costoUnitarioSoles)]) });
    doc.save("Costeo.pdf");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="flex justify-between items-center mb-10 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Costeo de Importación</h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">Forwarderly Logistics Analysis System</p>
        </div>
        <button className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-2xl shadow-indigo-200 hover:scale-105 transition-all flex items-center gap-3" onClick={() => setShowModal(true)}>
          <Plus size={24} /> NUEVO COSTEO
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {costeos.map((c) => (
          <div key={c.id} className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 hover:border-indigo-200 transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600 font-black text-xs">#{c.codigo}</div>
              <div className="flex gap-2">
                <button onClick={() => viewCosteo(c)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Eye size={18} /></button>
                <button onClick={() => editCosteo(c)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"><Edit2 size={18} /></button>
                <button onClick={() => { if(window.confirm('Eliminar?')) api.delete(`/costeos/${c.id}`).then(fetchCosteos) }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button>
              </div>
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 truncate">{c.clienteNombre || c.cliente?.razonSocial}</h3>
            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">
              <span className="flex items-center gap-1"><Ship size={12} /> {c.incoterm}</span>
              <span className="flex items-center gap-1"><TrendingUp size={12} /> Ratio: {formatNum(c.ratioImportacion)}</span>
            </div>
            <div className="pt-6 border-t border-slate-50 flex justify-between items-end">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Inversión Total</p>
                <p className="text-2xl font-black text-slate-900">${formatNum(c.costoTotalImportacion)}</p>
              </div>
              <div className={`px-4 py-1.5 rounded-full text-[10px] font-black ${c.canal === 'VERDE' ? 'bg-emerald-100 text-emerald-600' : c.canal === 'ROJO' ? 'bg-rose-100 text-rose-600' : 'bg-orange-100 text-orange-600'}`}>{c.canal || 'PENDIENTE'}</div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-0">
          <div className="bg-white w-full h-full flex flex-col shadow-2xl overflow-hidden relative">
            <div className="bg-slate-900 p-8 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-500/20"><Calculator size={32} /></div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight">{isViewing ? 'ANÁLISIS DE COSTEO' : isEditing ? 'MODIFICAR REGISTRO' : 'NUEVO COSTEO ESTRATÉGICO'}</h2>
                  <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] mt-1">Status: {selectedCosteo?.codigo || 'Drafting'}</p>
                </div>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-3 hover:bg-white/10 rounded-full transition-all"><X size={32} /></button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 p-10 custom-scrollbar">
              <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-10">
                <div className="col-span-12 lg:col-span-8 space-y-10">
                  <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-3"><Info size={20} className="text-indigo-600" /> Información de Cabecera</h3>
                    <div className="grid grid-cols-2 gap-8">
                      {!isViewing && !isEditing && (
                        <div className="col-span-2"><label className="label">Vincular con Orden</label><select value={formData.ordenId} onChange={(e) => handleOrdenChange(e.target.value)} className="input-select">{ordenes.map(o => <option key={o.id} value={o.id}>{o.anio}-{o.correlativo} ({o.cotizacion.cliente.razonSocial})</option>)}</select></div>
                      )}
                      <div><label className="label">Cliente / Empresa</label><input type="text" value={formData.clienteNombre} disabled className="input-field" /></div>
                      <div><label className="label">Tipo de Cambio (PEN)</label><input type="number" step="0.001" value={formData.tipoCambio || ''} onChange={(e) => setFormData({...formData, tipoCambio: parseFloat(e.target.value) || 0})} className="input-field-tc" disabled={isViewing} /></div>
                      <div><label className="label">Factura Comercial</label><input type="text" value={formData.nroFacturaComercial} onChange={(e) => setFormData({...formData, nroFacturaComercial: e.target.value})} className="input-field" disabled={isViewing} /></div>
                      <div><label className="label">Moneda de Pago</label><select className="input-select" disabled={isViewing}><option value="USD">Dólar Americano (USD)</option></select></div>
                    </div>
                  </div>

                  <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
                    <div className="bg-slate-50/50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3"><Package size={22} className="text-indigo-600" /> Detalle de Mercadería</h3>
                      {!isViewing && <button onClick={addItem} className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black tracking-widest hover:bg-indigo-600 transition-all shadow-lg">+ AGREGAR PRODUCTO</button>}
                    </div>
                    <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50/30 text-slate-400 uppercase text-[10px] font-black border-b border-slate-50 sticky top-0 z-10 backdrop-blur-md">
                          <tr><th className="px-6 py-5 text-left">SKU</th><th className="px-6 py-5 text-left">Descripción</th><th className="px-6 py-5 text-right">Cant</th><th className="px-6 py-5 text-right">Unit USD</th><th className="px-6 py-5 text-right">Costo PEN</th>{!isViewing && <th className="px-6 py-5"></th>}</tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-indigo-50/10 group">
                              <td className="px-6 py-4"><input type="text" value={item.sku} onChange={(e) => updateItem(idx, 'sku', e.target.value)} className="bg-transparent w-20 font-bold" disabled={isViewing} /></td>
                              <td className="px-6 py-4"><input type="text" value={item.producto} onChange={(e) => updateItem(idx, 'producto', e.target.value)} className="bg-transparent w-full font-bold text-slate-700" disabled={isViewing} /></td>
                              <td className="px-6 py-4"><input type="number" value={item.cantidad || ''} onChange={(e) => updateItem(idx, 'cantidad', parseFloat(e.target.value) || 0)} className="w-20 text-right bg-slate-100/30 rounded-lg px-2 py-1 font-black" disabled={isViewing} /></td>
                              <td className="px-6 py-4"><input type="number" value={item.valorUnitario || ''} onChange={(e) => updateItem(idx, 'valorUnitario', parseFloat(e.target.value) || 0)} className="w-20 text-right bg-slate-100/30 rounded-lg px-2 py-1 font-black" disabled={isViewing} /></td>
                              <td className="px-6 py-4 text-right font-black text-indigo-600 text-sm">S/ {formatNum(isViewing ? item.costoUnitarioSoles || 0 : totals.finalItems[idx]?.costoUnitarioSoles || 0)}</td>
                              {!isViewing && <td className="px-6 py-4"><button onClick={() => removeItem(idx)} className="text-slate-300 hover:text-rose-600 transition-all"><Trash2 size={18} /></button></td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-4 space-y-8">
                  <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-3"><Ship size={20} className="text-indigo-600" /> Operativa Logística</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div><label className="label">Incoterm</label><select className="input-select" value={formData.incoterm} onChange={(e) => setFormData({...formData, incoterm: e.target.value})} disabled={isViewing}><option value="EXW">EXW</option><option value="FOB">FOB</option></select></div>
                      <div><label className="label">Canal</label><select className="input-select" value={formData.canal} onChange={(e) => setFormData({...formData, canal: e.target.value})} disabled={isViewing}><option value="">PENDIENTE</option><option value="VERDE">VERDE</option><option value="ROJO">ROJO</option></select></div>
                      <div className="col-span-2"><label className="label">Nro DAM</label><input type="text" className="input-field" value={formData.nroDAM} onChange={(e) => setFormData({...formData, nroDAM: e.target.value})} disabled={isViewing} /></div>
                    </div>
                  </div>

                  <div className="bg-slate-900 p-10 rounded-[3.5rem] shadow-2xl text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform"><Landmark size={120} /></div>
                    <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-10">Tributos Aduaneros</h3>
                    <div className="grid grid-cols-2 gap-x-12 gap-y-8 relative z-10">
                      {[ {l:'AdValorem', v:totals.adValoremG}, {l:'IGV (16%)', v:totals.igv}, {l:'IPM (2%)', v:totals.ipm}, {l:'Percepción', v:totals.perc} ].map((t, i) => (
                        <div key={i} className="bg-white/5 p-4 rounded-3xl border border-white/5">
                          <p className="text-[9px] font-black uppercase opacity-40 mb-2 tracking-widest">{t.l}</p>
                          <p className="text-lg font-black text-indigo-300">${formatNum(t.v)}</p>
                          <p className="text-[9px] font-black opacity-30 mt-1">S/ {formatNum(t.v * Number(formData.tipoCambio || 1))}</p>
                        </div>
                      ))}
                      <div className="col-span-2 pt-8 border-t border-white/10 flex justify-between items-end">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Total Impuestos</p>
                        <div className="text-right"><p className="text-3xl font-black text-white">${formatNum(totals.adValoremG + totals.igv + totals.ipm + totals.perc)}</p><p className="text-[11px] font-black text-indigo-400 uppercase mt-1">S/ {formatNum((totals.adValoremG + totals.igv + totals.ipm + totals.perc) * Number(formData.tipoCambio || 1))}</p></div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-indigo-600 p-10 rounded-[3.5rem] shadow-2xl shadow-indigo-200 text-white overflow-hidden relative">
                    <div className="absolute -bottom-8 -left-8 opacity-20"><TrendingUp size={180} /></div>
                    <h3 className="text-[11px] font-black uppercase tracking-[0.4em] opacity-70 mb-10">Rentabilidad Estimada (PEN)</h3>
                    <div className="space-y-8 relative z-10">
                      <div className="flex justify-between items-end"><p className="text-[10px] font-black uppercase tracking-widest opacity-60">Utilidad Total</p><p className="text-4xl font-black text-emerald-300 tracking-tighter">S/ {formatNum(totals.uTotalPEN)}</p></div>
                      <div className="flex justify-between items-center"><p className="text-[10px] font-black uppercase tracking-widest opacity-60">Margen Promedio</p><div className="bg-white/20 px-6 py-2 rounded-2xl text-xl font-black">{formatNum(totals.margProm)}%</div></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 flex justify-between items-center border-t border-slate-100 shrink-0">
              <div className="flex gap-16">
                <div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inversión Soles</p><p className="text-3xl font-black text-slate-900">S/ {formatNum(totals.cTotalPEN)}</p></div>
                <div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ratio de Costo</p><p className="text-3xl font-black text-indigo-600">{formatNum(totals.ratio)}</p></div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => { setShowModal(false); resetForm(); }} className="px-10 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs tracking-widest hover:bg-slate-200 transition-all uppercase">Cancelar</button>
                {(isViewing || isEditing) && <button onClick={exportPDF} className="px-10 py-4 bg-indigo-100 text-indigo-700 rounded-2xl font-black text-xs tracking-widest hover:bg-indigo-200 transition-all uppercase flex items-center gap-2"><Printer size={16} /> Imprimir</button>}
                {!isViewing && <button onClick={handleSave} className="px-14 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs tracking-widest hover:bg-indigo-700 shadow-2xl shadow-indigo-200 transition-all uppercase flex items-center gap-3"><Save size={18} /> {isEditing ? 'Actualizar' : 'Guardar Costeo'}</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .label { display: block; font-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest opacity-70; }
        .input-field { width: 100%; bg-slate-50 border-slate-200 border-2 rounded-2xl px-5 py-3 text-sm font-bold focus:ring-4 focus:ring-indigo-100 outline-none transition-all; }
        .input-field-tc { width: 100%; bg-indigo-50 border-indigo-200 border-2 rounded-2xl px-5 py-3 text-sm font-black text-indigo-700 focus:ring-4 focus:ring-indigo-100 outline-none transition-all; }
        .input-select { width: 100%; bg-slate-50 border-slate-200 border-2 rounded-2xl px-5 py-3 text-sm font-bold focus:ring-4 focus:ring-indigo-100 outline-none transition-all cursor-pointer; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

export default Costeos;
