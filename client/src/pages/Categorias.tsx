import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Plus, Tags, Trash2, CheckSquare, Square, Edit, X } from 'lucide-react';

const Categorias: React.FC = () => {
  const { token } = useAuth();
  const [categorias, setCategorias] = useState<any[]>([]);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);
  const [catFormData, setCatFormData] = useState({ nombre: '', afectoIGV: true });
  
  const [showConceptForm, setShowConceptForm] = useState<string | null>(null);
  const [newConcept, setNewConcept] = useState({ nombre: '', incluirPorDefecto: false });

  useEffect(() => {
    fetchCategorias();
  }, []);

  const fetchCategorias = async () => {
    try {
      const response = await api.get('/categorias');
      setCategorias(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catFormData.nombre.trim()) return;
    try {
      if (editingCat) {
        await api.put(`/categorias/${editingCat.id}`, catFormData);
      } else {
        await api.post('/categorias', catFormData);
      }
      setShowCatModal(false);
      fetchCategorias();
    } catch (err) {
      alert('Error al guardar categoría');
    }
  };

  const handleEditCat = (cat: any) => {
    setEditingCat(cat);
    setCatFormData({ nombre: cat.nombre, afectoIGV: cat.afectoIGV });
    setShowCatModal(true);
  };

  const handleNewCat = () => {
    setEditingCat(null);
    setCatFormData({ nombre: '', afectoIGV: true });
    setShowCatModal(true);
  };

  const handleAddConcepto = async (catId: string) => {
    if (!newConcept.nombre) return;
    try {
      await api.post(`/categorias/${catId}/conceptos`, newConcept);
      setNewConcept({ nombre: '', incluirPorDefecto: false });
      setShowConceptForm(null);
      fetchCategorias();
    } catch (err) {
      alert('Error al crear concepto');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Configuración de Categorías</h1>
        <button className="primary icon-left" onClick={handleNewCat}>
          <Plus size={18} /> Nueva Categoría
        </button>
      </div>

      <div className="categories-list">
        {categorias.map(cat => (
          <div key={cat.id} className="cat-section card">
            <div className="cat-header">
              <div className="cat-title-group">
                <div className="cat-title">
                  <Tags size={20} className="icon-blue" />
                  <h2>{cat.nombre}</h2>
                  {cat.afectoIGV ? 
                    <span className="badge-success">Afecto a IGV</span> : 
                    <span className="badge-warning">No afecto a IGV</span>
                  }
                </div>
              </div>
              <div className="cat-actions">
                <button className="icon-btn" onClick={() => handleEditCat(cat)} title="Editar Categoría">
                  <Edit size={16} />
                </button>
                <button className="btn-outline sm" onClick={() => setShowConceptForm(cat.id)}>
                  <Plus size={16} /> Agregar Concepto
                </button>
              </div>
            </div>

            <div className="concepts-table">
              <table>
                <thead>
                  <tr>
                    <th>Nombre del Concepto</th>
                    <th>Incluir por defecto</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.conceptos.map((con: any) => (
                    <tr key={con.id}>
                      <td>{con.nombre}</td>
                      <td>
                        {con.incluirPorDefecto ? 
                          <span className="badge-success"><CheckSquare size={14} /> Sí</span> : 
                          <span className="badge-gray"><Square size={14} /> No</span>
                        }
                      </td>
                      <td>
                        <button className="icon-btn danger"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  {showConceptForm === cat.id && (
                    <tr className="new-row">
                      <td>
                        <input 
                          type="text" 
                          placeholder="Nombre del concepto" 
                          autoFocus
                          value={newConcept.nombre}
                          onChange={(e) => setNewConcept({ ...newConcept, nombre: e.target.value })}
                        />
                      </td>
                      <td>
                        <label className="checkbox-label">
                          <input 
                            type="checkbox" 
                            checked={newConcept.incluirPorDefecto}
                            onChange={(e) => setNewConcept({ ...newConcept, incluirPorDefecto: e.target.checked })}
                          />
                          <span>Marcar para cotizaciones nuevas</span>
                        </label>
                      </td>
                      <td>
                        <div className="actions-cell">
                          <button className="success" onClick={() => handleAddConcepto(cat.id)}>Guardar</button>
                          <button onClick={() => setShowConceptForm(null)}>Cancelar</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {showCatModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingCat ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
              <button className="icon-btn" onClick={() => setShowCatModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmitCategoria}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nombre de la Categoría</label>
                  <input 
                    type="text" 
                    required 
                    value={catFormData.nombre}
                    onChange={(e) => setCatFormData({ ...catFormData, nombre: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={catFormData.afectoIGV}
                      onChange={(e) => setCatFormData({ ...catFormData, afectoIGV: e.target.checked })}
                    />
                    <span>¿Esta categoría está afecta al IGV?</span>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={() => setShowCatModal(false)}>Cancelar</button>
                <button type="submit" className="primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .add-cat-card { margin-bottom: 2rem; }
        .inline-form { display: flex; gap: 1rem; margin-top: 1rem; }
        .cat-section { margin-bottom: 1.5rem; padding: 0; overflow: hidden; }
        .cat-header {
          padding: 1rem 1.5rem;
          background: #f8fafc;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .cat-title { display: flex; align-items: center; gap: 0.75rem; }
        .cat-title h2 { font-size: 1.1rem; margin: 0; }
        .cat-actions { display: flex; align-items: center; gap: 0.75rem; }
        .badge-warning { background: #fef3c7; color: #d97706; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; }
        .concepts-table { padding: 0.5rem 1.5rem; }
        .icon-blue { color: var(--secondary); }
        .sm { padding: 0.4rem 0.75rem; font-size: 0.8rem; }
        .badge-success { color: var(--success); display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; font-weight: 600; }
        .badge-gray { color: var(--text-light); display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; }
        .new-row { background: #f0f9ff; }
        .checkbox-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
        .checkbox-label input { width: auto; }
      `}</style>
    </div>
  );
};

export default Categorias;
