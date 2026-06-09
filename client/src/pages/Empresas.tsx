import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Plus, Building2, Edit, X, Trash2 } from 'lucide-react';

const Empresas: React.FC = () => {
  const { token } = useAuth();
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<any>(null);
  const [formData, setFormData] = useState({
    ruc: '',
    razonSocial: '',
    contacto: '',
    celular: '',
    correo: '',
    fechaInicio: '',
    estado: 'ACTIVO',
    logoUrl: '',
    diaPagoSuscripcion: 5,
    periodicidad: 'MENSUAL',
    montoSuscripcion: 0,
    diasPrueba: 14,
    ultimoNroCotizacion: 0,
    ultimoNroOrden: 0,
    ultimoNroCosteo: 0
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
        fechaInicio: new Date(formData.fechaInicio),
        diaPagoSuscripcion: parseInt(String(formData.diaPagoSuscripcion)) || 5,
        montoSuscripcion: parseFloat(String(formData.montoSuscripcion)) || 0,
        diasPrueba: parseInt(String(formData.diasPrueba)) || 0,
        ultimoNroCotizacion: parseInt(String(formData.ultimoNroCotizacion)) || 0,
        ultimoNroOrden: parseInt(String(formData.ultimoNroOrden)) || 0,
        ultimoNroCosteo: parseInt(String(formData.ultimoNroCosteo)) || 0
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
      estado: empresa.estado,
      logoUrl: empresa.logoUrl || '',
      diaPagoSuscripcion: empresa.diaPagoSuscripcion ?? 5,
      periodicidad: empresa.periodicidad || 'MENSUAL',
      montoSuscripcion: empresa.montoSuscripcion ?? 0,
      diasPrueba: empresa.diasPrueba ?? 14,
      ultimoNroCotizacion: empresa.ultimoNroCotizacion ?? 0,
      ultimoNroOrden: empresa.ultimoNroOrden ?? 0,
      ultimoNroCosteo: empresa.ultimoNroCosteo ?? 0
    });
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingEmpresa(null);
    setFormData({
      ruc: '',
      razonSocial: '',
      contacto: '',
      celular: '',
      correo: '',
      fechaInicio: '',
      estado: 'ACTIVO',
      logoUrl: '',
      diaPagoSuscripcion: 5,
      periodicidad: 'MENSUAL',
      montoSuscripcion: 0,
      diasPrueba: 14,
      ultimoNroCotizacion: 0,
      ultimoNroOrden: 0,
      ultimoNroCosteo: 0
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`¿Está seguro de que desea eliminar permanentemente la empresa "${name}" y todos sus datos relacionados (usuarios, cotizaciones, costeos, etc.)?`)) {
      return;
    }
    try {
      await api.delete(`/empresas/${id}`);
      fetchEmpresas();
    } catch (err: any) {
      alert('Error al eliminar la empresa: ' + (err.response?.data?.message || err.message));
    }
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
                <th>Suscripción</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map(e => (
                <tr key={e.id}>
                  <td>
                    <div className="flex-align" style={{ gap: '0.75rem' }}>
                      {e.logoUrl ? (
                        <img 
                          src={e.logoUrl} 
                          alt="Logo" 
                          style={{
                            width: '32px',
                            height: '32px',
                            objectFit: 'contain',
                            borderRadius: '4px',
                            border: '1px solid rgba(226, 232, 240, 0.8)',
                            backgroundColor: '#fff',
                            padding: '2px'
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '4px',
                          border: '1px solid rgba(226, 232, 240, 0.8)',
                          backgroundColor: '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#64748b',
                          fontWeight: 'bold',
                          fontSize: '0.8rem'
                        }}>
                          {e.razonSocial.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <strong>{e.razonSocial}</strong>
                      </div>
                    </div>
                  </td>
                  <td>{e.ruc}</td>
                  <td>
                    <div>{e.contacto}</div>
                    <small className="text-light">{e.correo}</small>
                  </td>
                  <td>{new Date(e.fechaInicio).toLocaleDateString()}</td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>$ {e.montoSuscripcion.toFixed(2)} USD</div>
                    <small className="text-light uppercase font-semibold" style={{ fontSize: '0.7rem', display: 'block' }}>
                      {e.periodicidad} (Día {e.diaPagoSuscripcion})
                    </small>
                    <span className="status-badge status-pending" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', marginTop: '4px', display: 'inline-block' }}>
                      Prueba: {e.diasPrueba ?? 14} días
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${e.estado === 'ACTIVO' ? 'status-approved' : e.estado === 'SUSPENDIDO' ? 'status-pending' : 'status-rejected'}`}>
                      {e.estado}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: '0.25rem' }}>
                    <button className="icon-btn" onClick={() => handleEdit(e)} title="Editar Empresa">
                      <Edit size={16} />
                    </button>
                    <button className="icon-btn" style={{ color: '#EF4444' }} onClick={() => handleDelete(e.id, e.razonSocial)} title="Eliminar Empresa">
                      <Trash2 size={16} />
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
          <div className="modal-content animate-slide-in" style={{ maxWidth: '650px', width: '95%' }}>
            <div className="modal-header">
              <h3>{editingEmpresa ? 'Editar Empresa' : 'Registrar Empresa'}</h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
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
                  <div className="form-group">
                    <label>URL del Logo</label>
                    <input 
                      type="url" 
                      placeholder="https://ejemplo.com/logo.png"
                      value={formData.logoUrl}
                      onChange={(e) => setFormData({...formData, logoUrl: e.target.value})} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Estado de la Empresa</label>
                    <select value={formData.estado} onChange={(e) => setFormData({...formData, estado: e.target.value})}>
                      <option value="ACTIVO">ACTIVO</option>
                      <option value="SUSPENDIDO">SUSPENDIDO</option>
                      <option value="DE_BAJA">DE BAJA</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Día de Pago Suscripción</label>
                    <input 
                      type="number" 
                      min="1"
                      max="31"
                      required 
                      value={formData.diaPagoSuscripcion}
                      onChange={(e) => setFormData({...formData, diaPagoSuscripcion: parseInt(e.target.value) || 5})} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Periodicidad</label>
                    <select value={formData.periodicidad} onChange={(e) => setFormData({...formData, periodicidad: e.target.value})}>
                      <option value="MENSUAL">MENSUAL</option>
                      <option value="ANUAL">ANUAL</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Monto Suscripción (USD - $)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      required 
                      value={formData.montoSuscripcion}
                      onChange={(e) => setFormData({...formData, montoSuscripcion: parseFloat(e.target.value) || 0})} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Días de Periodo de Prueba</label>
                    <input 
                      type="number" 
                      min="0"
                      required 
                      value={formData.diasPrueba}
                      onChange={(e) => setFormData({...formData, diasPrueba: parseInt(e.target.value) || 0})} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Último Nro. Cotización</label>
                    <input 
                      type="number" 
                      min="0"
                      required 
                      value={formData.ultimoNroCotizacion}
                      onChange={(e) => setFormData({...formData, ultimoNroCotizacion: parseInt(e.target.value) || 0})} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Último Nro. Orden</label>
                    <input 
                      type="number" 
                      min="0"
                      required 
                      value={formData.ultimoNroOrden}
                      onChange={(e) => setFormData({...formData, ultimoNroOrden: parseInt(e.target.value) || 0})} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Último Nro. Costeo</label>
                    <input 
                      type="number" 
                      min="0"
                      required 
                      value={formData.ultimoNroCosteo}
                      onChange={(e) => setFormData({...formData, ultimoNroCosteo: parseInt(e.target.value) || 0})} 
                    />
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
