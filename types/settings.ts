// API Provider and Model Configuration Types

export interface ModelConfig {
    id: string;                    // 模型ID，如"gemini-2.0-flash-exp"
    displayName: string;           // 显示名称，如"Gemini 2.0 Flash"
    parameters?: Record<string, any>; // 模型特定参数（可选）
}

// API类型定义
export type ApiProviderType = 'gemini' | 'openai' | 'sora' | 'veo' | 'univ2' | 'grok';

// Endpoint模式定义（仅OpenAI使用）
export type EndpointMode = 'chat' | 'custom';

export interface ApiProvider {
    id: string;                    // 唯一标识符
    name: string;                  // 用户自定义名称，如"主要Gemini"、"备用OpenAI"
    apiKey: string;                // API密钥
    baseUrl: string;               // 基础URL
    type: ApiProviderType;         // API类型：gemini/openai/sora
    endpointMode?: EndpointMode;   // Endpoint模式（仅OpenAI类型使用）
    customEndpoint?: string;       // 自定义endpoint路径（当endpointMode为'custom'时使用）
    models: ModelConfig[];         // 该提供商支持的模型列表
    isDefault?: boolean;           // 是否为默认配置
}

export interface AppSettings {
    imageProviders: ApiProvider[];   // 图像生成API列表
    videoProviders: ApiProvider[];   // 视频生成API列表
    textProviders: ApiProvider[];    // 文本生成API列表
    defaultImageProvider?: string;   // 默认图像API的ID
    defaultVideoProvider?: string;   // 默认视频API的ID
    defaultTextProvider?: string;    // 默认文本API的ID
    concurrencyLimit?: number;       // 批量生成并发控制数量（默认15）
}

// Helper function to get default provider ID from a list
export const getDefaultProviderId = (providers: ApiProvider[]): string | undefined => {
    const defaultProvider = providers.find(p => p.isDefault);
    return defaultProvider?.id || providers[0]?.id;
};

// Helper function to get provider by ID
export const getProviderById = (providers: ApiProvider[], id?: string): ApiProvider | undefined => {
    if (!id) return providers.find(p => p.isDefault) || providers[0];
    return providers.find(p => p.id === id);
};

// Helper function to get model by ID from a provider
export const getModelById = (provider: ApiProvider, modelId?: string): ModelConfig | undefined => {
    if (!modelId) return provider.models[0];
    return provider.models.find(m => m.id === modelId);
};

// Helper function to build complete endpoint URL
export const buildEndpointUrl = (provider: ApiProvider, action: 'image' | 'text' | 'video'): string => {
    let base = provider.baseUrl.trim();
    if (base.endsWith('/')) base = base.slice(0, -1);

    // Gemini类型
    if (provider.type === 'gemini') {
        // 保持原有逻辑：{baseUrl}/v1beta/models/{model}:generateContent
        // 注意：这里只返回base，具体的model部分由调用者添加
        return base;
    }

    // Sora/Veo/Grok类型
    if (provider.type === 'sora' || provider.type === 'veo' || provider.type === 'grok') {
        return base; // Sora/Veo/Grok使用自己的endpoint
    }

    // OpenAI类型
    const mode = provider.endpointMode || 'chat';

    if (mode === 'custom' && provider.customEndpoint) {
        const custom = provider.customEndpoint.trim();
        return custom.startsWith('/') ? `${base}${custom}` : `${base}/${custom}`;
    }

    // 默认：chat模式
    return `${base}/v1/chat/completions`;
};
