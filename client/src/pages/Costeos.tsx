import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Search, FileText, ChevronRight, Save, X, Trash2, 
  Calculator, Info, Package, DollarSign, RefreshCw, TrendingUp,
  Download, Upload, FileSpreadsheet, CheckCircle, AlertTriangle,
  Edit2, FileDown, Eye, Calendar, Ship, MapPin, ExternalLink,
  ChevronDown, ChevronUp, Clock, User, ArrowRight, Printer,
  Gavel, Landmark
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jsPDF';
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
        seguro: 0,
        tipoCambio: formData.tipoCambio // Preserve TC
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
    const percepcionMonto = (baseImponible + igv + ipm) * (Number(formData.percepcionPorcentaje || 0) / 100);

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
  };

  const viewCosteo = (costeo: any) => {
    setSelectedCosteo(costeo);
    setIsViewing(true);
    setIsEditing(false);
    setShowModal(true);
    setItems(costeo.items || []);
    setFormData({
      ...formData,
      tipoCambio: costeo.tipoCambio,
      incoterm: costeo.incoterm,
      moneda: costeo.moneda,
      gastosOrigen: costeo.gastosOrigen,
      fleteInternacional: costeo.fleteInternacional,
      seguro: costeo.seguro,
      gastosLocales: costeo.gastosLocales,
      adValoremGlobal: costeo.adValoremGlobal,
      percepcionPorcentaje: costeo.percepcionPorcentaje,
      fechaEmbarque: costeo.fechaEmbarque ? format(new Date(costeo.fechaEmbarque), 'yyyy-MM-dd') : '',
      fechaLlegada: costeo.fechaLlegada ? format(new Date(costeo.fechaLlegada), 'yyyy-MM-dd') : '',
      canal: costeo.canal || '',
      nroDAM: costeo.nroDAM || '',
      clienteNombre: costeo.clienteNombre || costeo.cliente?.razonSocial || '',
      clienteDocumento: costeo.clienteDocumento || costeo.cliente?.ruc || '',
      nroFacturaComercial: costeo.nroFacturaComercial || '',
      proveedorExtranjero: costeo.proveedorExtranjero || ''
    });
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
          }
        });
        setItems([...items, ...newItems]);
        setUploadProgress(100);
        setTimeout(() => setIsUploading(false), 2000);
      } catch (err) {
        alert('Error al leer el archivo Excel');
        setIsUploading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const exportPDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const data = isViewing ? { ...formData, ...totals } : { ...formData, ...totals };
      const tc = Number(formData.tipoCambio || 1);
      const clienteName = isViewing ? (selectedCosteo.cliente?.razonSocial || selectedCosteo.clienteNombre) : formData.clienteNombre;
      
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, 210, 35, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.text("COSTEO DE IMPORTACIÓN", 15, 18);
      doc.setFontSize(9);
      doc.text(`CÓDIGO: ${selectedCosteo?.codigo || 'BORRADOR'}`, 15, 26);
      doc.text(`FECHA: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 15, 30);

      const drawSection = (title: string, y: number) => {
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 15, y);
        doc.setDrawColor(226, 232, 240);
        doc.line(15, y + 2, 195, y + 2);
        return y + 10;
      };

      let currentY = 45;
      currentY = drawSection("DATOS GENERALES Y LOGÍSTICA", currentY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Cliente: ${clienteName}`, 15, currentY);
      doc.text(`Factura: ${data.nroFacturaComercial || '-'}`, 15, currentY + 5);
      doc.text(`Incoterm: ${data.incoterm}`, 100, currentY);
      doc.text(`Moneda: ${data.moneda} / T.C.: ${tc}`, 100, currentY + 5);
      doc.text(`Fecha Embarque: ${data.fechaEmbarque || '-'}`, 15, currentY + 10);
      doc.text(`DAM: ${data.nroDAM || '-'}`, 100, currentY + 10);

      currentY += 20;
      currentY = drawSection("TRIBUTOS POR PAGAR", currentY);
      doc.setFontSize(8);
      const taxData = [
        ["CONCEPTO", `MONEDA (${data.moneda})`, "SOLES (PEN)"],
        ["AdValorem", `$${formatNum(data.adValoremGlobal)}`, `S/ ${formatNum(data.adValoremGlobal * tc)}`],
        ["IGV (16%)", `$${formatNum(data.igv)}`, `S/ ${formatNum(data.igv * tc)}`],
        ["IPM (2%)", `$${formatNum(data.ipm)}`, `S/ ${formatNum(data.ipm * tc)}`],
        ["Percepción", `$${formatNum(data.percepcionMonto)}`, `S/ ${formatNum(data.percepcionMonto * tc)}`],
        ["TOTAL TRIBUTOS", `$${formatNum(data.adValoremGlobal + data.igv + data.ipm + data.percepcionMonto)}`, `S/ ${formatNum((data.adValoremGlobal + data.igv + data.ipm + data.percepcionMonto) * tc)}`]
      ];
      
      autoTable(doc, {
        startY: currentY,
        head: [taxData[0]],
        body: taxData.slice(1),
        theme: 'grid',
        styles: { fontSize: 7 },
        headStyles: { fillColor: [51, 65, 85] }
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
      currentY = drawSection("DETALLE DE PRODUCTOS", currentY);
      const itemsTable = (isViewing ? items : totals.finalItems).map((i: any) => [
        i.sku || '-', i.producto, i.cantidad, formatNum(i.valorUnitario), formatNum(i.costoTotalUnitario), formatNum(i.costoUnitarioSoles)
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['SKU', 'Producto', 'Cant', 'Val. Unit', 'Costo USD', 'Costo PEN']],
        body: itemsTable,
        theme: 'striped',
        styles: { fontSize: 7 },
        headStyles: { fillColor: [79, 70, 229] }
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
      currentY = drawSection("RESUMEN DE PROYECCIÓN ESTRATÉGICA", currentY);
      doc.setFontSize(9);
      doc.text(`Inversión Total: S/ ${formatNum(data.costoTotalImportacionPEN)}`, 15, currentY);
      doc.text(`Utilidad Total: S/ ${formatNum(data.utilidadTotalPEN_Sum)}`, 100, currentY);
      doc.text(`Margen Promedio: ${formatNum(data.margenPromedio)}%`, 15, currentY + 6);
      doc.text(`Ratio de Importación: ${formatNum(data.ratioImportacion)}`, 100, currentY + 6);

      doc.save(`Costeo_Peru_${selectedCosteo?.codigo || 'Nuevo'}.pdf`);
    } catch (err) {
      alert('Error al generar PDF.');
    }
  };

  const exportExcel = () => {
    const data = isViewing ? { ...formData, ...totals } : { ...formData, ...totals };
    const tc = Number(formData.tipoCambio || 1);
    const clienteName = isViewing ? (selectedCosteo.cliente?.razonSocial || selectedCosteo.clienteNombre) : formData.clienteNombre;
    
    const content = [
      ["COSTEO DE IMPORTACIÓN - DETALLE COMPLETO"],
      ["FECHA", format(new Date(), 'dd/MM/yyyy')],
      [],
      ["DATOS GENERALES"],
      ["Código", selectedCosteo?.codigo || "BORRADOR"],
      ["Cliente", clienteName],
      ["Factura", data.nroFacturaComercial],
      ["Incoterm", data.incoterm],
      ["Moneda", data.moneda],
      ["Tipo Cambio", tc],
      [],
      ["LOGÍSTICA"],
      ["Fecha Embarque", data.fechaEmbarque],
      ["DAM", data.nroDAM],
      ["Canal", data.canal],
      [],
      ["TRIBUTOS POR PAGAR", `EN ${data.moneda}`, "EN SOLES (PEN)"],
      ["AdValorem", data.adValoremGlobal, data.adValoremGlobal * tc],
      ["IGV", data.igv, data.igv * tc],
      ["IPM", data.ipm, data.ipm * tc],
      ["Percepción", data.percepcionMonto, data.percepcionMonto * tc],
      ["TOTAL TRIBUTOS", data.adValoremGlobal + data.igv + data.ipm + data.percepcionMonto, (data.adValoremGlobal + data.igv + data.ipm + data.percepcionMonto) * tc],
      [],
      ["RESUMEN PROYECCIÓN"],
      ["Inversión Total (PEN)", data.costoTotalImportacionPEN],
      ["Utilidad Total (PEN)", data.utilidadTotalPEN_Sum],
      ["Margen Promedio (%)", data.margenPromedio],
      ["Ratio de Importación", data.ratioImportacion],
      [],
      ["DETALLE DE PRODUCTOS"],
      ["SKU", "Producto", "Cantidad", "Val Unit USD", "Total USD", "Costo Unit USD", "Costo Unit PEN", "Precio Venta PEN", "Utilidad PEN", "Margen %"]
    ];

    (isViewing ? items : totals.finalItems).forEach((i: any) => {
      content.push([i.sku, i.producto, i.cantidad, i.valorUnitario, i.valorTotal, i.costoTotalUnitario, i.costoUnitarioSoles, i.precioVentaPEN, i.utilidadUnitarioPEN, i.margenPorcentaje]);
    });

    const ws = XLSX.utils.aoa_to_sheet(content);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Costeo");
    XLSX.writeFile(wb, `Costeo_Excel_${selectedCosteo?.codigo || 'Nuevo'}.xlsx`);
  };

  return (
    <div className="page-container bg-slate-50 min-h-screen">
      <div className="page-header flex justify-between items-end mb-8 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Costeo de Importación</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2"><TrendingUp size={16} /> Gestión avanzada de costos y rentabilidad</p>
        </div>
        <button className="btn btn-primary shadow-indigo-200 shadow-lg px-6 py-3 rounded-xl hover:scale-105 transition-all" onClick={() => setShowModal(true)}>
          <Plus size={20} /> Nuevo Cálculo
        </button>
      </div>

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
                <tr key={c.id} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="px-6 py-4 font-bold text-indigo-600">{c.codigo}</td>
                  <td className="px-6 py-4 text-slate-500">{format(new Date(c.createdAt), 'dd/MM/yyyy')}</td>
                  <td className="px-6 py-4 font-semibold text-slate-700">{c.cliente?.razonSocial || c.clienteNombre}</td>
                  <td className="px-6 py-4"><span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold">{c.incoterm}</span></td>
                  <td className="px-6 py-4 text-right font-extrabold text-slate-900">${formatNum(c.costoTotalImportacion)}</td>
                  <td className="px-6 py-4 text-center flex justify-center gap-2">
                    <button className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all" onClick={() => viewCosteo(c)} title="Ver"><Eye size={18} /></button>
                    <button className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all" onClick={() => editCosteo(c)} title="Editar"><Edit2 size={18} /></button>
                    <button className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all" onClick={() => deleteCosteo(c.id)} title="Eliminar"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay backdrop-blur-sm bg-slate-900/60 z-50 fixed inset-0 flex items-center justify-center p-4">
          <div className="modal-content-custom bg-white shadow-2xl overflow-hidden flex flex-col rounded-3xl w-full max-w-[1400px] h-[95vh]">
            {/* Header */}
            <div className="bg-slate-900 p-6 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg"><Calculator size={24} /></div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">{isViewing ? 'Resumen de Costeo' : isEditing ? 'Editar Registro' : 'Nuevo Análisis'}</h2>
                  <div className="flex items-center gap-3 mt-1 opacity-80 text-[10px] font-bold uppercase tracking-wider">
                    <span># {selectedCosteo?.codigo || 'BORRADOR'}</span>
                    {formData.ordenId && <span className="text-indigo-400">Orden: {ordenes.find(o => o.id === formData.ordenId)?.correlativo}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {(isViewing || isEditing) && (
                  <div className="flex gap-2 mr-4">
                    <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold transition-all" onClick={exportPDF}><Printer size={14} /> PDF</button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold transition-all" onClick={exportExcel}><FileSpreadsheet size={14} /> EXCEL</button>
                  </div>
                )}
                <button className="p-2 hover:bg-white/10 rounded-full transition-colors" onClick={() => { setShowModal(false); resetForm(); }}><X size={24} /></button>
              </div>
            </div>
            
            {/* Body */}
            <div className="overflow-y-auto p-8 bg-slate-50/30 flex-1 space-y-8 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* General Data */}
                <div className="lg:col-span-8 space-y-8">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6"><Info size={16} className="text-indigo-600" /> Datos Principales</h3>
                    <div className="grid grid-cols-3 gap-6">
                      {!isViewing && !isEditing && (
                        <div className="col-span-3 form-group">
                          <label className="text-[10px] font-bold text-slate-500 mb-1 uppercase">Vincular con Orden</label>
                          <select value={formData.ordenId} onChange={(e) => handleOrdenChange(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium">
                            <option value="">-- Manual / Sin orden --</option>
                            {ordenes.map(o => (
                              <option key={o.id} value={o.id}>{o.anio}-{o.correlativo.toString().padStart(5, '0')} ({o.cotizacion.cliente.razonSocial})</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="form-group">
                        <label className="text-[10px] font-bold text-slate-500 mb-1 uppercase">Cliente</label>
                        <input type="text" value={formData.clienteNombre} onChange={(e) => setFormData({ ...formData, clienteNombre: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" disabled={isViewing || !!formData.ordenId} />
                      </div>
                      <div className="form-group">
                        <label className="text-[10px] font-bold text-slate-500 mb-1 uppercase">Factura Comercial</label>
                        <input type="text" value={formData.nroFacturaComercial} onChange={(e) => setFormData({ ...formData, nroFacturaComercial: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" disabled={isViewing} />
                      </div>
                      <div className="form-group">
                        <label className="text-[10px] font-bold text-slate-500 mb-1 uppercase">Tipo Cambio (PEN)</label>
                        <input type="number" step="0.001" value={formData.tipoCambio || ''} onChange={(e) => setFormData({ ...formData, tipoCambio: parseFloat(e.target.value) || 0 })} className="w-full bg-indigo-50 border-indigo-200 border rounded-xl px-4 py-2.5 font-bold text-indigo-700 text-sm" disabled={isViewing} />
                      </div>
                    </div>
                  </div>

                  {/* Products Grid */}
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><Package size={18} className="text-indigo-600" /> Detalle de Productos</h3>
                      {!isViewing && (
                        <div className="flex gap-2">
                          <button className="p-2 bg-white border border-slate-200 rounded-lg shadow-sm" onClick={() => fileInputRef.current?.click()} title="Importar Excel"><Upload size={14} /></button>
                          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" style={{ display: 'none' }} />
                          <button className="px-4 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-bold" onClick={addItem}>+ AGREGAR ÍTEM</button>
                        </div>
                      )}
                    </div>
                    <div className="overflow-x-auto max-h-[400px]">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50/50 text-slate-500 uppercase text-[9px] font-black sticky top-0 z-10 border-b border-slate-100">
                          <tr>
                            <th className="px-4 py-3 text-left">SKU</th>
                            <th className="px-4 py-3 text-left">Producto</th>
                            <th className="px-4 py-3 text-right">Cant</th>
                            <th className="px-4 py-3 text-right">Unit USD</th>
                            <th className="px-4 py-3 text-right">Costo PEN</th>
                            {!isViewing && <th className="px-4 py-3"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {items.map((item, idx) => {
                            const calc = isViewing ? item : totals.finalItems[idx];
                            return (
                              <tr key={idx} className="hover:bg-indigo-50/10">
                                <td className="px-4 py-2"><input type="text" value={item.sku} onChange={(e) => updateItem(idx, 'sku', e.target.value)} className="bg-transparent w-16 border-0 focus:ring-0" disabled={isViewing} /></td>
                                <td className="px-4 py-2"><input type="text" value={item.producto} onChange={(e) => updateItem(idx, 'producto', e.target.value)} className="bg-transparent w-full border-0 focus:ring-0 font-medium" disabled={isViewing} /></td>
                                <td className="px-4 py-2 text-right"><input type="number" value={item.cantidad || ''} onChange={(e) => updateItem(idx, 'cantidad', parseFloat(e.target.value) || 0)} className="w-16 text-right border-0 focus:ring-0 bg-slate-50 rounded" disabled={isViewing} /></td>
                                <td className="px-4 py-2 text-right"><input type="number" value={item.valorUnitario || ''} onChange={(e) => updateItem(idx, 'valorUnitario', parseFloat(e.target.value) || 0)} className="w-16 text-right border-0 focus:ring-0 bg-slate-50 rounded" disabled={isViewing} /></td>
                                <td className="px-4 py-2 text-right font-black text-emerald-600">S/ {formatNum(calc?.costoUnitarioSoles || 0)}</td>
                                {!isViewing && <td className="px-4 py-2 text-center"><button onClick={() => removeItem(idx)} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button></td>}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right Panel: Logistics & Taxes */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Logistics Section */}
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4"><Ship size={16} className="text-indigo-600" /> Logística</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="form-group">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Incoterm</label>
                        <select value={formData.incoterm} onChange={(e) => setFormData({ ...formData, incoterm: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs" disabled={isViewing}>
                          <option value="EXW">EXW</option><option value="FOB">FOB</option><option value="FCA">FCA</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">DAM / DUA</label>
                        <input type="text" value={formData.nroDAM} onChange={(e) => setFormData({ ...formData, nroDAM: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs" disabled={isViewing} placeholder="118-2024..." />
                      </div>
                      <div className="form-group">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Gastos Origen</label>
                        <input type="number" value={formData.gastosOrigen || ''} onChange={(e) => setFormData({ ...formData, gastosOrigen: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs" disabled={isViewing || formData.incoterm === 'FOB'} />
                      </div>
                      <div className="form-group">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Flete / Seguro</label>
                        <input type="number" value={formData.fleteInternacional || ''} onChange={(e) => setFormData({ ...formData, fleteInternacional: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs" disabled={isViewing} placeholder="Flete" />
                      </div>
                    </div>
                  </div>

                  {/* Tributos Section - IMPORTANT */}
                  <div className="bg-slate-800 p-6 rounded-3xl shadow-xl text-white">
                    <h3 className="text-xs font-black uppercase tracking-widest opacity-50 mb-4 flex items-center gap-2"><Landmark size={16} /> Tributos por Pagar</h3>
                    <div className="space-y-4">
                      {[
                        { label: 'AdValorem', val: totals.adValoremGlobal, tc: formData.tipoCambio },
                        { label: 'IGV (16%)', val: totals.igv, tc: formData.tipoCambio },
                        { label: 'IPM (2%)', val: totals.ipm, tc: formData.tipoCambio },
                        { label: 'Percepción', val: totals.percepcionMonto, tc: formData.tipoCambio }
                      ].map((tax, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="opacity-70">{tax.label}</span>
                          <div className="text-right">
                            <div className="font-bold">${formatNum(tax.val)}</div>
                            <div className="text-[9px] opacity-50">S/ {formatNum(tax.val * Number(tax.tc || 1))}</div>
                          </div>
                        </div>
                      ))}
                      <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                        <span className="text-[10px] font-black uppercase">Total Tributos</span>
                        <div className="text-right">
                          <div className="text-lg font-black text-indigo-400">${formatNum(totals.adValoremGlobal + totals.igv + totals.ipm + totals.percepcionMonto)}</div>
                          <div className="text-[10px] opacity-50 font-bold">S/ {formatNum((totals.adValoremGlobal + totals.igv + totals.ipm + totals.percepcionMonto) * Number(formData.tipoCambio || 1))}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Profit Projections Card */}
                  <div className="bg-indigo-600 p-6 rounded-3xl shadow-xl shadow-indigo-200 text-white">
                    <h3 className="text-xs font-black uppercase tracking-widest opacity-75 mb-4">Proyección de Rentabilidad</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center"><span className="text-xs opacity-80">Ingresos Totales (Neto)</span><span className="font-black">S/ {formatNum(totals.ingresosTotalesPEN)}</span></div>
                      <div className="flex justify-between items-center"><span className="text-xs opacity-80">Utilidad Proyectada</span><span className="font-black text-emerald-300">S/ {formatNum(totals.utilidadTotalPEN_Sum)}</span></div>
                      <div className="flex justify-between items-center"><span className="text-xs opacity-80">Margen Promedio</span><span className="px-2 py-0.5 bg-white/20 rounded-full font-black">{formatNum(totals.margenPromedio)}%</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Dashboard */}
            <div className="bg-slate-900 p-6 flex justify-between items-center text-white shrink-0">
              <div className="flex gap-12">
                <div className="space-y-0.5">
                  <div className="text-[9px] text-indigo-400 font-black uppercase tracking-widest">Inversión Total (PEN)</div>
                  <div className="text-2xl font-black">S/ {formatNum(totals.costoTotalImportacionPEN)}</div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-[9px] text-emerald-400 font-black uppercase tracking-widest">Ratio de Importación</div>
                  <div className="text-2xl font-black text-emerald-400">{formatNum(totals.ratioImportacion)}</div>
                </div>
              </div>
              <div className="flex gap-4 items-center">
                <div className="text-right text-[10px] text-slate-500 mr-8 leading-tight">
                  {selectedCosteo && <div>Creado: {format(new Date(selectedCosteo.createdAt), 'dd/MM/yyyy HH:mm')}</div>}
                </div>
                <button className="px-8 py-3 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-700 transition-all" onClick={() => { setShowModal(false); resetForm(); }}>CERRAR</button>
                {!isViewing && (
                  <button className="px-10 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition-all" onClick={handleSave}>
                    {isEditing ? 'ACTUALIZAR REGISTRO' : 'FINALIZAR Y GUARDAR'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .modal-content-custom { animation: zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes zoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default Costeos;
