'use client';
import { createContext, useContext, useState, ReactNode } from 'react';

type ConfirmFunction = (message: string) => Promise<boolean>;

interface ConfirmDialogContextType {
    confirm: ConfirmFunction;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType>({
    confirm: async () => false
});

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [resolver, setResolver] = useState<{ resolve: (val: boolean) => void } | null>(null);

    const confirm: ConfirmFunction = (msg) => {
        setMessage(msg);
        setIsOpen(true);
        return new Promise<boolean>((resolve) => {
            setResolver({ resolve });
        });
    };

    const handleConfirm = (val: boolean) => {
        setIsOpen(false);
        if (resolver) {
            resolver.resolve(val);
            setResolver(null);
        }
    };

    return (
        <ConfirmDialogContext.Provider value={{ confirm }}>
            {children}
            {isOpen && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-auto overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                                <i className="fas fa-exclamation-triangle text-xl"></i>
                            </div>
                            <h3 className="text-lg font-black text-gray-900 mb-2">Confirm Action</h3>
                            <p className="text-sm font-bold text-gray-600">{message}</p>
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => handleConfirm(false)}
                                className="px-5 py-2.5 text-xs font-black text-gray-500 uppercase tracking-widest hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleConfirm(true)}
                                className="px-5 py-2.5 text-xs font-black text-white bg-red-600 uppercase tracking-widest hover:bg-red-700 rounded-xl shadow-md cursor-pointer transition-colors"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmDialogContext.Provider>
    );
}

export const useConfirm = () => useContext(ConfirmDialogContext);
