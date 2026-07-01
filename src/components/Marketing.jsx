import { useState } from 'react';
import { Camera, Globe2, MessageCircle, Globe, Users, TrendingUp, Mail, FileText, Plus, X } from 'lucide-react';
import { useLeads, useScheduledContent } from '../hooks/useTenantData';

export default function Marketing() {
  const { leads, loading: leadsLoading, insertLead, updateLead } = useLeads();
  const { scheduledContent, loading: contentLoading } = useScheduledContent();
  const [showNewForm, setShowNewForm] = useState(false);

  const totalLeads = leads.length;
  const convertedLeads = leads.filter((l) => l.status === 'convertido').length;
  const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0;

  const leadsBySource = {};
  leads.forEach((l) => {
    leadsBySource[l.source] = (leadsBySource[l.source] || 0) + 1;
  });
  const maxSource = Math.max(...Object.values(leadsBySource), 1);
  Object.keys(leadsBySource).forEach((k) => {
    leadsBySource[k] = Math.round((leadsBySource[k] / maxSource) * 100);
  });

  const socialMetrics = { instagram: { followers: 0, engagement: 0, growth: 0 }, facebook: { followers: 0, engagement: 0, growth: 0 }, whatsapp: { contacts: 0, messagesThisMonth: 0 } };
  const emailMetrics = { sent: 0, openRate: 0, clickRate: 0 };

  const sourceIcon = (source) => {
    switch (source) {
      case 'whatsapp': return <MessageCircle size={14} className="text-green-500" />;
      case 'instagram': return <Camera size={14} className="text-pink-500" />;
      case 'facebook': return <Globe2 size={14} className="text-blue-600" />;
      case 'web': return <Globe size={14} className="text-purple-500" />;
      case 'referido': return <Users size={14} className="text-teal-500" />;
      case 'jornada': return <TrendingUp size={14} className="text-orange-500" />;
      default: return <Globe size={14} className="text-on-surface-variant/70" />;
    }
  };

  const sourceLabel = (source) => {
    const labels = { whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook', web: 'Web', referido: 'Referido', jornada: 'Jornada' };
    return labels[source] || source;
  };

  const leadStatusColor = (status) => {
    switch (status) {
      case 'nuevo': return 'bg-blue-100 text-blue-700';
      case 'contactado': return 'bg-yellow-100 text-yellow-700';
      case 'convertido': return 'bg-green-100 text-green-700';
      case 'perdido': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const formatShortDate = (d) => {
    if (!d) return '';
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Marketing</h2>
          <p className="text-on-surface-variant text-sm mt-1">Métricas y gestión de leads</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} /> Nuevo Lead
        </button>
      </div>

      {/* Social Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-clinical border border-outline-variant">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-2 rounded-lg">
              <Camera size={18} className="text-white" />
            </div>
            <h3 className="font-semibold text-on-surface">Instagram</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-on-surface">{socialMetrics.instagram.followers.toLocaleString()}</p>
              <p className="text-[10px] text-on-surface-variant/70">Followers</p>
            </div>
            <div>
              <p className="text-lg font-bold text-pink-500">{socialMetrics.instagram.engagement}%</p>
              <p className="text-[10px] text-on-surface-variant/70">Engagement</p>
            </div>
            <div>
              <p className="text-lg font-bold text-success">+{socialMetrics.instagram.growth}%</p>
              <p className="text-[10px] text-on-surface-variant/70">Crecimiento</p>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-clinical border border-outline-variant">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Globe2 size={18} className="text-white" />
            </div>
            <h3 className="font-semibold text-on-surface">Facebook</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-on-surface">{socialMetrics.facebook.followers.toLocaleString()}</p>
              <p className="text-[10px] text-on-surface-variant/70">Followers</p>
            </div>
            <div>
              <p className="text-lg font-bold text-blue-600">{socialMetrics.facebook.engagement}%</p>
              <p className="text-[10px] text-on-surface-variant/70">Engagement</p>
            </div>
            <div>
              <p className="text-lg font-bold text-success">+{socialMetrics.facebook.growth}%</p>
              <p className="text-[10px] text-on-surface-variant/70">Crecimiento</p>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-clinical border border-outline-variant">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-green-500 p-2 rounded-lg">
              <MessageCircle size={18} className="text-white" />
            </div>
            <h3 className="font-semibold text-on-surface">WhatsApp</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-on-surface">{socialMetrics.whatsapp.contacts}</p>
              <p className="text-[10px] text-on-surface-variant/70">Contactos</p>
            </div>
            <div>
              <p className="text-lg font-bold text-green-600">{socialMetrics.whatsapp.messagesThisMonth}</p>
              <p className="text-[10px] text-on-surface-variant/70">Mensajes/mes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-clinical border border-outline-variant">
        <h3 className="font-semibold text-on-surface mb-4">Embudo de conversión</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1 text-center">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-3xl font-bold text-blue-600">{totalLeads}</p>
              <p className="text-xs text-on-surface-variant">Leads</p>
            </div>
          </div>
          <TrendingUp size={20} className="text-on-surface-variant/50" />
          <div className="flex-1 text-center">
            <div className="bg-yellow-50 rounded-lg p-4">
              <p className="text-3xl font-bold text-yellow-600">{leads.filter((l) => l.status === 'contactado').length}</p>
              <p className="text-xs text-on-surface-variant">Contactados</p>
            </div>
          </div>
          <TrendingUp size={20} className="text-on-surface-variant/50" />
          <div className="flex-1 text-center">
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-3xl font-bold text-green-600">{convertedLeads}</p>
              <p className="text-xs text-on-surface-variant">Convertidos</p>
            </div>
          </div>
          <div className="text-center min-w-[80px]">
            <p className="text-2xl font-bold text-primary">{conversionRate}%</p>
            <p className="text-xs text-on-surface-variant/70">Conversión</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads by Source */}
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-clinical border border-outline-variant">
          <h3 className="font-semibold text-on-surface mb-4">Leads por fuente</h3>
          <div className="space-y-3">
            {Object.entries(leadsBySource).map(([source, pct]) => (
              <div key={source} className="flex items-center gap-3">
                <div className="w-24 flex items-center gap-1.5 text-sm text-on-surface">
                  {sourceIcon(source)}
                  <span>{sourceLabel(source)}</span>
                </div>
                <div className="flex-1 bg-surface-container rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-medium text-on-surface min-w-[35px] text-right">{pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Email Metrics */}
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-clinical border border-outline-variant">
          <h3 className="font-semibold text-on-surface mb-4">Email Marketing</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-surface-container-low rounded-lg p-4">
              <Mail size={20} className="mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold text-on-surface">{emailMetrics.sent}</p>
              <p className="text-xs text-on-surface-variant/70">Enviados</p>
            </div>
            <div className="bg-surface-container-low rounded-lg p-4">
              <TrendingUp size={20} className="mx-auto text-success mb-2" />
              <p className="text-2xl font-bold text-success">{emailMetrics.openRate}%</p>
              <p className="text-xs text-on-surface-variant/70">Apertura</p>
            </div>
            <div className="bg-surface-container-low rounded-lg p-4">
              <FileText size={20} className="mx-auto text-accent mb-2" />
              <p className="text-2xl font-bold text-accent">{emailMetrics.clickRate}%</p>
              <p className="text-xs text-on-surface-variant/70">Clicks</p>
            </div>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant overflow-hidden">
        <div className="p-4 border-b border-outline-variant">
          <h3 className="font-semibold text-on-surface">Leads recientes</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase">Nombre</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase">Fuente</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase">Fecha</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b border-outline-variant/30 hover:bg-surface-container-low/50">
                <td className="px-4 py-3 text-sm font-medium text-on-surface">{lead.name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-sm text-on-surface">
                    {sourceIcon(lead.source)}
                    {sourceLabel(lead.source)}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-on-surface-variant">{formatShortDate(lead.date)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${leadStatusColor(lead.status)}`}>
                    {lead.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {lead.status === 'nuevo' && (
                    <button onClick={() => updateLead(lead.id, { status: 'contactado' })} className="text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded hover:bg-yellow-100 transition-colors">Contactar</button>
                  )}
                  {lead.status === 'contactado' && (
                    <button onClick={() => updateLead(lead.id, { status: 'convertido' })} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100 transition-colors">Convertir</button>
                  )}
                  {lead.status !== 'perdido' && lead.status !== 'convertido' && (
                    <button onClick={() => updateLead(lead.id, { status: 'perdido' })} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded hover:bg-red-100 transition-colors ml-1">Perder</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Scheduled Content */}
      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-clinical border border-outline-variant">
        <h3 className="font-semibold text-on-surface mb-4">Contenido programado</h3>
        <div className="space-y-2">
          {scheduledContent.map((content) => (
            <div key={content.id} className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg">
              <div className={`p-1.5 rounded ${content.platform === 'instagram' ? 'bg-pink-100' : 'bg-blue-100'}`}>
                {content.platform === 'instagram' ? <Camera size={14} className="text-pink-500" /> : <Globe2 size={14} className="text-blue-600" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-on-surface">{content.type}</p>
                <p className="text-xs text-on-surface-variant/70">{formatShortDate(content.date)}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                content.status === 'programado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {content.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* New Lead Form */}
      {showNewForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNewForm(false)}>
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-on-surface">Nuevo Lead</h3>
              <button onClick={() => setShowNewForm(false)} className="text-on-surface-variant/50 hover:text-on-surface-variant"><X size={20} /></button>
            </div>
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target;
              await insertLead({
                name: form.name.value,
                source: form.source.value,
                status: 'nuevo',
                date: form.date.value,
                notes: form.notes.value || null,
              });
              setShowNewForm(false);
            }}>
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Nombre</label>
                <input name="name" required className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Nombre del lead" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Fuente</label>
                  <select name="source" className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="whatsapp">WhatsApp</option>
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="web">Web</option>
                    <option value="referido">Referido</option>
                    <option value="jornada">Jornada</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Fecha</label>
                  <input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Notas</label>
                <textarea name="notes" className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" rows={2} placeholder="Notas del lead..." />
              </div>
              <button type="submit" className="w-full bg-primary hover:bg-primary-dark text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                Registrar Lead
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
