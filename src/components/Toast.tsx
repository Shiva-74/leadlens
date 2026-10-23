import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'loading';
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastItem['type'], durationMs?: number) => string;
  updateToast: (id: string, message: string, type?: ToastItem['type']) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastItem['type'] = 'info', durationMs = 4000) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, type, message }]);
      if (type !== 'loading' && durationMs > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, durationMs);
      }
      return id;
    },
    [dismissToast]
  );

  const updateToast = useCallback(
    (id: string, message: string, type?: ToastItem['type']) => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, message, type: type ?? t.type } : t))
      );
      if (type && type !== 'loading') {
        setTimeout(() => {
          dismissToast(id);
        }, 3500);
      }
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, updateToast, dismissToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0 no-print">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center justify-between gap-3 bg-white border border-[#E7E5E0] rounded-[10px] px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.08)] text-[#1C1B19]"
          >
            <div className="flex items-center gap-2.5 text-sm font-medium">
              {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#0F766E] shrink-0" />}
              {t.type === 'error' && <AlertCircle className="w-4 h-4 text-[#B42318] shrink-0" />}
              {t.type === 'loading' && (
                <Loader2 className="w-4 h-4 text-[#0F766E] animate-spin shrink-0" />
              )}
              {t.type === 'info' && <CheckCircle2 className="w-4 h-4 text-[#5F5C55] shrink-0" />}
              <span>{t.message}</span>
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="text-[#8C8980] hover:text-[#1C1B19] p-1 rounded"
              aria-label="Close notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}