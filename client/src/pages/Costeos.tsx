import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Search, FileText, ChevronRight, Save, X, Trash2, 
  Calculator, Info, Package, DollarSign, RefreshCw, TrendingUp,
  Download, Upload, FileSpreadsheet, CheckCircle, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

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
  const [selectedCosteo, setSelectedCosteo] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Excel Upload State
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
    percepcionPorcentaje: 0
  });

  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    fetchCosteos();
    if (user?.rol === 'SUPER_ADMIN' || user?.rol === 'ADMIN') {
      fetchOrdenes();
      fetchClientes();
    }
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
        gastosOrigen: 0, 
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

    const fobEquivalente = (formData.incoterm === 'FOB') 
      ? totalFacturaComercial 
      : (totalFacturaComercial + Number(formData.gastosOrigen || 0));

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
      const origenItem = Number(formData.gastosOrigen || 0) * item.participacion;
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

    const costoTotalImportacion = totalFacturaComercial + Number(formData.gastosOrigen || 0) + 
                                  Number(formData.fleteInternacional || 0) + Number(formData.seguro || 0) + 
                                  finalAdValoremGlobal + Number(formData.gastosLocales || 0);

    const ratioImportacion = totalFacturaComercial > 0 ? (costoTotalImportacion / totalFacturaComercial) : 0;

    // Resumen de Proyección (PEN)
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
      // Projection Totals
      costoTotalImportacionPEN,
      ingresosTotalesPEN,
      utilidadTotalPEN_Sum,
      margenPromedio
    };
  }, [items, formData]);

  const handleSave = async () => {
    if (items.length === 0) return alert('Debe agregar al menos un producto');
    if (!formData.tipoCambio) return alert('El tipo de cambio es obligatorio');

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

      await api.post('/costeos', payload);
      setShowModal(false);
      fetchCosteos();
      resetForm();
    } catch (err) {
      console.error('Error saving costeo', err);
      alert('Error al guardar el costeo. Verifique que todos los datos sean correctos.');
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
      percepcionPorcentaje: 0
    });
    setItems([]);
    setIsViewing(false);
    setSelectedCosteo(null);
    setUploadProgress(0);
    setUploadStats({ total: 0, success: 0, errors: 0 });
  };

  const viewCosteo = (costeo: any) => {
    setSelectedCosteo(costeo);
    setIsViewing(true);
    setShowModal(true);
  };

  // Excel Handlers
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
        
        setTimeout(() => {
          setIsUploading(false);
        }, 2000);
      } catch (err) {
        console.error('Error reading excel', err);
        alert('Error al leer el archivo Excel');
        setIsUploading(false);
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Costeo de Importación</h1>
          <p>Cálculo de costo real de productos puestos en Perú</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Nuevo Costeo
        </button>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Factura</th>
                <th>Incoterm</th>
                <th>Total Costo (USD)</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {costeos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center">No hay costeos registrados</td>
                </tr>
              ) : (
                costeos.map((c) => (
                  <tr key={c.id}>
                    <td className="font-bold">{c.codigo}</td>
                    <td>{format(new Date(c.createdAt), 'dd/MM/yyyy')}</td>
                    <td>{c.cliente?.razonSocial || c.clienteNombre}</td>
                    <td>{c.nroFacturaComercial || '-'}</td>
                    <td><span className="badge">{c.incoterm}</span></td>
                    <td className="font-bold text-primary">${formatNum(c.costoTotalImportacion)}</td>
                    <td>
                      <button className="btn-icon" onClick={() => viewCosteo(c)}>
                        <Search size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <div className="modal-header">
              <h2>{isViewing ? `Detalle Costeo: ${selectedCosteo?.codigo}` : 'Nuevo Costeo de Importación'}</h2>
              <button className="close-btn" onClick={() => { setShowModal(false); resetForm(); }}><X size={24} /></button>
            </div>
            
            <div className="modal-body">
              {/* Seccion 1: Datos Generales */}
              <div className="form-section">
                <h3 className="section-title"><Info size={18} /> Datos Generales</h3>
                <div className="grid-3">
                  {(user?.rol === 'SUPER_ADMIN' || user?.rol === 'ADMIN') && !isViewing && (
                    <div className="form-group">
                      <label>Vincular Orden</label>
                      <select 
                        value={formData.ordenId} 
                        onChange={(e) => handleOrdenChange(e.target.value)}
                        className="form-control"
                      >
                        <option value="">-- Sin orden previa --</option>
                        {ordenes.map(o => (
                          <option key={o.id} value={o.id}>{o.anio}-{o.correlativo.toString().padStart(5, '0')} ({o.cotizacion.cliente.razonSocial})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div className="form-group">
                    <label>Cliente / Razón Social *</label>
                    <input 
                      type="text" 
                      value={isViewing ? (selectedCosteo?.cliente?.razonSocial || selectedCosteo?.clienteNombre) : formData.clienteNombre}
                      onChange={(e) => setFormData({ ...formData, clienteNombre: e.target.value })}
                      className="form-control"
                      placeholder="Ingrese razón social"
                      disabled={isViewing || !!formData.ordenId}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>RUC / DNI</label>
                    <input 
                      type="text" 
                      value={isViewing ? (selectedCosteo?.cliente?.ruc || selectedCosteo?.clienteDocumento) : formData.clienteDocumento}
                      onChange={(e) => setFormData({ ...formData, clienteDocumento: e.target.value })}
                      className="form-control"
                      placeholder="Ingrese RUC o DNI"
                      disabled={isViewing || !!formData.ordenId}
                    />
                  </div>

                  <div className="form-group">
                    <label>Factura Comercial</label>
                    <input 
                      type="text" 
                      value={isViewing ? selectedCosteo?.nroFacturaComercial : formData.nroFacturaComercial}
                      onChange={(e) => setFormData({ ...formData, nroFacturaComercial: e.target.value })}
                      className="form-control"
                      disabled={isViewing}
                    />
                  </div>

                  <div className="form-group">
                    <label>Proveedor Extranjero</label>
                    <input 
                      type="text" 
                      value={isViewing ? selectedCosteo?.proveedorExtranjero : formData.proveedorExtranjero}
                      onChange={(e) => setFormData({ ...formData, proveedorExtranjero: e.target.value })}
                      className="form-control"
                      disabled={isViewing}
                    />
                  </div>

                  <div className="form-group">
                    <label>Incoterm *</label>
                    <select 
                      value={isViewing ? selectedCosteo?.incoterm : formData.incoterm}
                      onChange={(e) => setFormData({ ...formData, incoterm: e.target.value })}
                      className="form-control"
                      disabled={isViewing}
                    >
                      <option value="EXW">EXW</option>
                      <option value="FOB">FOB</option>
                      <option value="FCA">FCA</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Moneda *</label>
                    <select 
                      value={isViewing ? selectedCosteo?.moneda : formData.moneda}
                      onChange={(e) => setFormData({ ...formData, moneda: e.target.value })}
                      className="form-control"
                      disabled={isViewing}
                    >
                      <option value="USD">USD - Dólar</option>
                      <option value="EUR">EUR - Euro</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Tipo de Cambio *</label>
                    <input 
                      type="number" 
                      step="0.001"
                      value={isViewing ? selectedCosteo?.tipoCambio : (formData.tipoCambio === 0 ? '' : formData.tipoCambio)}
                      onChange={(e) => setFormData({ ...formData, tipoCambio: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                      className="form-control"
                      disabled={isViewing}
                      placeholder="0.000"
                    />
                  </div>
                </div>
              </div>

              {/* Seccion 2: Productos con Excel */}
              <div className="form-section">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-4">
                    <h3 className="section-title mb-0"><Package size={18} /> Productos</h3>
                    {!isViewing && (
                      <div className="excel-actions flex items-center gap-2">
                        <button className="btn btn-secondary btn-sm" onClick={downloadTemplate} title="Descargar Plantilla">
                          <Download size={14} /> Plantilla
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()} title="Subir Excel">
                          <Upload size={14} /> Subir Excel
                        </button>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleFileUpload} 
                          accept=".xlsx, .xls" 
                          style={{ display: 'none' }} 
                        />
                      </div>
                    )}
                  </div>
                  {!isViewing && (
                    <button className="btn btn-primary btn-sm" onClick={addItem}>
                      <Plus size={14} /> Agregar Item
                    </button>
                  )}
                </div>

                {isUploading && (
                  <div className="upload-progress-container mb-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Procesando archivo... {uploadProgress}%</span>
                      {uploadProgress === 100 && (
                        <span className="text-success flex items-center gap-1">
                          <CheckCircle size={12} /> Carga finalizada
                        </span>
                      )}
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                    {uploadStats.total > 0 && (
                      <div className="flex gap-3 mt-2 text-xs">
                        <span>Total: <strong>{uploadStats.total}</strong></span>
                        <span className="text-success">Éxito: <strong>{uploadStats.success}</strong></span>
                        <span className="text-danger">Errores: <strong>{uploadStats.errors}</strong></span>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="table-responsive">
                  <table className="table grid-table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Producto</th>
                        <th>Cant.</th>
                        <th>Val. Unit.</th>
                        <th>Val. Total</th>
                        <th>% AdVal.</th>
                        <th>Costo Unit. (USD)</th>
                        <th>Costo Unit. (PEN)</th>
                        {!isViewing && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {(isViewing ? selectedCosteo?.items : items).map((item: any, idx: number) => {
                        const calcItem = isViewing ? item : totals.finalItems[idx];
                        return (
                          <tr key={idx}>
                            <td>
                              <input 
                                type="text" 
                                value={item.sku} 
                                onChange={(e) => updateItem(idx, 'sku', e.target.value)}
                                className="form-control-sm"
                                disabled={isViewing}
                                style={{ minWidth: '80px' }}
                              />
                            </td>
                            <td>
                              <input 
                                type="text" 
                                value={item.producto} 
                                onChange={(e) => updateItem(idx, 'producto', e.target.value)}
                                className="form-control-sm"
                                disabled={isViewing}
                                style={{ minWidth: '150px' }}
                              />
                            </td>
                            <td width="90">
                              <input 
                                type="number" 
                                value={item.cantidad === 0 ? '' : item.cantidad} 
                                onChange={(e) => updateItem(idx, 'cantidad', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                className="form-control-sm text-right"
                                disabled={isViewing}
                                style={{ minWidth: '70px' }}
                              />
                            </td>
                            <td width="100">
                              <input 
                                type="number" 
                                value={item.valorUnitario === 0 ? '' : item.valorUnitario} 
                                onChange={(e) => updateItem(idx, 'valorUnitario', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                className="form-control-sm text-right"
                                disabled={isViewing}
                                style={{ minWidth: '90px' }}
                              />
                            </td>
                            <td className="text-right font-semibold">
                              {formatNum(item.valorTotal || 0)}
                            </td>
                            <td width="80">
                              <input 
                                type="number" 
                                value={item.adValoremPorcentaje} 
                                onChange={(e) => updateItem(idx, 'adValoremPorcentaje', e.target.value === '' ? '' : parseFloat(e.target.value))}
                                className="form-control-sm text-right"
                                placeholder="Auto"
                                disabled={isViewing}
                              />
                            </td>
                            <td className="text-right text-primary font-bold">
                              ${formatNum(calcItem?.costoTotalUnitario || 0)}
                            </td>
                            <td className="text-right text-success font-bold">
                              S/ {formatNum(calcItem?.costoUnitarioSoles || 0)}
                            </td>
                            {!isViewing && (
                              <td>
                                <button className="btn-icon text-danger" onClick={() => removeItem(idx)}>
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sección: Distribución de Costos y Proyección de Ventas */}
              <div className="form-section projection-section">
                <h3 className="section-title"><TrendingUp size={18} /> Distribución de Costos y Proyección de Ventas</h3>
                <div className="table-responsive">
                  <table className="table projection-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th className="text-right">Costo Unit. (USD)</th>
                        <th className="text-right">Costo Lote (USD)</th>
                        <th className="text-right">Costo Unit. (PEN)</th>
                        <th className="text-right">Precio Venta (PEN)</th>
                        <th className="text-right">Desc. B2B (%)</th>
                        <th className="text-right">Margen %</th>
                        <th className="text-right">Utilidad Unit. (PEN)</th>
                        <th className="text-right">Utilidad Total (PEN)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(isViewing ? selectedCosteo?.items : totals.finalItems).map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="font-medium">{item.producto}</td>
                          <td className="text-right">${formatNum(item.costoTotalUnitario)}</td>
                          <td className="text-right text-primary">${formatNum(item.costoTotalTotal)}</td>
                          <td className="text-right text-success">S/ {formatNum(item.costoUnitarioSoles)}</td>
                          <td className="text-right">
                            <input 
                              type="number" 
                              value={item.precioVentaPEN === 0 ? '' : item.precioVentaPEN} 
                              onChange={(e) => updateItem(idx, 'precioVentaPEN', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                              className="form-control-sm text-right bg-white"
                              disabled={isViewing}
                              style={{ width: '100px' }}
                            />
                          </td>
                          <td className="text-right">
                            <input 
                              type="number" 
                              value={item.descuentoPorcentaje === 0 ? '' : item.descuentoPorcentaje} 
                              onChange={(e) => updateItem(idx, 'descuentoPorcentaje', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                              className="form-control-sm text-right bg-white"
                              disabled={isViewing}
                              style={{ width: '80px' }}
                            />
                          </td>
                          <td className={`text-right font-bold ${item.margenPorcentaje > 0 ? 'text-success' : 'text-danger'}`}>
                            {formatNum(item.margenPorcentaje)}%
                          </td>
                          <td className="text-right text-success font-bold">S/ {formatNum(item.utilidadUnitarioPEN)}</td>
                          <td className="text-right text-success font-bold">S/ {formatNum(item.utilidadTotalPEN)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Seccion 3: Gastos e Impuestos */}
              <div className="grid-2 gap-6 mt-4">
                <div className="form-section">
                  <h3 className="section-title"><DollarSign size={18} /> Gastos Adicionales</h3>
                  <div className="grid-2">
                    <div className="form-group">
                      <label>Gastos Origen (USD)</label>
                      <input 
                        type="number" 
                        value={isViewing ? selectedCosteo?.gastosOrigen : (formData.gastosOrigen === 0 ? '' : formData.gastosOrigen)}
                        onChange={(e) => setFormData({ ...formData, gastosOrigen: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                        className="form-control"
                        disabled={isViewing}
                      />
                    </div>
                    <div className="form-group">
                      <label>Flete Internacional (USD)</label>
                      <input 
                        type="number" 
                        value={isViewing ? selectedCosteo?.fleteInternacional : (formData.fleteInternacional === 0 ? '' : formData.fleteInternacional)}
                        onChange={(e) => setFormData({ ...formData, fleteInternacional: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                        className="form-control"
                        disabled={isViewing}
                      />
                    </div>
                    <div className="form-group">
                      <label>Seguro (USD)</label>
                      <input 
                        type="number" 
                        value={isViewing ? selectedCosteo?.seguro : (formData.seguro === 0 ? '' : formData.seguro)}
                        onChange={(e) => setFormData({ ...formData, seguro: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                        className="form-control"
                        disabled={isViewing}
                      />
                    </div>
                    <div className="form-group">
                      <label>Gastos Locales (USD)</label>
                      <input 
                        type="number" 
                        value={isViewing ? selectedCosteo?.gastosLocales : (formData.gastosLocales === 0 ? '' : formData.gastosLocales)}
                        onChange={(e) => setFormData({ ...formData, gastosLocales: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                        className="form-control"
                        disabled={isViewing}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="section-title"><Calculator size={18} /> Impuestos y Percepción</h3>
                  <div className="grid-2">
                    <div className="form-group">
                      <label>% AdValorem Global</label>
                      <input 
                        type="number" 
                        value={isViewing ? selectedCosteo?.adValoremGlobalPorc : (formData.adValoremGlobal === 0 ? '' : formData.adValoremGlobal)}
                        onChange={(e) => setFormData({ ...formData, adValoremGlobal: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                        className="form-control"
                        placeholder="Solo si no hay en grilla"
                        disabled={isViewing || totals.hasItemAdValorem}
                      />
                      {totals.hasItemAdValorem && <small className="text-warning">Inactivo (hay valores en grilla)</small>}
                    </div>
                    <div className="form-group">
                      <label>% Percepción</label>
                      <input 
                        type="number" 
                        value={isViewing ? selectedCosteo?.percepcionPorcentaje : (formData.percepcionPorcentaje === 0 ? '' : formData.percepcionPorcentaje)}
                        onChange={(e) => setFormData({ ...formData, percepcionPorcentaje: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                        className="form-control"
                        disabled={isViewing}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seccion 4: Resumen de Proyección (PEN) - Estilo Imagen 1 */}
              <div className="form-section projection-summary-section">
                <h3 className="section-title text-sm uppercase opacity-70">RESUMEN DE PROYECCIÓN (PEN)</h3>
                <div className="projection-summary-grid">
                  <div className="summary-item">
                    <small>Costo Total Importación</small>
                    <div className="value">S/ {formatNum(isViewing ? (selectedCosteo?.costoTotalImportacion * selectedCosteo?.tipoCambio) : totals.costoTotalImportacionPEN)}</div>
                  </div>
                  <div className="summary-item border-l">
                    <small>Ingresos Totales (Valor Venta)</small>
                    <div className="value">S/ {formatNum(isViewing ? selectedCosteo?.items.reduce((s: number, i: any) => s + (i.utilidadTotalPEN || 0) + (i.costoTotalSoles || 0), 0) : totals.ingresosTotalesPEN)}</div>
                  </div>
                  <div className="summary-item border-l">
                    <small>Utilidad Total</small>
                    <div className="value text-success">+{formatNum(isViewing ? selectedCosteo?.items.reduce((s: number, i: any) => s + (i.utilidadTotalPEN || 0), 0) : totals.utilidadTotalPEN_Sum)}</div>
                  </div>
                  <div className="summary-item border-l">
                    <small>Margen Promedio</small>
                    <div className="value text-success">{formatNum(isViewing ? (selectedCosteo?.items.reduce((s: number, i: any) => s + (i.margenPorcentaje || 0), 0) / selectedCosteo?.items.length) : totals.margenPromedio)}%</div>
                  </div>
                  <div className="summary-item border-l">
                    <small>Ratio de Importación</small>
                    <div className="value text-primary">{formatNum(isViewing ? selectedCosteo?.ratioImportacion : totals.ratioImportacion)}</div>
                  </div>
                </div>
              </div>

              {/* Resumen Final de Totales (USD) */}
              <div className="summary-section mt-4">
                <div className="summary-grid">
                  <div className="summary-card">
                    <span>Total Factura</span>
                    <strong>${formatNum(isViewing ? selectedCosteo?.totalFacturaComercial : totals.totalFacturaComercial)}</strong>
                  </div>
                  <div className="summary-card">
                    <span>CIF Global</span>
                    <strong>${formatNum(isViewing ? selectedCosteo?.cifGlobal : totals.cifGlobal)}</strong>
                  </div>
                  <div className="summary-card">
                    <span>AdValorem Total</span>
                    <strong>${formatNum(isViewing ? selectedCosteo?.adValoremGlobal : totals.adValoremGlobal)}</strong>
                  </div>
                  <div className="summary-card">
                    <span>IGV (16%)</span>
                    <strong>${formatNum(isViewing ? selectedCosteo?.igv : totals.igv)}</strong>
                  </div>
                  <div className="summary-card highlight">
                    <span>COSTO TOTAL IMPORTACIÓN</span>
                    <strong>${formatNum(isViewing ? selectedCosteo?.costoTotalImportacion : totals.costoTotalImportacion)}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>
                {isViewing ? 'Cerrar' : 'Cancelar'}
              </button>
              {!isViewing && (
                <button className="btn btn-primary" onClick={handleSave}>
                  <Save size={18} /> Guardar Costeo
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .grid-table input, .projection-table input {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          padding: 0.25rem 0.5rem;
          font-family: inherit;
        }
        .form-section {
          background: #f8fafc;
          padding: 1.5rem;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          margin-bottom: 1rem;
        }
        .section-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--primary);
          margin-bottom: 1.25rem;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
        }
        .summary-card {
          background: white;
          padding: 1rem;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
        }
        .summary-card span {
          font-size: 0.75rem;
          color: var(--text-light);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.25rem;
        }
        .summary-card strong {
          font-size: 1.25rem;
          color: var(--text);
        }
        .summary-card.highlight {
          background: var(--primary);
          border-color: var(--primary);
        }
        .summary-card.highlight span {
          color: rgba(255, 255, 255, 0.8);
        }
        .summary-card.highlight strong {
          color: white;
          font-size: 1.5rem;
        }
        .modal-content.large {
          max-width: 1250px;
          width: 98%;
        }
        .projection-section {
          background: #f1f5f9;
        }
        .projection-table th {
          background: #e2e8f0 !important;
          color: #475569 !important;
          font-size: 0.75rem;
          text-transform: uppercase;
        }
        .projection-summary-section {
          background: #f8fafc;
          padding: 1rem 1.5rem;
        }
        .projection-summary-grid {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
        }
        .summary-item {
          flex: 1;
          padding: 0 1.5rem;
        }
        .summary-item.border-l {
          border-left: 1px solid #e2e8f0;
        }
        .summary-item small {
          display: block;
          color: #64748b;
          font-size: 0.8rem;
          margin-bottom: 0.5rem;
        }
        .summary-item .value {
          font-size: 1.5rem;
          font-weight: 800;
          color: #1e293b;
        }
        .progress-bar-bg {
          background: #e2e8f0;
          height: 8px;
          border-radius: 4px;
          overflow: hidden;
        }
        .progress-bar-fill {
          background: var(--primary);
          height: 100%;
          transition: width 0.3s ease;
        }
        .badge {
          background: #e2e8f0;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 700;
        }
        @media (max-width: 768px) {
          .projection-summary-grid {
            flex-direction: column;
            gap: 1.5rem;
          }
          .summary-item.border-l {
            border-left: none;
            border-top: 1px solid #e2e8f0;
            padding-top: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default Costeos;
