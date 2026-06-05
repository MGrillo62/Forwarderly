import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Settings, Edit2, X, Save, Calendar, ShieldCheck, DollarSign } from 'lucide-react';

const ConfiguracionPlanes: React.FC = () => {
  const { user } = useAuth();
  const [planes, setPlanes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [formData, setFormData] = useState({
    nombre: '',
    monto: 0,
    periodicidad: 'MENSUAL',
    diasPrueba: 14
  });

  useEffect(() => {
    fetchPlanes();
  }, []);

  const fetchPlanes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/suscripciones/planes');
      setPlanes(res.data);
    } catch (err) {
      console.error('Error fetching plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (plan: any) => {
    setSelectedPlan(plan);
    setFormData({
      nombre: plan.nombre,
      monto: plan.monto !== undefined ? plan.monto : (plan.amount / 100),
      periodicidad: plan.periodicidad || (plan.interval_count === 12 ? 'ANUAL' : 'MENSUAL'),
      diasPrueba: plan.diasPrueba !== undefined ? plan.diasPrueba : 14
    });
    setErrorMsg('');
    setSuccessMsg('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setErrorMsg('');
      setSuccessMsg('');
      const res = await api.put(`/suscripciones/planes/${selectedPlan.id}`, {
        nombre: formData.nombre,
        monto: parseFloat(String(formData.monto)) || 0,
        periodicidad: formData.periodicidad,
        diasPrueba: parseInt(String(formData.diasPrueba)) || 0
      });

      setSuccessMsg('Plan actualizado con éxito.');
      setTimeout(() => {
        setShowModal(false);
        fetchPlanes();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Error al actualizar el plan');
    }
  };

  if (user?.rol !== 'SUPER_ADMIN') {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--danger)' }}>Acceso Denegado</h2>
        <p style={{ color: 'var(--text-light)' }}>Solo el Super Administrador tiene permiso para acceder a esta configuración.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1><Settings size={26} className="icon-blue" style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Configuración de Planes de Suscripción</h1>
        <p className="subtitle">Gestione las tarifas, periodicidad y días de prueba que se muestran a los clientes.</p>
      </div>

      <div className="card animate-fade-in">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Código / ID</th>
                <th>Nombre del Plan</th>
                <th>Periodicidad</th>
                <th>Importe de Suscripción</th>
                <th>Periodo de Prueba</th>
                <th>Última Actualización</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                    Cargando planes...
                  </td>
                </tr>
              ) : planes.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                    No se encontraron planes configurados en el sistema.
                  </td>
                </tr>
              ) : (
                planes.map(p => {
                  const planCodigo = p.codigo || p.id;
                  const planMonto = p.monto !== undefined ? p.monto : (p.amount / 100);
                  const planNombre = p.nombre || p.name;
                  const planPeriodicidad = p.periodicidad || (p.interval_count === 12 ? 'ANUAL' : 'MENSUAL');
                  const planDiasPrueba = p.diasPrueba !== undefined ? p.diasPrueba : 14;

                  return (
                    <tr key={p.id}>
                      <td><strong style={{ color: 'var(--primary)' }}>{planCodigo}</strong></td>
                      <td><strong>{planNombre}</strong></td>
                      <td>
                        <span className={`status-badge ${planPeriodicidad === 'ANUAL' ? 'status-approved' : 'status-pending'}`} style={{ fontSize: '0.7rem' }}>
                          {planPeriodicidad}
                        </span>
                      </td>
                      <td><strong style={{ color: 'var(--text-dark)' }}>S/ {planMonto.toFixed(2)} PEN</strong></td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{planDiasPrueba} días</span>
                      </td>
                      <td>
                        <small className="text-light flex-align" style={{ gap: '0.25rem', fontSize: '0.75rem' }}>
                          <Calendar size={12} /> {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : 'Por defecto'}
                        </small>
                      </td>
                      <td>
                        <button 
                          className="btn-outline font-bold flex-align" 
                          style={{ gap: '0.25rem', padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                          onClick={() => handleEdit(p)}
                        >
                          <Edit2 size={14} /> Editar Tarifa
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && selectedPlan && (
        <div className="modal-overlay">
          <div className="modal-content animate-slide-in" style={{ maxWidth: '500px', width: '95%' }}>
            <div className="modal-header">
              <h3 className="flex-align" style={{ gap: '0.5rem' }}>
                <Edit2 size={18} className="icon-blue" /> Editar Configuración del Plan
              </h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {successMsg && <div className="alert-success" style={{ padding: '0.75rem', fontSize: '0.85rem', marginBottom: '1.25rem', background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: '0.375rem', textAlign: 'center', fontWeight: 'bold' }}>{successMsg}</div>}
                {errorMsg && <div className="error-message" style={{ padding: '0.75rem', fontSize: '0.85rem', marginBottom: '1.25rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '0.375rem', textAlign: 'center', fontWeight: 'bold' }}>{errorMsg}</div>}

                <div style={{ background: 'rgba(79, 70, 229, 0.04)', border: '1px solid rgba(79, 70, 229, 0.1)', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Código Identificador</div>
                  <strong style={{ fontSize: '1rem', color: 'var(--primary)', marginTop: '0.25rem', display: 'block' }}>
                    {selectedPlan.codigo || selectedPlan.id}
                  </strong>
                </div>

                <div className="form-group">
                  <label>Nombre del Plan</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Periodicidad</label>
                  <select 
                    value={formData.periodicidad} 
                    onChange={(e) => setFormData({ ...formData, periodicidad: e.target.value })}
                    required
                  >
                    <option value="MENSUAL">MENSUAL</option>
                    <option value="ANUAL">ANUAL</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Importe de Suscripción (Soles - S/)</label>
                  <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                    <DollarSign size={16} style={{ position: 'absolute', left: '10px', color: '#94a3b8' }} />
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      required 
                      style={{ paddingLeft: '2rem' }}
                      value={formData.monto}
                      onChange={(e) => setFormData({ ...formData, monto: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Periodo de Prueba Gratis (Días)</label>
                  <input 
                    type="number" 
                    min="0"
                    required 
                    value={formData.diasPrueba}
                    onChange={(e) => setFormData({ ...formData, diasPrueba: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="primary flex-align" style={{ gap: '0.25rem' }}>
                  <Save size={16} /> Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfiguracionPlanes;
