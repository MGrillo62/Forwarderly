import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Search, FileText, ChevronRight, Save, X, Trash2, 
  Calculator, Info, Package, DollarSign, RefreshCw, TrendingUp,
  Download, Upload, FileSpreadsheet, CheckCircle, AlertTriangle,
  Edit2, FileDown, Eye, Calendar, Ship, MapPin, Printer,
  Gavel, Landmark, ArrowRight, User, Clock
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
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCosteo, setSelectedCosteo] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const formatNum = (val: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  const [formData, setFormData] = useState({
    clienteId: '',
    clienteNombre: '',
    clienteDocumento: '',
    ordenId: '',
    nroFacturaComercial: '',
    proveedorExtranjero: '',
    incoterm: 'FOB',
    moneda: 'USD',
    tipoCambio: 0,
    observaciones: '',
    gastosOrigen: 0,
    fleteInternacional: 0,
    seguro: 0,
    gastosLocales: 0,
    adValoremGlobal: 0,
    percepcionPorcentaje: 0,
    fechaEmbarque: '',
    fechaLlegada: '',
    canal: '',
    nroDAM: ''
  });

  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    fetchCosteos();
    fetchOrdenes();
    fetchClientes();
  }, []);

  const fetchCosteos = async () => {
    try {
      const res = await api.get('/costeos');
      setCosteos(res.data);
    } catch (err) {
      console.error('Error fetching costeos', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrdenes = async () => {
    try {
      const res = await api.get('/ordenes');
      setOrdenes(res.data);
    } catch (err) {
      console.error('Error fetching ordenes', err);
    }
  };

  const fetchClientes = async () => {
    try {
      const res = await api.get('/clientes');
      setClientes(res.data);
    } catch (err) {
      console.error('Error fetching clientes', err);
    }
  };

  const handleOrdenChange = (ordenId: string) => {
    const orden = ordenes.find(o => o.id === ordenId);
    if (orden) {
      setFormData({
        ...formData,
        ordenId,
        clienteId: orden.cotizacion.clienteId,
        clienteNombre: orden.cotizacion.cliente.razonSocial,
        clienteDocumento: orden.cotizacion.cliente.ruc,
        canal: orden.canal || '',
        nroDAM: orden.nroDAM || '',
        fechaEmbarque: orden.fechaETD ? format(new Date(orden.fechaETD), 'yyyy-MM-dd') : '',
        fechaLlegada: orden.fechaETA ? format(new Date(orden.fechaETA), 'yyyy-MM-dd') : '',
        gastosOrigen: orden.incoterm === 'FOB' ? 0 : formData.gastosOrigen
      });
    } else {
      setFormData({ ...formData, ordenId: '' });
    }
  };

  const addItem = () => {
    setItems([...items, { 
      sku: '', producto: '', cantidad: 0, valorUnitario: 0, valorTotal: 0, 
      adValoremPorcentaje: '', precioVentaPEN: 0, descuentoPorcentaje: 0 
    }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof Item, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };
    if (field === 'cantidad' || field === 'valorUnitario') {
      const cant = Number(item.cantidad) || 0;
      const unit = Number(item.valorUnitario) || 0;
      item.valorTotal = cant * unit;
    }
    newItems[index] = item;
    setItems(newItems);
  };

  const totals = useMemo(() => {
    const totalFacturaComercial = items.reduce((sum: number, item: Item) => sum + (item.valorTotal || 0), 0);
    const itemsCalculated = items.map(item => {
      const participacion = totalFacturaComercial > 0 ? (item.valorTotal / totalFacturaComercial) : 0;
      return { ...item, participacion };
    });

    const isFob = formData.incoterm === 'FOB';
    const gastosOrigenEfectivo = isFob ? 0 : Number(formData.gastosOrigen || 0);
    const fobEquivalente = isFob ? totalFacturaComercial : (totalFacturaComercial + gastosOrigenEfectivo);
    const cifGlobal = fobEquivalente + Number(formData.fleteInternacional || 0) + Number(formData.seguro || 0);

    let adValoremGlobalCalculated = 0;
    const hasItemAdValorem = items.some(item => item.adValoremPorcentaje !== '');

    const finalItems = itemsCalculated.map(item => {
      const cifOculto = cifGlobal * item.participacion;
      let adValoremMonto = hasItemAdValorem ? cifOculto * (Number(item.adValoremPorcentaje || 0) / 100) : cifOculto * (Number(formData.adValoremGlobal || 0) / 100);
      adValoremGlobalCalculated += adValoremMonto;
      const fleteItem = Number(formData.fleteInternacional || 0) * item.participacion;
      const seguroItem = Number(formData.seguro || 0) * item.participacion;
      const origenItem = gastosOrigenEfectivo * item.participacion;
      const localesItem = Number(formData.gastosLocales || 0) * item.participacion;
      const costoTotalMercaderia = item.valorTotal + fleteItem + seguroItem + origenItem + localesItem + adValoremMonto;
      const cantNum = Number(item.cantidad) || 0;
      const costoUnitario = cantNum > 0 ? (costoTotalMercaderia / cantNum) : 0;
      const costoSoles = costoTotalMercaderia * Number(formData.tipoCambio || 1);
      const costoUnitarioSoles = cantNum > 0 ? (costoSoles / cantNum) : 0;
      const precioVentaNum = Number(item.precioVentaPEN) || 0;
      const descPorcNum = Number(item.descuentoPorcentaje) || 0;
      const precioConDescuento = precioVentaNum * (1 - descPorcNum / 100);
      const valorVentaNeto = precioConDescuento / 1.18;
      const utilidadUnitarioPEN = valorVentaNeto - costoUnitarioSoles;
      const utilidadTotalPEN = utilidadUnitarioPEN * cantNum;
      const margenPorcentaje = valorVentaNeto > 0 ? (utilidadUnitarioPEN / valorVentaNeto) * 100 : 0;

      return { ...item, participacionPorcentual: item.participacion * 100, cifOculto, adValoremMonto, fleteUnitario: cantNum > 0 ? fleteItem / cantNum : 0, seguroUnitario: cantNum > 0 ? seguroItem / cantNum : 0, gastosOrigenUnitario: cantNum > 0 ? origenItem / cantNum : 0, gastosLocalesUnitario: cantNum > 0 ? localesItem / cantNum : 0, costoTotalUnitario: costoUnitario, costoTotalTotal: costoTotalMercaderia, costoTotalSoles: costoSoles, costoUnitarioSoles, utilidadUnitarioPEN, utilidadTotalPEN, margenPorcentaje };
    });

    const finalAdValoremGlobal = hasItemAdValorem ? adValoremGlobalCalculated : (cifGlobal * (Number(formData.adValoremGlobal || 0) / 100));
    const baseImponible = cifGlobal + finalAdValoremGlobal;
    const igv = baseImponible * 0.16;
    const ipm = baseImponible * 0.02;
    const percepcionMonto = (baseImponible + igv + ipm) * (Number(formData.percepcionPorcentaje || 0) / 100);
    const costoTotalImportacion = totalFacturaComercial + gastosOrigenEfectivo + Number(formData.fleteInternacional || 0) + Number(formData.seguro || 0) + finalAdValoremGlobal + Number(formData.gastosLocales || 0);
    const ratioImportacion = totalFacturaComercial > 0 ? (costoTotalImportacion / totalFacturaComercial) : 0;
    const costoTotalImportacionPEN = costoTotalImportacion * Number(formData.tipoCambio || 1);
    const ingresosTotalesPEN = finalItems.reduce((sum: number, item: any) => sum + ((Number(item.precioVentaPEN) * (1 - Number(item.descuentoPorcentaje) / 100)) / 1.18) * Number(item.cantidad), 0);
    const utilidadTotalPEN_Sum = finalItems.reduce((sum: number, item: any) => sum + (item.utilidadTotalPEN || 0), 0);
    const margenPromedio = ingresosTotalesPEN > 0 ? (utilidadTotalPEN_Sum / ingresosTotalesPEN) * 100 : 0;

    return { totalFacturaComercial, fobEquivalente, cifGlobal, adValoremGlobal: finalAdValoremGlobal, baseImponible, igv, ipm, percepcionMonto, costoTotalImportacion, ratioImportacion, finalItems, hasItemAdValorem, costoTotalImportacionPEN, ingresosTotalesPEN, utilidadTotalPEN_Sum, margenPromedio };
  }, [items, formData]);

  const handleSave = async () => {
    if (items.length === 0) return alert('Debe agregar productos');
    if (!formData.tipoCambio || formData.tipoCambio <= 0) return alert('Tipo de cambio inválido');
    try {
      const payload = { ...formData, items: totals.finalItems, totalFacturaComercial: totals.totalFacturaComercial, adValoremGlobal: totals.adValoremGlobal, cifGlobal: totals.cifGlobal, baseImponible: totals.baseImponible, igv: totals.igv, ipm: totals.ipm, percepcionMonto: totals.percepcionMonto, costoTotalImportacion: totals.costoTotalImportacion, ratioImportacion: totals.ratioImportacion };
      if (isEditing && selectedCosteo) await api.put(`/costeos/${selectedCosteo.id}`, payload);
      else await api.post('/costeos', payload);
      setShowModal(false); fetchCosteos(); resetForm();
    } catch (err) { alert('Error al guardar'); }
  };

  const resetForm = () => {
    setFormData({ clienteId: '', clienteNombre: '', clienteDocumento: '', ordenId: '', nroFacturaComercial: '', proveedorExtranjero: '', incoterm: 'FOB', moneda: 'USD', tipoCambio: 0, observaciones: '', gastosOrigen: 0, fleteInternacional: 0, seguro: 0, gastosLocales: 0, adValoremGlobal: 0, percepcionPorcentaje: 0, fechaEmbarque: '', fechaLlegada: '', canal: '', nroDAM: '' });
    setItems([]); setIsViewing(false); setIsEditing(false); setSelectedCosteo(null);
  };

  const viewCosteo = (costeo: any) => {
    setSelectedCosteo(costeo); setIsViewing(true); setIsEditing(false); setShowModal(true); setItems(costeo.items || []);
    setFormData({ ...formData, tipoCambio: costeo.tipoCambio, incoterm: costeo.incoterm, moneda: costeo.moneda, gastosOrigen: costeo.gastosOrigen, fleteInternacional: costeo.fleteInternacional, seguro: costeo.seguro, gastosLocales: costeo.gastosLocales, adValoremGlobal: costeo.adValoremGlobal, percepcionPorcentaje: costeo.percepcionPorcentaje, fechaEmbarque: costeo.fechaEmbarque ? format(new Date(costeo.fechaEmbarque), 'yyyy-MM-dd') : '', fechaLlegada: costeo.fechaLlegada ? format(new Date(costeo.fechaLlegada), 'yyyy-MM-dd') : '', canal: costeo.canal || '', nroDAM: costeo.nroDAM || '', clienteNombre: costeo.clienteNombre || costeo.cliente?.razonSocial || '', clienteDocumento: costeo.clienteDocumento || costeo.cliente?.ruc || '', nroFacturaComercial: costeo.nroFacturaComercial || '', proveedorExtranjero: costeo.proveedorExtranjero || '' });
  };

  const editCosteo = (costeo: any) => {
    setSelectedCosteo(costeo); setIsEditing(true); setIsViewing(false); setShowModal(true); setItems(costeo.items || []);
    setFormData({ ...formData, clienteId: costeo.clienteId || '', clienteNombre: costeo.clienteNombre || costeo.cliente?.razonSocial || '', clienteDocumento: costeo.clienteDocumento || costeo.cliente?.ruc || '', ordenId: costeo.ordenId || '', nroFacturaComercial: costeo.nroFacturaComercial || '', proveedorExtranjero: costeo.proveedorExtranjero || '', incoterm: costeo.incoterm || 'FOB', moneda: costeo.moneda || 'USD', tipoCambio: costeo.tipoCambio || 0, observaciones: costeo.observaciones || '', gastosOrigen: costeo.gastosOrigen || 0, fleteInternacional: costeo.fleteInternacional || 0, seguro: costeo.seguro || 0, gastosLocales: costeo.gastosLocales || 0, adValoremGlobal: costeo.adValoremGlobal || 0, percepcionPorcentaje: costeo.percepcionPorcentaje || 0, fechaEmbarque: costeo.fechaEmbarque ? format(new Date(costeo.fechaEmbarque), 'yyyy-MM-dd') : '', fechaLlegada: costeo.fechaLlegada ? format(new Date(costeo.fechaLlegada), 'yyyy-MM-dd') : '', canal: costeo.canal || '', nroDAM: costeo.nroDAM || '' });
  };

  const deleteCosteo = async (id: string) => {
    if (!window.confirm('¿Eliminar registro?')) return;
    try { await api.delete(`/costeos/${id}`); fetchCosteos(); } catch (err) { alert('Error al eliminar'); }
  };

  const exportPDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const data = isViewing ? { ...formData, ...totals } : { ...formData, ...totals };
      const tc = Number(formData.tipoCambio || 1);
      doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.text("COSTEO DE IMPORTACIÓN", 15, 18);
      doc.setFontSize(10); doc.text(`CÓDIGO: ${selectedCosteo?.codigo || 'BORRADOR'}`, 15, 28);
      doc.text(`CLIENTE: ${formData.clienteNombre}`, 15, 34);

      let currentY = 50;
      autoTable(doc, { startY: currentY, head: [['TRIBUTO', `USD (${formData.moneda})`, 'PEN (Soles)']], body: [['AdValorem', formatNum(data.adValoremGlobal), formatNum(data.adValoremGlobal * tc)], ['IGV (16%)', formatNum(data.igv), formatNum(data.igv * tc)], ['IPM (2%)', formatNum(data.ipm), formatNum(data.ipm * tc)], ['Percepción', formatNum(data.percepcionMonto), formatNum(data.percepcionMonto * tc)], ['TOTAL TRIBUTOS', formatNum(data.adValoremGlobal + data.igv + data.ipm + data.percepcionMonto), formatNum((data.adValoremGlobal + data.igv + data.ipm + data.percepcionMonto) * tc)]], theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [51, 65, 85] } });
      currentY = (doc as any).lastAutoTable.finalY + 10;
      autoTable(doc, { startY: currentY, head: [['SKU', 'Producto', 'Cant', 'Val Unit', 'Costo Unit USD', 'Costo Unit PEN']], body: (isViewing ? items : totals.finalItems).map((i: any) => [i.sku, i.producto, i.cantidad, formatNum(i.valorUnitario), formatNum(i.costoTotalUnitario), formatNum(i.costoUnitarioSoles)]), theme: 'striped', styles: { fontSize: 7 }, headStyles: { fillColor: [79, 70, 229] } });
      doc.save(`Costeo_${selectedCosteo?.codigo || 'Nuevo'}.pdf`);
    } catch (err) { alert('Error al generar PDF'); }
  };

  const exportExcel = () => {
    const data = isViewing ? { ...formData, ...totals } : { ...formData, ...totals };
    const tc = Number(formData.tipoCambio || 1);
    const content = [["COSTEO DE IMPORTACIÓN"], ["Código", selectedCosteo?.codigo || "BORRADOR"], ["Cliente", formData.clienteNombre], [], ["TRIBUTOS POR PAGAR", "USD", "PEN"], ["AdValorem", data.adValoremGlobal, data.adValoremGlobal * tc], ["IGV", data.igv, data.igv * tc], ["IPM", data.ipm, data.ipm * tc], ["Percepción", data.percepcionMonto, data.percepcionMonto * tc], [], ["DETALLE DE PRODUCTOS"], ["SKU", "Producto", "Cantidad", "Unit USD", "Costo USD", "Costo PEN"]];
    (isViewing ? items : totals.finalItems).forEach((i: any) => content.push([i.sku, i.producto, i.cantidad, i.valorUnitario, i.costoTotalUnitario, i.costoUnitarioSoles]));
    const ws = XLSX.utils.aoa_to_sheet(content); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Costeo"); XLSX.writeFile(wb, `Costeo_${selectedCosteo?.codigo || 'Nuevo'}.xlsx`);
  };

  return (
    <div className="page-container bg-slate-50 min-h-screen p-8">
      <div className="flex justify-between items-end mb-8 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Costeo de Importación</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2 font-medium">Gestión inteligente de costos logísticos y tributarios</p>
        </div>
        <button className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:scale-105 transition-all" onClick={() => setShowModal(true)}>
          <Plus size={20} className="inline mr-2" /> Nuevo Análisis
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-800 text-white">
            <tr>
              <th className="px-6 py-4 font-bold text-sm">Código</th>
              <th className="px-6 py-4 font-bold text-sm">Cliente</th>
              <th className="px-6 py-4 font-bold text-sm">Incoterm</th>
              <th className="px-6 py-4 font-bold text-sm text-right">Costo Total (USD)</th>
              <th className="px-6 py-4 font-bold text-sm text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {costeos.map((c) => (
              <tr key={c.id} className="hover:bg-indigo-50/30 transition-colors">
                <td className="px-6 py-4 font-bold text-indigo-600">{c.codigo}</td>
                <td className="px-6 py-4 font-semibold text-slate-700">{c.cliente?.razonSocial || c.clienteNombre}</td>
                <td className="px-6 py-4"><span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase">{c.incoterm}</span></td>
                <td className="px-6 py-4 text-right font-black text-slate-900">${formatNum(c.costoTotalImportacion)}</td>
                <td className="px-6 py-4 flex justify-center gap-3">
                  <button onClick={() => viewCosteo(c)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"><Eye size={16} /></button>
                  <button onClick={() => editCosteo(c)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all"><Edit2 size={16} /></button>
                  <button onClick={() => deleteCosteo(c.id)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-0">
          <div className="bg-white w-full h-full flex flex-col shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="bg-slate-900 p-6 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg"><Calculator size={24} /></div>
                <div>
                  <h2 className="text-xl font-black tracking-tight">{isViewing ? 'RESUMEN DE COSTEO' : isEditing ? 'EDITAR REGISTRO' : 'NUEVO ANÁLISIS'}</h2>
                  <div className="flex items-center gap-3 mt-1 opacity-75 text-[10px] font-bold uppercase tracking-widest">
                    <span>CÓDIGO: {selectedCosteo?.codigo || 'BORRADOR'}</span>
                    {formData.ordenId && <span className="text-indigo-400">VINCULADO A ORDEN: {ordenes.find(o => o.id === formData.ordenId)?.correlativo}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {(isViewing || isEditing) && (
                  <div className="flex gap-2">
                    <button onClick={exportPDF} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold transition-all"><Printer size={14} className="inline mr-2" /> PDF</button>
                    <button onClick={exportExcel} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold transition-all"><FileSpreadsheet size={14} className="inline mr-2" /> EXCEL</button>
                  </div>
                )}
                <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={28} /></button>
              </div>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto bg-slate-50 p-8 custom-scrollbar">
              <div className="max-w-[1500px] mx-auto grid grid-cols-12 gap-8">
                
                {/* Column Left: Main Inputs & Table */}
                <div className="col-span-12 xl:col-span-8 space-y-8">
                  
                  {/* Seccion 1: Datos Generales */}
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><Info size={16} className="text-indigo-600" /> Datos Generales</h3>
                    <div className="grid grid-cols-3 gap-6">
                      {!isViewing && !isEditing && (
                        <div className="col-span-3">
                          <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Vincular Orden de Servicio</label>
                          <select value={formData.ordenId} onChange={(e) => handleOrdenChange(e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                            <option value="">-- Ingreso Manual --</option>
                            {ordenes.map(o => <option key={o.id} value={o.id}>{o.anio}-{o.correlativo.toString().padStart(5, '0')} ({o.cotizacion.cliente.razonSocial})</option>)}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Cliente / Empresa</label>
                        <input type="text" value={formData.clienteNombre} onChange={(e) => setFormData({ ...formData, clienteNombre: e.target.value })} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-2 text-sm font-medium" disabled={isViewing || !!formData.ordenId} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Nro Documento</label>
                        <input type="text" value={formData.clienteDocumento} onChange={(e) => setFormData({ ...formData, clienteDocumento: e.target.value })} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-2 text-sm font-medium" disabled={isViewing || !!formData.ordenId} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Factura Comercial</label>
                        <input type="text" value={formData.nroFacturaComercial} onChange={(e) => setFormData({ ...formData, nroFacturaComercial: e.target.value })} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-2 text-sm font-medium" disabled={isViewing} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Proveedor Extranjero</label>
                        <input type="text" value={formData.proveedorExtranjero} onChange={(e) => setFormData({ ...formData, proveedorExtranjero: e.target.value })} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-2 text-sm font-medium" disabled={isViewing} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Moneda</label>
                        <select value={formData.moneda} onChange={(e) => setFormData({ ...formData, moneda: e.target.value })} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold" disabled={isViewing}><option value="USD">Dólar (USD)</option><option value="EUR">Euro (EUR)</option></select>
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Tipo de Cambio (PEN)</label>
                        <input type="number" step="0.001" value={formData.tipoCambio || ''} onChange={(e) => setFormData({ ...formData, tipoCambio: parseFloat(e.target.value) || 0 })} className="w-full bg-indigo-50 border-indigo-200 border-2 rounded-xl px-4 py-2 text-sm font-black text-indigo-700" disabled={isViewing} />
                      </div>
                    </div>
                  </div>

                  {/* Seccion 2: Grilla de Productos */}
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Package size={18} className="text-indigo-600" /> Detalle de Ítems</h3>
                      {!isViewing && (
                        <div className="flex gap-2">
                          <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-all shadow-sm"><Upload size={16} /></button>
                          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
                          <button onClick={addItem} className="px-5 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-black tracking-widest">+ AGREGAR PRODUCTO</button>
                        </div>
                      )}
                    </div>
                    <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] font-black sticky top-0 z-10 border-b border-slate-100">
                          <tr>
                            <th className="px-4 py-3">SKU</th>
                            <th className="px-4 py-3">Producto</th>
                            <th className="px-4 py-3 text-right">Cant</th>
                            <th className="px-4 py-3 text-right">Unit USD</th>
                            <th className="px-4 py-3 text-right">% AdV</th>
                            <th className="px-4 py-3 text-right">Costo PEN</th>
                            {!isViewing && <th className="px-4 py-3"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {items.map((item, idx) => {
                            const calc = isViewing ? item : totals.finalItems[idx];
                            return (
                              <tr key={idx} className="hover:bg-indigo-50/10">
                                <td className="px-4 py-2"><input type="text" value={item.sku} onChange={(e) => updateItem(idx, 'sku', e.target.value)} className="bg-transparent border-0 w-16 text-[10px]" disabled={isViewing} /></td>
                                <td className="px-4 py-2"><input type="text" value={item.producto} onChange={(e) => updateItem(idx, 'producto', e.target.value)} className="bg-transparent w-full border-0 font-bold text-slate-700" disabled={isViewing} /></td>
                                <td className="px-4 py-2"><input type="number" value={item.cantidad || ''} onChange={(e) => updateItem(idx, 'cantidad', parseFloat(e.target.value) || 0)} className="w-16 text-right border-0 bg-slate-100/50 rounded px-2" disabled={isViewing} /></td>
                                <td className="px-4 py-2"><input type="number" value={item.valorUnitario || ''} onChange={(e) => updateItem(idx, 'valorUnitario', parseFloat(e.target.value) || 0)} className="w-20 text-right border-0 bg-slate-100/50 rounded px-2" disabled={isViewing} /></td>
                                <td className="px-4 py-2"><input type="number" value={item.adValoremPorcentaje} onChange={(e) => updateItem(idx, 'adValoremPorcentaje', e.target.value === '' ? '' : parseFloat(e.target.value))} className="w-12 text-right border-0 text-indigo-600 font-black" placeholder="Auto" disabled={isViewing} /></td>
                                <td className="px-4 py-2 text-right font-black text-emerald-600">S/ {formatNum(calc?.costoUnitarioSoles || 0)}</td>
                                {!isViewing && <td className="px-4 py-2 text-center"><button onClick={() => removeItem(idx)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button></td>}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Column Right: Logistics, Taxes, and KPIs */}
                <div className="col-span-12 xl:col-span-4 space-y-8">
                  
                  {/* Seccion 3: Logística */}
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><Ship size={16} className="text-indigo-600" /> Operativa Logística</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Incoterm</label>
                        <select value={formData.incoterm} onChange={(e) => setFormData({ ...formData, incoterm: e.target.value })} className="w-full bg-slate-50 border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold" disabled={isViewing}><option value="EXW">EXW</option><option value="FOB">FOB</option><option value="FCA">FCA</option></select>
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Canal Aduana</label>
                        <select value={formData.canal} onChange={(e) => setFormData({ ...formData, canal: e.target.value })} className={`w-full border rounded-lg px-3 py-1.5 text-xs font-black ${formData.canal === 'VERDE' ? 'bg-emerald-50 text-emerald-600' : formData.canal === 'NARANJA' ? 'bg-orange-50 text-orange-600' : formData.canal === 'ROJO' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50'}`} disabled={isViewing}><option value="">-- Seleccionar --</option><option value="VERDE">VERDE</option><option value="NARANJA">NARANJA</option><option value="ROJO">ROJO</option></select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Nro DAM / DUA</label>
                        <input type="text" value={formData.nroDAM} onChange={(e) => setFormData({ ...formData, nroDAM: e.target.value })} className="w-full bg-slate-50 border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium" disabled={isViewing} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Gastos Origen (USD)</label>
                        <input type="number" value={formData.gastosOrigen || ''} onChange={(e) => setFormData({ ...formData, gastosOrigen: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-50 border-slate-200 rounded-lg px-3 py-1.5 text-xs" disabled={isViewing || formData.incoterm === 'FOB'} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Flete Int. (USD)</label>
                        <input type="number" value={formData.fleteInternacional || ''} onChange={(e) => setFormData({ ...formData, fleteInternacional: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-50 border-slate-200 rounded-lg px-3 py-1.5 text-xs" disabled={isViewing} />
                      </div>
                    </div>
                  </div>

                  {/* Seccion 4: Tributos por Pagar - GRID LAYOUT */}
                  <div className="bg-slate-800 p-6 rounded-[2rem] shadow-2xl text-white">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-6 flex items-center gap-2"><Landmark size={18} /> Tributos por Pagar</h3>
                    <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                      {[
                        { label: 'AdValorem', val: totals.adValoremGlobal },
                        { label: 'IGV (16%)', val: totals.igv },
                        { label: 'IPM (2%)', val: totals.ipm },
                        { label: 'Percepción', val: totals.percepcionMonto }
                      ].map((tax, i) => (
                        <div key={i} className="space-y-1">
                          <div className="text-[9px] font-black uppercase opacity-50 tracking-wider">{tax.label}</div>
                          <div className="text-sm font-bold text-indigo-300">${formatNum(tax.val)}</div>
                          <div className="text-[9px] font-medium opacity-40">S/ {formatNum(tax.val * Number(formData.tipoCambio || 1))}</div>
                        </div>
                      ))}
                      <div className="col-span-2 pt-6 border-t border-white/10 mt-2">
                        <div className="flex justify-between items-end">
                          <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Total Tributos</div>
                          <div className="text-right">
                            <div className="text-xl font-black text-white">${formatNum(totals.adValoremGlobal + totals.igv + totals.ipm + totals.percepcionMonto)}</div>
                            <div className="text-[10px] font-black text-indigo-300 uppercase">S/ {formatNum((totals.adValoremGlobal + totals.igv + totals.ipm + totals.percepcionMonto) * Number(formData.tipoCambio || 1))}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Proyección Summary Card */}
                  <div className="bg-indigo-600 p-8 rounded-[2rem] shadow-xl shadow-indigo-100 text-white relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform"><TrendingUp size={120} /></div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-6">Proyección de Negocio (PEN)</h3>
                    <div className="space-y-6 relative z-10">
                      <div className="flex justify-between items-end">
                        <div className="text-[9px] font-black uppercase tracking-widest opacity-70">Utilidad Total</div>
                        <div className="text-2xl font-black text-emerald-300">S/ {formatNum(totals.utilidadTotalPEN_Sum)}</div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="text-[9px] font-black uppercase tracking-widest opacity-70">Margen Promedio</div>
                        <div className="px-4 py-1.5 bg-white/20 rounded-2xl font-black text-sm">{formatNum(totals.margenPromedio)}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer - Fixed */}
            <div className="bg-slate-50 p-6 flex justify-between items-center border-t border-slate-200 shrink-0">
              <div className="flex gap-12">
                <div className="space-y-1">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inversión Total Estimada</div>
                  <div className="text-2xl font-black text-slate-800">S/ {formatNum(totals.costoTotalImportacionPEN)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ratio de Costo</div>
                  <div className="text-2xl font-black text-indigo-600">{formatNum(totals.ratioImportacion)}</div>
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => { setShowModal(false); resetForm(); }} className="px-8 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all">DESCARTAR</button>
                {!isViewing && (
                  <button onClick={handleSave} className="px-10 py-3 bg-slate-900 text-white rounded-2xl font-black shadow-xl shadow-slate-200 hover:bg-indigo-700 transition-all flex items-center gap-2">
                    <Save size={20} /> {isEditing ? 'ACTUALIZAR REGISTRO' : 'GUARDAR COSTEO'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        /* Reset modal overrides for clean full screen */
        .modal-content {
          width: 100vw !important;
          height: 100vh !important;
          max-width: none !important;
          max-height: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
        }
      `}</style>
    </div>
  );
};

export default Costeos;
