import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Plus, User, Mail, Phone, MapPin, Edit, X } from 'lucide-react';

const Clientes: React.FC = () => {
  const { token } = useAuth();
  const [clientes, setClientes] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState<any>(null);
  const [formData, setFormData] = useState({
    ruc: '', razonSocial: '', direccion: '', direccionEntrega: '', contacto: '', correo: '', celular: ''
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
      if (editingCliente) {
        await api.put(`/clientes/${editingCliente.id}`, formData);
      } else {
        await api.post('/clientes', formData);
      }
      setShowModal(false);
      setFormData({ ruc: '', razonSocial: '', direccion: '', direccionEntrega: '', contacto: '', correo: '', celular: '' });
      fetchClientes();
    } catch (err) {
      alert('Error al guardar cliente');
    }
  };

  const handleEdit = (cliente: any) => {
    setEditingCliente(cliente);
    setFormData({
      ruc: cliente.ruc,
      razonSocial: cliente.razonSocial,
      direccion: cliente.direccion,
      direccionEntrega: cliente.direccionEntrega || '',
      contacto: cliente.contacto,
      correo: cliente.correo || '',
      celular: cliente.celular || ''
    });
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingCliente(null);
    setFormData({ ruc: '', razonSocial: '', direccion: '', direccionEntrega: '', contacto: '', correo: '', celular: '' });
    setShowModal(true);
  };

  return (
    <div>
      <div className="page-header">
        <h1>Mis Clientes</h1>
        <button className="primary icon-left" onClick={handleNew}>
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
                    <button className="icon-btn" onClick={() => handleEdit(c)}>
                      <Edit size={16} />
                    </button>
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
              <h3>{editingCliente ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}</h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label>RUC</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.ruc}
                      onChange={(e) => setFormData({ ...formData, ruc: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Razón Social</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.razonSocial}
                      onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Contacto</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.contacto}
                      onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Celular</label>
                    <input 
                      type="text" 
                      value={formData.celular}
                      onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Correo</label>
                    <input 
                      type="email" 
                      value={formData.correo}
                      onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Dirección Fiscal</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Dirección de Entrega</label>
                    <input 
                      type="text" 
                      value={formData.direccionEntrega}
                      onChange={(e) => setFormData({ ...formData, direccionEntrega: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="primary">Guardar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clientes;
