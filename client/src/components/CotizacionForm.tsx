import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, Trash2, Save, X } from 'lucide-react';

interface CotizacionFormProps {
  onClose: () => void;
  onSave: () => void;
  initialData?: any;
  viewOnly?: boolean;
}

const CotizacionForm: React.FC<CotizacionFormProps> = ({ onClose, onSave, initialData, viewOnly }) => {
  const [clientes, setClientes] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  
  const [clienteId, setClienteId] = useState(initialData?.clienteId || '');
  const [lineas, setLineas] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showNewConceptInput, setShowNewConceptInput] = useState<string | null>(null);
  const [newConceptName, setNewConceptName] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [cRes, pRes, catRes] = await Promise.all([
        api.get('/clientes'),
        api.get('/proveedores'),
        api.get('/categorias')
      ]);
      setClientes(cRes.data);
      setProveedores(pRes.data);
      setCategorias(catRes.data);

      if (!initialData) {
        const defaultLineas: any[] = [];
        catRes.data.forEach((cat: any) => {
          if (cat.conceptos) {
            cat.conceptos.forEach((con: any) => {
              if (con.incluirPorDefecto) {
                defaultLineas.push({
                  conceptoId: con.id,
                  categoriaNombre: cat.nombre,
                  conceptoNombre: con.nombre,
                  proveedorId: '',
                  costo: 0,
                  precioVenta: 0,
                  valorVenta: 0,
                  igv: 0,
                  utilidad: 0,
                  margen: 0,
                  afectoIGV: cat.afectoIGV
                });
              }
            });
          }
        });
        setLineas(defaultLineas);
      } else {
        setLineas((initialData.lineas || []).map((l: any) => ({
          ...l,
          categoriaNombre: l.concepto?.categoria?.nombre || 'S/C',
          conceptoNombre: l.concepto?.nombre || 'S/C',
          afectoIGV: l.concepto?.categoria?.afectoIGV ?? true
        })));
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const newLineas = [...lineas];
    const linea = { ...newLineas[index], [field]: value };

    if (field === 'precioVenta' || field === 'costo') {
      const precioVenta = field === 'precioVenta' ? parseFloat(value) || 0 : linea.precioVenta;
      const costo = field === 'costo' ? parseFloat(value) || 0 : linea.costo;
      
      let valorVenta, igv;
      if (linea.afectoIGV) {
        valorVenta = precioVenta / 1.18;
        igv = valorVenta * 0.18;
      } else {
        valorVenta = precioVenta;
        igv = 0;
      }
      
      const utilidad = valorVenta - costo;
      const margen = valorVenta > 0 ? (utilidad / valorVenta) * 100 : 0;

      linea.valorVenta = valorVenta;
      linea.igv = igv;
      linea.utilidad = utilidad;
      linea.margen = margen;
      linea.precioVenta = precioVenta;
      linea.costo = costo;
    }

    newLineas[index] = linea;
    setLineas(newLineas);
  };

  const addLine = (concepto: any, categoria: any) => {
    setLineas([...lineas, {
      categoriaId: categoria.id,
      categoriaNombre: categoria.nombre,
      conceptoId: concepto.id,
      conceptoNombre: concepto.nombre,
      proveedorId: '',
      costo: 0,
      precioVenta: 0,
      valorVenta: 0,
      igv: 0,
      utilidad: 0,
      margen: 0,
      afectoIGV: categoria.afectoIGV
    }]);
  };

  const removeLine = (index: number) => {
    setLineas(lineas.filter((_, i) => i !== index));
  };

  const handleCreateConcept = async (categoriaId: string) => {
    if (!newConceptName.trim()) return;
    try {
      const response = await api.post(`/categorias/${categoriaId}/conceptos`, {
        nombre: newConceptName,
        incluirPorDefecto: false
      });
      
      const newConcept = response.data;
      // Refresh categories to include the new concept
      const catRes = await api.get('/categorias');
      const updatedCategorias = catRes.data;
      setCategorias(updatedCategorias);
      
      // Automatically add the new concept to the quotation
      const category = updatedCategorias.find((c: any) => c.id === categoriaId);
      addLine(newConcept, category);
      
      setNewConceptName('');
      setShowNewConceptInput(null);
    } catch (err) {
      alert('Error al crear concepto');
    }
  };

  const totals = lineas.reduce((acc, l) => ({
    precioTotal: acc.precioTotal + (l.precioVenta || 0),
    totalVenta: acc.totalVenta + (l.valorVenta || 0),
    igv: acc.igv + (l.igv || 0),
    utilidad: acc.utilidad + (l.utilidad || 0)
  }), { precioTotal: 0, totalVenta: 0, igv: 0, utilidad: 0 });

  const porcentajeUtilidad = totals.totalVenta > 0 ? (totals.utilidad / totals.totalVenta) * 100 : 0;

  const handleSubmit = async () => {
    if (!clienteId) return alert('Seleccione un cliente');
    try {
      const data = { clienteId, lineas };
      if (initialData) {
        await api.put(`/cotizaciones/${initialData.id}`, data);
      } else {
        await api.post('/cotizaciones', data);
      }
      onSave();
    } catch (err) {
      alert('Error al guardar cotización');
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="modal-overlay">
      <div className="modal-content large">
        <div className="modal-header">
          <h2>{viewOnly ? 'Detalle de Cotización' : (initialData ? 'Editar Cotización' : 'Nueva Cotización')}</h2>
          <button className="icon-btn" onClick={onClose}><X /></button>
        </div>

        <div className="modal-body">
          <div className="form-section">
            <label>Cliente</label>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} disabled={viewOnly}>
              <option value="">Seleccione un cliente</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.razonSocial} ({c.ruc})</option>
              ))}
            </select>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Categoría / Concepto</th>
                  <th>Proveedor</th>
                  <th>Costo</th>
                  <th>Precio Venta</th>
                  <th>Valor Venta</th>
                  <th>IGV</th>
                  <th>Utilidad</th>
                  <th>Margen %</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((linea, index) => (
                  <tr key={index}>
                    <td>
                      <div className="concept-info">
                        <small>{linea.categoriaNombre}</small>
                        <div>{linea.conceptoNombre}</div>
                      </div>
                    </td>
                    <td>
                      <select 
                        value={linea.proveedorId} 
                        onChange={(e) => handleLineChange(index, 'proveedorId', e.target.value)}
                        disabled={viewOnly}
                      >
                        <option value="">Seleccionar</option>
                        {proveedores.map(p => (
                          <option key={p.id} value={p.id}>{p.razonSocial}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input 
                        type="number" 
                        value={linea.costo} 
                        onChange={(e) => handleLineChange(index, 'costo', e.target.value)} 
                        disabled={viewOnly}
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        value={linea.precioVenta} 
                        onChange={(e) => handleLineChange(index, 'precioVenta', e.target.value)} 
                        disabled={viewOnly}
                      />
                    </td>
                    <td>{linea.valorVenta.toFixed(2)}</td>
                    <td>{linea.igv.toFixed(2)}</td>
                    <td>{linea.utilidad.toFixed(2)}</td>
                    <td>{linea.margen.toFixed(1)}%</td>
                    <td>
                      {!viewOnly && (
                        <button className="icon-btn danger" onClick={() => removeLine(index)}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!viewOnly && (
            <div className="add-concepts-section">
              <h4>Agregar Conceptos</h4>
              <div className="categories-grid">
                {categorias.map(cat => {
                  const availableConcepts = cat.conceptos.filter((con: any) => 
                    !lineas.some(l => l.conceptoId === con.id)
                  );
                  
                  return (
                    <div key={cat.id} className="cat-group">
                      <h6>{cat.nombre}</h6>
                      <div className="concepts-list">
                        {availableConcepts.map((con: any) => (
                          <button 
                            key={con.id} 
                            className="tag-btn" 
                            onClick={() => addLine(con, cat)}
                          >
                            <Plus size={14} /> {con.nombre}
                          </button>
                        ))}
                        
                        {showNewConceptInput === cat.id ? (
                          <div className="new-concept-inline">
                            <input 
                              autoFocus
                              type="text" 
                              placeholder="Nuevo concepto..." 
                              value={newConceptName}
                              onChange={(e) => setNewConceptName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateConcept(cat.id);
                                if (e.key === 'Escape') setShowNewConceptInput(null);
                              }}
                            />
                            <button className="small-primary" onClick={() => handleCreateConcept(cat.id)}>OK</button>
                            <button className="small-ghost" onClick={() => setShowNewConceptInput(null)}>X</button>
                          </div>
                        ) : (
                          <button 
                            className="tag-btn add-new-btn" 
                            onClick={() => {
                              setShowNewConceptInput(cat.id);
                              setNewConceptName('');
                            }}
                          >
                            <Plus size={14} /> <em>Nuevo...</em>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="totals-section">
            <div className="totals-grid">
              <div className="total-item">
                <label>Total Venta</label>
                <span>S/ {totals.totalVenta.toFixed(2)}</span>
              </div>
              <div className="total-item">
                <label>IGV (18%)</label>
                <span>S/ {totals.igv.toFixed(2)}</span>
              </div>
              <div className="total-item highlight">
                <label>Precio Total</label>
                <span>S/ {totals.precioTotal.toFixed(2)}</span>
              </div>
              <div className="total-item">
                <label>Utilidad</label>
                <span>S/ {totals.utilidad.toFixed(2)}</span>
              </div>
              <div className="total-item">
                <label>% Utilidad</label>
                <span>{porcentajeUtilidad.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-outline" onClick={onClose}>Cerrar</button>
          {!viewOnly && (
            <button className="primary" onClick={handleSubmit}>
              <Save size={18} /> Guardar Cotización
            </button>
          )}
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }
        .modal-content.large {
          width: 95%;
          max-width: 1200px;
          max-height: 90vh;
          background: white;
          border-radius: 1rem;
          display: flex;
          flex-direction: column;
        }
        .modal-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }
        .form-section {
          margin-bottom: 1.5rem;
          max-width: 300px;
        }
        .concept-info small {
          color: var(--text-light);
          display: block;
          text-transform: uppercase;
          font-size: 0.65rem;
        }
        .add-concepts-section {
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border);
        }
        .categories-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-top: 1rem;
        }
        .concepts-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 0.75rem;
        }
        .tag-btn {
          padding: 0.5rem 1rem;
          font-size: 0.9rem;
          background: #f1f5f9;
          border: 1px solid var(--border);
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          transition: all 0.2s;
          font-weight: 500;
        }
        .tag-btn:hover {
          background: var(--secondary);
          color: white;
          transform: translateY(-2px);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .tag-btn.add-new-btn {
          background: transparent;
          border-style: dashed;
          color: var(--text-light);
        }
        .new-concept-inline {
          display: flex;
          gap: 0.25rem;
          align-items: center;
        }
        .new-concept-inline input {
          padding: 0.4rem;
          font-size: 0.85rem;
          width: 150px;
          border-radius: 4px;
        }
        .small-primary {
          background: var(--primary);
          color: white;
          padding: 0.4rem 0.6rem;
          border-radius: 4px;
          font-size: 0.8rem;
        }
        .small-ghost {
          background: transparent;
          color: var(--text-light);
          padding: 0.4rem;
          font-size: 0.8rem;
        }
        .cat-group h6 {
          font-size: 1rem;
          color: var(--primary);
          margin-bottom: 0.5rem;
          font-weight: 600;
        }
        .totals-section {
          margin-top: 2rem;
          background: #f8fafc;
          padding: 1.5rem;
          border-radius: 0.75rem;
        }
        .totals-grid {
          display: flex;
          justify-content: flex-end;
          gap: 3rem;
        }
        .total-item {
          text-align: right;
        }
        .total-item label {
          display: block;
          color: var(--text-light);
          font-size: 0.75rem;
          margin-bottom: 0.25rem;
        }
        .total-item span {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--primary);
        }
        .total-item.highlight span {
          color: var(--secondary);
          font-size: 1.5rem;
        }
        .modal-footer {
          padding: 1.5rem;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
        }
        .icon-btn {
          padding: 0.5rem;
          border-radius: 4px;
        }
        .icon-btn.danger {
          color: var(--danger);
          background: #fee2e2;
        }
        .btn-outline {
          background: transparent;
          border: 1px solid var(--border);
        }
      `}</style>
    </div>
  );
};

export default CotizacionForm;
