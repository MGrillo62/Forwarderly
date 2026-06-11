import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { User, Phone, Mail, Lock, Save, Eye, EyeOff, Upload, Trash2, Image } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
  
  const { activeEmpresa } = useAuth();
  const [logoUploading, setLogoUploading] = useState(false);
  const [numCotizacion, setNumCotizacion] = useState(0);
  const [numOrden, setNumOrden] = useState(0);
  const [numCosteo, setNumCosteo] = useState(0);
  const [numsSuccess, setNumsSuccess] = useState(false);

  const [bancosList, setBancosList] = useState<any[]>([]);
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);
  const [notasLiquidador, setNotasLiquidador] = useState('');
  const [cobranzasSuccess, setCobranzasSuccess] = useState(false);

  useEffect(() => {
    const fetchBancos = async () => {
      try {
        const res = await api.get('/bancos');
        setBancosList(res.data);
      } catch (err) {
        console.error('Error fetching banks:', err);
      }
    };
    if (user?.rol === 'ADMIN' || user?.rol === 'SUPER_ADMIN') {
      fetchBancos();
    }
  }, [user]);

  useEffect(() => {
    if (activeEmpresa) {
      setNumCotizacion(activeEmpresa.ultimoNroCotizacion ?? 0);
      setNumOrden(activeEmpresa.ultimoNroOrden ?? 0);
      setNumCosteo(activeEmpresa.ultimoNroCosteo ?? 0);

      if (activeEmpresa.cuentasBancarias) {
        try {
          const parsed = typeof activeEmpresa.cuentasBancarias === 'string'
            ? JSON.parse(activeEmpresa.cuentasBancarias)
            : activeEmpresa.cuentasBancarias;
          setCuentasBancarias(Array.isArray(parsed) ? parsed : []);
        } catch (e) {
          setCuentasBancarias([]);
        }
      } else {
        setCuentasBancarias([]);
      }
      setNotasLiquidador(activeEmpresa.notasLiquidador ?? 'Documento generado automáticamente por el sistema de gestión de cobranzas. Los montos reflejados corresponden a la liquidación final autorizada para el despacho ORD-1.');
    }
  }, [activeEmpresa]);

  const handleSaveNumeradores = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put('/empresas/mi-empresa/numeradores', {
        ultimoNroCotizacion: numCotizacion,
        ultimoNroOrden: numOrden,
        ultimoNroCosteo: numCosteo
      });
      setNumsSuccess(true);
      setTimeout(() => setNumsSuccess(false), 3000);
      alert('Numeradores actualizados con éxito.');
      window.location.reload();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al actualizar numeradores');
    }
  };

  const handleRegisterBanco = async () => {
    const nombre = prompt('Ingrese el nombre del nuevo banco:');
    if (!nombre || nombre.trim() === '') return;
    
    try {
      await api.post('/bancos', { nombre: nombre.trim() });
      const res = await api.get('/bancos');
      setBancosList(res.data);
      alert('Banco registrado con éxito.');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al registrar banco');
    }
  };

  const handleAddCuenta = () => {
    setCuentasBancarias(prev => [
      ...prev,
      { banco: '', moneda: 'Soles', tipoCuenta: 'Cta. Cte', nroCuenta: '', cci: '' }
    ]);
  };

  const handleRemoveCuenta = (index: number) => {
    setCuentasBancarias(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditCuenta = (index: number, field: string, value: string) => {
    setCuentasBancarias(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const handleSaveCobranzas = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      for (const account of cuentasBancarias) {
        if (!account.banco || account.banco.trim() === '') {
          alert('Por favor seleccione o ingrese un banco para todas las cuentas.');
          return;
        }
        if (!account.nroCuenta || account.nroCuenta.trim() === '') {
          alert('Por favor ingrese el número de cuenta para todas las cuentas.');
          return;
        }
      }

      await api.put('/empresas/mi-empresa/bancos-y-notas', {
        cuentasBancarias,
        notasLiquidador: notasLiquidador.trim()
      });
      setCobranzasSuccess(true);
      setTimeout(() => setCobranzasSuccess(false), 3000);
      alert('Configuración de cobranzas guardada con éxito.');
      window.location.reload();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al guardar la configuración de cobranzas');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('logo', file);

    try {
      setLogoUploading(true);
      await api.post('/empresas/mi-empresa/logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      alert('Logo subido con éxito.');
      window.location.reload();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al subir el logo');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoDelete = async () => {
    if (!window.confirm('¿Está seguro de que desea eliminar el logo de la empresa?')) return;
    try {
      setLogoUploading(true);
      await api.delete('/empresas/mi-empresa/logo');
      alert('Logo eliminado con éxito.');
      window.location.reload();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al eliminar el logo');
    } finally {
      setLogoUploading(false);
    }
  };

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
              <div className="password-input-wrapper">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="********"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
          </div>
          
          <div className="form-footer">
            <button type="submit" className="primary">
              <Save size={18} /> Guardar Cambios
            </button>
          </div>
        </form>
      </div>

      {(user?.rol === 'ADMIN' || user?.rol === 'SUPER_ADMIN') && (
        <div className="card perfil-card" style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '0.25rem' }}>Logo de la Empresa</h2>
          <p className="subtitle" style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '1.5rem' }}>
            Sube el logotipo oficial para los reportes y comprobantes de la empresa (se insertará automáticamente en el lado superior izquierdo de los reportes PDF).
          </p>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{
              width: '180px',
              height: '100px',
              border: '2px dashed var(--border)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f8fafc',
              overflow: 'hidden',
              padding: '0.5rem'
            }}>
              {activeEmpresa?.logoUrl ? (
                <img 
                  src={activeEmpresa.logoUrl} 
                  alt="Logo Empresa" 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                  <Image size={32} style={{ margin: '0 auto 0.25rem auto', display: 'block' }} />
                  <span style={{ fontSize: '0.75rem' }}>Sin Logo</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {logoUploading ? (
                <span style={{ fontSize: '0.875rem', color: 'var(--text-light)', fontStyle: 'italic' }}>
                  Procesando logo en Cloudinary...
                </span>
              ) : (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <label className="primary font-bold flex-align" style={{ padding: '0.55rem 1.25rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', background: 'var(--primary)', color: 'white' }}>
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: 'none' }}
                      onChange={handleLogoUpload}
                    />
                    <Upload size={16} /> Subir Logo
                  </label>
                  
                  {activeEmpresa?.logoUrl && (
                    <button 
                      type="button" 
                      className="danger font-semibold" 
                      onClick={handleLogoDelete}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.25rem', fontSize: '0.85rem', background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} /> Eliminar
                    </button>
                  )}
                </div>
              )}
              <small style={{ color: 'var(--text-light)', fontSize: '0.75rem', maxWidth: '350px', lineHeight: '1.4' }}>
                Formatos recomendados: PNG o JPG con fondo transparente.
              </small>
            </div>
          </div>
        </div>
      )}

      {(user?.rol === 'ADMIN' || user?.rol === 'SUPER_ADMIN') && (
        <div className="card perfil-card" style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '0.25rem' }}>Numeradores de la Empresa</h2>
          <p className="subtitle" style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '1.5rem' }}>
            Inicializa o actualiza el contador de los documentos de la empresa. El número ingresado representa el <strong>último asignado</strong>; el siguiente documento creado recibirá ese número + 1.
          </p>

          <form onSubmit={handleSaveNumeradores}>
            {numsSuccess && <div className="alert-success">Numeradores guardados con éxito</div>}
            <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label>Último Nro. Cotización</label>
                <input 
                  type="number" 
                  min="0"
                  required
                  value={numCotizacion}
                  onChange={(e) => setNumCotizacion(parseInt(e.target.value) || 0)}
                />
                <small className="text-light" style={{ fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                  Próxima cotización será: <strong>{numCotizacion + 1}</strong>
                </small>
              </div>

              <div className="form-group">
                <label>Último Nro. Orden</label>
                <input 
                  type="number" 
                  min="0"
                  required
                  value={numOrden}
                  onChange={(e) => setNumOrden(parseInt(e.target.value) || 0)}
                />
                <small className="text-light" style={{ fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                  Próxima orden será: <strong>{numOrden + 1}</strong>
                </small>
              </div>

              <div className="form-group">
                <label>Último Nro. Costeo</label>
                <input 
                  type="number" 
                  min="0"
                  required
                  value={numCosteo}
                  onChange={(e) => setNumCosteo(parseInt(e.target.value) || 0)}
                />
                <small className="text-light" style={{ fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                  Próximo costeo será: <strong>{new Date().getFullYear()}-{(numCosteo + 1).toString().padStart(5, '0')}</strong>
                </small>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="primary">
                <Save size={18} /> Guardar Numeradores
              </button>
            </div>
          </form>
        </div>
      )}

      {(user?.rol === 'ADMIN' || user?.rol === 'SUPER_ADMIN') && (
        <div className="card perfil-card" style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '0.25rem' }}>Configuración de Cobranzas (Cuentas y Notas)</h2>
          <p className="subtitle" style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '1.5rem' }}>
            Registra las cuentas bancarias de la empresa para la liquidación de cobranza y edita la nota legal de pie de página.
          </p>

          <form onSubmit={handleSaveCobranzas}>
            {cobranzasSuccess && <div className="alert-success">Configuración de cobranzas guardada con éxito</div>}
            
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-dark)', margin: 0 }}>Cuentas Bancarias</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={handleRegisterBanco} className="btn-outline font-semibold" style={{ padding: '0.45rem 0.9rem', fontSize: '0.75rem', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#475569' }}>
                    + Registrar Nuevo Banco
                  </button>
                  <button type="button" onClick={handleAddCuenta} className="primary font-bold" style={{ padding: '0.45rem 0.9rem', fontSize: '0.75rem', cursor: 'pointer', border: 'none', borderRadius: '6px', background: 'var(--primary)', color: 'white' }}>
                    + Añadir Cuenta
                  </button>
                </div>
              </div>

              {cuentasBancarias.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', border: '2px dashed #e2e8f0', borderRadius: '8px', color: '#94a3b8', fontSize: '0.85rem', background: '#f8fafc' }}>
                  No hay cuentas bancarias registradas. Haz clic en "Añadir Cuenta" para empezar.
                </div>
              ) : (
                <div className="table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: 'white' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Banco</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Moneda</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Tipo de Cuenta</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Nro. de Cuenta</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>CCI</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', width: '50px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuentasBancarias.map((cuenta, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.5rem', minWidth: '150px' }}>
                            <select
                              value={cuenta.banco}
                              onChange={(e) => handleEditCuenta(idx, 'banco', e.target.value)}
                              className="select-custom"
                              style={{ width: '100%', padding: '0.45rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                            >
                              <option value="">Seleccione Banco...</option>
                              {['BCP', 'BBVA', 'Interbank', 'Scotiabank', 'Banco de la Nación'].map(b => (
                                <option key={b} value={b}>{b}</option>
                              ))}
                              {bancosList.filter(b => !['BCP', 'BBVA', 'Interbank', 'Scotiabank', 'Banco de la Nación'].includes(b.nombre.toUpperCase())).map(b => (
                                <option key={b.id} value={b.nombre}>{b.nombre}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '0.5rem', minWidth: '100px' }}>
                            <select
                              value={cuenta.moneda}
                              onChange={(e) => handleEditCuenta(idx, 'moneda', e.target.value)}
                              style={{ width: '100%', padding: '0.45rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', background: 'white' }}
                            >
                              <option value="Soles">Soles</option>
                              <option value="Dólares">Dólares</option>
                            </select>
                          </td>
                          <td style={{ padding: '0.5rem', minWidth: '120px' }}>
                            <select
                              value={cuenta.tipoCuenta}
                              onChange={(e) => handleEditCuenta(idx, 'tipoCuenta', e.target.value)}
                              style={{ width: '100%', padding: '0.45rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', background: 'white' }}
                            >
                              <option value="Cta. Cte">Cta. Cte</option>
                              <option value="Ahorro">Ahorro</option>
                            </select>
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <input
                              type="text"
                              placeholder="Ej. 191-xxxxxxxx-xx"
                              value={cuenta.nroCuenta}
                              onChange={(e) => handleEditCuenta(idx, 'nroCuenta', e.target.value)}
                              style={{ width: '100%', padding: '0.45rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <input
                              type="text"
                              placeholder="Ej. 002-xxxxxxxxxxxxxx-xx"
                              value={cuenta.cci}
                              onChange={(e) => handleEditCuenta(idx, 'cci', e.target.value)}
                              style={{ width: '100%', padding: '0.45rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveCuenta(idx)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Notas del Liquidador</label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: '0.50rem', lineHeight: '1.4' }}>
                Este texto aparecerá al pie de página del PDF de liquidación. El texto `"ORD-1"` o similar se reemplazará automáticamente con el número de orden correspondiente al imprimir.
              </p>
              <textarea
                rows={3}
                value={notasLiquidador}
                onChange={(e) => setNotasLiquidador(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem', fontFamily: 'inherit', resize: 'vertical', background: 'white' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="primary">
                <Save size={18} /> Guardar Configuración de Cobranzas
              </button>
            </div>
          </form>
        </div>
      )}

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
        @media (max-width: 600px) {
          .grid-2 { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default Perfil;
