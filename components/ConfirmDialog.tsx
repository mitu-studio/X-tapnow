import React from 'react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    isDanger?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmLabel = '确认',
    cancelLabel = '取消',
    isDanger = false
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onMouseDown={onCancel}>
            <div className="bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200" onMouseDown={e => e.stopPropagation()}>
                <div className="p-6">
                    <h3 className={`text-lg font-semibold mb-2 ${isDanger ? 'text-red-400' : 'text-zinc-100'}`}>{title}</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">{message}</p>
                </div>
                <div className="px-6 py-4 bg-zinc-900/50 flex items-center justify-end gap-3 border-t border-zinc-800/50">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-sm font-bold text-white rounded-lg transition-colors shadow-lg ${isDanger
                                ? 'bg-red-500/80 hover:bg-red-500 border border-red-500/50 shadow-red-500/10'
                                : 'bg-cyan-600 hover:bg-cyan-500 border border-cyan-500/50 shadow-cyan-500/20'
                            }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
