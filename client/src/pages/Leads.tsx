import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Edit, Trash2, X, Mail, Phone, MapPin, 
  LayoutGrid, Kanban, User, Building, Landmark, ChevronRight, ChevronLeft
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
  const [viewMode, setViewMode] = useState<'grid' | 'kanban'>('kanban');
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);
  const [formData, setFormData] = useState({
    nombre: '', ruc: '', razonSocial: '', direccion: '', contacto: '', correo: '', celular: '', estado: 'NUEVO_CONTACTO'
  });

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const response = await api.get('/leads');
      setLeads(response.data);
    } catch (err) {
      console.error('Error fetching leads:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingLead) {
        await api.put(`/leads/${editingLead.id}`, formData);
      } else {
        await api.post('/leads', formData);
      }
      setShowModal(false);
      setFormData({ nombre: '', ruc: '', razonSocial: '', direccion: '', contacto: '', correo: '', celular: '', estado: 'NUEVO_CONTACTO' });
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
      contacto: lead.contacto || '',
      correo: lead.correo || '',
      celular: lead.celular || '',
      estado: lead.estado
    });
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingLead(null);
    setFormData({ nombre: '', ruc: '', razonSocial: '', direccion: '', contacto: '', correo: '', celular: '', estado: 'NUEVO_CONTACTO' });
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

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Kanban size={26} className="text-sky-600" /> Leads y Prospectos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestiona tus oportunidades comerciales y embudo de ventas.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Alternar vista switch */}
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

      {viewMode === 'grid' ? (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nombre/Prospecto</th>
                  <th>Contacto</th>
                  <th>RUC / Tax ID</th>
                  <th>Celular</th>
                  <th>Correo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-400 py-6">
                      No hay prospectos registrados. ¡Crea uno nuevo!
                    </td>
                  </tr>
                ) : (
                  leads.map(lead => {
                    const stage = STAGES.find(s => s.id === lead.estado);
                    return (
                      <tr key={lead.id}>
                        <td>
                          <div className="font-semibold text-slate-800">{lead.nombre || lead.razonSocial || 'N/A'}</div>
                          {lead.razonSocial && lead.nombre && <div className="text-xs text-slate-400">{lead.razonSocial}</div>}
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5 text-slate-700 text-sm">
                            <User size={13} className="text-slate-400" />
                            {lead.contacto}
                          </div>
                        </td>
                        <td>{lead.ruc || '-'}</td>
                        <td>
                          {lead.celular ? (
                            <span className="flex items-center gap-1 text-slate-700 text-sm">
                              <Phone size={13} className="text-slate-400" />
                              {lead.celular}
                            </span>
                          ) : '-'}
                        </td>
                        <td>
                          {lead.correo ? (
                            <span className="flex items-center gap-1 text-slate-700 text-sm">
                              <Mail size={13} className="text-slate-400" />
                              {lead.correo}
                            </span>
                          ) : '-'}
                        </td>
                        <td>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${stage?.color || ''}`}>
                            {stage?.label || lead.estado}
                          </span>
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
            const stageLeads = leads.filter(l => l.estado === stage.id);
            return (
              <div 
                key={stage.id} 
                className="bg-slate-100/80 rounded-xl p-3 border border-slate-200 min-h-[500px] flex flex-col w-full min-w-[240px]"
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
                    stageLeads.map((lead, idx) => (
                      <div 
                        key={lead.id} 
                        className="bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-3 shadow-sm hover:shadow transition-all group flex flex-col justify-between"
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

                          <div className="mt-2.5 space-y-1 text-slate-500 text-xs border-t border-slate-100 pt-2">
                            <div className="flex items-center gap-1.5">
                              <User size={11} className="text-slate-400 shrink-0" />
                              <span className="truncate">{lead.contacto}</span>
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
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1">
                          {/* Navigation buttons */}
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
                    ))
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
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="font-bold text-lg text-slate-800">
                {editingLead ? 'Editar Prospecto' : 'Registrar Nuevo Prospecto'}
              </h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="grid-2">
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
                    <label>Nombre de Contacto *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Ej. Juan Pérez"
                      value={formData.contacto}
                      onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Celular</label>
                    <input 
                      type="text" 
                      placeholder="Ej. 987654321"
                      value={formData.celular}
                      onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Correo Electrónico</label>
                    <input 
                      type="email" 
                      placeholder="contacto@prospecto.com"
                      value={formData.correo}
                      onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
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

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 border-b pb-1">
                      Información Corporativa (Opcional)
                    </h4>
                  </div>

                  <div className="form-group">
                    <label>Razón Social Empresa</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Importaciones S.A.C."
                      value={formData.razonSocial}
                      onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>RUC / Tax ID</label>
                    <input 
                      type="text" 
                      placeholder="Ej. 20123456789"
                      value={formData.ruc}
                      onChange={(e) => setFormData({ ...formData, ruc: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Dirección Legal</label>
                    <input 
                      type="text" 
                      placeholder="Av. Las Flores 123, San Isidro"
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    />
                  </div>
                </div>
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
        .text-xxs { font-size: 0.65rem; }
      `}</style>
    </div>
  );
};

export default Leads;
