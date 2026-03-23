// API Adapter Interfaces

export interface ImageToImageParams {
    sourceImage: string | Blob;
    mode: 'edit' | 'variation' | 'inpaint';
    mask?: string | Blob;
    strength?: number;  // 0-1
}

export interface ImageGenerationRequest {
    prompt: string;
    model: string;
    aspectRatio?: string;
    resolution?: string;
    referenceImages?: (string | Blob)[];
    imageToImage?: ImageToImageParams;
}

export interface ImageGenerationResponse {
    images: string[];       // 所有图片的data URL
    primaryImage: string;   // 主图片（第一张）
}

export interface TextGenerationRequest {
    prompt: string;
    model: string;
    referenceImages?: (string | Blob)[];
    systemPrompt?: string;
    tsc?: number;
}

export interface ApiAdapter {
    generateImage(
        request: ImageGenerationRequest,
        apiKey: string,
        baseUrl: string,
        endpointMode?: string,
        customEndpoint?: string
    ): Promise<ImageGenerationResponse>;

    generateText(
        request: TextGenerationRequest,
        apiKey: string,
        baseUrl: string,
        endpointMode?: string,
        customEndpoint?: string
    ): Promise<string>;
}
