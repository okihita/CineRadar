'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LightboxCarouselProps {
  urls: string[];
  initialIndex: number;
  onClose: () => void;
}

export function LightboxCarousel({ urls, initialIndex, onClose }: LightboxCarouselProps) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && index > 0) {
        setIndex(index - 1);
      } else if (e.key === 'ArrowRight' && index < urls.length - 1) {
        setIndex(index + 1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [index, urls.length, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-20"
      >
        <X className="w-5 h-5" />
      </button>

      {/* ESC hint */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
        <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest">
          Press ESC to close · ← → to navigate
        </span>
      </div>

      {/* Image counter */}
      {urls.length > 1 && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20">
          <span className="text-white/50 text-[11px] font-mono font-bold">
            {index + 1} / {urls.length}
          </span>
        </div>
      )}

      {/* Left arrow */}
      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex(index - 1); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-20"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Right arrow */}
      {index < urls.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex(index + 1); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-20"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Main image */}
      <div
        className="relative w-[90vw] h-[75vh] max-w-[1200px]"
        onClick={(e) => e.stopPropagation()}
      >
        <LightboxImage url={urls[index]} key={index} />
      </div>

      {/* Bottom thumbnail strip */}
      {urls.length > 1 && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          {urls.map((url, idx) => (
            <button
              key={idx}
              onClick={() => setIndex(idx)}
              className={cn(
                'relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0',
                idx === index
                  ? 'border-white shadow-lg scale-110'
                  : 'border-white/20 hover:border-white/50 opacity-50 hover:opacity-80',
              )}
            >
              <Image
                src={url}
                alt=""
                fill
                className="object-cover"
                sizes="56px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Image with loading spinner ────────────────────────────

function LightboxImage({ url }: { url: string }) {
  const [loading, setLoading] = useState(true);

  return (
    <>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-white/40" />
        </div>
      )}
      <Image
        src={url}
        alt=""
        fill
        className={cn(
          'object-contain transition-opacity duration-300',
          loading ? 'opacity-0' : 'opacity-100',
        )}
        sizes="90vw"
        onLoad={() => setLoading(false)}
      />
    </>
  );
}
