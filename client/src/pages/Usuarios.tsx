import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Plus, Shield, UserCheck, UserX } from 'lucide-react';

const Usuarios: React.FC = () => {
  const { token } = useAuth();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '', password: '', nombres: '', apellidos: '', correo: '', rol: 'VENDEDOR', celular: ''
  });

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    try {
      const response = await api.get('/usuarios');
      setUsuarios(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/usuarios', newUser);
      setShowModal(false);
      setNewUser({ username: '', password: '', nombres: '', apellidos: '', correo: '', rol: 'VENDEDOR', celular: '' });
      fetchUsuarios();
    } catch (err) {
      alert('Error al crear usuario');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Gestión de Usuarios</h1>
        <button className="primary icon-left" onClick={() => setShowModal(true)}>
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
                      <Shield size={12} /> {u.rol}
                    </span>
                  </td>
                  <td>{u.correo}</td>
                  <td>
                    {u.estado === 'ACTIVO' ? 
                      <span className="text-success"><UserCheck size={16} /> Activo</span> : 
                      <span className="text-danger"><UserX size={16} /> Inactivo</span>
                    }
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
              <h3>Registrar Usuario</h3>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label>ID Usuario (Username)</label>
                    <input type="text" required onChange={(e) => setNewUser({...newUser, username: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Contraseña</label>
                    <input type="password" required onChange={(e) => setNewUser({...newUser, password: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Nombres</label>
                    <input type="text" required onChange={(e) => setNewUser({...newUser, nombres: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Apellidos</label>
                    <input type="text" required onChange={(e) => setNewUser({...newUser, apellidos: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Correo</label>
                    <input type="email" required onChange={(e) => setNewUser({...newUser, correo: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Rol</label>
                    <select onChange={(e) => setNewUser({...newUser, rol: e.target.value})}>
                      <option value="VENDEDOR">Vendedor</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="primary">Guardar Usuario</button>
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
        .text-success { color: var(--success); display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; }
        .text-danger { color: var(--danger); display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; }
      `}</style>
    </div>
  );
};

export default Usuarios;
