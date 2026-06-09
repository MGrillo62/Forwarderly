import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Plus, Shield, UserCheck, UserX, Edit2, Eye, EyeOff } from 'lucide-react';

const Usuarios: React.FC = () => {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newUser, setNewUser] = useState({
    id: '', username: '', password: '', nombres: '', apellidos: '', correo: '', rol: 'VENDEDOR', celular: '', estado: 'ACTIVO', empresaId: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchUsuarios();
    if (user?.rol === 'SUPER_ADMIN') {
      fetchEmpresas();
    }
  }, [user]);

  const fetchUsuarios = async () => {
    try {
      const response = await api.get('/usuarios');
      setUsuarios(response.data);
    } catch (err) {
      console.error(err);
    }
  };

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
      if (isEditing) {
        await api.put(`/usuarios/${newUser.id}`, newUser);
      } else {
        await api.post('/usuarios', newUser);
      }
      setShowModal(false);
      resetForm();
      fetchUsuarios();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error al guardar usuario';
      alert(msg);
    }
  };

  const editUser = (u: any) => {
    setNewUser({
      id: u.id,
      username: u.username,
      password: '', // Blank so it doesn't change unless typed
      nombres: u.nombres,
      apellidos: u.apellidos,
      correo: u.correo,
      rol: u.rol,
      celular: u.celular || '',
      estado: u.estado,
      empresaId: u.empresaId || ''
    });
    setIsEditing(true);
    setShowModal(true);
  };

  const resetForm = () => {
    setNewUser({ id: '', username: '', password: '', nombres: '', apellidos: '', correo: '', rol: 'VENDEDOR', celular: '', estado: 'ACTIVO', empresaId: '' });
    setIsEditing(false);
    setShowPassword(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1>Gestión de Usuarios</h1>
        <button className="primary icon-left" onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus size={18} /> Nuevo Usuario
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Nombre Completo</th>
                <th>Rol</th>
                {user?.rol === 'SUPER_ADMIN' && <th>Empresa</th>}
                <th>Correo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.username}</strong></td>
                  <td>{u.nombres} {u.apellidos}</td>
                  <td>
                    <span className={`rol-tag ${u.rol.toLowerCase()}`}>
                      <Shield size={12} /> {u.rol.replace('_', ' ')}
                    </span>
                  </td>
                  {user?.rol === 'SUPER_ADMIN' && <td>{u.empresa?.razonSocial || '-'}</td>}
                  <td>{u.correo}</td>
                  <td>
                    {u.estado === 'ACTIVO' ? 
                      <span className="text-success"><UserCheck size={16} /> Activo</span> : 
                      <span className="text-danger"><UserX size={16} /> Inactivo</span>
                    }
                  </td>
                  <td>
                    <button className="btn-outline sm icon-only" onClick={() => editUser(u)}>
                      <Edit2 size={16} />
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
              <h3>{isEditing ? 'Editar Usuario' : 'Registrar Usuario'}</h3>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label>ID Usuario (Username)</label>
                    <input type="text" required value={newUser.username} disabled={isEditing} onChange={(e) => setNewUser({...newUser, username: e.target.value})} autoComplete="off" />
                  </div>
                  <div className="form-group">
                    <label>{isEditing ? 'Nueva Contraseña (dejar en blanco para no cambiar)' : 'Contraseña'}</label>
                    <div className="password-input-wrapper">
                      <input 
                        type={showPassword ? 'text' : 'password'} 
                        required={!isEditing} 
                        onChange={(e) => setNewUser({...newUser, password: e.target.value})} 
                        autoComplete="new-password"
                      />
                      <button 
                        type="button" 
                        className="password-toggle-btn" 
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Nombres</label>
                    <input type="text" required value={newUser.nombres} onChange={(e) => setNewUser({...newUser, nombres: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Apellidos</label>
                    <input type="text" required value={newUser.apellidos} onChange={(e) => setNewUser({...newUser, apellidos: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Celular</label>
                    <input type="text" value={newUser.celular} onChange={(e) => setNewUser({...newUser, celular: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Correo</label>
                    <input type="email" required value={newUser.correo} onChange={(e) => setNewUser({...newUser, correo: e.target.value})} />
                  </div>
                  
                  <div className="form-group">
                    <label>Rol</label>
                    <select value={newUser.rol} onChange={(e) => setNewUser({...newUser, rol: e.target.value})}>
                      <option value="VENDEDOR">Vendedor</option>
                      <option value="ADMIN">Administrador</option>
                      {user?.rol === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">Super Admin</option>}
                    </select>
                  </div>
                  
                  {isEditing && (
                    <div className="form-group">
                      <label>Estado</label>
                      <select value={newUser.estado} onChange={(e) => setNewUser({...newUser, estado: e.target.value})}>
                        <option value="ACTIVO">Activo</option>
                        <option value="INACTIVO">Inactivo</option>
                      </select>
                    </div>
                  )}

                  {user?.rol === 'SUPER_ADMIN' && newUser.rol !== 'SUPER_ADMIN' && (
                    <div className="form-group">
                      <label>Empresa</label>
                      <select value={newUser.empresaId} onChange={(e) => setNewUser({...newUser, empresaId: e.target.value})} required>
                        <option value="">Seleccione una empresa</option>
                        {empresas.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.razonSocial}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={() => { setShowModal(false); resetForm(); }}>Cancelar</button>
                <button type="submit" className="primary">{isEditing ? 'Guardar Cambios' : 'Crear Usuario'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .rol-tag {
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          text-transform: uppercase;
        }
        .rol-tag.admin { background: #fee2e2; color: #ef4444; }
        .rol-tag.vendedor { background: #dcfce7; color: #16a34a; }
        .rol-tag.super_admin { background: #e0e7ff; color: #4f46e5; }
        .text-success { color: var(--success); display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; }
        .text-danger { color: var(--danger); display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; }
        .icon-only { padding: 0.4rem; display: flex; align-items: center; justify-content: center; }
        .password-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
        }
        .password-input-wrapper input {
          width: 100%;
          padding-right: 2.5rem;
        }
        .password-toggle-btn {
          position: absolute;
          right: 0.75rem;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.25rem;
        }
        .password-toggle-btn:hover {
          color: #64748b;
        }
      `}</style>
    </div>
  );
};

export default Usuarios;
