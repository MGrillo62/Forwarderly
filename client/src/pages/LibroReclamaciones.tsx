import React, { useState, useEffect } from 'react';
import { BookOpen, User, Briefcase, FileText, CheckCircle, Printer, ArrowLeft, Send, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const LibroReclamaciones: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nombres: '',
    apellidos: '',
    tipoDocumento: 'DNI',
    nroDocumento: '',
    domicilio: '',
    telefono: '',
    correo: '',
    tipoBien: 'SERVICIO',
    montoReclamado: '',
    descripcionBien: '',
    tipoReclamacion: 'RECLAMO',
    detalle: '',
    pedido: '',
    declaroVerdad: false
  });

  // Anti-bot Protection State
  const [captcha, setCaptcha] = useState({ num1: 0, num2: 0, answer: '' });
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);
  const [error, setError] = useState('');

  // Generate new math challenge
  const generateCaptcha = () => {
    const n1 = Math.floor(Math.random() * 9) + 2; // 2 to 10
    const n2 = Math.floor(Math.random() * 8) + 2; // 2 to 9
    setCaptcha({ num1: n1, num2: n2, answer: '' });
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Check declaration
    if (!formData.declaroVerdad) {
      setError('Debe declarar bajo juramento que la información ingresada es verdadera.');
      return;
    }

    // Validate Math Captcha
    const expected = captcha.num1 + captcha.num2;
    if (parseInt(captcha.answer.trim()) !== expected) {
      setError('Respuesta del filtro anti-bot incorrecta. Por favor intente de nuevo.');
      generateCaptcha();
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/reclamaciones', {
        ...formData,
        montoReclamado: formData.montoReclamado ? parseFloat(formData.montoReclamado) : 0
      });
      setSuccessData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al enviar la reclamación. Por favor intente de nuevo.');
      generateCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (successData) {
    return (
      <div className="reclamacion-success-page animate-fade-in">
        <div className="success-card">
          <div className="success-header">
            <CheckCircle size={56} className="text-success animate-bounce" />
            <h1>¡Reclamación Registrada!</h1>
            <p className="claim-code">{successData.numeroReclamacion}</p>
            <p className="subtitle">Conserve este número para el seguimiento de su solicitud.</p>
          </div>

          <div className="success-body">
            <div className="info-box">
              <h3>Estimado(a) {successData.nombres} {successData.apellidos},</h3>
              <p>
                Su hoja de reclamación ha sido registrada de forma exitosa en el Libro de Reclamaciones Virtual de <strong>Optimus Systems & Process EIRL</strong>.
              </p>
              <p>
                Hemos enviado una copia en formato digital con todos los detalles a su correo: <strong>{successData.correo}</strong>.
              </p>
              <p className="legal-notice">
                ⚠️ Conforme a la legislación peruana vigente (INDECOPI), daremos respuesta a su solicitud en un plazo máximo e improrrogable de <strong>quince (15) días hábiles</strong>.
              </p>
            </div>

            <div className="printable-claim-section">
              <h4>Resumen del Registro</h4>
              <div className="summary-grid">
                <div><strong>Fecha:</strong> {new Date(successData.createdAt).toLocaleDateString()}</div>
                <div><strong>Tipo:</strong> {successData.tipoReclamacion}</div>
                <div><strong>Bien:</strong> Servicio (SaaS Forwarderly)</div>
                <div><strong>Monto:</strong> S/ {successData.montoReclamado.toFixed(2)} PEN</div>
                <div className="full-width"><strong>Detalle (Membresía):</strong> {successData.detalle}</div>
                <div className="full-width"><strong>Pedido del Consumidor:</strong> {successData.pedido}</div>
              </div>
            </div>
          </div>

          <div className="success-footer">
            <button className="btn-outline flex-align" onClick={handlePrint}>
              <Printer size={16} /> Imprimir Hoja
            </button>
            <button className="primary flex-align" onClick={() => navigate('/login')}>
              Volver al Inicio
            </button>
          </div>
        </div>

        <style>{`
          .reclamacion-success-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            padding: 2rem 1rem;
          }
          .success-card {
            background: #ffffff;
            border-radius: 1.25rem;
            max-width: 650px;
            width: 100%;
            padding: 2.5rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            color: #1e293b;
          }
          .success-header {
            text-align: center;
            margin-bottom: 2rem;
          }
          .text-success {
            color: #10b981;
            margin: 0 auto 1rem auto;
          }
          .success-header h1 {
            font-size: 1.75rem;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 0.5rem;
          }
          .claim-code {
            display: inline-block;
            background: rgba(79, 70, 229, 0.08);
            color: #4f46e5;
            padding: 0.5rem 1.5rem;
            border-radius: 9999px;
            font-weight: 800;
            font-size: 1.25rem;
            letter-spacing: 0.5px;
            border: 1px dashed rgba(79, 70, 229, 0.3);
            margin: 0.5rem 0;
          }
          .success-header .subtitle {
            color: #64748b;
            font-size: 0.875rem;
          }
          .info-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 1.5rem;
            border-radius: 0.75rem;
            margin-bottom: 1.5rem;
            font-size: 0.9rem;
            line-height: 1.6;
          }
          .info-box h3 {
            margin-top: 0;
            color: #0f172a;
            margin-bottom: 0.75rem;
          }
          .legal-notice {
            background: #fffbeb;
            color: #b45309;
            border-left: 4px solid #f59e0b;
            padding: 0.75rem 1rem;
            border-radius: 0.375rem;
            margin-top: 1rem;
            font-weight: 500;
          }
          .printable-claim-section {
            border: 1px solid #e2e8f0;
            border-radius: 0.75rem;
            padding: 1.25rem;
            margin-bottom: 2rem;
          }
          .printable-claim-section h4 {
            margin: 0 0 1rem 0;
            color: #0f172a;
            font-size: 0.95rem;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 0.5rem;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.75rem;
            font-size: 0.85rem;
          }
          .summary-grid .full-width {
            grid-column: span 2;
            background: #f8fafc;
            padding: 0.5rem;
            border-radius: 4px;
            margin-top: 0.25rem;
          }
          .success-footer {
            display: flex;
            justify-content: flex-end;
            gap: 1rem;
          }
          @media print {
            body * {
              visibility: hidden;
            }
            .printable-claim-section, .printable-claim-section * {
              visibility: visible;
            }
            .printable-claim-section {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              border: none;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="libro-reclamaciones-page animate-fade-in">
      <div className="claim-form-container">
        
        {/* Cabecera del Formulario */}
        <header className="form-header">
          <button className="back-button" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Volver
          </button>
          
          <div className="brand-badge">
            <BookOpen size={24} className="icon-gold" />
            <span>LIBRO DE RECLAMACIONES VIRTUAL</span>
          </div>

          <div className="company-info-card">
            <h2>Optimus Systems & Process EIRL</h2>
            <p><strong>RUC:</strong> 20600259751 | <strong>Dirección:</strong> Calle Españoleto 141 Dpto 102, San Borja, Lima-Perú</p>
          </div>
          <p className="legal-disclaimer">
            Conforme a lo establecido en el Código de Protección y Defensa del Consumidor, esta institución cuenta con un Libro de Reclamaciones Virtual a su disposición.
          </p>
        </header>

        {error && <div className="error-message animate-shake">{error}</div>}

        <form onSubmit={handleSubmit} className="claim-form">
          
          {/* SECCIÓN 1: IDENTIFICACIÓN DEL CONSUMIDOR */}
          <section className="form-section">
            <div className="section-header">
              <User size={18} />
              <h3>1. Identificación del Consumidor Reclamante</h3>
            </div>
            
            <div className="grid-2">
              <div className="form-group">
                <label>Nombres *</label>
                <input 
                  type="text" 
                  required
                  value={formData.nombres}
                  onChange={(e) => setFormData({ ...formData, nombres: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Apellidos *</label>
                <input 
                  type="text" 
                  required
                  value={formData.apellidos}
                  onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>Tipo Documento *</label>
                <select 
                  value={formData.tipoDocumento}
                  onChange={(e) => setFormData({ ...formData, tipoDocumento: e.target.value })}
                >
                  <option value="DNI">DNI (Documento Nacional de Identidad)</option>
                  <option value="CE">C.E. (Carnet de Extranjería)</option>
                  <option value="PASAPORTE">Pasaporte</option>
                  <option value="RUC">R.U.C.</option>
                </select>
              </div>
              <div className="form-group">
                <label>Número Documento *</label>
                <input 
                  type="text" 
                  required
                  value={formData.nroDocumento}
                  onChange={(e) => setFormData({ ...formData, nroDocumento: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Domicilio (Dirección Completa) *</label>
              <input 
                type="text" 
                required
                placeholder="Av. Principal 123, Dpto. 401, San Borja, Lima"
                value={formData.domicilio}
                onChange={(e) => setFormData({ ...formData, domicilio: e.target.value })}
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>Teléfono / Celular *</label>
                <input 
                  type="tel" 
                  required
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Correo Electrónico *</label>
                <input 
                  type="email" 
                  required
                  placeholder="ejemplo@correo.com"
                  value={formData.correo}
                  onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                />
              </div>
            </div>
          </section>

          {/* SECCIÓN 2: IDENTIFICACIÓN DEL BIEN CONTRATADO */}
          <section className="form-section">
            <div className="section-header">
              <Briefcase size={18} />
              <h3>2. Identificación del Bien Contratado</h3>
            </div>
            
            <div className="grid-2">
              <div className="form-group">
                <label>Tipo de Bien</label>
                <div style={{ padding: '0.65rem 0' }}>
                  <span className="badge-bien" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                    Servicio (SaaS Forwarderly)
                  </span>
                </div>
              </div>
              <div className="form-group">
                <label>Monto Reclamado (S/. PEN - Estimado) *</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={formData.montoReclamado}
                  onChange={(e) => setFormData({ ...formData, montoReclamado: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Descripción detallada de la Membresía contratada *</label>
              <textarea 
                rows={3}
                required
                placeholder="Indique detalles de la membresía en línea del SaaS (Ej. Plan Solopreneur Mensual / Anual) respecto al cual se presenta la disconformidad..."
                value={formData.descripcionBien}
                onChange={(e) => setFormData({ ...formData, descripcionBien: e.target.value })}
              />
            </div>
          </section>

          {/* SECCIÓN 3: DETALLE DE LA RECLAMACIÓN */}
          <section className="form-section">
            <div className="section-header">
              <FileText size={18} />
              <h3>3. Detalle de la Reclamación y Pedido</h3>
            </div>

            <div className="form-group">
              <label>Tipo de Registro *</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input 
                    type="radio" 
                    name="tipoReclamacion"
                    checked={formData.tipoReclamacion === 'RECLAMO'}
                    onChange={() => setFormData({ ...formData, tipoReclamacion: 'RECLAMO' })}
                  />
                  <div>
                    <strong>Reclamo</strong>
                    <small style={{ display: 'block', color: 'var(--text-light)', fontWeight: 400, fontSize: '0.75rem' }}>
                      Disconformidad relacionada a los planes de membresía contratados.
                    </small>
                  </div>
                </label>
                <label className="radio-label">
                  <input 
                    type="radio" 
                    name="tipoReclamacion"
                    checked={formData.tipoReclamacion === 'QUEJA'}
                    onChange={() => setFormData({ ...formData, tipoReclamacion: 'QUEJA' })}
                  />
                  <div>
                    <strong>Queja</strong>
                    <small style={{ display: 'block', color: 'var(--text-light)', fontWeight: 400, fontSize: '0.75rem' }}>
                      Descontento o insatisfacción respecto al soporte o la atención del SaaS.
                    </small>
                  </div>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label>Detalle y Sustento del Reclamo o Queja (Plan de Membresía) *</label>
              <textarea 
                rows={4}
                required
                placeholder="Describa de forma clara los inconvenientes experimentados con su plan o pago de membresía..."
                value={formData.detalle}
                onChange={(e) => setFormData({ ...formData, detalle: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Pedido o Solicitud del Consumidor *</label>
              <textarea 
                rows={3}
                required
                placeholder="Escriba la solución concreta o ajuste de membresía que solicita..."
                value={formData.pedido}
                onChange={(e) => setFormData({ ...formData, pedido: e.target.value })}
              />
            </div>
          </section>

          {/* CAPTCHA ANTI-BOT PROTECTION */}
          <section className="form-section" style={{ border: '1px solid rgba(56, 189, 248, 0.25)', background: 'rgba(56, 189, 248, 0.02)' }}>
            <div className="section-header" style={{ color: '#38bdf8' }}>
              <ShieldCheck size={18} />
              <h3>Seguridad Anti-Bots</h3>
            </div>
            
            <div className="grid-2">
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.85rem', color: '#f1f5f9' }}>
                  Resuelva este desafío matemático simple para confirmar que es humano:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '2px', background: 'rgba(0,0,0,0.4)', padding: '0.4rem 1.2rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {captcha.num1} + {captcha.num2} =
                  </span>
                  <input 
                    type="text" 
                    required
                    placeholder="?"
                    value={captcha.answer}
                    onChange={(e) => setCaptcha({ ...captcha, answer: e.target.value })}
                    style={{ width: '80px', textAlign: 'center', fontSize: '1.1rem', fontWeight: 700, padding: '0.45rem' }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* DECLARACIÓN JURADA */}
          <div className="form-checkbox-wrapper statement-box" style={{ marginTop: '2rem' }}>
            <input 
              type="checkbox"
              id="declaroVerdad"
              required
              checked={formData.declaroVerdad}
              onChange={(e) => setFormData({ ...formData, declaroVerdad: e.target.checked })}
            />
            <label htmlFor="declaroVerdad" style={{ fontSize: '0.8rem', lineHeight: '1.4', cursor: 'pointer' }}>
              <strong>Declaración bajo juramento:</strong> Declaro ser el titular del reclamo respecto al SaaS Forwarderly y que los datos consignados en la presente hoja de reclamación son verdaderos y de total conformidad con el Código de Protección y Defensa del Consumidor de Perú.
            </label>
          </div>

          <div className="form-actions">
            <button 
              type="submit" 
              className="primary btn-glow font-bold flex-align" 
              style={{ gap: '0.5rem', padding: '0.85rem 2rem', fontSize: '0.95rem' }}
              disabled={loading}
            >
              <Send size={16} />
              {loading ? 'Enviando Reclamación...' : 'Enviar Hoja de Reclamación'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .libro-reclamaciones-page {
          min-height: 100vh;
          background: linear-gradient(180deg, #020617 0%, #0f172a 100%);
          color: #f1f5f9;
          padding: 3rem 1rem;
        }
        .claim-form-container {
          max-width: 800px;
          margin: 0 auto;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1.25rem;
          padding: 2.5rem;
          backdrop-filter: blur(16px);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
        }
        .form-header {
          margin-bottom: 2.5rem;
          position: relative;
        }
        .back-button {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: #94a3b8;
          padding: 0.4rem 0.8rem;
          border-radius: 0.5rem;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.8rem;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          transition: all 0.2s;
          margin-bottom: 1.5rem;
        }
        .back-button:hover {
          background: rgba(255,255,255,0.08);
          color: white;
        }
        .brand-badge {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .brand-badge span {
          font-weight: 900;
          font-size: 0.95rem;
          letter-spacing: 1.5px;
          background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .company-info-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 1.25rem;
          border-radius: 0.75rem;
          margin-bottom: 1rem;
        }
        .company-info-card h2 {
          font-size: 1.25rem;
          font-weight: 800;
          color: white;
          margin: 0 0 0.25rem 0;
        }
        .company-info-card p {
          margin: 0;
          font-size: 0.8rem;
          color: #94a3b8;
        }
        .legal-disclaimer {
          font-size: 0.8rem;
          color: #64748b;
          line-height: 1.5;
        }
        .form-section {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 0.75rem;
          padding: 1.75rem;
          margin-bottom: 2rem;
        }
        .section-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 0.75rem;
          margin-bottom: 1.5rem;
          color: #38bdf8;
        }
        .section-header h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 700;
          color: white;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }
        .form-group {
          margin-bottom: 1.25rem;
        }
        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-size: 0.825rem;
          font-weight: 600;
          color: #94a3b8;
        }
        .form-group input, 
        .form-group select, 
        .form-group textarea {
          width: 100%;
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          padding: 0.65rem 0.85rem;
          color: white;
          font-size: 0.875rem;
          outline: none;
          transition: all 0.2s;
        }
        .form-group input:focus, 
        .form-group select:focus, 
        .form-group textarea:focus {
          border-color: #38bdf8;
          box-shadow: 0 0 10px rgba(56, 189, 248, 0.15);
        }
        .radio-group {
          display: flex;
          gap: 1.5rem;
          padding: 0.5rem 0;
        }
        .radio-label {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          cursor: pointer;
          font-size: 0.875rem;
        }
        .radio-label input {
          margin-top: 0.2rem;
          cursor: pointer;
        }
        .form-checkbox-wrapper {
          display: flex;
          align-items: flex-start;
          gap: 0.625rem;
        }
        .form-checkbox-wrapper input {
          margin-top: 0.25rem;
          cursor: pointer;
        }
        .statement-box {
          background: rgba(245, 158, 11, 0.03);
          border: 1px solid rgba(245, 158, 11, 0.1);
          padding: 1.25rem;
          border-radius: 0.75rem;
          margin-bottom: 2rem;
        }
        .form-actions {
          display: flex;
          justify-content: flex-end;
        }
        .error-message {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #ef4444;
          padding: 1rem;
          border-radius: 0.5rem;
          margin-bottom: 1.5rem;
          font-weight: 600;
          font-size: 0.875rem;
          text-align: center;
        }
        @media (max-width: 600px) {
          .grid-2 {
            grid-template-columns: 1fr;
          }
          .claim-form-container {
            padding: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
};

export default LibroReclamaciones;
