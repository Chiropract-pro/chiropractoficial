import { useEffect, useState } from 'react';
import { Users, Trash2, Loader2, Mail, UserPlus, Clock, X } from 'lucide-react';
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
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState(null);

  // Formulario de invitación
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('doctor');
  const [inviting, setInviting] = useState(false);

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

      // Invitaciones pendientes (solo owner/admin las ve por RLS)
      const { data: invs } = await supabase
        .from('tenant_invitations')
        .select('id, email, role, status, created_at, expires_at')
        .eq('tenant_id', tenant.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setInvitations(invs || []);
    } catch (e) {
      logger.error('load team', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenant?.id]);

  const handleInvite = async (e) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setInviting(true);
    try {
      const { error } = await supabase.rpc('invite_member', {
        p_tenant_id: tenant.id,
        p_email: email,
        p_role: inviteRole,
      });
      if (error) throw error;
      toast.success(`Invitación enviada a ${email}`);
      setInviteEmail('');
      setInviteRole('doctor');
      load();
    } catch (err) {
      toast.error(userFriendlyError(err));
    } finally {
      setInviting(false);
    }
  };

  const revokeInvite = async (invitationId, email) => {
    const { error } = await supabase.rpc('revoke_invitation', { p_invitation_id: invitationId });
    if (error) {
      toast.error(userFriendlyError(error));
    } else {
      toast.success(`Invitación a ${email} cancelada`);
      load();
    }
  };

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

      {/* Invitar miembros — solo owner/admin */}
      {isOwnerOrAdmin && (
        <div className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-primary/10 p-3 rounded-lg">
              <UserPlus size={22} className="text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-on-surface">Invitar a alguien</h3>
              <p className="text-xs text-on-surface-variant">La persona se une con su email al hacer login — sin crear un consultorio nuevo.</p>
            </div>
          </div>

          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                required
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="doctor">Doctor</option>
              <option value="admin">Administrador</option>
              <option value="assistant">Asistente</option>
              <option value="receptionist">Recepcionista</option>
            </select>
            <button
              type="submit"
              disabled={inviting}
              className="clinical-gradient text-on-primary px-5 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
            >
              {inviting ? <Loader2 size={16} className="animate-spin" /> : 'Invitar'}
            </button>
          </form>

          {/* Invitaciones pendientes */}
          {invitations.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">Invitaciones pendientes</p>
              <div className="space-y-2">
                {invitations.map((inv) => {
                  const roleStyle = ROLE_LABELS[inv.role] || { label: inv.role, color: 'bg-gray-100 text-gray-700' };
                  return (
                    <div key={inv.id} className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg border border-outline-variant">
                      <Clock size={16} className="text-amber-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-on-surface truncate">{inv.email}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${roleStyle.color}`}>{roleStyle.label}</span>
                      </div>
                      <button
                        onClick={() => revokeInvite(inv.id, inv.email)}
                        className="text-on-surface-variant hover:text-error p-1.5"
                        title="Cancelar invitación"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
