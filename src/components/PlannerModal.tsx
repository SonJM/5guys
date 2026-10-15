"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { playMotion } from '@/lib/motion';

// Wait for a closing modal's history entry to be removed before opening another.
// Otherwise a delayed popstate can dismiss the newly opened editor.
let historyRestored: Promise<void> = Promise.resolve();

function modalMotion(node: HTMLDialogElement, editor: boolean, closing = false) {
  const mobile = window.matchMedia('(max-width: 639px)').matches;
  const offset = mobile ? editor ? 'translateX(100%)' : 'translateY(36px)' : 'scale(.98)';
  const resting = { transform: 'none', opacity: 1 };
  const shifted = { transform: offset, opacity: mobile && editor ? 1 : 0 };
  return playMotion(node, closing ? [resting, shifted] : [shifted, resting], closing ? 180 : 260, false);
}

export default function PlannerModal({ title, editor = false, busy = false, onClose, children, footer }: {
  title: string;
  editor?: boolean;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  const saving = useRef(busy);
  const mode = useRef(editor);
  const motion = useRef<Animation | null>(null);
  const closing = useRef(false);
  useEffect(() => { close.current = onClose; saving.current = busy; }, [onClose, busy]);
  const dismiss = useCallback(() => {
    const node = dialog.current;
    if (!node || saving.current || closing.current) return;
    closing.current = true;
    node.inert = true;
    node.classList.add('planner-modal-closing');
    motion.current?.cancel();
    const animation = modalMotion(node, mode.current, true);
    motion.current = animation;
    if (animation) void animation.finished.then(() => close.current(), () => {});
    else close.current();
  }, []);
  useLayoutEffect(() => {
    mode.current = editor;
    const node = dialog.current;
    if (!node?.open || closing.current) return;
    motion.current?.cancel();
    motion.current = modalMotion(node, editor);
    void motion.current?.finished.catch(() => {});
  }, [editor]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    let active = true;
    let cleanup: (() => void) | undefined;
    void historyRestored.then(() => {
      if (!active) return;
      const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const previousOverflow = document.body.style.overflow;
      const previousMarker = document.body.getAttribute('data-planner-modal');
      const url = window.location.href;
      const marker = crypto.randomUUID();
      const entry = { ...window.history.state, plannerModal: marker };
      window.history.pushState(entry, '', url);
      document.body.style.overflow = 'hidden';
      document.body.setAttribute('data-planner-modal', 'open');
      element.showModal();
      const resize = () => {
        const viewport = window.visualViewport;
        element.style.setProperty('--planner-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
        element.style.setProperty('--planner-viewport-top', `${viewport?.offsetTop ?? 0}px`);
      };
      const back = () => {
        if (window.history.state?.plannerModal === marker) return;
        if (saving.current) window.history.pushState(entry, '', url);
        else dismiss();
      };
      resize();
      motion.current = modalMotion(element, mode.current);
      void motion.current?.finished.catch(() => {});
      window.addEventListener('popstate', back);
      window.addEventListener('resize', resize);
      window.visualViewport?.addEventListener('resize', resize);
      window.visualViewport?.addEventListener('scroll', resize);
      cleanup = () => {
        window.removeEventListener('popstate', back);
        window.removeEventListener('resize', resize);
        window.visualViewport?.removeEventListener('resize', resize);
        window.visualViewport?.removeEventListener('scroll', resize);
        motion.current?.cancel();
        element.inert = false;
        element.close();
        document.body.style.overflow = previousOverflow;
        if (previousMarker === null) document.body.removeAttribute('data-planner-modal');
        else document.body.setAttribute('data-planner-modal', previousMarker);
        if (window.location.href === url && window.history.state?.plannerModal === marker) {
          historyRestored = new Promise(resolve => {
            window.addEventListener('popstate', () => resolve(), { once: true });
            window.history.back();
          });
        }
        if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      };
    });
    return () => {
      active = false;
      cleanup?.();
    };
  }, [dismiss]);

  return createPortal(
    <dialog ref={dialog} className={`planner-modal ${editor ? 'planner-modal-editor' : 'planner-modal-detail'}`}
      aria-labelledby="planner-modal-title" aria-modal="true" aria-busy={busy}
      onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onClick={(event) => {
        if (busy || event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dismiss();
      }}>
      <header className="planner-modal-header"><h2 id="planner-modal-title">{title}</h2><button type="button" autoFocus disabled={busy} className="ghost-button" aria-label="닫기" onClick={dismiss}>닫기</button></header>
      <div className="planner-modal-content">{children}</div>
      {footer && <footer className="planner-modal-footer">{footer}</footer>}
    </dialog>, document.body,
  );
}
