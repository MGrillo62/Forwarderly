import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Plus, Mail, Truck, X } from 'lucide-react';

const Proveedores: React.FC = () => {
  const { token } = useAuth();
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newProv, setNewProv] = useState({
    ruc: '', razonSocial: '', correos: ['']
  });

  useEffect(() => {
    fetchProveedores();
  }, []);

  const fetchProveedores = async () => {
    try {
      const response = await api.get('/proveedores');
      setProveedores(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddEmail = () => {
    setNewProv({ ...newProv, correos: [...newProv.correos, ''] });
  };

  const handleEmailChange = (index: number, value: string) => {
    const newEmails = [...newProv.correos];
    newEmails[index] = value;
    setNewProv({ ...newProv, correos: newEmails });
  };

  const removeEmail = (index: number) => {
    setNewProv({ ...newProv, correos: newProv.correos.filter((_, i) => i !== index) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/proveedores', {
        ...newProv,
        correos: newProv.correos.filter(e => e !== '')
      });
      setShowModal(false);
      setNewProv({ ruc: '', razonSocial: '', correos: [''] });
      fetchProveedores();
    } catch (err) {
      alert('Error al crear proveedor');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Proveedores</h1>
        <button className="primary icon-left" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Nuevo Proveedor
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Razón Social</th>
                <th>RUC</th>
                <th>Correos</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {proveedores.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="flex-align">
                      <Truck size={18} className="icon-blue" />
                      <strong>{p.razonSocial}</strong>
                    </div>
                  </td>
                  <td>{p.ruc}</td>
                  <td>
                    <div className="email-chips">
                      {p.correos.map((email: string, i: number) => (
                        <span key={i} className="email-chip"><Mail size={12} /> {email}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <button className="btn-outline sm">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Nuevo Proveedor</h3>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>RUC</label>
                  <input 
                    type="text" 
                    required 
                    value={newProv.ruc}
                    onChange={(e) => setNewProv({ ...newProv, ruc: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Razón Social</label>
                  <input 
                    type="text" 
                    required 
                    value={newProv.razonSocial}
                    onChange={(e) => setNewProv({ ...newProv, razonSocial: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Lista de Correos</label>
                  {newProv.correos.map((email, index) => (
                    <div key={index} className="email-input-row">
                      <input 
                        type="email" 
                        placeholder="ejemplo@proveedor.com"
                        value={email}
                        onChange={(e) => handleEmailChange(index, e.target.value)}
                      />
                      {newProv.correos.length > 1 && (
                        <button type="button" className="icon-btn" onClick={() => removeEmail(index)}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn-text" onClick={handleAddEmail}>
                    <Plus size={14} /> Agregar otro correo
                  </button>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .flex-align { display: flex; align-items: center; gap: 0.75rem; }
        .email-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .email-chip {
          background: #f1f5f9;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          color: var(--text-light);
        }
        .email-input-row { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
        .btn-text { background: transparent; color: var(--secondary); font-size: 0.8rem; padding: 0.5rem 0; }
        .icon-blue { color: var(--secondary); }
      `}</style>
    </div>
  );
};

export default Proveedores;
