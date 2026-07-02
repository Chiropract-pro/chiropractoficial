import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const PAGE = 15;

/**
 * El practitioner_profile del usuario logueado (para saber si puede publicar).
 */
export function useMyPractitioner() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (mounted) { setMe(null); setLoading(false); } return; }
      const { data } = await supabase
        .from('practitioner_profiles')
        .select('id, slug, full_name, title, photo_url, verified')
        .eq('user_id', user.id)
        .maybeSingle();
      if (mounted) { setMe(data || null); setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  return { me, loading };
}

/**
 * Feed de la red profesional. Si p_authorId se pasa, solo posts de ese médico.
 */
export function useFeed(authorId = null) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = useCallback(async (before = null) => {
    const { data, error } = await supabase.rpc('get_feed', {
      p_limit: PAGE,
      p_before: before,
      p_author_id: authorId,
    });
    if (error) { logger.error('get_feed', error); return []; }
    return data || [];
  }, [authorId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await fetchPage(null);
    setPosts(rows);
    setHasMore(rows.length === PAGE);
    setLoading(false);
  }, [fetchPage]);

  useEffect(() => { refresh(); }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!posts.length) return;
    const last = posts[posts.length - 1];
    const rows = await fetchPage(last.created_at);
    setPosts((prev) => [...prev, ...rows]);
    setHasMore(rows.length === PAGE);
  }, [posts, fetchPage]);

  const publish = useCallback(async (content, imageUrl = null) => {
    const { error } = await supabase.rpc('create_post', { p_content: content, p_image_url: imageUrl });
    if (error) throw error;
    await refresh();
  }, [refresh]);

  // Like optimista con reconciliación
  const toggleLike = useCallback(async (postId) => {
    setPosts((prev) => prev.map((p) =>
      p.id === postId
        ? { ...p, liked_by_me: !p.liked_by_me, likes_count: p.likes_count + (p.liked_by_me ? -1 : 1) }
        : p
    ));
    const { data, error } = await supabase.rpc('toggle_like', { p_post_id: postId });
    if (error) {
      logger.error('toggle_like', error);
      // revertir
      setPosts((prev) => prev.map((p) =>
        p.id === postId
          ? { ...p, liked_by_me: !p.liked_by_me, likes_count: p.likes_count + (p.liked_by_me ? -1 : 1) }
          : p
      ));
      throw error;
    }
    // reconciliar con el valor real del servidor
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, liked_by_me: data } : p)));
  }, []);

  return { posts, loading, hasMore, refresh, loadMore, publish, toggleLike };
}
