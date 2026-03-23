import React, { useState, useEffect, useRef } from 'react';

interface InputDialogProps {
    isOpen: boolean;
    title: string;
    defaultValue: string;
    defaultFontSize?: number;
    onConfirm: (value: string, fontSize: number) => void;
    onCancel: () => void;
    placeholder?: string;
}

const InputDialog: React.FC<InputDialogProps> = ({
    isOpen,
    title,
    defaultValue,
    defaultFontSize = 36,
    onConfirm,
    onCancel,
    placeholder = '请输入内容...'
}) => {
    const [value, setValue] = useState(defaultValue);
    const [fontSize, setFontSize] = useState(defaultFontSize);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setValue(defaultValue);
            setFontSize(defaultFontSize);
            // Focus after animation
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, defaultValue, defaultFontSize]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(value, fontSize);
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onMouseDown={onCancel}>
            <div className="bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200" onMouseDown={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>

                        <div className="space-y-2">
                            <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider">文字内容</label>
                            <input
                                ref={inputRef}
                                type="text"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder={placeholder}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#4a90d9]/50 focus:border-[#4a90d9]/50 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider">字号大小 (px)</label>
                            <input
                                type="number"
                                value={fontSize}
                                onChange={(e) => setFontSize(Number(e.target.value))}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#4a90d9]/50 focus:border-[#4a90d9]/50 transition-all"
                            />
                        </div>
                    </div>
                    <div className="px-6 py-4 bg-zinc-900/50 flex items-center justify-end gap-3 border-t border-zinc-800/50">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-bold text-white bg-[#4a90d9] hover:bg-[#357abd] rounded-lg transition-colors shadow-lg shadow-[#4a90d9]/20"
                        >
                            确认
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InputDialog;
