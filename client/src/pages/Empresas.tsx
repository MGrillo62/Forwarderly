import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Plus, Building2, Edit, X } from 'lucide-react';

const Empresas: React.FC = () => {
  const { token } = useAuth();
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<any>(null);
  const [formData, setFormData] = useState({
    ruc: '', razonSocial: '', contacto: '', celular: '', correo: '', fechaInicio: '', estado: 'ACTIVO'
  });

  useEffect(() => {
    fetchEmpresas();
  }, []);

  const fetchEmpresas = async () => {
    try {
      const response = await api.get('/empresas');
      setEmpresas(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        fechaInicio: new Date(formData.fechaInicio)
      };
      
      if (editingEmpresa) {
        await api.put(`/empresas/${editingEmpresa.id}`, payload);
      } else {
        await api.post('/empresas', payload);
      }
      
      setShowModal(false);
      fetchEmpresas();
    } catch (err) {
      alert('Error al guardar empresa');
    }
  };

  const handleEdit = (empresa: any) => {
    setEditingEmpresa(empresa);
    setFormData({
      ruc: empresa.ruc,
      razonSocial: empresa.razonSocial,
      contacto: empresa.contacto,
      celular: empresa.celular,
      correo: empresa.correo,
      fechaInicio: new Date(empresa.fechaInicio).toISOString().split('T')[0],
      estado: empresa.estado
    });
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingEmpresa(null);
    setFormData({
      ruc: '', razonSocial: '', contacto: '', celular: '', correo: '', fechaInicio: '', estado: 'ACTIVO'
    });
    setShowModal(true);
  };

  return (
    <div>
      <div className="page-header">
        <h1>Gestión de Empresas Usuarias</h1>
        <button className="primary icon-left" onClick={handleNew}>
          <Plus size={18} /> Nueva Empresa
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
                <th>Inicio</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map(e => (
                <tr key={e.id}>
                  <td>
                    <div className="flex-align">
                      <Building2 size={18} className="icon-blue" />
                      <strong>{e.razonSocial}</strong>
                    </div>
                  </td>
                  <td>{e.ruc}</td>
                  <td>
                    <div>{e.contacto}</div>
                    <small className="text-light">{e.correo}</small>
                  </td>
                  <td>{new Date(e.fechaInicio).toLocaleDateString()}</td>
                  <td>
                    <span className={`status-badge ${e.estado === 'ACTIVO' ? 'status-approved' : 'status-rejected'}`}>
                      {e.estado}
                    </span>
                  </td>
                  <td>
                    <button className="icon-btn" onClick={() => handleEdit(e)} title="Editar Empresa">
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
              <h3>{editingEmpresa ? 'Editar Empresa' : 'Registrar Empresa'}</h3>
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
                      onChange={(e) => setFormData({...formData, ruc: e.target.value})} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Razón Social</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.razonSocial}
                      onChange={(e) => setFormData({...formData, razonSocial: e.target.value})} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Persona de Contacto</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.contacto}
                      onChange={(e) => setFormData({...formData, contacto: e.target.value})} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Celular</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.celular}
                      onChange={(e) => setFormData({...formData, celular: e.target.value})} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Correo</label>
                    <input 
                      type="email" 
                      required 
                      value={formData.correo}
                      onChange={(e) => setFormData({...formData, correo: e.target.value})} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Fecha de Inicio</label>
                    <input 
                      type="date" 
                      required 
                      value={formData.fechaInicio}
                      onChange={(e) => setFormData({...formData, fechaInicio: e.target.value})} 
                    />
                  </div>
                  {editingEmpresa && (
                    <div className="form-group">
                      <label>Estado</label>
                      <select value={formData.estado} onChange={(e) => setFormData({...formData, estado: e.target.value})}>
                        <option value="ACTIVO">ACTIVO</option>
                        <option value="SUSPENDIDO">SUSPENDIDO</option>
                        <option value="INACTIVO">INACTIVO</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="primary">Guardar Empresa</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Empresas;
