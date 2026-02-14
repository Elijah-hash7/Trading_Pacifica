'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';

export type WalletCarouselItem = {
  id: string;
  title: string;
  subtitle?: string;
  balanceLabel: string;
  secondaryLabel?: string;
  secondaryTone?: 'muted' | 'positive' | 'negative';
  badge?: string;
  showDepositAction?: boolean;
};

export default function WalletBalanceCarousel({
  items,
  activeIndex,
  onActiveIndexChange,
  onDeposit,
  className,
}: {
  items: WalletCarouselItem[];
  activeIndex?: number;
  onActiveIndexChange?: (next: number) => void;
  onDeposit?: () => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const controlled = typeof activeIndex === 'number';
  const [internalIndex, setInternalIndex] = useState(0);

  const index = controlled ? (activeIndex as number) : internalIndex;

  const total = items.length;

  const scrollToIndex = useCallback(
    (next: number) => {
      const el = containerRef.current;
      if (!el) return;
      const clamped = Math.max(0, Math.min(total - 1, next));
      const child = el.children.item(clamped) as HTMLElement | null;
      if (!child) return;
      child.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    },
    [total]
  );

  const applyTransforms = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    if (!children.length) return;

    const mid = el.scrollLeft + el.clientWidth / 2;
    const maxRotate = 18;
    const maxScaleDown = 0.06;

    children.forEach((child) => {
      const childMid = child.offsetLeft + child.clientWidth / 2;
      const dx = childMid - mid;
      const width = Math.max(child.clientWidth, 1);
      const t = Math.max(-1, Math.min(1, dx / width));
      const rotateY = -t * maxRotate;
      const scale = 1 - Math.min(1, Math.abs(t)) * maxScaleDown;
      const opacity = 1 - Math.min(1, Math.abs(t)) * 0.18;

      child.style.transform = `perspective(1100px) rotateY(${rotateY.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      child.style.opacity = opacity.toFixed(3);
    });
  }, []);

  const setIndex = (next: number) => {
    if (!controlled) setInternalIndex(next);
    onActiveIndexChange?.(next);
  };

  const dots = useMemo(() => {
    return Array.from({ length: total }, (_, i) => i);
  }, [total]);

  useEffect(() => {
    if (!controlled) return;
    scrollToIndex(activeIndex as number);
  }, [controlled, activeIndex, scrollToIndex]);

  useEffect(() => {
    applyTransforms();
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [applyTransforms, items.length]);

  return (
    <div className={className ?? 'px-4'}>
      <div
        ref={containerRef}
        onScroll={() => {
          const el = containerRef.current;
          if (!el) return;
          const children = Array.from(el.children) as HTMLElement[];
          if (!children.length) return;

          const mid = el.scrollLeft + el.clientWidth / 2;
          let best = 0;
          let bestDist = Number.POSITIVE_INFINITY;

          children.forEach((child, i) => {
            const childMid = child.offsetLeft + child.clientWidth / 2;
            const dist = Math.abs(childMid - mid);
            if (dist < bestDist) {
              bestDist = dist;
              best = i;
            }
          });

          if (best !== index) {
            setIndex(best);
          }

          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          rafRef.current = requestAnimationFrame(() => {
            applyTransforms();
          });
        }}
        className="flex gap-0 overflow-x-auto snap-x snap-mandatory scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [perspective:1100px]"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="min-w-full snap-center bg-zinc-900/80 rounded-2xl p-6 border border-zinc-800/50 relative will-change-transform transition-[transform,opacity] duration-200"
          >
            <div className="flex justify-between items-start mb-1">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500 uppercase tracking-wider">{item.title}</span>
                {item.subtitle ? <span className="text-xs text-zinc-500">{item.subtitle}</span> : null}
              </div>
              {item.badge ? <span className="text-xs text-zinc-500">{item.badge}</span> : null}
            </div>

            <div className="text-3xl font-bold tracking-tight mb-2">{item.balanceLabel}</div>

            {item.secondaryLabel ? (
              <div
                className={`text-sm font-mono font-semibold ${
                  item.secondaryTone === 'positive'
                    ? 'text-emerald-400'
                    : item.secondaryTone === 'negative'
                      ? 'text-red-400'
                      : 'text-zinc-400'
                }`}
              >
                {item.secondaryLabel}
              </div>
            ) : null}

            {item.showDepositAction ? (
              <button
                type="button"
                onClick={onDeposit}
                className="absolute right-5 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl bg-zinc-800/70 hover:bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-200"
                aria-label="Deposit"
              >
                <Plus className="w-5 h-5" />
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {total > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-2">
          {dots.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollToIndex(i)}
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                i === index ? 'bg-emerald-500' : 'bg-zinc-700 hover:bg-zinc-600'
              }`}
              aria-label={`Wallet ${i + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
