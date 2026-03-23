import { ApiAdapter } from './index';
import { OpenAIAdapter } from './openaiAdapter';
import { ApiProviderType } from '../../types/settings';

// Gemini适配器暂时先创建一个空实现，后续填充
class GeminiAdapter implements ApiAdapter {
    async generateImage(request: any, apiKey: string, baseUrl: string): Promise<any> {
        // 这里后续会迁移geminiService.ts的逻辑
        throw new Error('Gemini adapter not yet implemented. Use geminiService.ts directly for now.');
    }

    async generateText(request: any, apiKey: string, baseUrl: string): Promise<string> {
        throw new Error('Gemini adapter not yet implemented. Use geminiService.ts directly for now.');
    }
}

const adapters: Record<ApiProviderType, ApiAdapter> = {
    gemini: new GeminiAdapter(),
    openai: new OpenAIAdapter(),
    sora: new GeminiAdapter()  // Sora暂时使用Gemini适配器
};

export function getAdapter(type: ApiProviderType): ApiAdapter {
    const adapter = adapters[type];
    if (!adapter) {
        throw new Error(`Unsupported API type: ${type}`);
    }
    return adapter;
}
