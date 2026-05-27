import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { CreditCard, Filter, ChevronUp, ChevronDown, Check, DollarSign, X, Calendar, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';

const Suscripciones: React.FC = () => {
  const { user, activeEmpresa } = useAuth();
  
  // Data States
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [estadoActual, setEstadoActual] = useState<any>(null);
  
  // Filter States
  const [filterCompany, setFilterCompany] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  
  // Sorting States
  const [sortField, setSortField] = useState('fecha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Loading & Action States
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    modalidad: 'Yape',
    banco: '',
    referencia: '',
    fechaPago: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (user?.rol === 'SUPER_ADMIN') {
      fetchCompanies();
    }
    fetchSubscriptions();
    fetchEstadoActual();

    // Configure Culqi global callback
    (window as any).culqi = async () => {
      const Culqi = (window as any).Culqi;
      if (Culqi && Culqi.token) {
        const token = Culqi.token.id;
        const subId = (window as any)._activePagoSuscripcionId;
        if (subId) {
          try {
            Culqi.close();
            const res = await api.post('/suscripciones/culqi-charge', {
              token,
              pagoSuscripcionId: subId
            });
            if (res.data.success) {
              alert('¡Pago completado con éxito a través de Culqi! Tu suscripción se encuentra al día.');
              fetchSubscriptions();
              fetchEstadoActual();
            }
          } catch (err: any) {
            alert('Error al verificar el pago con Culqi: ' + (err.response?.data?.message || err.message));
          }
        }
      } else if (Culqi && Culqi.error) {
        alert('Error en Culqi Checkout: ' + Culqi.error.user_message);
      }
    };

    return () => {
      delete (window as any).culqi;
    };
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [filterCompany, filterStatus, filterMonth, filterYear]);

  const fetchCompanies = async () => {
    try {
      const res = await api.get('/empresas');
      setCompanies(res.data);
    } catch (err) {
      console.error('Error fetching companies:', err);
    }
  };

  const fetchSubscriptions = async () => {
    try {
      const params: any = {};
      if (user?.rol === 'SUPER_ADMIN') {
        if (filterCompany) params.empresaId = filterCompany;
      }
      if (filterStatus) params.estadoPago = filterStatus;
      if (filterMonth) params.mes = filterMonth;
      if (filterYear) params.anio = filterYear;

      const res = await api.get('/suscripciones', { params });
      setSubscriptions(res.data);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
    }
  };

  const fetchEstadoActual = async () => {
    try {
      const res = await api.get('/suscripciones/estado-actual');
      setEstadoActual(res.data);
    } catch (err) {
      console.error('Error fetching subscription status:', err);
    }
  };

  const loadCulqiScript = () => {
    return new Promise<void>((resolve) => {
      if ((window as any).Culqi) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.culqi.com/js/v4';
      script.onload = () => resolve();
      document.body.appendChild(script);
    });
  };

  const handleCulqiPay = async (sub: any) => {
    try {
      setLoadingCheckout(sub.id);
      await loadCulqiScript();
      
      const Culqi = (window as any).Culqi;
      if (!Culqi) {
        alert('No se pudo cargar la pasarela de pagos Culqi.');
        return;
      }

      // Set the active subscription ID globally so the window.culqi callback can read it
      (window as any)._activePagoSuscripcionId = sub.id;

      // Initialize Culqi (will fallback to test public key if VITE_CULQI_PUBLIC_KEY is not defined)
      Culqi.publicKey = import.meta.env.VITE_CULQI_PUBLIC_KEY || 'pk_test_7f16f5c5b4d75d27';

      Culqi.settings({
        title: 'Forwarderly',
        currency: 'PEN',
        amount: Math.round(sub.monto * 100), // Culqi receives cents
        description: `Suscripción ${getMonthName(sub.mes)} ${sub.anio}`,
      });

      Culqi.options({
        lang: 'auto',
        installments: false,
        paymentMethods: {
          tarjeta: true,
          yape: true,
          bancaMovil: false,
          agente: false,
          pagoEfectivo: false
        }
      });

      Culqi.open();
    } catch (err: any) {
      alert('Error al iniciar el pago con Culqi: ' + err.message);
    } finally {
      setLoadingCheckout(null);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleOpenPayment = (sub: any) => {
    setSelectedSub(sub);
    setPaymentForm({
      modalidad: 'Yape',
      banco: '',
      referencia: '',
      fechaPago: new Date().toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/suscripciones/${selectedSub.id}/pagar`, paymentForm);
      setShowModal(false);
      fetchSubscriptions();
      fetchEstadoActual();
    } catch (err) {
      alert('Error al registrar el pago de suscripción');
      console.error(err);
    }
  };

  // Sort calculations (client-side)
  const sortedSubscriptions = [...subscriptions].sort((a, b) => {
    let valA: any = '';
    let valB: any = '';

    if (sortField === 'empresa') {
      valA = a.empresa?.razonSocial || '';
      valB = b.empresa?.razonSocial || '';
    } else if (sortField === 'fecha') {
      valA = a.anio * 100 + a.mes;
      valB = b.anio * 100 + b.mes;
    } else if (sortField === 'monto') {
      valA = a.monto;
      valB = b.monto;
    } else if (sortField === 'estado') {
      valA = a.estadoPago;
      valB = b.estadoPago;
    } else if (sortField === 'diaPago') {
      valA = a.empresa?.diaPagoSuscripcion || 5;
      valB = b.empresa?.diaPagoSuscripcion || 5;
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const getMonthName = (monthNumber: number) => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[monthNumber - 1] || '';
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div>
      <div className="page-header">
        <h1>{user?.rol === 'SUPER_ADMIN' ? '💳 Recaudación de Suscripciones' : '💳 Mi Suscripción y Plan'}</h1>
        <p className="subtitle">
          {user?.rol === 'SUPER_ADMIN' 
            ? 'Administración de cobros mensuales y anuales de la plataforma Forwarderly.' 
            : 'Gestiona tu plan de facturación, periodos de prueba y pagos en línea de forma segura.'}
        </p>
      </div>

      {/* ADMIN Panel Summary Card */}
      {user?.rol !== 'SUPER_ADMIN' && estadoActual && (
        <div className="billing-summary-card animate-slide-in">
          <div className="billing-summary-content">
            <div className="billing-info">
              <span className="billing-label">Estado de la cuenta</span>
              <div className="billing-status-wrapper">
                {estadoActual.motivo === 'TRIAL_ACTIVO' ? (
                  <span className="status-badge status-pending flex-align" style={{ gap: '0.25rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                    <Clock size={16} /> Periodo de Prueba Activo
                  </span>
                ) : estadoActual.tieneAcceso ? (
                  <span className="status-badge status-approved flex-align" style={{ gap: '0.25rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                    <ShieldCheck size={16} /> Cuenta Activa y al Día
                  </span>
                ) : (
                  <span className="status-badge status-rejected flex-align animate-pulse" style={{ gap: '0.25rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                    <AlertTriangle size={16} /> Pago Requerido (Acceso Bloqueado)
                  </span>
                )}
              </div>
              
              <div className="billing-details-grid">
                <div>
                  <small>Plan de Suscripción</small>
                  <strong>S/ {activeEmpresa?.montoSuscripcion?.toFixed(2)} PEN</strong>
                </div>
                <div>
                  <small>Periodicidad</small>
                  <strong>{activeEmpresa?.periodicidad}</strong>
                </div>
                <div>
                  <small>Día de Pago</small>
                  <strong>Día {activeEmpresa?.diaPagoSuscripcion} de cada ciclo</strong>
                </div>
                {estadoActual.motivo === 'TRIAL_ACTIVO' && (
                  <div>
                    <small>Fin de Periodo de Prueba</small>
                    <strong style={{ color: 'var(--primary)' }}>
                      {new Date(estadoActual.fechaFinPrueba).toLocaleDateString()} (Quedan {estadoActual.diasRestantesTrial} días)
                    </strong>
                  </div>
                )}
              </div>
            </div>
            
            <div className="billing-card-right">
              {estadoActual.tieneAcceso ? (
                <div className="billing-alert-info">
                  <ShieldCheck size={36} style={{ color: 'var(--success)', marginBottom: '0.5rem' }} />
                  <p>¡Gracias por usar Forwarderly! Tu plan está al día y cuentas con acceso total a todos los módulos.</p>
                </div>
              ) : (
                <div className="billing-alert-danger">
                  <AlertTriangle size={36} style={{ color: 'var(--danger)', marginBottom: '0.5rem' }} />
                  <p>Tu acceso ha sido restringido por falta de pago. Por favor, cancela la suscripción pendiente a continuación para restaurar el servicio inmediatamente.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter Card (Superadmin only) */}
      {user?.rol === 'SUPER_ADMIN' && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
          <div className="flex-align" style={{ gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-dark)', fontWeight: 'bold' }}>
            <Filter size={18} /> Filtros de Búsqueda
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Empresa</label>
              <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
                <option value="">-- Todas las empresas --</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.razonSocial}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Estado de Pago</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">-- Todos los estados --</option>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="PAGADO">PAGADO</option>
                <option value="VENCIDO">VENCIDO</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Mes</label>
              <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
                <option value="">-- Todos los meses --</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{getMonthName(m)}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Año</label>
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                <option value="">-- Todos los años --</option>
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Grid Card */}
      <div className="card animate-fade-in">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {user?.rol === 'SUPER_ADMIN' && (
                  <th onClick={() => handleSort('empresa')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div className="flex-align" style={{ gap: '0.25rem' }}>
                      Empresa {getSortIcon('empresa')}
                    </div>
                  </th>
                )}
                <th onClick={() => handleSort('fecha')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div className="flex-align" style={{ gap: '0.25rem' }}>
                    Periodo {getSortIcon('fecha')}
                  </div>
                </th>
                <th onClick={() => handleSort('monto')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div className="flex-align" style={{ gap: '0.25rem' }}>
                    Monto (PEN) {getSortIcon('monto')}
                  </div>
                </th>
                <th onClick={() => handleSort('diaPago')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div className="flex-align" style={{ gap: '0.25rem' }}>
                    Día / Periodicidad {getSortIcon('diaPago')}
                  </div>
                </th>
                <th onClick={() => handleSort('estado')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div className="flex-align" style={{ gap: '0.25rem' }}>
                    Estado {getSortIcon('estado')}
                  </div>
                </th>
                <th>Datos de Pago</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedSubscriptions.length === 0 ? (
                <tr>
                  <td colSpan={user?.rol === 'SUPER_ADMIN' ? 7 : 6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                    No se encontraron cobros de suscripción registrados.
                  </td>
                </tr>
              ) : (
                sortedSubscriptions.map(s => (
                  <tr key={s.id}>
                    {user?.rol === 'SUPER_ADMIN' && (
                      <td>
                        <div className="flex-align" style={{ gap: '0.75rem' }}>
                          {s.empresa?.logoUrl ? (
                            <img 
                              src={s.empresa.logoUrl} 
                              alt="Logo" 
                              style={{
                                width: '28px',
                                height: '28px',
                                objectFit: 'contain',
                                borderRadius: '4px',
                                border: '1px solid rgba(226, 232, 240, 0.8)',
                                backgroundColor: '#fff',
                                padding: '1px'
                              }}
                            />
                          ) : null}
                          <div>
                            <strong>{s.empresa?.razonSocial || 'Desconocida'}</strong>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>RUC: {s.empresa?.ruc}</div>
                          </div>
                        </div>
                      </td>
                    )}
                    <td>
                      <div style={{ fontWeight: 600 }}>{getMonthName(s.mes)} {s.anio}</div>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-dark)' }}>S/ {s.monto.toFixed(2)} PEN</strong>
                    </td>
                    <td>
                      <div>Día {s.empresa?.diaPagoSuscripcion || 5}</div>
                      <small className="text-light uppercase font-semibold" style={{ fontSize: '0.7rem' }}>
                        {s.empresa?.periodicidad || 'MENSUAL'}
                      </small>
                    </td>
                    <td>
                      <span className={`status-badge ${s.estadoPago === 'PAGADO' ? 'status-approved' : s.estadoPago === 'PENDIENTE' ? 'status-pending' : 'status-rejected'}`}>
                        {s.estadoPago}
                      </span>
                    </td>
                    <td>
                      {s.estadoPago === 'PAGADO' ? (
                        <div style={{ fontSize: '0.8rem', lineHeight: '1.3' }}>
                          <div><strong>Modalidad:</strong> {s.modalidad}</div>
                          {s.banco && <div><strong>Banco:</strong> {s.banco}</div>}
                          {s.referencia && <div><strong>Ref:</strong> {s.referencia}</div>}
                          {s.fechaPago && (
                            <small className="text-light flex-align" style={{ gap: '0.25rem', marginTop: '2px' }}>
                              <Calendar size={12} /> {new Date(s.fechaPago).toLocaleDateString()}
                            </small>
                          )}
                        </div>
                      ) : (
                        <span className="text-light">—</span>
                      )}
                    </td>
                    <td>
                      {s.estadoPago !== 'PAGADO' ? (
                        user?.rol === 'SUPER_ADMIN' ? (
                          <button 
                            className="success btn-glow font-bold flex-align" 
                            style={{ gap: '0.25rem', padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                            onClick={() => handleOpenPayment(s)}
                          >
                            <Check size={14} /> Registrar Pago
                          </button>
                        ) : (
                          <button 
                            className="primary btn-glow font-bold flex-align" 
                            style={{ gap: '0.35rem', padding: '0.5rem 0.9rem', fontSize: '0.75rem', borderRadius: '6px' }}
                            onClick={() => handleCulqiPay(s)}
                            disabled={loadingCheckout === s.id}
                          >
                            <CreditCard size={14} /> 
                            {loadingCheckout === s.id ? 'Cargando...' : 'Pagar en Línea (Culqi)'}
                          </button>
                        )
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--success)', fontWeight: 'bold', fontSize: '0.75rem' }}>
                          <Check size={16} /> Cobrado
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registrar Pago Modal (Superadmin only) */}
      {showModal && selectedSub && (
        <div className="modal-overlay">
          <div className="modal-content animate-slide-in" style={{ maxWidth: '450px', width: '95%' }}>
            <div className="modal-header">
              <h3 className="flex-align" style={{ gap: '0.5rem' }}>
                <DollarSign size={20} className="icon-blue" /> Registrar Pago de Suscripción
              </h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleRegisterPayment}>
              <div className="modal-body">
                <div style={{ background: 'rgba(79, 70, 229, 0.04)', border: '1px solid rgba(79, 70, 229, 0.1)', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Factura de Suscripción</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-dark)', marginTop: '0.25rem' }}>
                    {selectedSub.empresa?.razonSocial}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    {getMonthName(selectedSub.mes)} {selectedSub.anio} — S/ {selectedSub.monto.toFixed(2)} PEN
                  </div>
                </div>

                <div className="form-group">
                  <label>Modalidad de Pago</label>
                  <select 
                    value={paymentForm.modalidad} 
                    onChange={(e) => setPaymentForm({...paymentForm, modalidad: e.target.value})}
                    required
                  >
                    <option value="Yape">Yape</option>
                    <option value="Plin">Plin</option>
                    <option value="Transferencia">Transferencia Bancaria</option>
                    <option value="Depósito">Depósito en Ventanilla</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Banco (Opcional)</label>
                  <input 
                    type="text" 
                    placeholder="Ej. BCP, BBVA, Interbank"
                    value={paymentForm.banco}
                    onChange={(e) => setPaymentForm({...paymentForm, banco: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Código de Referencia / Operación (Opcional)</label>
                  <input 
                    type="text" 
                    placeholder="Nro de operación"
                    value={paymentForm.referencia}
                    onChange={(e) => setPaymentForm({...paymentForm, referencia: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Fecha de Pago</label>
                  <input 
                    type="date" 
                    required
                    value={paymentForm.fechaPago}
                    onChange={(e) => setPaymentForm({...paymentForm, fechaPago: e.target.value})}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="primary">Confirmar Cobro</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Styled components custom CSS */}
      <style>{`
        .billing-summary-card {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1rem;
          padding: 1.75rem;
          color: #E2E8F0;
          margin-bottom: 2rem;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(10px);
        }
        
        .billing-summary-content {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 2rem;
          align-items: center;
        }
        
        @media (max-width: 768px) {
          .billing-summary-content {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }
        }
        
        .billing-info {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .billing-label {
          font-size: 0.725rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #94A3B8;
          font-weight: 700;
        }
        
        .billing-status-wrapper {
          display: flex;
          margin: 0.25rem 0 1rem 0;
        }
        
        .billing-details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 1.25rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 1.25rem;
        }
        
        .billing-details-grid div {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        
        .billing-details-grid small {
          font-size: 0.7rem;
          color: #94A3B8;
          font-weight: 600;
          text-transform: uppercase;
        }
        
        .billing-details-grid strong {
          font-size: 0.95rem;
          color: #FFFFFF;
          font-weight: 700;
        }
        
        .billing-card-right {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 0.75rem;
          padding: 1.25rem;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .billing-alert-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          color: #94A3B8;
          font-size: 0.8rem;
          line-height: 1.4;
        }
        
        .billing-alert-info p {
          margin: 0;
          color: #CBD5E1;
        }
        
        .billing-alert-danger {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          color: #FCA5A5;
          font-size: 0.8rem;
          line-height: 1.4;
        }
        
        .billing-alert-danger p {
          margin: 0;
          color: #F87171;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};

export default Suscripciones;
