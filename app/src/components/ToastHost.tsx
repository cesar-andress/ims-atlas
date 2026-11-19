import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ToastContext } from "../state/toastContext";

type Toast = { id: number; message: string };

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((message: string) => {
    const id = ++seq;
    setItems((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-host" aria-live="polite" data-testid="toast-host">
        {items.map((t) => (
          <div key={t.id} className="toast" data-testid="toast">
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
