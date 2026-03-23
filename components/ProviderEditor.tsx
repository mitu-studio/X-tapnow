import React, { useState, useEffect } from 'react';
import { ApiProvider, ModelConfig, ApiProviderType, EndpointMode } from '../types/settings';
import { XIcon } from './Icons';

interface ProviderEditorProps {
    provider: ApiProvider | null; // null表示新建模式
    onSave: (provider: ApiProvider) => void;
    onCancel: () => void;
    color: string;
    tabType?: 'image' | 'video' | 'text'; // 当前标签类型
}

const ProviderEditor: React.FC<ProviderEditorProps> = ({ provider, onSave, onCancel, color, tabType }) => {
    const [name, setName] = useState(provider?.name || '');
    const [baseUrl, setBaseUrl] = useState(provider?.baseUrl || '');
    const [apiKey, setApiKey] = useState(provider?.apiKey || '');
    const [type, setType] = useState<ApiProviderType>(provider?.type || 'gemini');
    const [endpointMode, setEndpointMode] = useState<EndpointMode>(provider?.endpointMode || 'chat');
    const [customEndpoint, setCustomEndpoint] = useState(provider?.customEndpoint || '');
    const [models, setModels] = useState<ModelConfig[]>(provider?.models || []);
    const [newModelId, setNewModelId] = useState('');
    const [newModelName, setNewModelName] = useState('');

    const colorClasses = {
        cyan: 'focus:border-cyan-500/50 focus:ring-cyan-500/50',
        purple: 'focus:border-purple-500/50 focus:ring-purple-500/50',
        indigo: 'focus:border-indigo-500/50 focus:ring-indigo-500/50'
    };

    const btnClasses = {
        cyan: 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/20',
        purple: 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/20',
        indigo: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20'
    };

    const handleAddModel = () => {
        if (newModelId.trim() && newModelName.trim()) {
            const newModel: ModelConfig = {
                id: newModelId.trim(),
                displayName: newModelName.trim()
            };
            setModels([...models, newModel]);
            setNewModelId('');
            setNewModelName('');
        }
    };

    const handleRemoveModel = (index: number) => {
        setModels(models.filter((_, i) => i !== index));
    };

    // 自动识别并标准化Base URL，去除多余路径和后缀
    const normalizeBaseUrl = (url: string): string => {
        const trimmed = url.trim();
        if (!trimmed) return '';

        try {
            // 尝试解析URL
            const urlObj = new URL(trimmed);
            // 只保留协议和域名部分，去除路径、查询参数、hash等
            return `${urlObj.protocol}//${urlObj.host}`;
        } catch (e) {
            // 如果不是完整的URL，尝试补全协议后再解析
            if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
                try {
                    const urlObj = new URL('https://' + trimmed);
                    return `${urlObj.protocol}//${urlObj.host}`;
                } catch (e2) {
                    // 解析失败，返回原始输入
                    return trimmed;
                }
            }
            // 无法解析，返回原始输入
            return trimmed;
        }
    };

    const handleBaseUrlChange = (value: string) => {
        // 检测是否包含协议或域名特征，如果是则自动标准化
        if (value.includes('://') || value.includes('.com') || value.includes('.cn') || value.includes('.org') || value.includes('.net')) {
            setBaseUrl(normalizeBaseUrl(value));
        } else {
            setBaseUrl(value);
        }
    };

    const handleSave = () => {
        if (!name.trim()) {
            alert('请输入提供商名称');
            return;
        }
        if (!apiKey.trim()) {
            alert('请输入API Key');
            return;
        }
        if (models.length === 0) {
            alert('请至少添加一个模型');
            return;
        }

        const savedProvider: ApiProvider = {
            id: provider?.id || `provider-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: name.trim(),
            baseUrl: baseUrl.trim(),
            apiKey: apiKey.trim(),
            type,
            endpointMode: type === 'openai' ? endpointMode : undefined,
            customEndpoint: type === 'openai' && endpointMode === 'custom' ? customEndpoint.trim() : undefined,
            models
        };

        onSave(savedProvider);
    };

    const focusClass = colorClasses[color as keyof typeof colorClasses] || colorClasses.cyan;
    const btnClass = btnClasses[color as keyof typeof btnClasses] || btnClasses.cyan;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={onCancel}
                    className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </button>
                <h3 className="text-base font-semibold text-white">
                    {provider ? '编辑提供商' : '添加新提供商'}
                </h3>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto space-y-4">
                {/* 名称和API类型 - 两列布局 */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-zinc-400 block mb-2">提供商名称</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="例如：主要Gemini"
                            className={`w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 outline-none focus:ring-1 transition-all placeholder-zinc-600 ${focusClass}`}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-zinc-400 block mb-2">API类型</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as ApiProviderType)}
                            className={`w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 outline-none focus:ring-1 transition-all ${focusClass}`}
                        >
                            <option value="gemini">Gemini / Google AI</option>
                            <option value="openai">OpenAI 兼容</option>
                            <option value="sora">Sora(/v1/videos)</option>
                            <option value="veo">统一接口(/v1/video/create)</option>
                            <option value="univ2">统一接口2(/v2/videos/generations)</option>
                        </select>
                    </div>
                </div>

                {/* Endpoint模式 - 仅OpenAI类型显示 */}
                {type === 'openai' && (
                    <div>
                        <label className="text-sm font-medium text-zinc-400 block mb-2">Endpoint路径</label>
                        <select
                            value={endpointMode}
                            onChange={(e) => setEndpointMode(e.target.value as EndpointMode)}
                            className={`w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 outline-none focus:ring-1 transition-all ${focusClass}`}
                        >
                            <option value="chat">标准路径 (/v1/chat/completions)</option>
                            <option value="custom">自定义路径</option>
                        </select>

                        {endpointMode === 'custom' && (
                            <div className="mt-2 space-y-1">
                                <input
                                    type="text"
                                    value={customEndpoint}
                                    onChange={(e) => setCustomEndpoint(e.target.value)}
                                    placeholder="/api/v1/generate"
                                    className={`w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 outline-none focus:ring-1 transition-all placeholder-zinc-600 ${focusClass}`}
                                />
                                <p className="text-xs text-zinc-500">
                                    示例：/api/generate、/v1/custom/images、/openai/chat
                                </p>
                            </div>
                        )}

                        {endpointMode !== 'custom' && (
                            <p className="text-xs text-zinc-500 mt-2">
                                使用 /v1/chat/completions 标准端点，兼容性最好，支持图生图
                            </p>
                        )}
                    </div>
                )}

                {/* Base URL */}
                <div>
                    <label className="text-sm font-medium text-zinc-400 block mb-2">Base URL（可选）</label>
                    <input
                        type="text"
                        value={baseUrl}
                        onChange={(e) => handleBaseUrlChange(e.target.value)}
                        placeholder="https://api.example.com"
                        className={`w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 outline-none focus:ring-1 transition-all placeholder-zinc-600 ${focusClass}`}
                    />
                    <p className="text-xs text-zinc-500 mt-1.5">
                        自动提取基础域名（例如：输入 https://api.example.com/v1/chat → 自动转为 https://api.example.com）
                    </p>
                </div>

                {/* API Key */}
                <div>
                    <label className="text-sm font-medium text-zinc-400 block mb-2">API Key</label>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className={`w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 outline-none focus:ring-1 transition-all placeholder-zinc-600 ${focusClass}`}
                    />
                </div>

                {/* 模型配置 */}
                <div>
                    <div className="flex items-start justify-between mb-2">
                        <label className="text-sm font-medium text-zinc-400">模型配置</label>
                        {tabType === 'video' && (
                            <div className="flex items-center gap-1 text-xs text-amber-500/80">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>请根据api接口支持模型设置和选择</span>
                            </div>
                        )}
                    </div>

                    {/* 视频生成快速预设 */}
                    {tabType === 'video' && (
                        <div className="mb-3 p-3 bg-purple-950/20 border border-purple-800/30 rounded-lg">
                            <p className="text-xs text-purple-300/70 mb-2">快速添加预设模型：</p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => {
                                        const preset1: ModelConfig = {
                                            id: 'sora-2',
                                            displayName: 'Sora 2'
                                        };
                                        if (!models.find(m => m.id === preset1.id)) {
                                            setModels([...models, preset1]);
                                        }
                                    }}
                                    className="flex-1 min-w-[30%] px-3 py-1.5 text-xs font-medium bg-purple-900/40 hover:bg-purple-800/50 text-purple-200 rounded transition-colors border border-purple-700/30"
                                >
                                    + Sora 2
                                </button>
                                <button
                                    onClick={() => {
                                        const presetVeo: ModelConfig = {
                                            id: 'veo3.1-fast',
                                            displayName: 'Veo 3.1 Fast'
                                        };
                                        if (!models.find(m => m.id === presetVeo.id)) {
                                            setModels([...models, presetVeo]);
                                        }
                                    }}
                                    className="flex-1 min-w-[30%] px-3 py-1.5 text-xs font-medium bg-purple-900/40 hover:bg-purple-800/50 text-purple-200 rounded transition-colors border border-purple-700/30"
                                >
                                    + Veo 3.1
                                </button>
                                <button
                                    onClick={() => {
                                        const presets = [
                                            { id: 'veo3-fast-frames', displayName: 'Veo 3 Fast (Frames)' },
                                            { id: 'veo2-fast-components', displayName: 'Veo 2 Fast (Components)' }
                                        ];
                                        const newModels = [...models];
                                        presets.forEach(p => {
                                            if (!newModels.find(m => m.id === p.id)) newModels.push(p);
                                        });
                                        setModels(newModels);
                                    }}
                                    className="flex-1 min-w-[30%] px-3 py-1.5 text-xs font-medium bg-purple-900/40 hover:bg-purple-800/50 text-purple-200 rounded transition-colors border border-purple-700/30"
                                >
                                    + Veo Advanced
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 已添加的模型列表 */}
                    <div className="space-y-2 mb-3">
                        {models.map((model, index) => (
                            <div key={index} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                                <div className="flex-1">
                                    <p className="text-sm text-white">{model.displayName}</p>
                                    <p className="text-xs text-zinc-500 font-mono">{model.id}</p>
                                </div>
                                <button
                                    onClick={() => handleRemoveModel(index)}
                                    className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                                >
                                    <XIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* 添加新模型 */}
                    <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/50">
                        <p className="text-xs text-zinc-500 mb-2">{tabType === 'video' ? '自定义添加其他模型' : '添加新模型'}</p>
                        <div className="space-y-2">
                            <input
                                type="text"
                                value={newModelId}
                                onChange={(e) => setNewModelId(e.target.value)}
                                placeholder={tabType === 'video' ? "模型ID（如：sora-turbo）" : "模型ID（如：gemini-2.0-flash-exp）"}
                                className={`w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-200 outline-none focus:ring-1 transition-all placeholder-zinc-600 ${focusClass}`}
                            />
                            <input
                                type="text"
                                value={newModelName}
                                onChange={(e) => setNewModelName(e.target.value)}
                                placeholder={tabType === 'video' ? "显示名称（如：Sora Turbo）" : "显示名称（如：Gemini 2.0 Flash）"}
                                className={`w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-200 outline-none focus:ring-1 transition-all placeholder-zinc-600 ${focusClass}`}
                            />
                            <button
                                onClick={handleAddModel}
                                className="w-full px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                            >
                                + 添加模型
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-3 pt-4 border-t border-zinc-800 mt-4">
                <button
                    onClick={onCancel}
                    className="flex-1 px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                >
                    取消
                </button>
                <button
                    onClick={handleSave}
                    className={`flex-1 px-6 py-2 ${btnClass} text-white text-sm font-medium rounded-lg shadow-lg transition-all active:scale-95`}
                >
                    保存
                </button>
            </div>
        </div>
    );
};

export default ProviderEditor;
