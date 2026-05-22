import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Edit, Trash2, X, Mail, Phone, MapPin, 
  LayoutGrid, Kanban, User, Building, Landmark, ChevronRight, ChevronLeft,
  Search, ArrowUpDown, Calendar, Clock, Briefcase
} from 'lucide-react';

const STAGES = [
  { id: 'NUEVO_CONTACTO', label: 'Nuevo Contacto', color: 'bg-blue-50 border-blue-200 text-blue-700 header-blue' },
  { id: 'CONTACTADO', label: 'Contactado', color: 'bg-indigo-50 border-indigo-200 text-indigo-700 header-indigo' },
  { id: 'COTIZANDO', label: 'Cotizando', color: 'bg-amber-50 border-amber-200 text-amber-700 header-amber' },
  { id: 'CERRADO_GANADO', label: 'Cerrado Ganado', color: 'bg-emerald-50 border-emerald-200 text-emerald-700 header-emerald' },
  { id: 'CERRADO_PERDIDO', label: 'Cerrado Perdido', color: 'bg-rose-50 border-rose-200 text-rose-700 header-rose' }
];

const Leads: React.FC = () => {
  const { token } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [giros, setGiros] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'kanban'>('kanban');
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);

  // Search & Sorting States
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('nombre');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Nominatim Address Suggestions
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const debounceRef = useRef<any>(null);

  // Giro Negocio Add Express
  const [newGiroName, setNewGiroName] = useState('');
  const [showAddGiroInline, setShowAddGiroInline] = useState(false);

  // Contacts
  const [primaryContact, setPrimaryContact] = useState({ nombre: '', correo: '', celular: '' });
  const [secondaryContacts, setSecondaryContacts] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    nombre: '', ruc: '', razonSocial: '', direccion: '', estado: 'NUEVO_CONTACTO', giroNegocio: ''
  });

  useEffect(() => {
    fetchLeads();
    fetchGiros();
  }, []);

  const fetchLeads = async () => {
    try {
      const response = await api.get('/leads');
      setLeads(response.data);
    } catch (err) {
      console.error('Error fetching leads:', err);
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

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('text/plain', leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('text/plain');
    if (!leadId) return;

    const lead = leads.find(l => l.id === leadId);
    if (lead && lead.estado !== targetStage) {
      try {
        await api.put(`/leads/${leadId}`, {
          ...lead,
          estado: targetStage
        });
        fetchLeads();
      } catch (err) {
        console.error('Error drag and drop:', err);
      }
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

      if (editingLead) {
        await api.put(`/leads/${editingLead.id}`, payload);
      } else {
        await api.post('/leads', payload);
      }
      setShowModal(false);
      fetchLeads();
    } catch (err) {
      alert('Error al guardar prospecto');
    }
  };

  const handleEdit = (lead: any) => {
    setEditingLead(lead);
    setFormData({
      nombre: lead.nombre || '',
      ruc: lead.ruc || '',
      razonSocial: lead.razonSocial || '',
      direccion: lead.direccion || '',
      estado: lead.estado,
      giroNegocio: lead.giroNegocio || ''
    });
    setPrimaryContact({
      nombre: lead.contacto || '',
      correo: lead.correo || '',
      celular: lead.celular || ''
    });

    let secContacts: any[] = [];
    if (lead.contactos) {
      try {
        secContacts = JSON.parse(lead.contactos);
      } catch (e) {
        console.error('Error parsing contactos', e);
      }
    }
    setSecondaryContacts(secContacts);
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingLead(null);
    setFormData({
      nombre: '', ruc: '', razonSocial: '', direccion: '', estado: 'NUEVO_CONTACTO', giroNegocio: ''
    });
    setPrimaryContact({ nombre: '', correo: '', celular: '' });
    setSecondaryContacts([]);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Está seguro de eliminar este prospecto?')) {
      try {
        await api.delete(`/leads/${id}`);
        fetchLeads();
      } catch (err) {
        alert('Error al eliminar prospecto');
      }
    }
  };

  const moveStage = async (leadId: string, currentStage: string, direction: 'forward' | 'backward') => {
    const currentIndex = STAGES.findIndex(s => s.id === currentStage);
    let nextIndex = currentIndex + (direction === 'forward' ? 1 : -1);
    if (nextIndex < 0 || nextIndex >= STAGES.length) return;

    try {
      const nextStage = STAGES[nextIndex].id;
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        await api.put(`/leads/${leadId}`, {
          ...lead,
          estado: nextStage
        });
        fetchLeads();
      }
    } catch (err) {
      console.error('Error shifting stage:', err);
    }
  };

  const getDaysElapsed = (dateString: string) => {
    if (!dateString) return 0;
    const start = new Date(dateString);
    const end = new Date();
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays - 1 >= 0 ? diffDays - 1 : 0;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter & Sort
  const filteredAndSortedLeads = leads
    .filter(l => {
      const search = searchTerm.toLowerCase();
      const rawDir = l.direccion || '';
      const displayDir = rawDir.split(' [GEO:')[0];
      return (
        (l.nombre && l.nombre.toLowerCase().includes(search)) ||
        (l.razonSocial && l.razonSocial.toLowerCase().includes(search)) ||
        (l.contacto && l.contacto.toLowerCase().includes(search)) ||
        displayDir.toLowerCase().includes(search) ||
        (l.giroNegocio && l.giroNegocio.toLowerCase().includes(search)) ||
        (l.ruc && l.ruc.toLowerCase().includes(search))
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Kanban size={26} className="text-sky-600" /> Leads y Prospectos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestiona tus oportunidades comerciales, geolocalización, giros e integrantes adicionales.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* View Toggle */}
          <div className="bg-slate-200 p-1 rounded-lg flex items-center shadow-inner">
            <button 
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-semibold transition ${viewMode === 'kanban' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
              onClick={() => setViewMode('kanban')}
            >
              <Kanban size={14} /> Kanban
            </button>
            <button 
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-semibold transition ${viewMode === 'grid' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid size={14} /> Grilla / Tabla
            </button>
          </div>

          <button className="primary flex items-center gap-2 text-sm ml-auto md:ml-0" onClick={handleNew}>
            <Plus size={16} /> Nuevo Prospecto
          </button>
        </div>
      </div>

      {/* Filters card */}
      <div className="card mb-4" style={{ padding: '1rem' }}>
        <div className="search-box" style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Buscar por nombre, Razón Social, RUC, Contacto, Dirección, Giro..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '38px', width: '100%' }}
          />
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th className="sortable-header" onClick={() => handleSort('nombre')}>
                    <div className="flex-center gap-1">Nombre / Oportunidad <ArrowUpDown size={14} /></div>
                  </th>
                  <th className="sortable-header" onClick={() => handleSort('giroNegocio')}>
                    <div className="flex-center gap-1">Giro <ArrowUpDown size={14} /></div>
                  </th>
                  <th className="sortable-header" onClick={() => handleSort('contacto')}>
                    <div className="flex-center gap-1">Contacto Principal <ArrowUpDown size={14} /></div>
                  </th>
                  <th className="sortable-header" onClick={() => handleSort('ruc')}>
                    <div className="flex-center gap-1">RUC / Tax ID <ArrowUpDown size={14} /></div>
                  </th>
                  <th className="sortable-header" onClick={() => handleSort('estado')}>
                    <div className="flex-center gap-1">Estado <ArrowUpDown size={14} /></div>
                  </th>
                  <th className="sortable-header" onClick={() => handleSort('estadoChangedAt')}>
                    <div className="flex-center gap-1">Último Cambio <ArrowUpDown size={14} /></div>
                  </th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-400 py-6">
                      No se encontraron prospectos.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedLeads.map(lead => {
                    const stage = STAGES.find(s => s.id === lead.estado);
                    const days = getDaysElapsed(lead.estadoChangedAt);
                    const addressText = lead.direccion?.split(' [GEO:')[0] || '';
                    return (
                      <tr key={lead.id}>
                        <td>
                          <div>
                            <span className="font-semibold text-slate-800 block">{lead.nombre || lead.razonSocial || 'N/A'}</span>
                            {lead.razonSocial && lead.nombre && <span className="text-xs text-slate-400 block">{lead.razonSocial}</span>}
                            {addressText && <span className="text-xs text-muted block italic mt-0.5">{addressText}</span>}
                          </div>
                        </td>
                        <td>
                          {lead.giroNegocio ? (
                            <span className="badge badge-outline">{lead.giroNegocio}</span>
                          ) : (
                            <span className="text-muted italic text-xs">No definido</span>
                          )}
                        </td>
                        <td>
                          <div>
                            <span className="font-medium">{lead.contacto}</span>
                            {lead.correo && <div className="text-xs text-muted flex-center gap-1"><Mail size={12} /> {lead.correo}</div>}
                            {lead.celular && <div className="text-xs text-muted flex-center gap-1"><Phone size={12} /> {lead.celular}</div>}
                          </div>
                        </td>
                        <td><span className="text-mono text-xs">{lead.ruc || '-'}</span></td>
                        <td>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${stage?.color || ''}`}>
                            {stage?.label || lead.estado}
                          </span>
                        </td>
                        <td>
                          <div>
                            <span className="text-xs flex items-center gap-1 font-medium"><Calendar size={12} /> {formatDate(lead.estadoChangedAt)}</span>
                            <span className="text-xxs text-warning block font-semibold flex items-center gap-1 mt-0.5"><Clock size={10} /> Hace {days} días</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button className="icon-btn" onClick={() => handleEdit(lead)} title="Editar">
                              <Edit size={14} />
                            </button>
                            <button className="icon-btn danger" onClick={() => handleDelete(lead.id)} title="Eliminar">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Vista Kanban */
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start overflow-x-auto pb-4">
          {STAGES.map(stage => {
            const stageLeads = filteredAndSortedLeads.filter(l => l.estado === stage.id);
            return (
              <div 
                key={stage.id} 
                className="bg-slate-100/80 rounded-xl p-3 border border-slate-200 min-h-[500px] flex flex-col w-full min-w-[240px]"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Stage Header */}
                <div className={`p-2.5 rounded-lg border mb-3 flex items-center justify-between shadow-sm ${stage.color}`}>
                  <span className="font-bold text-xs uppercase tracking-wider">{stage.label}</span>
                  <span className="bg-white/90 border border-current/20 px-2 py-0.5 rounded-full text-xxs font-extrabold shadow-sm">
                    {stageLeads.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-[600px] pr-1">
                  {stageLeads.length === 0 ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center text-slate-400 text-xs flex items-center justify-center flex-1">
                      Vacío
                    </div>
                  ) : (
                    stageLeads.map((lead) => {
                      const days = getDaysElapsed(lead.estadoChangedAt);
                      const geoMatch = lead.direccion?.match(/\[GEO:(-?\d+\.\d+),(-?\d+\.\d+)\]/);
                      const addressText = lead.direccion?.split(' [GEO:')[0] || '';
                      
                      return (
                        <div 
                          key={lead.id} 
                          draggable
                          onDragStart={(e) => handleDragStart(e, lead.id)}
                          className="bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-3 shadow-sm hover:shadow transition-all group flex flex-col justify-between cursor-grab active:cursor-grabbing"
                        >
                          <div>
                            <div className="flex justify-between items-start gap-1">
                              <h4 className="font-semibold text-sm text-slate-800 line-clamp-2 leading-tight">
                                {lead.nombre || lead.razonSocial || 'Sin nombre'}
                              </h4>
                            </div>

                            {lead.razonSocial && lead.nombre && (
                              <div className="text-xxs text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                                <Building size={10} /> {lead.razonSocial}
                              </div>
                            )}

                            {lead.giroNegocio && (
                              <div className="mt-1">
                                <span className="badge badge-outline" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>{lead.giroNegocio}</span>
                              </div>
                            )}

                            {/* Days Tracker Info */}
                            <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded p-1.5 text-xxs font-medium text-amber-700 flex flex-col gap-0.5">
                              <div className="flex items-center gap-1 font-bold">
                                <Calendar size={10} /> Cambió: {formatDate(lead.estadoChangedAt)}
                              </div>
                              <div className="flex items-center gap-1 text-slate-500 font-semibold">
                                <Clock size={10} /> Días transcurridos: {days} d
                              </div>
                            </div>

                            <div className="mt-2.5 space-y-1 text-slate-500 text-xs border-t border-slate-100 pt-2">
                              <div className="flex items-center gap-1.5">
                                <User size={11} className="text-slate-400 shrink-0" />
                                <span className="truncate">{lead.contacto}</span>
                                {lead.contactos && JSON.parse(lead.contactos).length > 0 && (
                                  <span className="text-xxs text-sky-500 ml-1 font-bold">+{JSON.parse(lead.contactos).length}</span>
                                )}
                              </div>
                              {lead.celular && (
                                <div className="flex items-center gap-1.5">
                                  <Phone size={11} className="text-slate-400 shrink-0" />
                                  <span>{lead.celular}</span>
                                </div>
                              )}
                              {lead.correo && (
                                <div className="flex items-center gap-1.5">
                                  <Mail size={11} className="text-slate-400 shrink-0" />
                                  <span className="truncate">{lead.correo}</span>
                                </div>
                              )}
                              {lead.ruc && (
                                <div className="flex items-center gap-1.5">
                                  <Landmark size={11} className="text-slate-400 shrink-0" />
                                  <span className="font-mono text-xxs bg-slate-100 px-1 py-0.5 rounded text-slate-600">RUC: {lead.ruc}</span>
                                </div>
                              )}
                              {addressText && (
                                <div className="flex items-center gap-1.5 text-slate-400 mt-1">
                                  <MapPin size={11} className={`${geoMatch ? 'text-success' : 'text-slate-300'} shrink-0`} />
                                  <span className="truncate italic text-xxs">{addressText}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1">
                            {/* Navigation buttons (for manual shift on touch screens) */}
                            <div className="flex items-center gap-1">
                              <button 
                                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:pointer-events-none"
                                disabled={stage.id === STAGES[0].id}
                                onClick={() => moveStage(lead.id, lead.estado, 'backward')}
                                title="Mover atrás"
                              >
                                <ChevronLeft size={14} />
                              </button>
                              <button 
                                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:pointer-events-none"
                                disabled={stage.id === STAGES[STAGES.length - 1].id}
                                onClick={() => moveStage(lead.id, lead.estado, 'forward')}
                                title="Mover adelante"
                              >
                                <ChevronRight size={14} />
                              </button>
                            </div>

                            {/* Edit / Delete */}
                            <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                              <button 
                                className="p-1 rounded hover:bg-slate-100 text-slate-600"
                                onClick={() => handleEdit(lead)}
                                title="Editar"
                              >
                                <Edit size={12} />
                              </button>
                              <button 
                                className="p-1 rounded hover:bg-red-50 text-red-600"
                                onClick={() => handleDelete(lead.id)}
                                title="Eliminar"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de CRUD */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="font-bold text-lg text-slate-800">
                {editingLead ? 'Editar Prospecto' : 'Registrar Nuevo Prospecto'}
              </h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <h4 className="section-title mb-3" style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', color: 'var(--primary)' }}>
                  Datos de la Oportunidad
                </h4>

                <div className="grid-2 mb-4">
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Nombre del Prospecto / Oportunidad</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Importación Maquinaria XYZ o Negociación Rápida"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Etapa del Embudo</label>
                    <select
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    >
                      {STAGES.map(s => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Giro de Negocio Selector */}
                  <div className="form-group">
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
                            placeholder="Nuevo Giro..." 
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

                  <div className="form-group">
                    <label>Razón Social Empresa (Opcional)</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Importaciones S.A.C."
                      value={formData.razonSocial}
                      onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>RUC / Tax ID (Opcional)</label>
                    <input 
                      type="text" 
                      placeholder="Ej. 20123456789"
                      value={formData.ruc}
                      onChange={(e) => setFormData({ ...formData, ruc: e.target.value })}
                    />
                  </div>

                  {/* OSM Autocomplete Address Input */}
                  <div className="form-group" style={{ gridColumn: 'span 2', position: 'relative' }}>
                    <label>Dirección Fiscal (Opcional)</label>
                    <input 
                      type="text" 
                      placeholder="Av. Las Flores 123, San Isidro (Escriba para buscar...)"
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
                      <label>Nombre *</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="Ej. Juan Pérez"
                        value={primaryContact.nombre}
                        onChange={(e) => setPrimaryContact({ ...primaryContact, nombre: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Celular</label>
                      <input 
                        type="text" 
                        placeholder="Ej. 987654321"
                        value={primaryContact.celular}
                        onChange={(e) => setPrimaryContact({ ...primaryContact, celular: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Correo</label>
                      <input 
                        type="email" 
                        placeholder="contacto@prospecto.com"
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
                <button type="submit" className="primary">Guardar Prospecto</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .header-blue { border-color: #bae6fd; background-color: #f0f9ff; color: #0369a1; }
        .header-indigo { border-color: #c7d2fe; background-color: #e0e7ff; color: #4338ca; }
        .header-amber { border-color: #fde68a; background-color: #fffbeb; color: #b45309; }
        .header-emerald { border-color: #a7f3d0; background-color: #ecfdf5; color: #047857; }
        .header-rose { border-color: #fecdd3; background-color: #fff1f2; color: #b91c1c; }
        .text-xxs { font-size: 0.65rem; }
        .text-xs { font-size: 0.75rem; }
        .text-sm { font-size: 0.875rem; }
      `}</style>
    </div>
  );
};

export default Leads;
