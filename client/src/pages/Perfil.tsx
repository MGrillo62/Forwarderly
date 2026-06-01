import React, { useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { User, Phone, Mail, Lock, Save } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const Perfil: React.FC = () => {
  const { token, user, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const isNewUser = queryParams.get('new') === 'true';
  
  const [showWelcomeModal, setShowWelcomeModal] = useState(isNewUser);
  const [formData, setFormData] = useState({
    nombres: user?.nombres || '',
    apellidos: user?.apellidos || '',
    correo: user?.correo || '',
    celular: user?.celular || '',
    password: ''
  });
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.put('/usuarios/me', formData);
      // Update local storage and context
      const updatedUser = { ...user, ...response.data };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert('Error al actualizar perfil');
    }
  };

  return (
    <div className="perfil-container">
      <h1>Mi Perfil</h1>
      <p className="subtitle">Actualiza tu información de contacto y contraseña</p>

      <div className="card perfil-card">
        {success && <div className="alert-success">Perfil actualizado con éxito</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label><User size={14} /> Nombres</label>
              <input 
                type="text" 
                value={formData.nombres}
                onChange={(e) => setFormData({ ...formData, nombres: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label><User size={14} /> Apellidos</label>
              <input 
                type="text" 
                value={formData.apellidos}
                onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label><Mail size={14} /> Correo Electrónico</label>
              <input 
                type="email" 
                value={formData.correo}
                onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label><Phone size={14} /> Celular</label>
              <input 
                type="text" 
                value={formData.celular}
                onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label><Lock size={14} /> Nueva Contraseña (dejar en blanco para no cambiar)</label>
              <input 
                type="password" 
                placeholder="********"
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>
          
          <div className="form-footer">
            <button type="submit" className="primary">
              <Save size={18} /> Guardar Cambios
            </button>
          </div>
        </form>
      </div>

      {/* Welcome / Registration Step Modal */}
      {showWelcomeModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', zIndex: 9999 }}>
          <div className="modal-content animate-slide-in" style={{ background: '#ffffff', borderRadius: '1rem', border: '1px solid rgba(226,232,240,0.8)', maxWidth: '480px', width: '95%', textAlign: 'center', padding: '2.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div className="welcome-icon-wrapper" style={{ margin: '0 auto 1.5rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(79, 70, 229, 0.08)', color: '#4f46e5' }}>
              <User size={32} style={{ margin: 'auto' }} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' }}>
              ¡Bienvenido a Forwarderly! 🎉
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: '1.6', marginBottom: '1.75rem', padding: '0 0.5rem' }}>
              Tu usuario ha sido creado de forma exitosa y cuentas con un periodo de <strong>Prueba Gratuito de 14 días</strong> activo para tu empresa.
            </p>
            
            <div style={{ background: '#f8fafc', border: '1px solid rgba(226,232,240,0.8)', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#475569', marginBottom: '2rem', textAlign: 'left', lineHeight: '1.4' }}>
              <strong>Próximo Paso:</strong> Para asegurar la continuidad de tus operaciones de importación y elegir el plan ideal, te invitamos a seleccionar tu membresía.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                className="primary font-bold flex-align" 
                style={{ width: '100%', justifyContent: 'center', padding: '0.8rem 1rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}
                onClick={() => navigate('/suscripciones')}
              >
                💳 Elegir Mi Suscripción
              </button>
              <button 
                className="btn-outline font-semibold" 
                style={{ width: '100%', padding: '0.8rem 1rem', background: 'none', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', color: '#64748b', fontSize: '0.9rem' }}
                onClick={() => setShowWelcomeModal(false)}
              >
                Completar Perfil Primero
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .perfil-container { max-width: 800px; margin: 0 auto; }
        .subtitle { color: var(--text-light); margin-bottom: 2rem; }
        .perfil-card { padding: 2rem; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; margin-bottom: 0.5rem; color: var(--text-light); }
        .form-footer { margin-top: 2rem; display: flex; justify-content: flex-end; }
        .alert-success { 
          background: #dcfce7; 
          color: #16a34a; 
          padding: 1rem; 
          border-radius: 0.5rem; 
          margin-bottom: 1.5rem; 
          text-align: center;
          font-weight: 600;
        }
        @media (max-width: 600px) {
          .grid-2 { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default Perfil;
