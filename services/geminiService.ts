import { ApiProviderType, EndpointMode } from '../types/settings';

interface ApiConfig {
  apiKey?: string;
  baseUrl?: string;
  type?: ApiProviderType;
  endpointMode?: EndpointMode;
  customEndpoint?: string;
}

export const generateImage = async (
  prompt: string,
  model: string = 'gemini-2.0-flash-exp', // Updated default to a likely image-capable model
  aspectRatio: string = '1:1',
  resolution: string = '1k',
  apiConfig: ApiConfig = {},
  referenceImages: (string | Blob)[] = []
): Promise<{ primaryImage: string; allImages: string[] }> => {
  try {
    const apiKey = apiConfig.apiKey || process.env.API_KEY || '';
    if (!apiKey) {
      throw new Error("API Key is missing. Please set it in Settings.");
    }

    // 如果是OpenAI类型，使用OpenAI适配器
    if (apiConfig.type === 'openai') {
      const { getAdapter } = await import('./apiAdapters/factory');
      const adapter = getAdapter('openai');
      const baseUrl = apiConfig.baseUrl || 'https://api.openai.com';

      const result = await adapter.generateImage(
        { prompt, model, aspectRatio, resolution, referenceImages },
        apiKey,
        baseUrl,
        apiConfig.endpointMode,
        apiConfig.customEndpoint
      );

      return { primaryImage: result.primaryImage, allImages: result.images };
    }

    // 默认使用Gemini逻辑

    // 1. Prepare Base URL
    // Default: https://generativelanguage.googleapis.com
    // We add /v1beta internally if not present, or rely on full path if user provided it?
    // Let's stick to the standard: defaults to standard googleapi, or uses user's proxy root.

    let baseUrl = 'https://generativelanguage.googleapis.com';
    let forceProxyHeaders = false;

    if (apiConfig.baseUrl && apiConfig.baseUrl.trim()) {
      baseUrl = apiConfig.baseUrl.trim();
      forceProxyHeaders = true;

      // Remove trailing slash
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

      // Heuristic: If user entered "https://proxy.com", we assume they want standard path appending.
      // If they entered "https://proxy.com/v1", we respect that.
      // But the target endpoint is `/v1beta/models/...` or `/models/...` depending on what they provide.
      // Safest bet: Look for 'models'. If not present, append '/v1beta'.

      // Actually, to align with "baseurl + suffix", let's assume the user provides the HOST or PRE-PATH.
      // Standard path suffix: /v1beta/models/${model}:generateContent

      // Remove known suffixes if user accidentally added them to BaseURL
      baseUrl = baseUrl.replace(/\/v1beta$/, '');
    }

    const version = 'v1beta';
    const method = 'generateContent';

    // Construct final URL
    // Format: {BASE_URL}/{VERSION}/models/{MODEL}:{METHOD}
    const url = `${baseUrl}/${version}/models/${model}:${method}`;

    // console.log(`🚀 [Direct Fetch URL]: ${url}`);

    // 2. Prepare Headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    // If using default Google Base URL, use x-goog-api-key header
    // Otherwise, use Authorization header for proxies
    if (baseUrl.includes('googleapis.com')) {
      headers['x-goog-api-key'] = apiKey;
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // 3. Prepare Payload (Generation Config)
    const parts: any[] = [{ text: prompt }];

    // Add Reference Images
    if (referenceImages && referenceImages.length > 0) {
      for (const img of referenceImages) {
        let mimeType = '';
        let data = '';

        if (typeof img === 'string') {
          if (img.startsWith('data:')) {
            const match = img.match(/^data:(.+);base64,(.+)$/);
            if (match) {
              mimeType = match[1];
              data = match[2];
            }
          } else if (img.startsWith('blob:') || img.startsWith('http')) {
            // Fetch the image and convert to base64
            try {
              const res = await fetch(img);
              const blob = await res.blob();
              mimeType = blob.type;
              const buffer = await blob.arrayBuffer();
              data = btoa(
                new Uint8Array(buffer)
                  .reduce((data, byte) => data + String.fromCharCode(byte), '')
              );
            } catch (e) {
              console.error(`Failed to fetch image from URL: ${img}`, e);
              continue;
            }
          }
        } else if (img instanceof Blob) {
          mimeType = img.type;
          const buffer = await img.arrayBuffer();
          data = btoa(
            new Uint8Array(buffer)
              .reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
        }

        if (mimeType && data) {
          parts.push({
            inline_data: {
              mime_type: mimeType,
              data: data
            }
          });
        }
      }
    }

    const payload: any = {
      contents: [
        {
          parts: parts
        }
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: resolution.toUpperCase()
        }
      }
    };

    // console.log("🚀 Payload:", JSON.stringify(payload, null, 2));

    // 4. Send Request
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (e) { }
      throw new Error(`Gemini API Error (${response.status}): ${errorBody || response.statusText}`);
    }

    const data = await response.json();

    // 5. Extract Image
    // Structure: candidates[0].content.parts[0].inline_data
    // Gemini通常只返回一张图片，但我们包装成与OpenAI一致的格式
    const allImages: string[] = [];

    if (data.candidates && data.candidates.length > 0) {
      for (const part of data.candidates[0].content.parts) {
        // REST API returns `inline_data` (snake_case) or `inlineData` (camelCase) depending on parser?
        // Fetch usually returns raw JSON, so snake_case normally, but Gemini V1beta might return camelCase if using protojson.
        // Let's handle both.
        const inlineData = part.inlineData || part.inline_data;

        if (inlineData && inlineData.data) {
          const mimeType = inlineData.mimeType || inlineData.mime_type || 'image/png';
          const imageData = `data:${mimeType};base64,${inlineData.data}`;
          allImages.push(imageData);
        }
      }

      if (allImages.length > 0) {
        return { primaryImage: allImages[0], allImages };
      }
    }

    throw new Error("No image data received from Gemini response.");

  } catch (error) {
    console.error("Gemini Image Generation Error:", error);
    throw error;
  }
};

export const generateText = async (
  prompt: string,
  model: string = 'gemini-3-pro-preview',
  apiConfig: ApiConfig = {},
  referenceImages: (string | Blob)[] = [],
  systemPrompt?: string,
  tsc?: number
): Promise<string> => {
  try {
    const apiKey = apiConfig.apiKey || '';
    if (!apiKey) throw new Error("Text API Key is missing. Please set it in Settings.");

    // 如果是OpenAI类型，使用OpenAI适配器
    if (apiConfig.type === 'openai') {
      const { getAdapter } = await import('./apiAdapters/factory');
      const adapter = getAdapter('openai');
      const baseUrl = apiConfig.baseUrl || 'https://api.openai.com';

      return await adapter.generateText(
        { prompt, model, referenceImages, systemPrompt, tsc },
        apiKey,
        baseUrl,
        apiConfig.endpointMode,
        apiConfig.customEndpoint
      );
    }

    // 如果是Gemini类型，使用Gemini API格式
    if (apiConfig.type === 'gemini') {
      let baseUrl = apiConfig.baseUrl?.trim() || 'https://generativelanguage.googleapis.com';
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

      // 移除可能的版本后缀
      baseUrl = baseUrl.replace(/\/v1beta$/, '');

      const version = 'v1beta';
      const method = 'generateContent';
      const url = `${baseUrl}/${version}/models/${model}:${method}`;

      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      // Gemini使用x-goog-api-key header（如果是Google API）或Authorization header（如果是代理）
      if (baseUrl.includes('googleapis.com')) {
        headers['x-goog-api-key'] = apiKey;
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      // 准备内容parts
      const parts: any[] = [];

      // 添加system prompt（如果有）
      if (systemPrompt && systemPrompt.trim()) {
        parts.push({ text: `System: ${systemPrompt}\n\nUser: ${prompt}` });
      } else {
        parts.push({ text: prompt });
      }

      // 添加参考图片
      if (referenceImages && referenceImages.length > 0) {
        for (const img of referenceImages) {
          let mimeType = '';
          let data = '';

          if (typeof img === 'string') {
            if (img.startsWith('data:')) {
              const match = img.match(/^data:(.+);base64,(.+)$/);
              if (match) {
                mimeType = match[1];
                data = match[2];
              }
            } else if (img.startsWith('blob:') || img.startsWith('http')) {
              try {
                const res = await fetch(img);
                const blob = await res.blob();
                mimeType = blob.type;
                const buffer = await blob.arrayBuffer();
                data = btoa(
                  new Uint8Array(buffer)
                    .reduce((data, byte) => data + String.fromCharCode(byte), '')
                );
              } catch (e) {
                console.error(`Failed to fetch image from URL: ${img}`, e);
                continue;
              }
            }
          } else if (img instanceof Blob) {
            mimeType = img.type;
            const buffer = await img.arrayBuffer();
            data = btoa(
              new Uint8Array(buffer)
                .reduce((data, byte) => data + String.fromCharCode(byte), '')
            );
          }

          if (mimeType && data) {
            parts.push({
              inline_data: {
                mime_type: mimeType,
                data: data
              }
            });
          }
        }
      }

      const payload: any = {
        contents: [{
          parts: parts
        }]
      };

      // Add tsc if provided and using xwang proxy
      if (tsc !== undefined && baseUrl.includes('xwang.store')) {
        payload.tsc = tsc;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorMsg = await response.text();
        throw new Error(`Gemini Text API Error (${response.status}): ${errorMsg}`);
      }

      const resData = await response.json();

      // 提取Gemini响应中的文本
      if (resData.candidates && resData.candidates.length > 0) {
        const candidate = resData.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          // 合并所有文本parts
          const textParts = candidate.content.parts
            .filter((part: any) => part.text)
            .map((part: any) => part.text);

          if (textParts.length > 0) {
            return textParts.join('');
          }
        }
      }

      throw new Error("No text data received from Gemini API.");
    }

    // 默认使用OpenAI兼容格式（用于其他未明确指定类型的情况）
    let baseUrl = apiConfig.baseUrl?.trim() || 'https://api.openai.com';
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

    // Support either base URL or full endpoint
    const url = baseUrl.includes('/chat/completions') ? baseUrl : `${baseUrl}/v1/chat/completions`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };

    const messages: any[] = [];
    if (systemPrompt && systemPrompt.trim()) {
      messages.push({ role: "system", content: systemPrompt });
    }

    const contentParts: any[] = [{ type: 'text', text: prompt }];

    if (referenceImages && referenceImages.length > 0) {
      for (const img of referenceImages) {
        let dataUrl = '';
        if (typeof img === 'string') {
          dataUrl = img;
        } else if (img instanceof Blob) {
          const buffer = await img.arrayBuffer();
          const base64 = btoa(new Uint8Array(buffer).reduce((d, b) => d + String.fromCharCode(b), ''));
          dataUrl = `data:${img.type};base64,${base64}`;
        }
        if (dataUrl) {
          contentParts.push({ type: "image_url", image_url: { url: dataUrl } });
        }
      }
    }

    messages.push({ role: "user", content: contentParts });

    const payload: any = {
      model,
      messages: messages,
      temperature: 0.7
    };

    if (tsc !== undefined && baseUrl.includes('xwang.store')) {
      payload.tsc = tsc;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorMsg = await response.text();
      throw new Error(`Text API Error (${response.status}): ${errorMsg}`);
    }

    const resData = await response.json();
    if (resData.choices && resData.choices.length > 0) {
      return resData.choices[0].message.content;
    }

    throw new Error("No text data received from the Text API.");
  } catch (error) {
    console.error("Text Generation Error:", error);
    throw error;
  }
};