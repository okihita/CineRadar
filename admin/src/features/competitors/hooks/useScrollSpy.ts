import { useCallback, useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';

interface UseScrollSpyOptions {
  /** Re-run observer setup when this changes (e.g. loading state) */
  enabled: boolean;
  /** Additional dependency to re-create observer (e.g. data ref) */
  dataDep: unknown;
}

/**
 * Manages the IntersectionObserver scroll spy and programmatic scroll-to-date
 * for the tweet archive page.
 *
 * Returns:
 * - currentDateInView: the date currently visible at the top of the viewport
 * - scrollToDate: programmatic scroll to a date section
 */
export function useScrollSpy({ enabled, dataDep }: UseScrollSpyOptions) {
  const [currentDateInView, setCurrentDateInView] = useState<Date | undefined>(new Date());
  const isManualScrolling = useRef(false);
  const suppressObserverUntil = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Set up / tear down observer when data loads
  useEffect(() => {
    if (!enabled) return;

    const rafId = requestAnimationFrame(() => {
      const sections = Array.from(document.querySelectorAll('section[data-date]'));
      if (sections.length === 0) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (isManualScrolling.current) return;
          const now = Date.now();
          if (now < suppressObserverUntil.current) return;

          let topEntry: { element: Element; dateStr: string } | null = null;

          for (const entry of entries) {
            if (entry.isIntersecting) {
              const dateStr = entry.target.getAttribute('data-date');
              if (dateStr && dateStr !== 'unknown') {
                const rect = entry.boundingClientRect;
                if (!topEntry || Math.abs(rect.top) < Math.abs(topEntry.element.getBoundingClientRect().top)) {
                  topEntry = { element: entry.target, dateStr };
                }
              }
            }
          }

          if (topEntry) {
            setCurrentDateInView(parseISO(topEntry.dateStr));
          }
        },
        { threshold: 0, rootMargin: '-80px 0px -60% 0px' },
      );

      sections.forEach(section => observer.observe(section));
      observerRef.current = observer;
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
    }, [enabled, dataDep]);

  const scrollToDate = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const element = document.getElementById(`date-section-${dateStr}`)
      || document.querySelector(`section[data-date="${dateStr}"]`);

    if (!element) return;

    isManualScrolling.current = true;
    setCurrentDateInView(date);
    suppressObserverUntil.current = Date.now() + 2500;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const scrollContainer = document.querySelector('main') as HTMLElement | null;
    if (scrollContainer) {
      const rect = element.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      scrollContainer.scrollTop = scrollContainer.scrollTop + rect.top - containerRect.top - 80;
    }

    setTimeout(() => {
      isManualScrolling.current = false;
      const sections = Array.from(document.querySelectorAll('section[data-date]'));
      if (observerRef.current) {
        sections.forEach(section => observerRef.current!.observe(section));
      }
    }, 1500);
  }, []);

  return { currentDateInView, setCurrentDateInView, scrollToDate };
}
