import React, { useState, useEffect } from 'react';
import { XIcon, VideoIcon } from './Icons';

interface GlobalVideoPromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (prompt: string) => void;
    initialPrompt: string;
}

const GlobalVideoPromptModal: React.FC<GlobalVideoPromptModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialPrompt
}) => {
    const [prompt, setPrompt] = useState(initialPrompt);

    useEffect(() => {
        setPrompt(initialPrompt);
    }, [initialPrompt]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(prompt);
        onClose();
    };

    const handleClear = () => {
        setPrompt('');
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-[600px] max-w-[90vw] max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                            <VideoIcon className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-100">全局视频提示词</h2>
                            <p className="text-xs text-zinc-500 mt-0.5">所有视频节点生成时会自动附加此提示词</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-100"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">
                                全局提示词内容
                            </label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="例如：高质量、电影感、专业摄影、4K分辨率..."
                                className="w-full h-48 px-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl text-zinc-300 placeholder-zinc-600 resize-none outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all leading-relaxed"
                            />
                            <p className="text-xs text-zinc-500 mt-2">
                                提示：此全局提示词会在每个视频节点的提示词之前添加
                            </p>
                        </div>

                        {/* Preview */}
                        {prompt && (
                            <div className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl">
                                <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2">
                                    生成时的完整提示词示例
                                </div>
                                <div className="text-sm text-zinc-400 leading-relaxed space-y-1">
                                    <div className="text-purple-400 font-medium">
                                        {prompt}
                                    </div>
                                    <div className="text-zinc-500">+</div>
                                    <div className="text-cyan-400 font-medium">
                                        [视频节点的提示词]
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-zinc-800">
                    <button
                        onClick={handleClear}
                        className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        清空
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg transition-all shadow-lg hover:shadow-purple-500/20"
                        >
                            保存
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GlobalVideoPromptModal;
