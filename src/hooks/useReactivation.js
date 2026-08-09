import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../lib/logger';
import { usePatients, useAppointments } from './useTenantData';
import { todayStr, parseDateStr } from '../utils/dates';

/**
 * Motor de reactivación.
 *
 * QUÉ RESUELVE
 * El consultorio tiene 1.424 pacientes con historia y ~$4.1M en saldos reales,
 * pero ninguna pantalla decía a quién llamar hoy. El CRM sabía todo y no
 * proponía nada. Aquí cada paciente inactivo recibe una prioridad calculada y
 * un valor recuperable estimado, para que la mañana empiece con una lista
 * corta y ordenada en vez de con una tabla de mil filas.
 *
 * REGLA DURA: nunca proponer a alguien que ya tiene cita futura agendada, ni a
 * quien se contactó hace poco. Un CRM que hace llamar dos veces al mismo
 * paciente destruye la confianza más rápido de lo que la construye.
 */

const DAY = 86400000;
const TOUCH_COOLDOWN_DAYS = 21;     // no volver a proponer antes de 3 semanas
const LOCAL_TOUCH_KEY = 'chiro_reactivation_touches';
const DEFAULT_TICKET = 150000;      // tarifa de primera consulta (utils/format)

export const SEGMENTS = {
  saldo: {
    id: 'saldo',
    label: 'Con saldo pendiente',
    short: 'Saldo',
    tone: 'danger',
    blurb: 'Dinero ya facturado que nunca entró. Es la cobranza más fácil: el paciente ya recibió el servicio.',
  },
  abandono: {
    id: 'abandono',
    label: 'Tratamiento interrumpido',
    short: 'Interrumpido',
    tone: 'amber',
    blurb: 'Estaban en tratamiento activo y dejaron de venir. Recuperarlos es clínico antes que comercial.',
  },
  dormido: {
    id: 'dormido',
    label: 'Pacientes dormidos',
    short: 'Dormidos',
    tone: 'pine',
    blurb: 'Vinieron varias veces y llevan meses sin volver. Conocen el consultorio: la conversión es alta.',
  },
  primera: {
    id: 'primera',
    label: 'No volvieron tras la primera',
    short: 'Primera vez',
    tone: 'info',
    blurb: 'Vinieron una sola vez. Cada uno es una primera consulta que no se convirtió en tratamiento.',
  },
};

export const SEGMENT_LIST = [SEGMENTS.saldo, SEGMENTS.abandono, SEGMENTS.dormido, SEGMENTS.primera];

/** Días desde una fecha YYYY-MM-DD (null si no hay fecha). */
function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = parseDateStr(String(dateStr).slice(0, 10));
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((parseDateStr(todayStr()) - d) / DAY);
}

/**
 * Curva de recencia: premia la ventana en que el paciente todavía se acuerda
 * del consultorio (1–8 meses) y castiga tanto lo demasiado reciente (aún no es
 * abandono) como lo muy antiguo (ya es una campaña fría, no una reactivación).
 */
function recencyScore(days) {
  if (days == null) return 8;
  if (days < 30) return 0;
  if (days <= 240) return 30 - Math.abs(days - 110) * 0.06;
  if (days <= 540) return 18;
  return 9;
}

function scorePatient(p, hasFutureAppt, lastTouchDays) {
  const days = daysSince(p.last_visit);
  const balance = Number(p.balance_due || 0);
  const visits = Number(p.appointments_count || 0);
  const spent = Number(p.total_spent || 0);

  let score = 0;
  // Saldo: hasta 35 puntos, con rendimiento decreciente (una deuda de $2M no
  // vale 20× una de $100k a la hora de decidir a quién llamar primero).
  if (balance > 0) score += Math.min(35, 12 + Math.log10(balance / 10000 + 1) * 16);
  score += recencyScore(days);
  score += Math.min(15, visits * 2.2);
  score += Math.min(20, (spent / 1000000) * 10);
  if (p.status === 'en_tratamiento') score += 12;
  if (p.status === 'inactivo') score -= 6;
  if (!p.phone && !p.email) score -= 25;      // no accionable hoy
  if (p.needs_review) score -= 4;             // dato importado dudoso
  if (hasFutureAppt) score -= 100;            // ya vuelve: no molestar
  if (lastTouchDays != null && lastTouchDays < TOUCH_COOLDOWN_DAYS) score -= 100;

  return Math.round(Math.max(0, Math.min(100, score)));
}

function segmentOf(p, days) {
  if (Number(p.balance_due || 0) > 0) return 'saldo';
  if (p.status === 'en_tratamiento' && (days == null || days >= 21)) return 'abandono';
  if (Number(p.appointments_count || 0) <= 1) return 'primera';
  return 'dormido';
}

/** Valor recuperable: el saldo real + el ticket típico de ese paciente. */
function recoverableValue(p) {
  const balance = Number(p.balance_due || 0);
  const visits = Number(p.appointments_count || 0);
  const spent = Number(p.total_spent || 0);
  const ticket = visits > 0 && spent > 0 ? Math.round(spent / visits) : DEFAULT_TICKET;
  return balance + ticket;
}

/** Motivo en una línea — lo que el doctor lee antes de marcar. */
function reasonFor(p, days, segment) {
  const when = days == null ? 'sin visita registrada' : days > 400
    ? `última visita hace ${Math.floor(days / 365)} año${days >= 730 ? 's' : ''}`
    : `última visita hace ${Math.floor(days / 30)} mes${days >= 60 ? 'es' : ''}`;
  if (segment === 'saldo') return `Debe saldo · ${when}`;
  if (segment === 'abandono') return `En tratamiento y no vuelve · ${when}`;
  if (segment === 'primera') return `Vino una sola vez · ${when}`;
  return `${p.appointments_count || 0} visitas · ${when}`;
}

/** Plantillas de WhatsApp. Tuteo rolo, sin voseo, sin promesas médicas. */
export function messageFor(candidate, clinicName = 'el consultorio') {
  const first = (candidate.name || '').split(' ')[0] || 'Hola';
  const base = {
    saldo: `Hola ${first}, te saludamos de ${clinicName}. Tenemos un saldo pendiente de tu tratamiento. Te dejo el link para que lo pagues en línea cuando puedas, y de paso agendamos tu control. ¿Te sirve esta semana?`,
    abandono: `Hola ${first}, te escribimos de ${clinicName}. Vimos que quedó pendiente continuar tu tratamiento y queremos saber cómo vas. Si quieres retomamos con una sesión de control, ¿qué día te queda bien?`,
    dormido: `Hola ${first}, ¿cómo vas? Te escribimos de ${clinicName}. Ha pasado un tiempo desde tu última visita y queremos saber cómo sigue tu espalda. Si quieres agendamos una revisión, cuéntame qué día te sirve.`,
    primera: `Hola ${first}, te saludamos de ${clinicName}. Nos quedamos con las ganas de continuar contigo después de tu primera consulta. ¿Te gustaría agendar una sesión de seguimiento? Cuéntame y te separo el espacio.`,
  };
  return base[candidate.segment] || base.dormido;
}

export function whatsappLink(phone, message) {
  const clean = String(phone || '').replace(/\D/g, '');
  if (!clean) return null;
  const withCode = clean.length === 10 ? `57${clean}` : clean;
  return `https://wa.me/${withCode}?text=${encodeURIComponent(message)}`;
}

/**
 * computeCandidates — el cálculo puro, sin React.
 *
 * Se exporta aparte para que el Panel pueda mostrar el resumen del radar con
 * los pacientes y citas que YA cargó, sin disparar una segunda consulta de
 * 1.424 filas solo para pintar tres tarjetas.
 */
export function computeCandidates(patients = [], appointments = [], touches = {}) {
  const t = parseDateStr(todayStr());
  const today = todayStr();
  const future = new Set(
    appointments
      .filter((a) => a.date >= today && a.status !== 'cancelada' && a.patient_id)
      .map((a) => a.patient_id),
  );

  return patients
    .map((p) => {
      const days = daysSince(p.last_visit);
      const touchedAt = touches[p.id];
      const lastTouchDays = touchedAt ? Math.floor((t - new Date(touchedAt)) / DAY) : null;
      const hasFuture = future.has(p.id);
      const segment = segmentOf(p, days);
      return {
        id: p.id,
        name: p.full_name,
        phone: p.phone,
        email: p.email,
        city: p.city,
        status: p.status,
        medicalAlerts: p.medical_alerts,
        needsReview: p.needs_review,
        balance: Number(p.balance_due || 0),
        visits: Number(p.appointments_count || 0),
        spent: Number(p.total_spent || 0),
        lastVisit: p.last_visit,
        daysSinceVisit: days,
        segment,
        value: recoverableValue(p),
        reason: reasonFor(p, days, segment),
        score: scorePatient(p, hasFuture, lastTouchDays),
        hasFutureAppointment: hasFuture,
        contactable: Boolean(p.phone || p.email),
        touchedAt: touchedAt || null,
        lastTouchDays,
      };
    })
    .filter((c) => c.score > 0 && !c.hasFutureAppointment)
    .sort((a, b) => b.score - a.score);
}

/** Totales a partir de una lista ya calculada. */
export function summarize(candidates) {
  const bySegment = { saldo: [], abandono: [], dormido: [], primera: [] };
  for (const c of candidates) bySegment[c.segment]?.push(c);
  return {
    total: candidates.length,
    potential: candidates.reduce((s, c) => s + c.value, 0),
    debt: candidates.reduce((s, c) => s + c.balance, 0),
    bySegment,
    counts: Object.fromEntries(Object.entries(bySegment).map(([k, v]) => [k, v.length])),
    unreachable: candidates.filter((c) => !c.contactable).length,
  };
}

/**
 * useReactivation — devuelve la lista priorizada, los totales y la acción de
 * registrar un contacto.
 */
export function useReactivation() {
  const { tenant } = useAuth();
  const tenantId = tenant?.id;
  const { patients, loading: loadingPatients } = usePatients();
  const { appointments, loading: loadingAppts } = useAppointments();
  const [touches, setTouches] = useState({});
  const [persisted, setPersisted] = useState(true);

  // Historial de contactos. Si la tabla aún no existe en la base (migración
  // 037 sin aplicar), se degrada a almacenamiento local para no perder la
  // funcionalidad — y se marca `persisted:false` para poder avisarlo.
  useEffect(() => {
    let cancelled = false;
    const readLocal = () => {
      try { return JSON.parse(localStorage.getItem(LOCAL_TOUCH_KEY) || '{}'); } catch { return {}; }
    };
    (async () => {
      if (!tenantId) return;
      const { data, error } = await supabase
        .from('reactivation_touches')
        .select('patient_id, channel, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        logger.error('fetch reactivation_touches', error);
        setPersisted(false);
        setTouches(readLocal());
        return;
      }
      const map = {};
      for (const row of data || []) {
        if (!map[row.patient_id]) map[row.patient_id] = row.created_at;
      }
      setPersisted(true);
      setTouches(map);
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  const candidates = useMemo(
    () => computeCandidates(patients, appointments, touches),
    [patients, appointments, touches],
  );

  const registerTouch = useCallback(async (patientId, channel = 'whatsapp') => {
    const now = new Date().toISOString();
    setTouches((prev) => ({ ...prev, [patientId]: now }));
    if (!tenantId) return;
    const { error } = await supabase
      .from('reactivation_touches')
      .insert({ tenant_id: tenantId, patient_id: patientId, channel });
    if (error) {
      logger.error('insert reactivation_touch', error);
      setPersisted(false);
      try {
        const local = JSON.parse(localStorage.getItem(LOCAL_TOUCH_KEY) || '{}');
        local[patientId] = now;
        localStorage.setItem(LOCAL_TOUCH_KEY, JSON.stringify(local));
      } catch { /* modo privado */ }
    }
  }, [tenantId]);

  const summary = useMemo(() => summarize(candidates), [candidates]);

  return {
    candidates,
    summary,
    loading: (loadingPatients || loadingAppts) && patients.length === 0,
    registerTouch,
    touches,
    persisted,
  };
}
