import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const showToast = useCallback((message, type = "success") => {
    const id = ++nextId.current;
    setToasts((items) => [...items, { id, message, type }]);
    window.setTimeout(
      () => setToasts((items) => items.filter((item) => item.id !== id)),
      3200,
    );
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((toast) => (
          <div
            className={`toast ${toast.type === "error" ? "is-error" : ""}`}
            key={toast.id}
          >
            {toast.type === "error" ? (
              <CircleAlert aria-hidden="true" />
            ) : (
              <CircleCheck aria-hidden="true" />
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider.");
  return value;
}
