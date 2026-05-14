import React, { useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { User, Phone, Mail, Lock, Save } from 'lucide-react';

const Perfil: React.FC = () => {
  const { token, user, login } = useAuth();
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
