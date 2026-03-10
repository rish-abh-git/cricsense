import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);

        setTimeout(() => {
            setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 3000);
    }, []);

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-full max-w-[90%] sm:max-w-md pointer-events-none">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`
              pointer-events-auto flex items-center gap-3 p-4 rounded-2xl shadow-lg border 
              animate-in slide-in-from-bottom-2 fade-in duration-300
              ${toast.type === 'success' ? 'bg-white dark:bg-gray-800 border-green-100 dark:border-green-900/50' : ''}
              ${toast.type === 'error' ? 'bg-white dark:bg-gray-800 border-red-100 dark:border-red-900/50' : ''}
              ${toast.type === 'info' ? 'bg-white dark:bg-gray-800 border-primary-100 dark:border-primary-900/50' : ''}
            `}
                    >
                        <div className={`
              p-2 rounded-xl
              ${toast.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-500' : ''}
              ${toast.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : ''}
              ${toast.type === 'info' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-500' : ''}
            `}>
                            {toast.type === 'success' && <CheckCircle size={18} />}
                            {toast.type === 'error' && <XCircle size={18} />}
                            {toast.type === 'info' && <Info size={18} />}
                        </div>

                        <p className="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {toast.message}
                        </p>

                        <button
                            onClick={() => removeToast(toast.id)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
