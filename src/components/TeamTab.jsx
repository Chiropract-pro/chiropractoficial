import { useEffect, useState } from 'react';
import { Users, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import { userFriendlyError, logger } from '../lib/logger';

const ROLE_LABELS = {
  owner: { label: 'Owner', color: 'bg-primary text-on-primary' },
  admin: { label: 'Administrador', color: 'bg-blue-100 text-blue-700' },
  doctor: { label: 'Doctor', color: 'bg-green-100 text-green-700' },
  assistant: { label: 'Asistente', color: 'bg-amber-100 text-amber-700' },
  receptionist: { label: 'Recepcionista', color: 'bg-purple-100 text-purple-700' },
};

export default function TeamTab() {
  const { tenant, membership } = useAuth();
  const toast = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState(null);

  const isOwnerOrAdmin = membership?.role === 'owner' || membership?.role === 'admin';

  const load = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('tenant_memberships')
        .select('id, user_id, role, accepted_at, profiles!inner(id, full_name, phone, avatar_url)')
        .eq('tenant_id', tenant.id);
      setMembers(data || []);
    } catch (e) {
      logger.error('load team', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenant?.id]);

  const updateRole = async (membershipId, newRole) => {
    const { error } = await supabase
      .from('tenant_memberships')
      .update({ role: newRole })
      .eq('id', membershipId);
    if (error) {
      toast.error(userFriendlyError(error));
    } else {
      toast.success('Rol actualizado');
      load();
    }
  };

  const removeMember = async (membershipId, name) => {
    const { error } = await supabase
      .from('tenant_memberships')
      .delete()
      .eq('id', membershipId);
    if (error) {
      toast.error(userFriendlyError(error));
    } else {
      toast.success(`${name} fue retirado del consultorio`);
      load();
    }
    setConfirmRemove(null);
  };

  if (loading) {
    return (
      <div className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant p-12 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-primary/10 p-3 rounded-lg">
            <Users size={24} className="text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-on-surface">Equipo del consultorio</h3>
            <p className="text-xs text-on-surface-variant">{members.length} miembro{members.length !== 1 ? 's' : ''} con acceso al CRM</p>
          </div>
        </div>

        <div className="space-y-3">
          {members.map((m) => {
            const profile = m.profiles;
            const roleStyle = ROLE_LABELS[m.role] || { label: m.role, color: 'bg-gray-100 text-gray-700' };
            const initials = (profile.full_name || 'U').split(' ').map((n) => n[0] || '').join('').slice(0, 2);
            const isMe = m.user_id === membership?.user_id;
            const isConfirming = confirmRemove === m.id;

            return (
              <div key={m.id} className="flex items-center gap-4 p-4 bg-surface-container-low rounded-lg border border-outline-variant">
                <div className="w-12 h-12 rounded-full clinical-gradient flex items-center justify-center text-white font-bold flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-on-surface">{profile.full_name}{isMe && <span className="text-xs text-on-surface-variant ml-1">(tú)</span>}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleStyle.color}`}>{roleStyle.label}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant truncate">{profile.phone || 'Sin teléfono registrado'}</p>
                </div>
                {isOwnerOrAdmin && !isMe && m.role !== 'owner' && (
                  <div className="flex items-center gap-2">
                    <select
                      value={m.role}
                      onChange={(e) => updateRole(m.id, e.target.value)}
                      className="text-xs px-2 py-1 border border-outline-variant rounded-lg bg-surface-container-lowest"
                    >
                      <option value="admin">Administrador</option>
                      <option value="doctor">Doctor</option>
                      <option value="assistant">Asistente</option>
                      <option value="receptionist">Recepcionista</option>
                    </select>
                    {!isConfirming ? (
                      <button onClick={() => setConfirmRemove(m.id)} className="text-on-surface-variant hover:text-error p-2" title="Retirar del consultorio">
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <>
                        <button onClick={() => removeMember(m.id, profile.full_name)} className="text-xs px-2 py-1 bg-danger text-white rounded">Sí</button>
                        <button onClick={() => setConfirmRemove(null)} className="text-xs px-2 py-1 border rounded">No</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-amber-900 mb-1">¿Quieres invitar a alguien?</p>
        <p className="text-xs text-amber-800">
          Por ahora la creación de cuentas se hace desde Supabase Auth. Pídenos que añadamos a alguien con su email + el rol que quieres asignarle.
          Próximamente: invitaciones por email automáticas desde aquí.
        </p>
      </div>
    </div>
  );
}
