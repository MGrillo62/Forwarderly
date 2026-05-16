import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Search, FileText, ChevronRight, Save, X, Trash2, 
  Calculator, Info, Package, DollarSign, RefreshCw 
} from 'lucide-react';
import { format } from 'date-fns';

interface Item {
  sku: string;
  producto: string;
  cantidad: number;
  valorUnitario: number;
  valorTotal: number;
  adValoremPorcentaje: number | '';
  // Calculated fields for UI display
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

  // Form State
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
      // For now, these fields are not in the Order model based on schema, 
      // but the prompt says "si selecciona una orden, se deben autocompletar".
      // Usually these would come from Cotizacion lines or other places.
      // We'll fill what we can and leave others for manual entry if not found.
      setFormData({
        ...formData,
        ordenId,
        clienteId: orden.cotizacion.clienteId,
        clienteNombre: orden.cotizacion.cliente.razonSocial,
        clienteDocumento: orden.cotizacion.cliente.ruc,
        // Hypothetical autocompletion as per prompt
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
    setItems([...items, { sku: '', producto: '', cantidad: 0, valorUnitario: 0, valorTotal: 0, adValoremPorcentaje: '' }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof Item, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };
    
    if (field === 'cantidad' || field === 'valorUnitario') {
      item.valorTotal = (Number(item.cantidad) || 0) * (Number(item.valorUnitario) || 0);
    }
    
    newItems[index] = item;
    setItems(newItems);
  };

  // Calculations
  const totals = useMemo(() => {
    const totalFacturaComercial = items.reduce((sum, item) => sum + (item.valorTotal || 0), 0);
    
    const itemsCalculated = items.map(item => {
      const participacion = totalFacturaComercial > 0 ? (item.valorTotal / totalFacturaComercial) : 0;
      return { ...item, participacion };
    });

    const fobEquivalente = (formData.incoterm === 'FOB') 
      ? totalFacturaComercial 
      : (totalFacturaComercial + Number(formData.gastosOrigen || 0));

    const cifGlobal = fobEquivalente + Number(formData.fleteInternacional || 0) + Number(formData.seguro || 0);

    // AdValorem Logic
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

      // Distribution of expenses
      const fleteItem = Number(formData.fleteInternacional || 0) * item.participacion;
      const seguroItem = Number(formData.seguro || 0) * item.participacion;
      const origenItem = Number(formData.gastosOrigen || 0) * item.participacion;
      const localesItem = Number(formData.gastosLocales || 0) * item.participacion;
      
      const costoTotalMercaderia = item.valorTotal + fleteItem + seguroItem + origenItem + localesItem + adValoremMonto;
      const costoUnitario = item.cantidad > 0 ? (costoTotalMercaderia / item.cantidad) : 0;
      const costoSoles = costoTotalMercaderia * Number(formData.tipoCambio || 1);

      return {
        ...item,
        participacionPorcentual: item.participacion * 100,
        cifOculto,
        adValoremMonto,
        fleteUnitario: item.cantidad > 0 ? fleteItem / item.cantidad : 0,
        seguroUnitario: item.cantidad > 0 ? seguroItem / item.cantidad : 0,
        gastosOrigenUnitario: item.cantidad > 0 ? origenItem / item.cantidad : 0,
        gastosLocalesUnitario: item.cantidad > 0 ? localesItem / item.cantidad : 0,
        costoTotalUnitario: costoUnitario,
        costoTotalTotal: costoTotalMercaderia,
        costoTotalSoles: costoSoles
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
      finalItems,
      hasItemAdValorem
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
        costoTotalImportacion: totals.costoTotalImportacion
      };

      await api.post('/costeos', payload);
      setShowModal(false);
      fetchCosteos();
      resetForm();
    } catch (err) {
      console.error('Error saving costeo', err);
      alert('Error al guardar el costeo');
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
  };

  const viewCosteo = (costeo: any) => {
    setSelectedCosteo(costeo);
    setIsViewing(true);
    setShowModal(true);
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
                    <td className="font-bold text-primary">${c.costoTotalImportacion.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
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
                      value={isViewing ? selectedCosteo?.tipoCambio : formData.tipoCambio}
                      onChange={(e) => setFormData({ ...formData, tipoCambio: parseFloat(e.target.value) || 0 })}
                      className="form-control"
                      disabled={isViewing}
                    />
                  </div>
                </div>
                
                <div className="form-group mt-3">
                  <label>Observaciones</label>
                  <textarea 
                    value={isViewing ? selectedCosteo?.observaciones : formData.observaciones}
                    onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                    className="form-control"
                    rows={2}
                    disabled={isViewing}
                  ></textarea>
                </div>
              </div>

              {/* Seccion 2: Grilla de Productos */}
              <div className="form-section">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="section-title mb-0"><Package size={18} /> Grilla de Productos</h3>
                  {!isViewing && (
                    <button className="btn btn-secondary btn-sm" onClick={addItem}>
                      <Plus size={14} /> Agregar Item
                    </button>
                  )}
                </div>
                
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
                        <th>Cost. Unit. (USD)</th>
                        <th>Cost. Total (PEN)</th>
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
                              />
                            </td>
                            <td>
                              <input 
                                type="text" 
                                value={item.producto} 
                                onChange={(e) => updateItem(idx, 'producto', e.target.value)}
                                className="form-control-sm"
                                disabled={isViewing}
                              />
                            </td>
                            <td width="80">
                              <input 
                                type="number" 
                                value={item.cantidad} 
                                onChange={(e) => updateItem(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                                className="form-control-sm text-right"
                                disabled={isViewing}
                              />
                            </td>
                            <td width="100">
                              <input 
                                type="number" 
                                value={item.valorUnitario} 
                                onChange={(e) => updateItem(idx, 'valorUnitario', parseFloat(e.target.value) || 0)}
                                className="form-control-sm text-right"
                                disabled={isViewing}
                              />
                            </td>
                            <td className="text-right font-semibold">
                              ${(item.valorTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                              ${(calcItem?.costoTotalUnitario || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="text-right text-success font-bold">
                              S/ {(calcItem?.costoTotalSoles || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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

              {/* Seccion 3: Gastos e Impuestos */}
              <div className="grid-2 gap-6 mt-4">
                <div className="form-section">
                  <h3 className="section-title"><DollarSign size={18} /> Gastos Adicionales</h3>
                  <div className="grid-2">
                    <div className="form-group">
                      <label>Gastos Origen (USD)</label>
                      <input 
                        type="number" 
                        value={isViewing ? selectedCosteo?.gastosOrigen : formData.gastosOrigen}
                        onChange={(e) => setFormData({ ...formData, gastosOrigen: parseFloat(e.target.value) || 0 })}
                        className="form-control"
                        disabled={isViewing}
                      />
                    </div>
                    <div className="form-group">
                      <label>Flete Internacional (USD)</label>
                      <input 
                        type="number" 
                        value={isViewing ? selectedCosteo?.fleteInternacional : formData.fleteInternacional}
                        onChange={(e) => setFormData({ ...formData, fleteInternacional: parseFloat(e.target.value) || 0 })}
                        className="form-control"
                        disabled={isViewing}
                      />
                    </div>
                    <div className="form-group">
                      <label>Seguro (USD)</label>
                      <input 
                        type="number" 
                        value={isViewing ? selectedCosteo?.seguro : formData.seguro}
                        onChange={(e) => setFormData({ ...formData, seguro: parseFloat(e.target.value) || 0 })}
                        className="form-control"
                        disabled={isViewing}
                      />
                    </div>
                    <div className="form-group">
                      <label>Gastos Locales (USD)</label>
                      <input 
                        type="number" 
                        value={isViewing ? selectedCosteo?.gastosLocales : formData.gastosLocales}
                        onChange={(e) => setFormData({ ...formData, gastosLocales: parseFloat(e.target.value) || 0 })}
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
                        value={isViewing ? selectedCosteo?.adValoremGlobalPorc : formData.adValoremGlobal}
                        onChange={(e) => setFormData({ ...formData, adValoremGlobal: parseFloat(e.target.value) || 0 })}
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
                        value={isViewing ? selectedCosteo?.percepcionPorcentaje : formData.percepcionPorcentaje}
                        onChange={(e) => setFormData({ ...formData, percepcionPorcentaje: parseFloat(e.target.value) || 0 })}
                        className="form-control"
                        disabled={isViewing}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seccion 4: Resumen de Totales */}
              <div className="summary-section mt-6">
                <div className="summary-grid">
                  <div className="summary-card">
                    <span>Total Factura</span>
                    <strong>${(isViewing ? selectedCosteo?.totalFacturaComercial : totals.totalFacturaComercial).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="summary-card">
                    <span>CIF Global</span>
                    <strong>${(isViewing ? selectedCosteo?.cifGlobal : totals.cifGlobal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="summary-card">
                    <span>AdValorem Total</span>
                    <strong>${(isViewing ? selectedCosteo?.adValoremGlobal : totals.adValoremGlobal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="summary-card">
                    <span>IGV (16%)</span>
                    <strong>${(isViewing ? selectedCosteo?.igv : totals.igv).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="summary-card">
                    <span>IPM (2%)</span>
                    <strong>${(isViewing ? selectedCosteo?.ipm : totals.ipm).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="summary-card highlight">
                    <span>COSTO TOTAL IMPORTACIÓN</span>
                    <strong>${(isViewing ? selectedCosteo?.costoTotalImportacion : totals.costoTotalImportacion).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
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
        .grid-table input {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          padding: 0.25rem 0.5rem;
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
          max-width: 1100px;
          width: 95%;
        }
        .badge {
          background: #e2e8f0;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
};

export default Costeos;
