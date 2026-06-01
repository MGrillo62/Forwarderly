import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Eye, EyeOff, ShieldCheck, ArrowLeft, ArrowRight, UserPlus, BookOpen } from 'lucide-react';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  // Login states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Flow State: 'login' | 'terms' | 'profile_setup'
  const [viewMode, setViewMode] = useState<'login' | 'terms' | 'profile_setup'>('login');
  
  // Registration States
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    nombres: '',
    apellidos: '',
    correo: '',
    celular: '',
    username: '',
    password: '',
    ruc: '',
    razonSocial: ''
  });
  const [registerShowPassword, setRegisterShowPassword] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { username, password });
      login(response.data.token, response.data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al iniciar sesión. Inténtelo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');
    
    if (registerForm.ruc.length !== 11) {
      setRegisterError('El RUC en el Perú debe constar exactamente de 11 dígitos.');
      return;
    }

    setRegisterLoading(true);
    try {
      const response = await api.post('/api/auth/register', registerForm);
      // Auto login
      login(response.data.token, response.data.user);
      // Redirect to profile with flag
      navigate('/perfil?new=true');
    } catch (err: any) {
      setRegisterError(err.response?.data?.message || 'Error al crear la cuenta. Verifique los datos.');
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        
        {/* LOGIN MODE */}
        {viewMode === 'login' && (
          <div className="login-card animate-fade-in">
            <h1 className="login-title">IMPORT PERÚ</h1>
            <p className="login-subtitle">Sistema de Cotizaciones y Órdenes</p>
            
            {error && <div className="error-message">{error}</div>}
            
            <form onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label>Usuario</label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <div className="password-input-wrapper">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                  />
                  <button 
                    type="button" 
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              
              <button type="submit" className="primary full-width font-bold" disabled={loading}>
                {loading ? 'Ingresando...' : 'Entrar'}
              </button>
            </form>

            <div className="register-option-wrapper">
              <button 
                type="button" 
                className="register-btn-toggle flex-align"
                onClick={() => setViewMode('terms')}
              >
                <UserPlus size={16} /> ¿No tienes cuenta? Crear usuario
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: TERMS AND CONDITIONS */}
        {viewMode === 'terms' && (
          <div className="login-card register-wide animate-slide-in">
            <h2 className="register-title flex-align" style={{ gap: '0.5rem', justifyContent: 'center' }}>
              <ShieldCheck size={24} className="icon-blue" /> Registro en la Plataforma
            </h2>
            <p className="login-subtitle" style={{ marginBottom: '1.5rem' }}>
              Paso 1: Lectura y Aceptación de Políticas de la Empresa
            </p>

            <div className="document-links-box">
              <div className="doc-link-item">
                <div className="doc-details">
                  <span className="doc-icon">📄</span>
                  <div>
                    <strong>Términos y Condiciones</strong>
                    <small>Sistema de Cotización de Importaciones</small>
                  </div>
                </div>
                <a 
                  href="https://res.cloudinary.com/dsqe7utsy/image/upload/v1780280028/T%C3%A9rminos_y_Condiciones_-_Sistema_Web_de_Cotizaci%C3%B3n_de_Importaciones_spfnae.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-link"
                >
                  Ver Documento
                </a>
              </div>

              <div className="doc-link-item">
                <div className="doc-details">
                  <span className="doc-icon">📄</span>
                  <div>
                    <strong>Política de Cambios</strong>
                    <small>Devoluciones y Cancelaciones - Sistema SaaS</small>
                  </div>
                </div>
                <a 
                  href="https://res.cloudinary.com/dsqe7utsy/image/upload/v1780280028/Pol%C3%ADtica_de_Cambios_Devoluciones_y_Cancelaciones_-_Sistema_SaaS_tpplbe.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-link"
                >
                  Ver Documento
                </a>
              </div>
            </div>

            <div className="checkboxes-section">
              <div className="form-checkbox-wrapper">
                <input 
                  type="checkbox" 
                  id="chkTerms"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                <label htmlFor="chkTerms" className="checkbox-label">
                  He leído, comprendo y acepto en su totalidad los <strong>Términos y Condiciones</strong> de uso.
                </label>
              </div>

              <div className="form-checkbox-wrapper" style={{ marginTop: '1rem' }}>
                <input 
                  type="checkbox" 
                  id="chkPolicy"
                  checked={policyAccepted}
                  onChange={(e) => setPolicyAccepted(e.target.checked)}
                />
                <label htmlFor="chkPolicy" className="checkbox-label">
                  He leído, comprendo y acepto la <strong>Política de cambios</strong>, devoluciones y cancelaciones.
                </label>
              </div>
            </div>

            <div className="actions-row">
              <button 
                type="button" 
                className="btn-outline flex-align"
                style={{ gap: '0.25rem' }}
                onClick={() => setViewMode('login')}
              >
                <ArrowLeft size={16} /> Cancelar
              </button>
              <button 
                type="button" 
                className="primary flex-align"
                style={{ gap: '0.25rem' }}
                disabled={!termsAccepted || !policyAccepted}
                onClick={() => setViewMode('profile_setup')}
              >
                Continuar <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PROFILE SETUP (CREAR USUARIO / MI PERFIL) */}
        {viewMode === 'profile_setup' && (
          <div className="login-card register-wide animate-slide-in">
            <h2 className="register-title">Crear Cuenta (Mi Perfil)</h2>
            <p className="login-subtitle" style={{ marginBottom: '1.5rem' }}>
              Paso 2: Complete sus datos personales y los de su empresa
            </p>

            {registerError && <div className="error-message">{registerError}</div>}

            <form onSubmit={handleRegisterSubmit}>
              <div className="register-scroll-container">
                <h3 className="sub-section-title">👤 Datos Personales</h3>
                
                <div className="grid-2">
                  <div className="form-group">
                    <label>Nombres *</label>
                    <input 
                      type="text" 
                      required
                      value={registerForm.nombres}
                      onChange={(e) => setRegisterForm({ ...registerForm, nombres: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Apellidos *</label>
                    <input 
                      type="text" 
                      required
                      value={registerForm.apellidos}
                      onChange={(e) => setRegisterForm({ ...registerForm, apellidos: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label>Correo Electrónico *</label>
                    <input 
                      type="email" 
                      required
                      placeholder="ejemplo@correo.com"
                      value={registerForm.correo}
                      onChange={(e) => setRegisterForm({ ...registerForm, correo: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Celular *</label>
                    <input 
                      type="tel" 
                      required
                      value={registerForm.celular}
                      onChange={(e) => setRegisterForm({ ...registerForm, celular: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label>Nombre de Usuario *</label>
                    <input 
                      type="text" 
                      required
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Contraseña *</label>
                    <div className="password-input-wrapper">
                      <input 
                        type={registerShowPassword ? "text" : "password"} 
                        required
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      />
                      <button 
                        type="button" 
                        className="password-toggle"
                        onClick={() => setRegisterShowPassword(!registerShowPassword)}
                        tabIndex={-1}
                      >
                        {registerShowPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                </div>

                <h3 className="sub-section-title" style={{ marginTop: '1.25rem' }}>🏢 Datos de su Empresa</h3>
                
                <div className="grid-2">
                  <div className="form-group">
                    <label>Razón Social *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Nombre Legal de la Empresa"
                      value={registerForm.razonSocial}
                      onChange={(e) => setRegisterForm({ ...registerForm, razonSocial: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>RUC (11 dígitos) *</label>
                    <input 
                      type="text" 
                      required
                      maxLength={11}
                      placeholder="RUC de la empresa"
                      value={registerForm.ruc}
                      onChange={(e) => setRegisterForm({ ...registerForm, ruc: e.target.value.replace(/\D/g, '') })}
                    />
                  </div>
                </div>
              </div>

              <div className="actions-row" style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(226,232,240,0.5)', paddingTop: '1rem' }}>
                <button 
                  type="button" 
                  className="btn-outline flex-align"
                  style={{ gap: '0.25rem' }}
                  onClick={() => setViewMode('terms')}
                >
                  <ArrowLeft size={16} /> Atrás
                </button>
                <button 
                  type="submit" 
                  className="primary flex-align"
                  style={{ gap: '0.25rem' }}
                  disabled={registerLoading}
                >
                  {registerLoading ? 'Creando Usuario...' : 'Crear Usuario y Continuar'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* PIE DE PÁGINA CORPORATIVO */}
        <footer className="login-footer">
          <div className="footer-details">
            <span className="company-name">Optimus Systems & Process EIRL</span>
            <span className="divider">|</span>
            <span className="contact-item">📞 +51 981 519 853</span>
            <span className="divider">|</span>
            <span className="contact-item">✉️ martin.grillo@optimussp.com</span>
            <span className="divider">|</span>
            <span className="address-item">📍 Calle Españoleto 141 Dpto 102, San Borja, Lima-Perú</span>
          </div>
          <div className="footer-links">
            <button className="book-link flex-align" onClick={() => navigate('/libro-reclamaciones')}>
              <BookOpen size={14} style={{ marginRight: '4px' }} /> Libro de Reclamaciones
            </button>
          </div>
        </footer>

      </div>

      <style>{`
        .login-page {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          padding: 1.5rem;
          overflow-y: auto;
        }
        .login-container {
          width: 100%;
          max-width: 420px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }
        .login-container:has(.register-wide) {
          max-width: 600px;
        }
        .login-card {
          background: rgba(255, 255, 255, 0.98);
          padding: 2.5rem;
          border-radius: 1.25rem;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
          width: 100%;
          color: #1e293b;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
        }
        .login-title {
          text-align: center;
          color: #4f46e5;
          margin-bottom: 0.35rem;
          font-size: 1.85rem;
          font-weight: 900;
          letter-spacing: 1px;
        }
        .register-title {
          text-align: center;
          color: #4f46e5;
          margin-bottom: 0.35rem;
          font-size: 1.5rem;
          font-weight: 800;
        }
        .login-subtitle {
          text-align: center;
          color: #64748b;
          margin-bottom: 2rem;
          font-size: 0.85rem;
          font-weight: 500;
        }
        .form-group {
          margin-bottom: 1.25rem;
        }
        .form-group label {
          display: block;
          margin-bottom: 0.45rem;
          font-size: 0.825rem;
          font-weight: 700;
          color: #475569;
        }
        .form-group input, 
        .form-group select, 
        .form-group textarea {
          width: 100%;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 0.5rem;
          padding: 0.65rem 0.85rem;
          color: #0f172a;
          font-size: 0.875rem;
          outline: none;
          transition: all 0.2s;
        }
        .form-group input:focus,
        .form-group select:focus {
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
        }
        .password-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .password-input-wrapper input {
          width: 100%;
          padding-right: 45px;
        }
        .password-toggle {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 0;
          transition: color 0.2s;
        }
        .password-toggle:hover {
          color: #4f46e5;
        }
        .full-width {
          width: 100%;
        }
        .error-message {
          background: #fee2e2;
          border: 1px solid #fecaca;
          color: #ef4444;
          padding: 0.75rem;
          border-radius: 0.5rem;
          margin-bottom: 1.25rem;
          font-size: 0.825rem;
          text-align: center;
          font-weight: 600;
        }
        
        /* Register Flow styles */
        .document-links-box {
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 1.25rem;
          border-radius: 0.75rem;
          margin-bottom: 1.5rem;
        }
        .doc-link-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 0.875rem;
          border-bottom: 1px solid #e2e8f0;
        }
        .doc-link-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .doc-details {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .doc-icon {
          font-size: 1.5rem;
        }
        .doc-details strong {
          display: block;
          font-size: 0.875rem;
          color: #0f172a;
        }
        .doc-details small {
          font-size: 0.725rem;
          color: #64748b;
        }
        .btn-link {
          color: #4f46e5;
          text-decoration: none;
          font-size: 0.825rem;
          font-weight: 700;
          border: 1px solid rgba(79, 70, 229, 0.2);
          padding: 0.35rem 0.75rem;
          border-radius: 0.375rem;
          transition: all 0.2s;
          background: white;
        }
        .btn-link:hover {
          background: rgba(79, 70, 229, 0.05);
          border-color: #4f46e5;
        }
        .checkboxes-section {
          margin-bottom: 2rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 1.25rem;
          border-radius: 0.75rem;
        }
        .form-checkbox-wrapper {
          display: flex;
          align-items: flex-start;
          gap: 0.625rem;
        }
        .form-checkbox-wrapper input[type="checkbox"] {
          margin-top: 0.2rem;
          cursor: pointer;
        }
        .checkbox-label {
          font-size: 0.8rem;
          color: #475569;
          line-height: 1.4;
          cursor: pointer;
        }
        .actions-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
        }
        .register-scroll-container {
          max-height: 50vh;
          overflow-y: auto;
          padding-right: 0.5rem;
        }
        .sub-section-title {
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #64748b;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 0.35rem;
          margin: 1.5rem 0 1rem 0;
          font-weight: 800;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        .register-option-wrapper {
          margin-top: 1.5rem;
          text-align: center;
          border-top: 1px solid #e2e8f0;
          padding-top: 1.25rem;
        }
        .register-btn-toggle {
          background: none;
          border: none;
          color: #4f46e5;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          margin: 0 auto;
          gap: 0.25rem;
          transition: opacity 0.2s;
        }
        .register-btn-toggle:hover {
          opacity: 0.85;
          text-decoration: underline;
        }

        /* PIE DE PÁGINA */
        .login-footer {
          text-align: center;
          font-size: 0.725rem;
          color: #94a3b8;
          line-height: 1.6;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          width: 100%;
        }
        .footer-details {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.35rem 0.5rem;
        }
        .company-name {
          font-weight: 700;
          color: #cbd5e1;
        }
        .divider {
          color: #475569;
        }
        .contact-item, .address-item {
          white-space: nowrap;
        }
        .footer-links {
          margin-top: 0.25rem;
          display: flex;
          justify-content: center;
        }
        .book-link {
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          padding: 0.25rem 0.75rem;
          border-radius: 99px;
          cursor: pointer;
          font-weight: 700;
          font-size: 0.7rem;
          transition: all 0.2s;
        }
        .book-link:hover {
          background: rgba(245, 158, 11, 0.15);
          border-color: #f59e0b;
          transform: translateY(-1px);
        }

        @media (max-width: 600px) {
          .grid-2 {
            grid-template-columns: 1fr;
            gap: 0;
          }
          .login-card {
            padding: 1.5rem;
          }
          .footer-details {
            flex-direction: column;
            align-items: center;
          }
          .divider {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default Login;
