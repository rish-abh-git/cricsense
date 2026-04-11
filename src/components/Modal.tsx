import React, { useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import Button from './Button';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm?: () => void;
    secondaryLabel?: string;
    onSecondary?: () => void;
    type?: 'danger' | 'info' | 'success';
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    message,
    confirmLabel = 'Confirm',
    onConfirm,
    secondaryLabel,
    onSecondary,
    type = 'info'
}) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const typeConfig = {
        danger: {
            icon: <AlertTriangle className="text-red-500" size={24} />,
            btnVariant: 'danger' as const,
            bg: 'bg-red-50 dark:bg-red-900/10'
        },
        success: {
            icon: <CheckCircle className="text-green-500" size={24} />,
            btnVariant: 'primary' as const,
            bg: 'bg-green-50 dark:bg-green-900/10'
        },
        info: {
            icon: <Info className="text-primary-500" size={24} />,
            btnVariant: 'primary' as const,
            bg: 'bg-primary-50 dark:bg-primary-900/10'
        }
    };

    const currentType = typeConfig[type];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            <div className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-2xl ${currentType.bg}`}>
                            {currentType.icon}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <h3 className="text-xl font-black text-gray-900 dark:text-gray-50 mb-2">
                        {title}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                        {message}
                    </p>
                </div>

                <div className="p-6 bg-gray-50 dark:bg-gray-850 flex flex-col-reverse sm:flex-row gap-3">
                    <Button variant="outline" fullWidth onClick={onClose} className="flex-1">
                        Cancel
                    </Button>
                    {secondaryLabel && (
                        <Button 
                            variant="secondary" 
                            fullWidth 
                            onClick={() => {
                                onSecondary?.();
                                onClose();
                            }} 
                            className="flex-1"
                        >
                            {secondaryLabel}
                        </Button>
                    )}
                    <Button
                        variant={currentType.btnVariant}
                        fullWidth
                        onClick={() => {
                            onConfirm?.();
                            onClose();
                        }}
                        className="flex-[1.5]"
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default Modal;
