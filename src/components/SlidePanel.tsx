"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { playMotion } from '@/lib/motion';

// Keep visited views mounted so forms, calendar position and drafts survive tabs.
export default function SlidePanel({ active, direction, children, className = '', name }: {
  active: boolean; direction: number; children: ReactNode; className?: string; name: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [present, setPresent] = useState(active);
  const interrupted = useRef<Keyframe | null>(null);
  useLayoutEffect(() => {
    const node = element.current;
    if (!node || (!active && node.hidden)) return;
    const offset = Math.min(node.getBoundingClientRect().width, 480);
    const from = interrupted.current ?? { transform: active ? `translateX(${direction * offset}px)` : 'none', opacity: 1 };
    const to = { transform: active ? 'none' : `translateX(${-direction * offset}px)`, opacity: active ? 1 : .3 };
    interrupted.current = null;
    if (active) setPresent(true);
    const animation = playMotion(node, [from, to]);
    if (!animation) { setPresent(active); return; }
    void animation.finished.then(() => { if (!active) setPresent(false); }, () => {});
    return () => {
      if (animation.playState === 'running') {
        const style = getComputedStyle(node);
        interrupted.current = { transform: style.transform, opacity: style.opacity };
      }
      animation.cancel();
    };
  }, [active, direction]);

  return <div ref={element} className={`slide-panel ${className}`} data-view={name}
    data-exiting={!active && present ? 'true' : undefined} hidden={!active && !present}
    inert={!active} aria-hidden={!active}>{children}</div>;
}
