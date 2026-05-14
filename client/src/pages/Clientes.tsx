import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Plus } from 'lucide-react';

const Clientes: React.FC = () => {
  const { token } = useAuth();
  const [clientes, setClientes] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newCliente, setNewCliente] = useState({
    ruc: '', razonSocial: '', direccion: '', contacto: ''
  });

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    try {
      const response = await api.get('/clientes');
      setClientes(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/clientes', newCliente);
      setShowModal(false);
      setNewCliente({ ruc: '', razonSocial: '', direccion: '', contacto: '' });
      fetchClientes();
    } catch (err) {
      alert('Error al crear cliente');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Mis Clientes</h1>
        <button className="primary icon-left" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Nuevo Cliente
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Razón Social</th>
                <th>RUC</th>
                <th>Contacto</th>
                <th>Dirección</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.razonSocial}</strong></td>
                  <td>{c.ruc}</td>
                  <td>{c.contacto}</td>
                  <td>{c.direccion}</td>
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
              <h3>Registrar Nuevo Cliente</h3>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>RUC</label>
                  <input 
                    type="text" 
                    required 
                    value={newCliente.ruc}
                    onChange={(e) => setNewCliente({ ...newCliente, ruc: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Razón Social</label>
                  <input 
                    type="text" 
                    required 
                    value={newCliente.razonSocial}
                    onChange={(e) => setNewCliente({ ...newCliente, razonSocial: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Contacto</label>
                  <input 
                    type="text" 
                    required 
                    value={newCliente.contacto}
                    onChange={(e) => setNewCliente({ ...newCliente, contacto: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Dirección</label>
                  <input 
                    type="text" 
                    required 
                    value={newCliente.direccion}
                    onChange={(e) => setNewCliente({ ...newCliente, direccion: e.target.value })}
                  />
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
    </div>
  );
};

export default Clientes;
