import { useEffect } from "react";

export function useBodyLock(locked, className = "is-modal-open") {
  useEffect(() => {
    if (!locked) return undefined;
    document.body.classList.add(className);
    return () => document.body.classList.remove(className);
  }, [locked, className]);
}
