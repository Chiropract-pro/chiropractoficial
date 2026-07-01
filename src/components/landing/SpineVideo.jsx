import { useRef, useEffect, useState } from 'react';

export default function SpineVideo() {
  const videoRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    const onReady = () => {
      video.pause();
      video.currentTime = 0;
      setLoaded(true);
    };

    if (video.readyState >= 2) {
      onReady();
    } else {
      video.addEventListener('loadeddata', onReady, { once: true });
    }

    return () => video.removeEventListener('loadeddata', onReady);
  }, []);

  useEffect(() => {
    if (!loaded) return;

    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        const video = videoRef.current;
        if (!video || !video.duration) return;

        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollProgress = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
        const targetTime = scrollProgress * video.duration;

        if (Math.abs(video.currentTime - targetTime) > 0.05) {
          video.currentTime = targetTime;
        }

        ticking = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loaded]);

  return (
    <div className="fixed inset-0 z-0">
      <video
        ref={videoRef}
        src="/spine.mp4"
        muted
        playsInline
        preload="auto"
        className="w-full h-full object-cover"
        style={{ filter: 'brightness(0.15) contrast(1.3) saturate(0.3)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/60 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/70 pointer-events-none" />
    </div>
  );
}
