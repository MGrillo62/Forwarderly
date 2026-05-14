import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Plus, Building2 } from 'lucide-react';

const Empresas: React.FC = () => {
  const { token } = useAuth();
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newEmpresa, setNewEmpresa] = useState({
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
      await api.post('/empresas', {
        ...newEmpresa,
        fechaInicio: new Date(newEmpresa.fechaInicio)
      });
      setShowModal(false);
      fetchEmpresas();
    } catch (err) {
      alert('Error al crear empresa');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Gestión de Empresas Usuarias</h1>
        <button className="primary icon-left" onClick={() => setShowModal(true)}>
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
                    <button className="btn-outline sm">Configurar</button>
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
              <h3>Registrar Empresa</h3>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label>RUC</label>
                    <input type="text" required onChange={(e) => setNewEmpresa({...newEmpresa, ruc: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Razón Social</label>
                    <input type="text" required onChange={(e) => setNewEmpresa({...newEmpresa, razonSocial: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Persona de Contacto</label>
                    <input type="text" required onChange={(e) => setNewEmpresa({...newEmpresa, contacto: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Celular</label>
                    <input type="text" required onChange={(e) => setNewEmpresa({...newEmpresa, celular: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Correo</label>
                    <input type="email" required onChange={(e) => setNewEmpresa({...newEmpresa, correo: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Fecha de Inicio</label>
                    <input type="date" required onChange={(e) => setNewEmpresa({...newEmpresa, fechaInicio: e.target.value})} />
                  </div>
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
