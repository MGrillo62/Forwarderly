import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { CreditCard, Filter, ChevronUp, ChevronDown, Check, DollarSign, X, Calendar } from 'lucide-react';

const Suscripciones: React.FC = () => {
  const { token } = useAuth();
  
  // Data States
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  
  // Filter States
  const [filterCompany, setFilterCompany] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  
  // Sorting States
  const [sortField, setSortField] = useState('fecha'); // 'empresa', 'fecha', 'monto', 'estado', 'diaPago'
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    modalidad: 'Yape',
    banco: '',
    referencia: '',
    fechaPago: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchCompanies();
    fetchSubscriptions();
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
      if (filterCompany) params.empresaId = filterCompany;
      if (filterStatus) params.estadoPago = filterStatus;
      if (filterMonth) params.mes = filterMonth;
      if (filterYear) params.anio = filterYear;

      const res = await api.get('/suscripciones', { params });
      setSubscriptions(res.data);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
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
        <h1>💳 Recaudación de Suscripciones</h1>
        <p className="subtitle">
          Administración de cobros mensuales y anuales de la plataforma Forwarderly.
        </p>
      </div>

      {/* Filter Card */}
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

      {/* Grid Card */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('empresa')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div className="flex-align" style={{ gap: '0.25rem' }}>
                    Empresa {getSortIcon('empresa')}
                  </div>
                </th>
                <th onClick={() => handleSort('fecha')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div className="flex-align" style={{ gap: '0.25rem' }}>
                    Periodo {getSortIcon('fecha')}
                  </div>
                </th>
                <th onClick={() => handleSort('monto')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div className="flex-align" style={{ gap: '0.25rem' }}>
                    Monto (Soles) {getSortIcon('monto')}
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
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
                    No se encontraron cobros de suscripción para los filtros especificados.
                  </td>
                </tr>
              ) : (
                sortedSubscriptions.map(s => (
                  <tr key={s.id}>
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
                    <td>
                      <div style={{ fontWeight: 600 }}>{getMonthName(s.mes)} {s.anio}</div>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-dark)' }}>S/ {s.monto.toFixed(2)}</strong>
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
                        <button 
                          className="success btn-glow font-bold flex-align" 
                          style={{ gap: '0.25rem', padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                          onClick={() => handleOpenPayment(s)}
                        >
                          <Check size={14} /> Registrar Pago
                        </button>
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

      {/* Registrar Pago Modal */}
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
                    {getMonthName(selectedSub.mes)} {selectedSub.anio} — S/ {selectedSub.monto.toFixed(2)}
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
    </div>
  );
};

export default Suscripciones;
