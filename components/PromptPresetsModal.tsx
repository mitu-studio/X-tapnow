import React, { useState, useEffect } from 'react';
import { XIcon, PlusIcon, Trash2Icon, CopyIcon, CheckIcon } from './Icons';

interface PromptPreset {
    id: string;
    name: string;
    content: string;
}

interface PromptPresetsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PromptPresetsModal: React.FC<PromptPresetsModalProps> = ({ isOpen, onClose }) => {
    const [presets, setPresets] = useState<PromptPreset[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editContent, setEditContent] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // 从 localStorage 加载预设
    useEffect(() => {
        const stored = localStorage.getItem('prompt_presets');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setPresets(parsed);
            } catch (e) {
                console.error('Failed to parse prompt presets:', e);
            }
        }
    }, []);

    // 保存预设到 localStorage
    const savePresets = (newPresets: PromptPreset[]) => {
        setPresets(newPresets);
        localStorage.setItem('prompt_presets', JSON.stringify(newPresets));
    };

    // 添加新预设
    const handleAddPreset = () => {
        const newPreset: PromptPreset = {
            id: `preset-${Date.now()}`,
            name: '新预设',
            content: ''
        };
        savePresets([...presets, newPreset]);
        setEditingId(newPreset.id);
        setEditName(newPreset.name);
        setEditContent(newPreset.content);
    };

    // 删除预设
    const handleDeletePreset = (id: string) => {
        savePresets(presets.filter(p => p.id !== id));
        if (editingId === id) {
            setEditingId(null);
        }
    };

    // 开始编辑
    const handleStartEdit = (preset: PromptPreset) => {
        setEditingId(preset.id);
        setEditName(preset.name);
        setEditContent(preset.content);
    };

    // 保存编辑
    const handleSaveEdit = () => {
        if (!editingId) return;

        const updated = presets.map(p =>
            p.id === editingId
                ? { ...p, name: editName, content: editContent }
                : p
        );
        savePresets(updated);
        setEditingId(null);
    };

    // 取消编辑
    const handleCancelEdit = () => {
        setEditingId(null);
        setEditName('');
        setEditContent('');
    };

    // 复制到剪贴板
    const handleCopy = async (preset: PromptPreset) => {
        try {
            await navigator.clipboard.writeText(preset.content);
            setCopiedId(preset.id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-[#1a1a1f] border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                    <div>
                        <h2 className="text-xl font-semibold text-white">提示词预设助手</h2>
                        <p className="text-sm text-zinc-400 mt-1">管理你的常用提示词模板</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Presets List */}
                    {presets.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-zinc-500">暂无预设，点击下方按钮添加</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {presets.map(preset => (
                                <div
                                    key={preset.id}
                                    className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
                                    {editingId === preset.id ? (
                                        // Edit Mode
                                        <div className="space-y-3">
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500">
                                            </input>
                                            <textarea
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                rows={4}
                                                placeholder="输入提示词内容..."
                                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none">
                                            </textarea>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleSaveEdit}
                                                    className="flex-1 px-4 py-2 bg-white text-zinc-900 rounded-lg hover:bg-zinc-200 transition-colors font-medium">
                                                    保存
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="flex-1 px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors">
                                                    取消
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        // View Mode
                                        <div>
                                            <div className="flex items-start justify-between gap-3 mb-2">
                                                <h3 className="text-white font-medium flex-1">{preset.name}</h3>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => handleCopy(preset)}
                                                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors relative group">
                                                        {copiedId === preset.id ? (
                                                            <CheckIcon className="w-4 h-4 text-green-400" />
                                                        ) : (
                                                            <CopyIcon className="w-4 h-4" />
                                                        )}
                                                        <span className="absolute top-full right-0 mt-1 px-2 py-1 bg-zinc-900 text-zinc-300 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap border border-zinc-800 z-10">
                                                            {copiedId === preset.id ? '已复制' : '复制'}
                                                        </span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleStartEdit(preset)}
                                                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeletePreset(preset.id)}
                                                        className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors">
                                                        <Trash2Icon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-sm text-zinc-400 line-clamp-2">
                                                {preset.content || '<空内容>'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-zinc-800">
                    <button
                        onClick={handleAddPreset}
                        className="w-full px-4 py-3 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2 font-medium">
                        <PlusIcon className="w-5 h-5" />
                        添加新预设
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PromptPresetsModal;
