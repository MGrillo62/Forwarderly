import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, ArrowUpDown, User, Mail, Phone, MapPin, Edit, X, Trash2, Briefcase } from 'lucide-react';

const Clientes: React.FC = () => {
  const { token } = useAuth();
  const [clientes, setClientes] = useState<any[]>([]);
  const [giros, setGiros] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState<any>(null);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('razonSocial');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Address Suggestions State
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const debounceRef = useRef<any>(null);

  // Giro Negocio Add Express
  const [newGiroName, setNewGiroName] = useState('');
  const [showAddGiroInline, setShowAddGiroInline] = useState(false);

  // Multiple Contacts state
  const [primaryContact, setPrimaryContact] = useState({ nombre: '', correo: '', celular: '' });
  const [secondaryContacts, setSecondaryContacts] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    ruc: '', razonSocial: '', direccion: '', direccionEntrega: '', giroNegocio: ''
  });

  useEffect(() => {
    fetchClientes();
    fetchGiros();
  }, []);

  const fetchClientes = async () => {
    try {
      const response = await api.get('/clientes');
      setClientes(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchGiros = async () => {
    try {
      const response = await api.get('/giros-negocio');
      setGiros(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData({ ...formData, direccion: val });
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    if (val.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&limit=5`);
        const data = await response.json();
        setSuggestions(data);
        setShowSuggestions(true);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 500);
  };

  const handleSelectSuggestion = (sug: any) => {
    const displayAddress = sug.display_name;
    const lat = sug.lat;
    const lon = sug.lon;
    
    setFormData({
      ...formData,
      direccion: `${displayAddress} [GEO:${lat},${lon}]`
    });
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleAddGiroExpress = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!newGiroName.trim()) return;
    try {
      const response = await api.post('/giros-negocio', { nombre: newGiroName.trim() });
      const created = response.data;
      setGiros([...giros, created]);
      setFormData({ ...formData, giroNegocio: created.nombre });
      setNewGiroName('');
      setShowAddGiroInline(false);
    } catch (err) {
      alert('Error al agregar giro');
    }
  };

  const handleAddSecondaryContact = () => {
    setSecondaryContacts([...secondaryContacts, { nombre: '', correo: '', celular: '' }]);
  };

  const handleSecondaryContactChange = (index: number, field: string, value: string) => {
    const updated = [...secondaryContacts];
    updated[index][field] = value;
    setSecondaryContacts(updated);
  };

  const handleRemoveSecondaryContact = (index: number) => {
    setSecondaryContacts(secondaryContacts.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        contacto: primaryContact.nombre,
        correo: primaryContact.correo,
        celular: primaryContact.celular,
        contactos: JSON.stringify(secondaryContacts)
      };

      if (editingCliente) {
        await api.put(`/clientes/${editingCliente.id}`, payload);
      } else {
        await api.post('/clientes', payload);
      }
      setShowModal(false);
      fetchClientes();
    } catch (err) {
      alert('Error al guardar cliente');
    }
  };

  const handleEdit = (cliente: any) => {
    setEditingCliente(cliente);
    setFormData({
      ruc: cliente.ruc,
      razonSocial: cliente.razonSocial,
      direccion: cliente.direccion || '',
      direccionEntrega: cliente.direccionEntrega || '',
      giroNegocio: cliente.giroNegocio || ''
    });
    setPrimaryContact({
      nombre: cliente.contacto || '',
      correo: cliente.correo || '',
      celular: cliente.celular || ''
    });

    let secContacts: any[] = [];
    if (cliente.contactos) {
      try {
        secContacts = JSON.parse(cliente.contactos);
      } catch (e) {
        console.error('Error parsing contactos', e);
      }
    }
    setSecondaryContacts(secContacts);
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingCliente(null);
    setFormData({
      ruc: '', razonSocial: '', direccion: '', direccionEntrega: '', giroNegocio: ''
    });
    setPrimaryContact({ nombre: '', correo: '', celular: '' });
    setSecondaryContacts([]);
    setShowModal(true);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter and Sort Clients
  const filteredAndSorted = clientes
    .filter(c => {
      const search = searchTerm.toLowerCase();
      const rawDir = c.direccion || '';
      const displayDir = rawDir.split(' [GEO:')[0];
      return (
        c.razonSocial.toLowerCase().includes(search) ||
        c.ruc.toLowerCase().includes(search) ||
        c.contacto.toLowerCase().includes(search) ||
        displayDir.toLowerCase().includes(search) ||
        (c.giroNegocio && c.giroNegocio.toLowerCase().includes(search))
      );
    })
    .sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';
      if (sortField === 'direccion') {
        aVal = aVal.split(' [GEO:')[0];
        bVal = bVal.split(' [GEO:')[0];
      }
      
      if (aVal.toString().toLowerCase() < bVal.toString().toLowerCase()) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (aVal.toString().toLowerCase() > bVal.toString().toLowerCase()) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Mis Clientes</h1>
          <p className="subtitle">Gestione la base de datos de sus clientes y contactos corporativos</p>
        </div>
        <button className="primary icon-left" onClick={handleNew}>
          <Plus size={18} /> Nuevo Cliente
        </button>
      </div>

      {/* Filters Card */}
      <div className="card filters-card mb-4" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div className="search-box" style={{ flex: 1, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Buscar por Razón Social, RUC, Contacto, Dirección, Giro..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '38px', width: '100%' }}
          />
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th className="sortable-header" onClick={() => handleSort('razonSocial')}>
                  <div className="flex-center gap-1">
                    Razón Social <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="sortable-header" onClick={() => handleSort('ruc')}>
                  <div className="flex-center gap-1">
                    RUC <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="sortable-header" onClick={() => handleSort('giroNegocio')}>
                  <div className="flex-center gap-1">
                    Giro de Negocio <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="sortable-header" onClick={() => handleSort('contacto')}>
                  <div className="flex-center gap-1">
                    Contacto Principal <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="sortable-header" onClick={() => handleSort('direccion')}>
                  <div className="flex-center gap-1">
                    Dirección Fiscal <ArrowUpDown size={14} />
                  </div>
                </th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map(c => {
                const geoMatch = c.direccion?.match(/\[GEO:(-?\d+\.\d+),(-?\d+\.\d+)\]/);
                const addressText = c.direccion?.split(' [GEO:')[0] || '';
                
                return (
                  <tr key={c.id}>
                    <td>
                      <div>
                        <strong>{c.razonSocial}</strong>
                        {c.contactos && JSON.parse(c.contactos).length > 0 && (
                          <span className="badge badge-info ml-2" style={{ fontSize: '0.7rem' }}>
                            +{JSON.parse(c.contactos).length} cont.
                          </span>
                        )}
                      </div>
                    </td>
                    <td><span className="text-mono">{c.ruc}</span></td>
                    <td>
                      {c.giroNegocio ? (
                        <span className="badge badge-outline">{c.giroNegocio}</span>
                      ) : (
                        <span className="text-muted italic text-sm">No definido</span>
                      )}
                    </td>
                    <td>
                      <div>
                        <span className="font-medium">{c.contacto}</span>
                        {c.correo && <div className="text-xs text-muted flex-center gap-1"><Mail size={12} /> {c.correo}</div>}
                        {c.celular && <div className="text-xs text-muted flex-center gap-1"><Phone size={12} /> {c.celular}</div>}
                      </div>
                    </td>
                    <td>
                      <div>
                        <span>{addressText}</span>
                        {geoMatch && (
                          <div className="text-xs text-success font-medium flex-center gap-1 mt-1">
                            <MapPin size={12} /> Geoposicionado
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <button className="icon-btn" onClick={() => handleEdit(c)} title="Editar Cliente">
                        <Edit size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredAndSorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-4">No se encontraron clientes registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px', width: '90%' }}>
            <div className="modal-header">
              <h3>{editingCliente ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}</h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <h4 className="section-title mb-3" style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', color: 'var(--primary)' }}>
                  Datos de la Empresa
                </h4>
                
                <div className="grid-2 mb-4">
                  <div className="form-group">
                    <label>RUC</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.ruc}
                      onChange={(e) => setFormData({ ...formData, ruc: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Razón Social</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.razonSocial}
                      onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
                    />
                  </div>

                  {/* Giro de Negocio Selector */}
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Giro de Negocio</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {!showAddGiroInline ? (
                        <>
                          <select
                            value={formData.giroNegocio}
                            onChange={(e) => setFormData({ ...formData, giroNegocio: e.target.value })}
                            style={{ flex: 1 }}
                          >
                            <option value="">Seleccione un Giro de Negocio</option>
                            {giros.map(g => (
                              <option key={g.id} value={g.nombre}>{g.nombre}</option>
                            ))}
                          </select>
                          <button 
                            type="button" 
                            className="btn-outline icon-only" 
                            style={{ padding: '10px' }}
                            onClick={() => setShowAddGiroInline(true)}
                            title="Agregar nuevo Giro"
                          >
                            <Plus size={18} />
                          </button>
                        </>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px', flex: 1, alignItems: 'center' }}>
                          <input 
                            type="text" 
                            placeholder="Nombre del nuevo Giro..." 
                            value={newGiroName}
                            onChange={(e) => setNewGiroName(e.target.value)}
                            style={{ flex: 1 }}
                          />
                          <button type="button" className="primary btn-sm" onClick={handleAddGiroExpress}>Agregar</button>
                          <button type="button" className="btn-outline btn-sm" onClick={() => { setShowAddGiroInline(false); setNewGiroName(''); }}>Cancelar</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Address Auto-suggest Input */}
                  <div className="form-group" style={{ gridColumn: 'span 2', position: 'relative' }}>
                    <label>Dirección Fiscal</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Escriba para buscar dirección..."
                      value={formData.direccion.split(' [GEO:')[0]}
                      onChange={handleAddressChange}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                    />
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="autocomplete-suggestions" style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'var(--card-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '0.5rem',
                        boxShadow: 'var(--shadow)',
                        zIndex: 100,
                        maxHeight: '200px',
                        overflowY: 'auto',
                        backdropFilter: 'blur(10px)'
                      }}>
                        {suggestions.map((sug, idx) => (
                          <div 
                            key={idx}
                            className="suggestion-item"
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              borderBottom: idx === suggestions.length - 1 ? 'none' : '1px solid var(--border-color)',
                              fontSize: '0.9rem',
                              color: 'var(--text-color)'
                            }}
                            onMouseDown={() => handleSelectSuggestion(sug)}
                          >
                            {sug.display_name}
                          </div>
                        ))}
                      </div>
                    )}
                    {loadingSuggestions && (
                      <span className="text-xs text-muted mt-1 block">Buscando geolocalizaciones en OSM...</span>
                    )}
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Dirección de Entrega</label>
                    <input 
                      type="text" 
                      value={formData.direccionEntrega}
                      onChange={(e) => setFormData({ ...formData, direccionEntrega: e.target.value })}
                    />
                  </div>
                </div>

                <h4 className="section-title mb-3" style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', color: 'var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Contactos</span>
                  <button type="button" className="btn-outline icon-left btn-xs" onClick={handleAddSecondaryContact}>
                    <Plus size={12} /> Contacto Adicional
                  </button>
                </h4>

                {/* Primary Contact */}
                <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px dashed var(--border-color)', marginBottom: '16px' }}>
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 block">Contacto Principal</span>
                  <div className="grid-3">
                    <div className="form-group">
                      <label>Nombre</label>
                      <input 
                        type="text" 
                        required 
                        value={primaryContact.nombre}
                        onChange={(e) => setPrimaryContact({ ...primaryContact, nombre: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Celular</label>
                      <input 
                        type="text" 
                        value={primaryContact.celular}
                        onChange={(e) => setPrimaryContact({ ...primaryContact, celular: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Correo</label>
                      <input 
                        type="email" 
                        value={primaryContact.correo}
                        onChange={(e) => setPrimaryContact({ ...primaryContact, correo: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Secondary Contacts */}
                {secondaryContacts.map((contact, index) => (
                  <div key={index} style={{ backgroundColor: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '12px', position: 'relative' }}>
                    <button 
                      type="button" 
                      className="icon-btn text-danger" 
                      style={{ position: 'absolute', right: '8px', top: '8px' }}
                      onClick={() => handleRemoveSecondaryContact(index)}
                    >
                      <Trash2 size={16} />
                    </button>
                    <span className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 block">Contacto Adicional #{index + 1}</span>
                    <div className="grid-3">
                      <div className="form-group">
                        <label>Nombre</label>
                        <input 
                          type="text" 
                          required 
                          value={contact.nombre}
                          onChange={(e) => handleSecondaryContactChange(index, 'nombre', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Celular</label>
                        <input 
                          type="text" 
                          value={contact.celular}
                          onChange={(e) => handleSecondaryContactChange(index, 'celular', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Correo</label>
                        <input 
                          type="email" 
                          value={contact.correo}
                          onChange={(e) => handleSecondaryContactChange(index, 'correo', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="primary">Guardar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clientes;
