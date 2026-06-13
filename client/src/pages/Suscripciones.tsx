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
  const [planes, setPlanes] = useState<any[]>([]);
  const [loadingPlanes, setLoadingPlanes] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('codigo');
  
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
    fetchPlanes();

    // Configure Culqi global callback
    (window as any).culqi = async () => {
      const Culqi = (window as any).Culqi;
      if (Culqi && Culqi.token) {
        const token = Culqi.token.id;
        const planCodigo = (window as any)._activePlanCodigo;
        const pagoSuscripcionId = (window as any)._activePagoSuscripcionId;
        
        if (planCodigo) {
          try {
            Culqi.close();
            const res = await api.post('/suscripciones/culqi-subscribe', {
              token,
              planCodigo
            });
            if (res.data.success) {
              alert('¡Suscripción recurrente activada con éxito a través de Culqi! Tu cuenta se encuentra al día.');
              fetchSubscriptions();
              fetchEstadoActual();
            }
          } catch (err: any) {
            alert('Error al verificar la suscripción con Culqi: ' + (err.response?.data?.message || err.message));
          }
        } else if (pagoSuscripcionId) {
          try {
            Culqi.close();
            const res = await api.post('/suscripciones/culqi-charge', {
              token,
              pagoSuscripcionId
            });
            if (res.data.success) {
              alert('¡Pago procesado con éxito! Tu cuenta se encuentra reactivada y al día.');
              fetchSubscriptions();
              fetchEstadoActual();
            }
          } catch (err: any) {
            alert('Error al procesar el pago con Culqi: ' + (err.response?.data?.message || err.message));
          }
        }
      } else if (Culqi && Culqi.error) {
        alert('Error en Culqi Checkout: ' + Culqi.error.user_message);
      }
    };

    return () => {
      delete (window as any).culqi;
      delete (window as any)._activePlanCodigo;
      delete (window as any)._activePagoSuscripcionId;
    };
  }, []);

  useEffect(() => {
    if (estadoActual?.planActual) {
      const currentPlanCode = estadoActual.planActual === 'ANUAL' ? 'anual' : 'codigo';
      setSelectedPlan(currentPlanCode);
    }
  }, [estadoActual]);

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

  const fetchPlanes = async () => {
    try {
      setLoadingPlanes(true);
      const res = await api.get('/suscripciones/planes');
      setPlanes(res.data);
    } catch (err) {
      console.error('Error fetching plans:', err);
    } finally {
      setLoadingPlanes(false);
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

  const handleCulqiPay = async (planCodigo: string | null, amount: number, pagoSuscripcionId?: string) => {
    try {
      setLoadingCheckout(pagoSuscripcionId || planCodigo || 'loading');
      await loadCulqiScript();
      
      const Culqi = (window as any).Culqi;
      if (!Culqi) {
        alert('No se pudo cargar la pasarela de pagos Culqi.');
        return;
      }

      // Set the active params globally so the window.culqi callback can read them
      (window as any)._activePlanCodigo = planCodigo;
      (window as any)._activePagoSuscripcionId = pagoSuscripcionId || null;

      // Initialize Culqi (will fallback to test public key if VITE_CULQI_PUBLIC_KEY is not defined)
      const rawPublicKey = import.meta.env.VITE_CULQI_PUBLIC_KEY || 'pk_test_PUCWnl5khqdKd4GH';
      Culqi.publicKey = rawPublicKey.replace(/['"]/g, '').trim();

      Culqi.settings({
        title: 'Forwarderly',
        currency: 'PEN',
        amount: Math.round(amount), // Plan amount in cents
        description: pagoSuscripcionId
          ? `Pago de Suscripción - Factura #${pagoSuscripcionId.slice(0, 8)}`
          : `Plan Forwarderly - ${planCodigo === 'anual' ? 'Anual' : 'Mensual'}`,
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

      {/* Mi Suscripción y Planes de Pago (Solo para Empresas, no para SUPER_ADMIN) */}
      {user?.rol !== 'SUPER_ADMIN' && estadoActual && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
          
          {/* Fila de Estado Rápido */}
          <div className="billing-summary-card animate-slide-in" style={{ padding: '1.25rem 1.75rem', marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <span className="billing-label" style={{ fontSize: '0.65rem' }}>Estado de la Cuenta</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                  {estadoActual.motivo === 'TRIAL_ACTIVO' ? (
                    <span className="status-badge status-pending flex-align" style={{ gap: '0.25rem', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                      <Clock size={14} /> Periodo de Prueba (Quedan {estadoActual.diasRestantesTrial} días)
                    </span>
                  ) : estadoActual.tieneAcceso ? (
                    <span className="status-badge status-approved flex-align" style={{ gap: '0.25rem', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                      <ShieldCheck size={14} /> Cuenta Activa y al Día
                    </span>
                  ) : (
                    <span className="status-badge status-rejected flex-align animate-pulse" style={{ gap: '0.25rem', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                      <AlertTriangle size={14} /> Pago Requerido (Acceso Bloqueado)
                    </span>
                  )}
                  {estadoActual.fechaFinSuscripcion && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 500 }}>
                      Vence el: <strong>{new Date(estadoActual.fechaFinSuscripcion).toLocaleDateString()}</strong>
                    </span>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                {estadoActual.planActual && (
                  <div>
                    <span className="billing-label" style={{ fontSize: '0.65rem' }}>Plan Contratado</span>
                    <strong style={{ display: 'block', fontSize: '0.9rem', color: '#FFFFFF', marginTop: '0.25rem' }}>
                      {estadoActual.planActual === 'ANUAL' ? 'Solopreneur Anual' : 'Solopreneur Mensual'}
                    </strong>
                  </div>
                )}
                {activeEmpresa?.diaPagoSuscripcion && (
                  <div>
                    <span className="billing-label" style={{ fontSize: '0.65rem' }}>Día de Pago</span>
                    <strong style={{ display: 'block', fontSize: '0.9rem', color: '#FFFFFF', marginTop: '0.25rem' }}>
                      Día {activeEmpresa.diaPagoSuscripcion} de cada ciclo
                    </strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pricing Grid */}
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ⚡ Planes y Suscripción Directa en Culqi
            </h3>
            
            <div className="pricing-grid">
              {planes.map((plan: any) => {
                const planCodigo = plan.codigo || plan.id;
                const planMonto = plan.monto !== undefined ? plan.monto : (plan.amount / 100);
                const planNombre = plan.nombre || plan.name;
                const planPeriodicidad = plan.periodicidad || (plan.interval_count === 12 ? 'ANUAL' : 'MENSUAL');
                const planDiasPrueba = plan.diasPrueba !== undefined ? plan.diasPrueba : 14;
                
                const isActive = selectedPlan === planCodigo;
                const isAnual = planPeriodicidad === 'ANUAL';
                
                return (
                  <div key={plan.id} className={`pricing-card ${isActive ? 'active-plan' : ''} ${isAnual ? 'highlighted-plan' : ''}`}>
                    {isAnual && <div className="save-badge">¡Ahorra más del 20%!</div>}
                    {isActive && estadoActual?.hasCulqiSubscription && (
                      <div className="current-badge">Tu Plan Actual</div>
                    )}
                    <div className="pricing-header">
                      <h4>{planNombre}</h4>
                      <div className="price">
                        <span className="currency">S/</span>
                        <span className="amount">{planMonto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                        <span className="period">/ {isAnual ? 'año' : 'mes'}</span>
                      </div>
                      <p className="description">
                        {isAnual 
                          ? 'Para importadores consolidados que buscan asegurar su software anual.' 
                          : 'Ideal para medianos y pequeños importadores que inician en el rubro.'
                        }
                        {planDiasPrueba > 0 && (
                          <span style={{ display: 'block', marginTop: '0.35rem', color: '#38BDF8', fontWeight: 600 }}>
                            ⭐ Incluye {planDiasPrueba} días de prueba gratis.
                          </span>
                        )}
                      </p>
                    </div>
                    
                    <div className="pricing-features">
                      {isAnual ? (
                        <>
                          <div className="feature-item"><Check size={16} /> <span>Todos los beneficios del plan Mensual</span></div>
                          <div className="feature-item"><Check size={16} /> <span>Una empresa, cuatro usuarios</span></div>
                          <div className="feature-item"><Check size={16} /> <span>Soporte remoto prioritario en horario de oficina</span></div>
                          <div className="feature-item"><Check size={16} /> <span>Ahorro del 20% en comparación mensual</span></div>
                        </>
                      ) : (
                        <>
                          <div className="feature-item"><Check size={16} /> <span>Acceso total a Costeos de Importación</span></div>
                          <div className="feature-item"><Check size={16} /> <span>Gestión de Órdenes y Proveedores</span></div>
                          <div className="feature-item"><Check size={16} /> <span>Módulo de Cotizaciones y Clientes</span></div>
                          <div className="feature-item"><Check size={16} /> <span>Una empresa, dos usuarios</span></div>
                          <div className="feature-item"><Check size={16} /> <span>Soporte remoto en horario de oficina</span></div>
                        </>
                      )}
                    </div>

                    <div className="pricing-footer">
                      {isActive && estadoActual?.hasCulqiSubscription ? (
                        <button className="success" style={{ width: '100%' }} disabled>
                          <ShieldCheck size={16} /> Plan Activo
                        </button>
                      ) : (
                        <button 
                          className="primary btn-glow" 
                          style={{ width: '100%', fontWeight: 700 }}
                          onClick={() => handleCulqiPay(planCodigo, planMonto * 100)}
                          disabled={loadingCheckout !== null}
                        >
                          {loadingCheckout === planCodigo ? 'Cargando...' : isActive ? 'Plan Seleccionado' : isAnual ? 'Contratar Plan Anual' : 'Contratar Plan Mensual'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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
                            onClick={() => handleCulqiPay(null, s.monto * 100, s.id)}
                            disabled={loadingCheckout !== null}
                          >
                            <CreditCard size={14} /> 
                            {loadingCheckout !== null ? 'Cargando...' : 'Pagar en Línea (Culqi)'}
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
        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
          margin-bottom: 2rem;
        }
        
        .pricing-card {
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 1.25rem;
          padding: 2.25rem 2rem;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
        }
        
        .pricing-card:hover {
          transform: translateY(-5px);
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.3);
        }
        
        .pricing-card.active-plan {
          border-color: var(--primary, #4f46e5);
          box-shadow: 0 0 25px rgba(79, 70, 229, 0.15);
        }
        
        .pricing-card.highlighted-plan {
          background: linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%);
          border-color: rgba(79, 70, 229, 0.3);
        }
        
        .pricing-card.highlighted-plan:hover {
          border-color: var(--primary, #4f46e5);
          box-shadow: 0 20px 25px -5px rgba(79, 70, 229, 0.2), 0 10px 10px -5px rgba(79, 70, 229, 0.1);
        }
        
        .current-badge {
          position: absolute;
          top: -12px;
          right: 20px;
          background: #10B981;
          color: white;
          padding: 4px 12px;
          border-radius: 99px;
          font-size: 0.725rem;
          font-weight: 700;
          letter-spacing: 0.5px;
          box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);
        }
        
        .save-badge {
          position: absolute;
          top: -12px;
          left: 20px;
          background: #6366F1;
          color: white;
          padding: 4px 12px;
          border-radius: 99px;
          font-size: 0.725rem;
          font-weight: 700;
          letter-spacing: 0.5px;
          box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.2);
        }
        
        .pricing-header h4 {
          font-size: 1.25rem;
          font-weight: 800;
          color: #FFFFFF;
          margin: 0 0 1rem 0;
        }
        
        .pricing-header .price {
          display: flex;
          align-items: baseline;
          margin-bottom: 0.75rem;
        }
        
        .pricing-header .price .currency {
          font-size: 1.5rem;
          font-weight: 700;
          color: #94A3B8;
          margin-right: 0.25rem;
        }
        
        .pricing-header .price .amount {
          font-size: 2.5rem;
          font-weight: 900;
          color: #FFFFFF;
          line-height: 1;
        }
        
        .pricing-header .price .period {
          font-size: 0.875rem;
          color: #94A3B8;
          margin-left: 0.25rem;
        }
        
        .pricing-header .description {
          font-size: 0.875rem;
          color: #E2E8F0;
          line-height: 1.5;
          margin: 0 0 1.75rem 0;
          min-height: 2.75rem;
        }
        
        .pricing-features {
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
          margin-bottom: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        
        .feature-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          font-size: 0.875rem;
          color: #F1F5F9;
          line-height: 1.4;
        }
        
        .feature-item svg {
          color: #34D399;
          flex-shrink: 0;
          margin-top: 2px;
        }
        
        .pricing-footer {
          margin-top: auto;
        }

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
