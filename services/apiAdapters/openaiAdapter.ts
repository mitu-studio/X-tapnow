import { ApiAdapter, ImageGenerationRequest, ImageGenerationResponse, TextGenerationRequest } from './index';
import { OpenAIResponseParser } from './responseParser';

export class OpenAIAdapter implements ApiAdapter {
    async generateImage(
        request: ImageGenerationRequest,
        apiKey: string,
        baseUrl: string,
        endpointMode: string = 'chat',
        customEndpoint?: string
    ): Promise<ImageGenerationResponse> {
        const url = this.buildUrl(baseUrl, endpointMode, customEndpoint);
        const payload = await this.buildChatPayload(request);

        console.log(`[OpenAI] Image generation request:`, {
            url,
            mode: endpointMode,
            model: request.model,
            aspectRatio: request.aspectRatio,
            resolution: request.resolution,
            payloadSize: payload.size,
            payloadQuality: payload.quality
        });
        console.log(`[OpenAI] Full payload:`, JSON.stringify(payload, null, 2));

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`OpenAI API Error (${response.status}): ${errorBody}`);
        }

        const data = await response.json();
        const parsed = OpenAIResponseParser.parseImageResponse(data);

        if (parsed.images.length === 0) {
            console.error('[OpenAI] No images in response:', data);
            throw new Error("No image data in OpenAI response");
        }

        if (parsed.images.length > 1) {
            console.warn(`[OpenAI] Generated ${parsed.images.length} images`);
        }

        // 下载URL图片为data URL
        const processedImages: string[] = [];
        for (const img of parsed.images) {
            if (img.startsWith('http://') || img.startsWith('https://')) {
                try {
                    processedImages.push(await this.downloadAndConvertToDataUrl(img));
                } catch (e) {
                    console.error('[OpenAI] Failed to download image:', img, e);
                    processedImages.push(img);  // 保留原URL作为fallback
                }
            } else {
                processedImages.push(img);
            }
        }

        return {
            images: processedImages,
            primaryImage: processedImages[0]
        };
    }

    private buildUrl(
        baseUrl: string,
        mode: string,
        customEndpoint?: string
    ): string {
        let base = baseUrl.trim();
        if (base.endsWith('/')) base = base.slice(0, -1);

        if (mode === 'custom' && customEndpoint) {
            const custom = customEndpoint.trim();
            return custom.startsWith('/') ? `${base}${custom}` : `${base}/${custom}`;
        }

        // 默认：chat模式
        return `${base}/v1/chat/completions`;
    }

    private async buildChatPayload(request: ImageGenerationRequest): Promise<any> {
        const messages: any[] = [];

        // 构建提示词，附加size参数
        let finalPrompt = request.prompt;
        if (request.aspectRatio) {
            finalPrompt = `${request.prompt}，${request.aspectRatio}`;
        }

        // 构建用户消息
        const userContent: any[] = [
            { type: 'text', text: finalPrompt }
        ];

        // 添加参考图片（多模态输入）
        if (request.referenceImages && request.referenceImages.length > 0) {
            for (const img of request.referenceImages) {
                const imageUrl = await this.convertToImageUrl(img);
                userContent.push({
                    type: 'image_url',
                    image_url: { url: imageUrl }
                });
            }
        }

        // 图生图：添加源图片
        if (request.imageToImage) {
            const sourceUrl = await this.convertToImageUrl(request.imageToImage.sourceImage);
            userContent.push({
                type: 'image_url',
                image_url: { url: sourceUrl }
            });

            // 修改prompt以包含编辑指令
            let editPrompt = finalPrompt;
            if (request.imageToImage.mode === 'variation') {
                editPrompt = `Create a variation of the provided image. ${finalPrompt}`;
            } else if (request.imageToImage.mode === 'edit') {
                editPrompt = `Edit the provided image: ${finalPrompt}`;
            } else if (request.imageToImage.mode === 'inpaint') {
                editPrompt = `Modify only the masked region: ${finalPrompt}`;
            }

            userContent[0].text = editPrompt;
        }

        messages.push({ role: 'user', content: userContent });

        const payload: any = {
            model: request.model,
            messages: messages,
            n: 1
        };

        // 直接传递原始参数，不做映射
        if (request.aspectRatio) {
            payload.size = request.aspectRatio;  // 直接使用如 "1:1", "16:9" 等
        }
        if (request.resolution) {
            payload.quality = request.resolution;  // 直接使用如 "1k", "2k", "4k"
        }

        return payload;
    }

    private async downloadAndConvertToDataUrl(url: string): Promise<string> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to download: ${response.status}`);
        }

        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce(
                (data, byte) => data + String.fromCharCode(byte), ''
            )
        );

        const mimeType = blob.type || 'image/png';
        return `data:${mimeType};base64,${base64}`;
    }

    private async convertToImageUrl(img: string | Blob): Promise<string> {
        if (typeof img === 'string') return img;

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(img);
        });
    }

    async generateText(
        request: TextGenerationRequest,
        apiKey: string,
        baseUrl: string,
        endpointMode: string = 'chat',
        customEndpoint?: string
    ): Promise<string> {
        const url = this.buildUrl(baseUrl, endpointMode, customEndpoint);

        const messages: any[] = [];
        if (request.systemPrompt) {
            messages.push({ role: 'system', content: request.systemPrompt });
        }

        if (request.referenceImages && request.referenceImages.length > 0) {
            const content: any[] = [{ type: 'text', text: request.prompt }];
            for (const img of request.referenceImages) {
                content.push({
                    type: 'image_url',
                    image_url: { url: await this.convertToImageUrl(img) }
                });
            }
            messages.push({ role: 'user', content });
        } else {
            messages.push({ role: 'user', content: request.prompt });
        }

        const payload: any = {
            model: request.model,
            messages: messages
        };

        if (request.tsc !== undefined && baseUrl.includes('xwang.store')) {
            payload.tsc = request.tsc;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`OpenAI API Error (${response.status}): ${errorBody}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }
}
