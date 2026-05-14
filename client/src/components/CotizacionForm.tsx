import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Save, X } from 'lucide-react';

interface CotizacionFormProps {
  onClose: () => void;
  onSave: () => void;
  initialData?: any;
}

const CotizacionForm: React.FC<CotizacionFormProps> = ({ onClose, onSave, initialData }) => {
  const { token } = useAuth();
  const [clientes, setClientes] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  
  const [clienteId, setClienteId] = useState(initialData?.clienteId || '');
  const [lineas, setLineas] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [cRes, pRes, catRes] = await Promise.all([
        axios.get('http://localhost:5000/api/clientes', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:5000/api/proveedores', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:5000/api/categorias', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setClientes(cRes.data);
      setProveedores(pRes.data);
      setCategorias(catRes.data);

      if (!initialData) {
        // Pre-load lines based on categories and default concepts
        const defaultLineas: any[] = [];
        catRes.data.forEach((cat: any) => {
          cat.conceptos.forEach((con: any) => {
            if (con.incluirPorDefecto) {
              defaultLineas.push({
                categoriaId: cat.id,
                categoriaNombre: cat.nombre,
                conceptoId: con.id,
                conceptoNombre: con.nombre,
                proveedorId: '',
                costo: 0,
                precioVenta: 0,
                valorVenta: 0,
                igv: 0,
                utilidad: 0,
                margen: 0
              });
            }
          });
        });
        setLineas(defaultLineas);
      } else {
        setLineas(initialData.lineas.map((l: any) => ({
          ...l,
          categoriaNombre: l.concepto?.categoria?.nombre,
          conceptoNombre: l.concepto?.nombre
        })));
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const newLineas = [...lineas];
    const linea = { ...newLineas[index], [field]: value };

    if (field === 'precioVenta' || field === 'costo') {
      const precioVenta = field === 'precioVenta' ? parseFloat(value) || 0 : linea.precioVenta;
      const costo = field === 'costo' ? parseFloat(value) || 0 : linea.costo;
      
      const valorVenta = precioVenta / 1.18;
      const igv = valorVenta * 0.18;
      const utilidad = precioVenta - costo;
      const margen = precioVenta > 0 ? (utilidad / precioVenta) * 100 : 0;

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
      margen: 0
    }]);
  };

  const removeLine = (index: number) => {
    setLineas(lineas.filter((_, i) => i !== index));
  };

  const totals = lineas.reduce((acc, l) => ({
    precioTotal: acc.precioTotal + (l.precioVenta || 0),
    totalVenta: acc.totalVenta + (l.valorVenta || 0),
    igv: acc.igv + (l.igv || 0),
    utilidad: acc.utilidad + (l.utilidad || 0)
  }), { precioTotal: 0, totalVenta: 0, igv: 0, utilidad: 0 });

  const porcentajeUtilidad = totals.precioTotal > 0 ? (totals.utilidad / totals.precioTotal) * 100 : 0;

  const handleSubmit = async () => {
    if (!clienteId) return alert('Seleccione un cliente');
    try {
      const data = { clienteId, lineas };
      if (initialData) {
        await axios.put(`http://localhost:5000/api/cotizaciones/${initialData.id}`, data, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post('http://localhost:5000/api/cotizaciones', data, {
          headers: { Authorization: `Bearer ${token}` }
        });
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
          <h2>{initialData ? 'Editar Cotización' : 'Nueva Cotización'}</h2>
          <button className="close-btn" onClick={onClose}><X /></button>
        </div>

        <div className="modal-body">
          <div className="form-section">
            <label>Cliente</label>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
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
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        value={linea.precioVenta} 
                        onChange={(e) => handleLineChange(index, 'precioVenta', e.target.value)} 
                      />
                    </td>
                    <td>{linea.valorVenta.toFixed(2)}</td>
                    <td>{linea.igv.toFixed(2)}</td>
                    <td>{linea.utilidad.toFixed(2)}</td>
                    <td>{linea.margen.toFixed(1)}%</td>
                    <td>
                      <button className="icon-btn danger" onClick={() => removeLine(index)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="add-concepts-section">
            <h4>Agregar Conceptos</h4>
            <div className="categories-grid">
              {categorias.map(cat => (
                <div key={cat.id} className="cat-group">
                  <h6>{cat.nombre}</h6>
                  <div className="concepts-list">
                    {cat.conceptos.map((con: any) => (
                      <button 
                        key={con.id} 
                        className="tag-btn" 
                        onClick={() => addLine(con, cat)}
                      >
                        <Plus size={12} /> {con.nombre}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

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
          <button className="btn-outline" onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={handleSubmit}>
            <Save size={18} /> Guardar Cotización
          </button>
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
          gap: 0.5rem;
          margin-top: 0.5rem;
        }
        .tag-btn {
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
          background: #f1f5f9;
          border: 1px solid var(--border);
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }
        .tag-btn:hover {
          background: var(--secondary);
          color: white;
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
