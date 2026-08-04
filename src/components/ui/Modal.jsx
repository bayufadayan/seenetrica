import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useBodyLock } from "../../hooks/useBodyLock";

const focusable = "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function Modal({ title, children, onClose, busy = false, className = "" }) {
  const dialogRef = useRef(null);
  const previousFocus = useRef(document.activeElement);
  useBodyLock(true);

  useEffect(() => {
    const dialog = dialogRef.current;
    const focusToRestore = previousFocus.current;
    const elements = () => [...(dialog?.querySelectorAll(focusable) || [])];
    elements()[0]?.focus();
    const keydown = (event) => {
      if (event.key === "Escape" && !busy) onClose();
      if (event.key !== "Tab") return;
      const items = elements();
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      focusToRestore?.focus?.();
    };
  }, [busy, onClose]);

  return (
    <div className={`wm-modal ${className}`} role="dialog" aria-modal="true" aria-labelledby="wm-modal-title">
      <button className="wm-modal-backdrop" type="button" aria-label="Close dialog" disabled={busy} onClick={onClose} />
      <section className="wm-modal-dialog" ref={dialogRef}>
        <header className="wm-modal-header">
          <h2 id="wm-modal-title">{title}</h2>
          <button className="wm-modal-close" type="button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X aria-hidden="true" /></button>
        </header>
        {children}
      </section>
    </div>
  );
}
