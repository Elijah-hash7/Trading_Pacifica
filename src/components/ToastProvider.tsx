"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastVariant = "info" | "success" | "warning" | "error";

type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ToastOptions = {
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastContextValue = {
  pushToast: (message: string, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<ToastVariant, string> = {
  info: "border-zinc-700/60 bg-zinc-900/95 text-zinc-100",
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  error: "border-rose-500/40 bg-rose-500/10 text-rose-100",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const pushToast = useCallback((message: string, options?: ToastOptions) => {
    const id = `${Date.now()}-${counterRef.current++}`;
    const toast: Toast = {
      id,
      message,
      variant: options?.variant ?? "info",
    };

    setToasts((prev) => [...prev, toast]);

    const durationMs = options?.durationMs ?? 3200;
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, durationMs);
  }, []);

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed left-4 right-4 bottom-24 z-[60] space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`mx-auto w-full max-w-xs rounded-lg border px-3 py-1.5 text-xs shadow-lg backdrop-blur ${variantStyles[toast.variant]}`}
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
