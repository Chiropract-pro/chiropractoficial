import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

/**
 * Directorio público de médicos registrados.
 */
export function usePractitioners({ city, specialty } = {}) {
  const [practitioners, setPractitioners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    supabase
      .rpc('get_practitioners', {
        p_city: city || null,
        p_specialty: specialty || null,
        p_limit: 100,
      })
      .then(({ data, error }) => {
        if (error) logger.error('get_practitioners', error);
        if (mounted) setPractitioners(data || []);
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [city, specialty]);

  return { practitioners, loading };
}

/**
 * Un médico por su slug (para la página de perfil).
 */
export function usePractitioner(slug) {
  const [practitioner, setPractitioner] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) { setLoading(false); return; }
    let mounted = true;
    setLoading(true);
    supabase
      .from('practitioner_profiles')
      .select('*')
      .eq('slug', slug)
      .eq('is_public', true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) logger.error('usePractitioner', error);
        if (mounted) setPractitioner(data || null);
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [slug]);

  return { practitioner, loading };
}
