import { useState } from 'react';
import {
  ArrowLeft, Heart, MessageCircle, BadgeCheck, Stethoscope,
  Send, Sparkles, Users, Loader2,
} from 'lucide-react';
import { useFeed, useMyPractitioner } from '../../hooks/useFeed';

const CLINIC = import.meta.env.VITE_CLINIC_NAME || 'chiropract.co';

function timeAgo(iso) {
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'ahora';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 604800) return `hace ${Math.floor(s / 86400)} d`;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function Avatar({ photo, name, size = 44 }) {
  return (
    <div
      className="rounded-full bg-surface-container-high overflow-hidden flex-shrink-0 flex items-center justify-center text-on-surface-variant"
      style={{ width: size, height: size }}
    >
      {photo ? <img src={photo} alt={name} className="w-full h-full object-cover" /> : <Stethoscope size={size * 0.45} />}
    </div>
  );
}

function Composer({ me, onPublish }) {
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  if (!me) return null;

  if (!me.verified) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 flex items-center gap-3 text-sm text-on-surface-variant">
        <Sparkles size={18} className="text-primary flex-shrink-0" />
        Tu perfil está pendiente de verificación. Cuando el equipo lo apruebe podrás publicar en la red.
      </div>
    );
  }

  const submit = async () => {
    if (!content.trim() || busy) return;
    setBusy(true);
    try {
      await onPublish(content.trim());
      setContent('');
    } catch (e) {
      alert(e.message || 'No se pudo publicar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
      <div className="flex gap-3">
        <Avatar photo={me.photo_url} name={me.full_name} />
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Comparte un caso, técnica o consejo, ${me.title} ${me.full_name.split(' ')[0]}…`}
            rows={3}
            className="w-full resize-none bg-transparent text-on-surface text-sm focus:outline-none placeholder:text-on-surface-variant"
          />
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-outline-variant">
            <span className="text-xs text-on-surface-variant">{content.length}/1000</span>
            <button
              onClick={submit}
              disabled={!content.trim() || busy}
              className="inline-flex items-center gap-1.5 clinical-gradient text-on-primary px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40 transition-opacity"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Publicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PostCard({ post, canInteract, onLike }) {
  return (
    <article className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5">
      <header className="flex items-center gap-3">
        <a href={`#dr/${post.author_slug}`}><Avatar photo={post.author_photo} name={post.author_name} /></a>
        <div className="min-w-0">
          <a href={`#dr/${post.author_slug}`} className="flex items-center gap-1 hover:underline">
            <span className="font-bold text-on-surface truncate">{post.author_title} {post.author_name}</span>
            {post.author_verified && <BadgeCheck size={15} className="text-primary flex-shrink-0" />}
          </a>
          <p className="text-xs text-on-surface-variant">{timeAgo(post.created_at)}</p>
        </div>
      </header>

      <p className="text-on-surface mt-3 leading-relaxed whitespace-pre-line">{post.content}</p>

      {post.image_url && (
        <img src={post.image_url} alt="" className="mt-3 rounded-xl w-full object-cover max-h-[480px]" />
      )}

      <footer className="flex items-center gap-5 mt-4 pt-3 border-t border-outline-variant">
        <button
          onClick={() => canInteract && onLike(post.id)}
          disabled={!canInteract}
          className={`flex items-center gap-1.5 text-sm transition-colors ${
            post.liked_by_me ? 'text-rose-600' : 'text-on-surface-variant hover:text-rose-600'
          } ${canInteract ? '' : 'cursor-default'}`}
          title={canInteract ? '' : 'Solo médicos verificados pueden interactuar'}
        >
          <Heart size={18} className={post.liked_by_me ? 'fill-rose-600' : ''} /> {post.likes_count}
        </button>
        <span className="flex items-center gap-1.5 text-sm text-on-surface-variant">
          <MessageCircle size={18} /> {post.comments_count}
        </span>
      </footer>
    </article>
  );
}

export default function FeedPage({ onBack }) {
  const { me } = useMyPractitioner();
  const { posts, loading, hasMore, loadMore, publish, toggleLike } = useFeed();
  const canInteract = !!me?.verified;

  return (
    <div className="min-h-screen bg-surface-container-low">
      <header className="bg-surface-container-lowest border-b border-outline-variant sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-on-surface hover:text-primary transition-colors">
            <ArrowLeft size={18} /> <span className="font-bold">{CLINIC}</span>
          </button>
          <a href="#directorio" className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            <Users size={16} /> Directorio
          </a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className="text-center pb-1">
          <h1 className="font-display text-2xl font-semibold text-on-surface">Comunidad</h1>
          <p className="text-sm text-on-surface-variant">La red de quiroprácticos de Latinoamérica</p>
        </div>

        <Composer me={me} onPublish={publish} />

        {loading ? (
          <div className="space-y-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-2xl h-40 animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-on-surface-variant">
            <MessageCircle size={36} className="mx-auto mb-3 opacity-50" />
            <p>Aún no hay publicaciones. ¡Sé el primero!</p>
          </div>
        ) : (
          <>
            {posts.map((p) => (
              <PostCard key={p.id} post={p} canInteract={canInteract} onLike={toggleLike} />
            ))}
            {hasMore && (
              <button
                onClick={loadMore}
                className="w-full py-3 text-sm font-semibold text-primary hover:bg-surface-container-lowest rounded-xl transition-colors"
              >
                Cargar más
              </button>
            )}
          </>
        )}

        {!me && !loading && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 text-center">
            <p className="text-sm text-on-surface-variant mb-3">¿Eres quiropráctico? Únete a la conversación.</p>
            <a href="#crm" className="inline-block clinical-gradient text-on-primary px-6 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
              Crear mi cuenta
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
