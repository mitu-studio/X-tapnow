import React from 'react';
import { ApiProvider } from '../types/settings';

interface ProviderCardProps {
    provider: ApiProvider;
    onEdit: () => void;
    onDelete: () => void;
    onSetDefault: () => void;
    color: string; // 'cyan' | 'purple' | 'indigo'
}

const ProviderCard: React.FC<ProviderCardProps> = ({ provider, onEdit, onDelete, onSetDefault, color }) => {
    const colorClasses = {
        cyan: 'border-cyan-500/30 bg-cyan-500/5',
        purple: 'border-purple-500/30 bg-purple-500/5',
        indigo: 'border-indigo-500/30 bg-indigo-500/5'
    };

    const getTypeLabel = () => {
        switch (provider.type) {
            case 'gemini': return 'Gemini';
            case 'openai': return 'OpenAI';
            case 'sora': return 'Sora';
            case 'univ2': return '统一接口 (V2)';
            default: return provider.type;
        }
    };

    const getEndpointInfo = () => {
        if (provider.type === 'openai') {
            if (provider.endpointMode === 'custom' && provider.customEndpoint) {
                return provider.customEndpoint;
            }
            return '/v1/chat/completions';
        }
        return null;
    };

    return (
        <div className={`relative border rounded-lg p-4 ${colorClasses[color as keyof typeof colorClasses] || colorClasses.cyan} hover:border-opacity-50 transition-colors`}>
            {/* Header区域 */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-white truncate">{provider.name}</h4>
                        {provider.isDefault && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded">
                                默认
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-zinc-700">
                            {getTypeLabel()}
                        </span>
                        {getEndpointInfo() && (
                            <span className="text-xs text-zinc-500 font-mono truncate">
                                {getEndpointInfo()}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* 信息区域 - 两列布局 */}
            <div className="grid grid-cols-2 gap-3 mb-3">
                {/* Base URL */}
                <div>
                    <p className="text-xs text-zinc-500 mb-1">Base URL</p>
                    <p className="text-xs text-zinc-300 truncate" title={provider.baseUrl || '默认'}>
                        {provider.baseUrl || '默认'}
                    </p>
                </div>

                {/* API Key */}
                <div>
                    <p className="text-xs text-zinc-500 mb-1">API Key</p>
                    <p className="text-xs text-zinc-400 font-mono truncate">
                        {provider.apiKey ? `${provider.apiKey.substring(0, 8)}...${provider.apiKey.substring(provider.apiKey.length - 4)}` : '未设置'}
                    </p>
                </div>
            </div>

            {/* 模型列表 */}
            <div className="mb-3">
                <p className="text-xs text-zinc-500 mb-1.5">模型 ({provider.models.length})</p>
                <div className="flex flex-wrap gap-1">
                    {provider.models.slice(0, 4).map((model) => (
                        <span key={model.id} className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded" title={model.id}>
                            {model.displayName}
                        </span>
                    ))}
                    {provider.models.length > 4 && (
                        <span className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-500 rounded">
                            +{provider.models.length - 4}
                        </span>
                    )}
                </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-3 border-t border-zinc-800">
                {!provider.isDefault && (
                    <button
                        onClick={onSetDefault}
                        className="flex-1 px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded transition-colors"
                        title="设为默认"
                    >
                        设为默认
                    </button>
                )}
                <button
                    onClick={onEdit}
                    className={`${provider.isDefault ? 'flex-1' : 'flex-1'} px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors`}
                >
                    编辑
                </button>
                <button
                    onClick={onDelete}
                    className="px-3 py-1.5 text-xs font-medium bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded transition-colors"
                >
                    删除
                </button>
            </div>
        </div>
    );
};

export default ProviderCard;
