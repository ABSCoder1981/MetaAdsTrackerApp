"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Wraps a wide table in a horizontally-scrollable container with fade hints
 * on whichever edge has more content — plain overflow-x-auto with no visual
 * cue reads as a bug ("content cut off") rather than "swipe for more" on a
 * phone, which is exactly what happened (user report: table looked broken
 * on mobile, it was actually just unscrolled).
 */
export function TableScroller({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function update() {
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }

    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  return (
    // No overflow-hidden here — a table cell (e.g. CampaignTable's property
    // popover) can position an absolutely-placed dropdown outside this box's
    // bounds, and clipping it would break that UI. Rounded corners without
    // overflow-hidden are fine visually since the table content itself is a
    // plain rectangle.
    <div className={`relative rounded-lg border border-border bg-surface ${className}`}>
      <div ref={ref} className="overflow-x-auto rounded-lg">
        {children}
      </div>
      {canScrollRight && (
        <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-surface to-transparent" />
      )}
      {canScrollLeft && (
        <div className="pointer-events-none absolute left-0 top-0 h-full w-8 bg-gradient-to-r from-surface to-transparent" />
      )}
    </div>
  );
}
