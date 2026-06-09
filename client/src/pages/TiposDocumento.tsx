import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Edit, X, FileText, Search } from 'lucide-react';

const TiposDocumento: React.FC = () => {
  const { token } = useAuth();
  const [tipos, setTipos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTipo, setEditingTipo] = useState<any>(null);
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTipos();
  }, []);

  const fetchTipos = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tipos-documento');
      setTipos(response.data);
    } catch (err) {
      console.error('Error al obtener tipos de documentos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    try {
      if (editingTipo) {
        await api.put(`/tipos-documento/${editingTipo.id}`, { nombre: nombre.trim() });
      } else {
        await api.post('/tipos-documento', { nombre: nombre.trim() });
      }
      setShowModal(false);
      fetchTipos();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al guardar tipo de documento');
    }
  };

  const handleEdit = (tipo: any) => {
    setEditingTipo(tipo);
    setNombre(tipo.nombre);
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingTipo(null);
    setNombre('');
    setShowModal(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`¿Está seguro de que desea eliminar el tipo de documento "${name}"? Se eliminará de todos los requerimientos asociados.`)) return;

    try {
      await api.delete(`/tipos-documento/${id}`);
      fetchTipos();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al eliminar tipo de documento');
    }
  };

  const filteredTipos = tipos.filter(tipo => 
    tipo.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Tipos de Documento</h1>
          <p style={{ color: 'var(--text-light)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Configure los tipos de documentos requeridos para la gestión de sus órdenes de importación.
          </p>
        </div>
        <button className="primary icon-left" onClick={handleNew}>
          <Plus size={18} /> Nuevo Tipo
        </button>
      </div>

      <div className="card animate-fade-in">
        <div className="filters-bar" style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', padding: '1rem 0 0 0' }}>
          <div className="search-input" style={{ flex: 1, maxWidth: '400px' }}>
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Buscar tipo de documento..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
            Cargando tipos de documentos...
          </div>
        ) : filteredTipos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)', border: '1px dashed var(--border)', borderRadius: '8px' }}>
            {searchTerm ? 'No se encontraron resultados para su búsqueda.' : 'No hay tipos de documentos registrados. Comience creando uno nuevo.'}
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nombre del Documento</th>
                  <th>Fecha de Creación</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredTipos.map(tipo => (
                  <tr key={tipo.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          background: 'rgba(79, 70, 229, 0.08)',
                          color: 'var(--primary)',
                          padding: '0.5rem',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          <FileText size={18} />
                        </div>
                        <strong className="text-slate-800" style={{ fontSize: '0.9rem' }}>{tipo.nombre}</strong>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>
                      {new Date(tipo.createdAt).toLocaleDateString('es-PE', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </td>
                    <td>
                      <div className="actions-cell" style={{ justifyContent: 'center' }}>
                        <button title="Editar" onClick={() => handleEdit(tipo)}>
                          <Edit size={16} />
                        </button>
                        <button title="Eliminar" className="danger" onClick={() => handleDelete(tipo.id, tipo.nombre)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-slide-in" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{editingTipo ? 'Editar Tipo de Documento' : 'Nuevo Tipo de Documento'}</h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label style={{ fontWeight: 600, color: 'var(--text-dark)' }}>Nombre del Documento</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ej. Factura Comercial, Packing List, BL, Certificado de Origen"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    style={{ width: '100%', marginTop: '0.5rem' }}
                    autoFocus
                  />
                  <small style={{ color: 'var(--text-light)', display: 'block', marginTop: '0.35rem', fontSize: '0.75rem' }}>
                    Debe ser un nombre descriptivo único para identificar el archivo.
                  </small>
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TiposDocumento;
