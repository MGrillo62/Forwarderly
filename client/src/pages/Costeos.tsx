import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Search, FileText, ChevronRight, Save, X, Trash2, 
  Calculator, Info, Package, DollarSign, RefreshCw, TrendingUp,
  Download, Upload, FileSpreadsheet, CheckCircle, AlertTriangle,
  Edit2, FileDown, Eye, Calendar, Ship, MapPin, ExternalLink,
  ChevronDown, ChevronUp, Clock, User, ArrowRight, Printer
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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
  const [uploadStats, setUploadStats] = useState({ total: 0, success: 0, errors: 0 });
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
        gastosOrigen: orden.incoterm === 'FOB' ? 0 : formData.gastosOrigen,
        fleteInternacional: 0,
        gastosLocales: 0,
        seguro: 0
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

    const fobEquivalente = (isFob) 
      ? totalFacturaComercial 
      : (totalFacturaComercial + gastosOrigenEfectivo);

    const cifGlobal = fobEquivalente + Number(formData.fleteInternacional || 0) + Number(formData.seguro || 0);

    let adValoremGlobalCalculated = 0;
    const hasItemAdValorem = items.some(item => item.adValoremPorcentaje !== '');

    const finalItems = itemsCalculated.map(item => {
      const cifOculto = cifGlobal * item.participacion;
      let adValoremMonto = 0;
      
      if (hasItemAdValorem) {
        adValoremMonto = cifOculto * (Number(item.adValoremPorcentaje || 0) / 100);
      } else {
        adValoremMonto = cifOculto * (Number(formData.adValoremGlobal || 0) / 100);
      }
      
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

      return {
        ...item,
        participacionPorcentual: item.participacion * 100,
        cifOculto,
        adValoremMonto,
        fleteUnitario: cantNum > 0 ? fleteItem / cantNum : 0,
        seguroUnitario: cantNum > 0 ? seguroItem / cantNum : 0,
        gastosOrigenUnitario: cantNum > 0 ? origenItem / cantNum : 0,
        gastosLocalesUnitario: cantNum > 0 ? localesItem / cantNum : 0,
        costoTotalUnitario: costoUnitario,
        costoTotalTotal: costoTotalMercaderia,
        costoTotalSoles: costoSoles,
        costoUnitarioSoles,
        utilidadUnitarioPEN,
        utilidadTotalPEN,
        margenPorcentaje
      };
    });

    const finalAdValoremGlobal = hasItemAdValorem ? adValoremGlobalCalculated : (cifGlobal * (Number(formData.adValoremGlobal || 0) / 100));
    const baseImponible = cifGlobal + finalAdValoremGlobal;
    const igv = baseImponible * 0.16;
    const ipm = baseImponible * 0.02;
    const percepcionMonto = baseImponible * (Number(formData.percepcionPorcentaje || 0) / 100);

    const costoTotalImportacion = totalFacturaComercial + gastosOrigenEfectivo + 
                                  Number(formData.fleteInternacional || 0) + Number(formData.seguro || 0) + 
                                  finalAdValoremGlobal + Number(formData.gastosLocales || 0);

    const ratioImportacion = totalFacturaComercial > 0 ? (costoTotalImportacion / totalFacturaComercial) : 0;

    const costoTotalImportacionPEN = costoTotalImportacion * Number(formData.tipoCambio || 1);
    const ingresosTotalesPEN = finalItems.reduce((sum: number, item: any) => {
      const cant = Number(item.cantidad) || 0;
      const precioVentaNum = Number(item.precioVentaPEN) || 0;
      const descPorcNum = Number(item.descuentoPorcentaje) || 0;
      return sum + ((precioVentaNum * (1 - descPorcNum / 100)) / 1.18) * cant;
    }, 0);
    const utilidadTotalPEN_Sum = finalItems.reduce((sum: number, item: any) => sum + (item.utilidadTotalPEN || 0), 0);
    const margenPromedio = ingresosTotalesPEN > 0 ? (utilidadTotalPEN_Sum / ingresosTotalesPEN) * 100 : 0;

    return {
      totalFacturaComercial,
      fobEquivalente,
      cifGlobal,
      adValoremGlobal: finalAdValoremGlobal,
      baseImponible,
      igv,
      ipm,
      percepcionMonto,
      costoTotalImportacion,
      ratioImportacion,
      finalItems,
      hasItemAdValorem,
      costoTotalImportacionPEN,
      ingresosTotalesPEN,
      utilidadTotalPEN_Sum,
      margenPromedio
    };
  }, [items, formData]);

  const handleSave = async () => {
    if (items.length === 0) return alert('Debe agregar al menos un producto');
    if (!formData.tipoCambio || formData.tipoCambio <= 0) return alert('El tipo de cambio debe ser mayor a cero');

    try {
      const payload = {
        ...formData,
        items: totals.finalItems,
        totalFacturaComercial: totals.totalFacturaComercial,
        adValoremGlobal: totals.adValoremGlobal,
        cifGlobal: totals.cifGlobal,
        baseImponible: totals.baseImponible,
        igv: totals.igv,
        ipm: totals.ipm,
        percepcionMonto: totals.percepcionMonto,
        costoTotalImportacion: totals.costoTotalImportacion,
        ratioImportacion: totals.ratioImportacion
      };

      if (isEditing && selectedCosteo) {
        await api.put(`/costeos/${selectedCosteo.id}`, payload);
      } else {
        await api.post('/costeos', payload);
      }
      
      setShowModal(false);
      fetchCosteos();
      resetForm();
    } catch (err) {
      console.error('Error saving costeo', err);
      alert('Error al guardar el costeo.');
    }
  };

  const resetForm = () => {
    setFormData({
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
    setItems([]);
    setIsViewing(false);
    setIsEditing(false);
    setSelectedCosteo(null);
    setUploadProgress(0);
    setUploadStats({ total: 0, success: 0, errors: 0 });
  };

  const viewCosteo = (costeo: any) => {
    setSelectedCosteo(costeo);
    setIsViewing(true);
    setIsEditing(false);
    setShowModal(true);
    setItems(costeo.items || []);
  };

  const editCosteo = (costeo: any) => {
    setSelectedCosteo(costeo);
    setIsEditing(true);
    setIsViewing(false);
    
    setFormData({
      clienteId: costeo.clienteId || '',
      clienteNombre: costeo.clienteNombre || costeo.cliente?.razonSocial || '',
      clienteDocumento: costeo.clienteDocumento || costeo.cliente?.ruc || '',
      ordenId: costeo.ordenId || '',
      nroFacturaComercial: costeo.nroFacturaComercial || '',
      proveedorExtranjero: costeo.proveedorExtranjero || '',
      incoterm: costeo.incoterm || 'FOB',
      moneda: costeo.moneda || 'USD',
      tipoCambio: costeo.tipoCambio || 0,
      observaciones: costeo.observaciones || '',
      gastosOrigen: costeo.gastosOrigen || 0,
      fleteInternacional: costeo.fleteInternacional || 0,
      seguro: costeo.seguro || 0,
      gastosLocales: costeo.gastosLocales || 0,
      adValoremGlobal: costeo.adValoremGlobal || 0,
      percepcionPorcentaje: costeo.percepcionPorcentaje || 0,
      fechaEmbarque: costeo.fechaEmbarque ? format(new Date(costeo.fechaEmbarque), 'yyyy-MM-dd') : '',
      fechaLlegada: costeo.fechaLlegada ? format(new Date(costeo.fechaLlegada), 'yyyy-MM-dd') : '',
      canal: costeo.canal || '',
      nroDAM: costeo.nroDAM || ''
    });
    
    setItems(costeo.items || []);
    setShowModal(true);
  };

  const deleteCosteo = async (id: string) => {
    if (!window.confirm('¿Está seguro de eliminar este costeo?')) return;
    try {
      await api.delete(`/costeos/${id}`);
      fetchCosteos();
    } catch (err) {
      alert('Error al eliminar costeo');
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { SKU: 'SKU001', Producto: 'Ejemplo Producto 1', Cantidad: 100, 'Valor Unitario': 15.50, '% AdValorem': 6 },
      { SKU: 'SKU002', Producto: 'Ejemplo Producto 2', Cantidad: 50, 'Valor Unitario': 25.00, '% AdValorem': 0 }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "Plantilla_Costeo.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(10);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        setUploadProgress(50);
        
        const newItems: Item[] = [];
        let success = 0;
        let errors = 0;

        data.forEach((row: any) => {
          if (row.Producto && row.Cantidad) {
            newItems.push({
              sku: row.SKU || '',
              producto: row.Producto,
              cantidad: parseFloat(row.Cantidad) || 0,
              valorUnitario: parseFloat(row['Valor Unitario']) || 0,
              valorTotal: (parseFloat(row.Cantidad) || 0) * (parseFloat(row['Valor Unitario']) || 0),
              adValoremPorcentaje: row['% AdValorem'] !== undefined ? parseFloat(row['% AdValorem']) : '',
              precioVentaPEN: 0,
              descuentoPorcentaje: 0
            });
            success++;
          } else {
            errors++;
          }
        });

        setItems([...items, ...newItems]);
        setUploadStats({ total: data.length, success, errors });
        setUploadProgress(100);
        setTimeout(() => setIsUploading(false), 2000);
      } catch (err) {
        console.error('Error reading excel', err);
        alert('Error al leer el archivo Excel');
        setIsUploading(false);
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const exportPDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const data = isViewing ? selectedCosteo : { ...formData, ...totals };
      const clienteName = isViewing ? (selectedCosteo.cliente?.razonSocial || selectedCosteo.clienteNombre) : formData.clienteNombre;
      
      // Header
      doc.setFillColor(30, 41, 59); // Slate-800
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text("COSTEO DE IMPORTACIÓN", 15, 18);
      doc.setFontSize(10);
      doc.text(`CÓDIGO: ${selectedCosteo?.codigo || 'BORRADOR'}`, 15, 26);
      doc.text(`FECHA: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 15, 32);

      // Section: General Info
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text("DATOS GENERALES", 15, 50);
      doc.setDrawColor(226, 232, 240);
      doc.line(15, 52, 195, 52);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Cliente: ${clienteName}`, 15, 60);
      doc.text(`RUC: ${isViewing ? (selectedCosteo.cliente?.ruc || selectedCosteo.clienteDocumento) : formData.clienteDocumento}`, 15, 65);
      doc.text(`Factura: ${data.nroFacturaComercial || '-'}`, 15, 70);
      doc.text(`Incoterm: ${data.incoterm}`, 110, 60);
      doc.text(`Moneda: ${data.moneda}`, 110, 65);
      doc.text(`T.C.: ${data.tipoCambio}`, 110, 70);

      // Section: Items Table
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text("DETALLE DE PRODUCTOS", 15, 85);
      doc.line(15, 87, 195, 87);

      const tableData = (isViewing ? items : totals.finalItems).map((i: any) => [
        i.sku || '-', i.producto, i.cantidad, formatNum(i.valorUnitario), formatNum(i.valorTotal), formatNum(i.costoTotalUnitario), formatNum(i.costoUnitarioSoles)
      ]);

      (doc as any).autoTable({
        startY: 92,
        head: [['SKU', 'Producto', 'Cant', 'Val. Unit', 'Total USD', 'Costo USD', 'Costo PEN']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
        styles: { fontSize: 8 }
      });

      // Section: Totals Summary
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text("RESUMEN DE COSTOS", 15, finalY);
      doc.line(15, finalY + 2, 195, finalY + 2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text("Total Factura (USD):", 15, finalY + 10);
      doc.text(`$${formatNum(data.totalFacturaComercial)}`, 70, finalY + 10, { align: 'right' });
      
      doc.text("Gastos Totales (USD):", 15, finalY + 15);
      doc.text(`$${formatNum(data.gastosOrigen + data.fleteInternacional + data.seguro + data.gastosLocales)}`, 70, finalY + 15, { align: 'right' });

      doc.text("Impuestos (USD):", 15, finalY + 20);
      doc.text(`$${formatNum(data.adValoremGlobal + data.igv + data.ipm)}`, 70, finalY + 20, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text("COSTO TOTAL (USD):", 15, finalY + 30);
      doc.text(`$${formatNum(data.costoTotalImportacion)}`, 70, finalY + 30, { align: 'right' });

      doc.save(`Costeo_${selectedCosteo?.codigo || 'Nuevo'}.pdf`);
    } catch (err) {
      console.error('Error generating PDF', err);
      alert('Error al generar PDF. Asegúrese de que jspdf-autotable esté cargado.');
    }
  };

  const exportExcel = () => {
    const costeo = isViewing ? selectedCosteo : { ...formData, ...totals };
    const clienteName = isViewing ? (selectedCosteo.cliente?.razonSocial || selectedCosteo.clienteNombre) : formData.clienteNombre;
    
    // Create sections
    const generalInfo = [
      ["DATOS GENERALES"],
      ["Código", selectedCosteo?.codigo || "BORRADOR"],
      ["Cliente", clienteName],
      ["Documento", isViewing ? (selectedCosteo.cliente?.ruc || selectedCosteo.clienteDocumento) : formData.clienteDocumento],
      ["Factura", costeo.nroFacturaComercial || "-"],
      ["Incoterm", costeo.incoterm],
      ["Moneda", costeo.moneda],
      ["Tipo Cambio", costeo.tipoCambio],
      [],
      ["LOGÍSTICA"],
      ["Fecha Embarque", costeo.fechaEmbarque || "-"],
      ["Fecha Llegada", costeo.fechaLlegada || "-"],
      ["Canal", costeo.canal || "-"],
      ["Nro DAM", costeo.nroDAM || "-"],
      [],
      ["RESUMEN FINANCIERO (USD)"],
      ["Total Factura", costeo.totalFacturaComercial],
      ["CIF Global", costeo.cifGlobal],
      ["AdValorem", costeo.adValoremGlobal],
      ["IGV", costeo.igv],
      ["COSTO TOTAL IMPORTACIÓN", costeo.costoTotalImportacion],
      ["Ratio Importación", costeo.ratioImportacion],
      [],
      ["RESUMEN PROYECCIÓN (PEN)"],
      ["Costo Total (PEN)", costeo.costoTotalImportacionPEN || (costeo.costoTotalImportacion * costeo.tipoCambio)],
      ["Utilidad Total (PEN)", isViewing ? items.reduce((s: number, i: any) => s + (i.utilidadTotalPEN || 0), 0) : totals.utilidadTotalPEN_Sum],
      ["Margen Promedio (%)", isViewing ? (items.reduce((s: number, i: any) => s + (i.margenPorcentaje || 0), 0) / items.length) : totals.margenPromedio],
      [],
      ["DETALLE DE PRODUCTOS"]
    ];

    const itemHeaders = ["SKU", "Producto", "Cantidad", "Val. Unit USD", "Total USD", "Costo Unit USD", "Costo Unit PEN", "Precio Venta PEN", "Utilidad PEN", "Margen %"];
    const itemData = (isViewing ? items : totals.finalItems).map((i: any) => [
      i.sku, i.producto, i.cantidad, i.valorUnitario, i.valorTotal, i.costoTotalUnitario, i.costoUnitarioSoles, i.precioVentaPEN, i.utilidadUnitarioPEN, i.margenPorcentaje
    ]);

    const finalSheetData = [...generalInfo, itemHeaders, ...itemData];
    const ws = XLSX.utils.aoa_to_sheet(finalSheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Costeo Completo");
    XLSX.writeFile(wb, `Costeo_Completo_${selectedCosteo?.codigo || 'Nuevo'}.xlsx`);
  };

  return (
    <div className="page-container bg-slate-50 min-h-screen">
      <div className="page-header flex justify-between items-end mb-8 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Costeo de Importación</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <TrendingUp size={16} /> Inteligencia de costos y proyección de márgenes
          </p>
        </div>
        <button className="btn btn-primary shadow-indigo-200 shadow-lg px-6 py-3 rounded-xl transition-all hover:scale-105 active:scale-95" onClick={() => setShowModal(true)}>
          <Plus size={20} /> Nuevo Cálculo
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {costeos.length === 0 && !loading ? (
          <div className="card flex flex-col items-center justify-center py-20 text-center border-dashed border-2 border-slate-300 bg-white/50">
            <Calculator size={64} className="text-slate-300 mb-4" />
            <h2 className="text-xl font-bold text-slate-600">No hay costeos registrados</h2>
            <p className="text-slate-400 mt-2">Comience creando un nuevo cálculo para sus importaciones.</p>
          </div>
        ) : (
          <div className="card overflow-hidden border-0 shadow-xl shadow-slate-200/50">
            <div className="table-responsive">
              <table className="table">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    <th className="px-6 py-4">Código</th>
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Incoterm</th>
                    <th className="px-6 py-4 text-right">Costo Total (USD)</th>
                    <th className="px-6 py-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {costeos.map((c) => (
                    <tr key={c.id} className="hover:bg-indigo-50/30 transition-colors group">
                      <td className="px-6 py-4 font-bold text-indigo-600">{c.codigo}</td>
                      <td className="px-6 py-4 text-slate-500">{format(new Date(c.createdAt), 'dd/MM/yyyy')}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-700">{c.cliente?.razonSocial || c.clienteNombre}</span>
                          <span className="text-xs text-slate-400">{c.nroFacturaComercial || 'S/F'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4"><span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600">{c.incoterm}</span></td>
                      <td className="px-6 py-4 text-right font-extrabold text-slate-900">${formatNum(c.costoTotalImportacion)}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-3">
                          <button className="p-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm" onClick={() => viewCosteo(c)} title="Ver Detalle">
                            <Eye size={18} />
                          </button>
                          <button className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm" onClick={() => editCosteo(c)} title="Editar">
                            <Edit2 size={18} />
                          </button>
                          <button className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm" onClick={() => deleteCosteo(c.id)} title="Eliminar">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay backdrop-blur-sm bg-slate-900/60 transition-opacity flex items-center justify-center z-50">
          <div className="modal-content large bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col border border-slate-200">
            {/* Modal Header */}
            <div className="bg-slate-900 p-6 flex justify-between items-center text-white relative">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/30">
                  <Calculator size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">
                    {isViewing ? 'Resumen de Costeo' : isEditing ? 'Editar Registro' : 'Nuevo Análisis de Importación'}
                  </h2>
                  <div className="flex items-center gap-3 mt-1 opacity-80 text-xs">
                    <span className="flex items-center gap-1"><Clock size={12} /> {format(new Date(), 'dd/MM/yyyy HH:mm')}</span>
                    {selectedCosteo?.codigo && <span className="bg-white/20 px-2 py-0.5 rounded"># {selectedCosteo.codigo}</span>}
                    {formData.ordenId && <span className="text-indigo-400 font-bold">Orden: {ordenes.find(o => o.id === formData.ordenId)?.correlativo}</span>}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {(isViewing || isEditing) && (
                  <div className="flex gap-2 bg-white/10 p-1.5 rounded-xl mr-4 border border-white/10">
                    <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold transition-all" onClick={exportPDF}>
                      <Printer size={14} /> PDF
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold transition-all" onClick={exportExcel}>
                      <FileSpreadsheet size={14} /> EXCEL
                    </button>
                  </div>
                )}
                <button className="p-2 hover:bg-white/10 rounded-full transition-colors" onClick={() => { setShowModal(false); resetForm(); }}>
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="modal-body overflow-y-auto p-8 bg-slate-50/50 space-y-8 flex-1 custom-scrollbar">
              
              {/* Step 1: General & Logistics */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                    <Info size={16} className="text-indigo-600" /> Información General
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    {(user?.rol === 'SUPER_ADMIN' || user?.rol === 'ADMIN') && !isViewing && !isEditing && (
                      <div className="col-span-2 form-group">
                        <label className="text-xs font-bold text-slate-500 mb-2 block uppercase">Vincular Orden de Servicio</label>
                        <select value={formData.ordenId} onChange={(e) => handleOrdenChange(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium">
                          <option value="">-- Sin orden previa --</option>
                          {ordenes.map(o => (
                            <option key={o.id} value={o.id}>{o.anio}-{o.correlativo.toString().padStart(5, '0')} ({o.cotizacion.cliente.razonSocial})</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="form-group">
                      <label className="text-xs font-bold text-slate-500 mb-2 block uppercase">Cliente / Empresa</label>
                      <input type="text" value={formData.clienteNombre} onChange={(e) => setFormData({ ...formData, clienteNombre: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" disabled={isViewing || !!formData.ordenId} />
                    </div>
                    <div className="form-group">
                      <label className="text-xs font-bold text-slate-500 mb-2 block uppercase">Nro Documento</label>
                      <input type="text" value={formData.clienteDocumento} onChange={(e) => setFormData({ ...formData, clienteDocumento: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" disabled={isViewing || !!formData.ordenId} />
                    </div>
                    <div className="form-group">
                      <label className="text-xs font-bold text-slate-500 mb-2 block uppercase">Factura Comercial</label>
                      <input type="text" value={formData.nroFacturaComercial} onChange={(e) => setFormData({ ...formData, nroFacturaComercial: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3" disabled={isViewing} />
                    </div>
                    <div className="form-group">
                      <label className="text-xs font-bold text-slate-500 mb-2 block uppercase">Proveedor Extranjero</label>
                      <input type="text" value={formData.proveedorExtranjero} onChange={(e) => setFormData({ ...formData, proveedorExtranjero: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3" disabled={isViewing} />
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                    <Ship size={16} className="text-indigo-600" /> Logística y Aduanas
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">Incoterm</label>
                      <select value={formData.incoterm} onChange={(e) => setFormData({ ...formData, incoterm: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2" disabled={isViewing}>
                        <option value="EXW">EXW</option><option value="FOB">FOB</option><option value="FCA">FCA</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">T. Cambio (PEN)</label>
                      <input type="number" step="0.001" value={formData.tipoCambio || ''} onChange={(e) => setFormData({ ...formData, tipoCambio: parseFloat(e.target.value) || 0 })} className="w-full bg-indigo-50 border-indigo-200 border rounded-lg px-3 py-2 font-bold text-indigo-700" disabled={isViewing} placeholder="0.000" />
                    </div>
                    <div className="form-group">
                      <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">Fecha Embarque</label>
                      <input type="date" value={formData.fechaEmbarque} onChange={(e) => setFormData({ ...formData, fechaEmbarque: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs" disabled={isViewing} />
                    </div>
                    <div className="form-group">
                      <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">Canal Aduana</label>
                      <select value={formData.canal} onChange={(e) => setFormData({ ...formData, canal: e.target.value })} className={`w-full border rounded-lg px-3 py-2 font-bold text-xs ${formData.canal === 'VERDE' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : formData.canal === 'NARANJA' ? 'bg-orange-50 border-orange-200 text-orange-600' : formData.canal === 'ROJO' ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200'}`} disabled={isViewing}>
                        <option value="">-- Seleccionar --</option><option value="VERDE">VERDE</option><option value="NARANJA">NARANJA</option><option value="ROJO">ROJO</option>
                      </select>
                    </div>
                    <div className="form-group col-span-2">
                      <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">Nro DAM</label>
                      <input type="text" value={formData.nroDAM} onChange={(e) => setFormData({ ...formData, nroDAM: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2" disabled={isViewing} placeholder="Ej: 118-2024-10-..." />
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Product Grid */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="bg-slate-50 px-8 py-5 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <Package size={18} className="text-indigo-600" /> Detalle de Productos
                  </h3>
                  {!isViewing && (
                    <div className="flex gap-2">
                      <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all text-slate-600 shadow-sm" onClick={downloadTemplate}>
                        <Download size={14} /> Plantilla
                      </button>
                      <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all text-slate-600 shadow-sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload size={14} /> Importar Excel
                      </button>
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" style={{ display: 'none' }} />
                      <button className="flex items-center gap-2 px-6 py-2 bg-slate-800 hover:bg-slate-900 rounded-xl text-xs font-bold text-white shadow-lg transition-all" onClick={addItem}>
                        <Plus size={16} /> Nuevo Ítem
                      </button>
                    </div>
                  )}
                </div>

                <div className="table-responsive">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/50 text-slate-500 uppercase text-[10px] font-black border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4 text-left">SKU / Ref</th>
                        <th className="px-6 py-4 text-left">Producto</th>
                        <th className="px-6 py-4 text-right">Cantidad</th>
                        <th className="px-6 py-4 text-right">Val. Unit (USD)</th>
                        <th className="px-6 py-4 text-right">Total USD</th>
                        <th className="px-6 py-4 text-right">% AdVal</th>
                        <th className="px-6 py-4 text-right">Costo Unit (PEN)</th>
                        {!isViewing && <th className="px-6 py-4 text-center"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {items.map((item, idx) => {
                        const calc = isViewing ? item : totals.finalItems[idx];
                        return (
                          <tr key={idx} className="group hover:bg-indigo-50/20 transition-all">
                            <td className="px-6 py-3"><input type="text" value={item.sku} onChange={(e) => updateItem(idx, 'sku', e.target.value)} className="bg-transparent border-0 focus:ring-0 w-24 font-mono text-xs" disabled={isViewing} placeholder="SKU-..." /></td>
                            <td className="px-6 py-3"><input type="text" value={item.producto} onChange={(e) => updateItem(idx, 'producto', e.target.value)} className="bg-transparent border-0 focus:ring-0 w-full font-medium" disabled={isViewing} placeholder="Nombre producto" /></td>
                            <td className="px-6 py-3 text-right font-bold"><input type="number" value={item.cantidad || ''} onChange={(e) => updateItem(idx, 'cantidad', parseFloat(e.target.value) || 0)} className="bg-slate-100/50 rounded px-2 py-1 border-0 focus:ring-1 focus:ring-indigo-300 w-20 text-right" disabled={isViewing} /></td>
                            <td className="px-6 py-3 text-right"><input type="number" value={item.valorUnitario || ''} onChange={(e) => updateItem(idx, 'valorUnitario', parseFloat(e.target.value) || 0)} className="bg-slate-100/50 rounded px-2 py-1 border-0 focus:ring-1 focus:ring-indigo-300 w-24 text-right" disabled={isViewing} /></td>
                            <td className="px-6 py-3 text-right font-bold text-slate-700">${formatNum(item.valorTotal || 0)}</td>
                            <td className="px-6 py-3 text-right"><input type="number" value={item.adValoremPorcentaje} onChange={(e) => updateItem(idx, 'adValoremPorcentaje', e.target.value === '' ? '' : parseFloat(e.target.value))} className="bg-transparent border-0 w-16 text-right text-indigo-600 font-bold" placeholder="Auto" disabled={isViewing} /></td>
                            <td className="px-6 py-3 text-right font-black text-emerald-600">S/ {formatNum(calc?.costoUnitarioSoles || 0)}</td>
                            {!isViewing && (
                              <td className="px-6 py-3 text-center"><button onClick={() => removeItem(idx)} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button></td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Step 3: Expenses & Projections */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Financial Summary */}
                <div className="xl:col-span-4 space-y-6">
                  <div className="bg-indigo-600 p-6 rounded-3xl shadow-xl shadow-indigo-200 text-white">
                    <h3 className="text-xs font-black uppercase tracking-widest opacity-75 mb-4">Resumen Financiero (USD)</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center"><span className="text-sm">Total Factura</span><span className="font-bold">${formatNum(isViewing ? selectedCosteo.totalFacturaComercial : totals.totalFacturaComercial)}</span></div>
                      <div className="flex justify-between items-center"><span className="text-sm">Gastos Operativos</span><span className="font-bold">${formatNum(isViewing ? (selectedCosteo.gastosOrigen + selectedCosteo.fleteInternacional + selectedCosteo.seguro + selectedCosteo.gastosLocales) : (Number(formData.gastosOrigen) + Number(formData.fleteInternacional) + Number(formData.seguro) + Number(formData.gastosLocales)))}</span></div>
                      <div className="flex justify-between items-center"><span className="text-sm">Impuestos (AdV+IGV+IPM)</span><span className="font-bold">${formatNum(isViewing ? (selectedCosteo.adValoremGlobal + selectedCosteo.igv + selectedCosteo.ipm) : (totals.adValoremGlobal + totals.igv + totals.ipm))}</span></div>
                      <div className="pt-4 border-t border-white/20 flex justify-between items-end">
                        <span className="text-xs uppercase font-black">Costo Total Importación</span>
                        <span className="text-2xl font-black">${formatNum(isViewing ? selectedCosteo.costoTotalImportacion : totals.costoTotalImportacion)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Indicador Clave</h3>
                    <div className="flex items-center gap-4">
                      <div className="p-4 bg-slate-50 rounded-2xl">
                        <TrendingUp size={24} className="text-indigo-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-black text-slate-800">{formatNum(isViewing ? selectedCosteo.ratioImportacion : totals.ratioImportacion)}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Ratio de Importación</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Projection Grid */}
                <div className="xl:col-span-8 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                  <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Proyección de Ventas</h3>
                    <div className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full">UTILIDAD NETA (SIN IGV)</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-400 uppercase text-[9px] font-black">
                        <tr>
                          <th className="px-4 py-3 text-left">Ítem</th>
                          <th className="px-4 py-3 text-right">Precio Venta (PEN)</th>
                          <th className="px-4 py-3 text-right">Desc (%)</th>
                          <th className="px-4 py-3 text-right">Margen (%)</th>
                          <th className="px-4 py-3 text-right">Utilidad Total (PEN)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(isViewing ? items : totals.finalItems).map((i: any, idx: number) => (
                          <tr key={idx}>
                            <td className="px-4 py-3 font-medium truncate max-w-[150px]">{i.producto}</td>
                            <td className="px-4 py-3 text-right"><input type="number" value={i.precioVentaPEN || ''} onChange={(e) => updateItem(idx, 'precioVentaPEN', parseFloat(e.target.value) || 0)} className="w-20 text-right font-bold text-slate-700 bg-slate-50 rounded p-1" disabled={isViewing} /></td>
                            <td className="px-4 py-3 text-right"><input type="number" value={i.descuentoPorcentaje || ''} onChange={(e) => updateItem(idx, 'descuentoPorcentaje', parseFloat(e.target.value) || 0)} className="w-12 text-right bg-slate-50 rounded p-1" disabled={isViewing} /></td>
                            <td className={`px-4 py-3 text-right font-bold ${i.margenPorcentaje > 30 ? 'text-emerald-500' : 'text-orange-500'}`}>{formatNum(i.margenPorcentaje)}%</td>
                            <td className="px-4 py-3 text-right font-black text-slate-800">S/ {formatNum(i.utilidadTotalPEN)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Step 4: Proyeccion Dashboard Footer */}
              <div className="bg-slate-900 p-8 rounded-[2rem] shadow-2xl text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-10"><TrendingUp size={120} /></div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-50 mb-8">Resumen de Proyección Estratégica (PEN)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-12 relative z-10">
                  <div className="space-y-2">
                    <div className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Inversión Total</div>
                    <div className="text-3xl font-black">S/ {formatNum(isViewing ? (selectedCosteo.costoTotalImportacion * selectedCosteo.tipoCambio) : totals.costoTotalImportacionPEN)}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Ingresos Proyectados</div>
                    <div className="text-3xl font-black">S/ {formatNum(isViewing ? items.reduce((s: number, i: any) => s + (i.utilidadTotalPEN || 0) + (i.costoTotalSoles || 0), 0) : totals.ingresosTotalesPEN)}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">Utilidad Estimada</div>
                    <div className="text-3xl font-black text-emerald-400">+{formatNum(isViewing ? items.reduce((s: number, i: any) => s + (i.utilidadTotalPEN || 0), 0) : totals.utilidadTotalPEN_Sum)}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">Margen Promedio</div>
                    <div className="text-3xl font-black text-emerald-400">{formatNum(isViewing ? (items.reduce((s: number, i: any) => s + (i.margenPorcentaje || 0), 0) / items.length) : totals.margenPromedio)}%</div>
                  </div>
                </div>
              </div>

            </div>

            <div className="modal-footer p-6 bg-white border-t border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {isViewing && selectedCosteo && (
                  <>
                    <span className="flex items-center gap-1.5"><User size={12} /> Creado por: {selectedCosteo.empresa?.razonSocial}</span>
                    <span className="flex items-center gap-1.5"><Calendar size={12} /> {format(new Date(selectedCosteo.createdAt), 'dd/MM/yyyy HH:mm')}</span>
                  </>
                )}
              </div>
              <div className="flex gap-4">
                <button className="px-8 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-2xl font-bold transition-all" onClick={() => { setShowModal(false); resetForm(); }}>{isViewing ? 'Cerrar Vista' : 'Descartar'}</button>
                {!isViewing && (
                  <button className="px-10 py-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all transform active:scale-95" onClick={handleSave}>
                    {isEditing ? 'Confirmar Cambios' : 'Finalizar y Guardar'}
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
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        .btn-primary { background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); color: white; border: none; }
        .modal-overlay { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};

export default Costeos;
