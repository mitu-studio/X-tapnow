
import axios from 'axios';
import { ApiProviderType, EndpointMode } from '../types/settings';

// Default values but these should be overridden by user settings
// Default values but these should be overridden by user settings
const DEFAULT_BASE_URL = "";

export interface SoraConfig {
    apiKey: string;
    baseUrl?: string;
    type?: ApiProviderType;
    endpointMode?: EndpointMode;
    customEndpoint?: string;
}

export interface VideoTaskParams {
    prompt: string;
    size?: string;
    seconds?: string;
    image?: File | Blob | string; // For image-to-video
    images?: (File | Blob | string)[]; // For multi-image input (Veo)
    enhance_prompt?: boolean;
    enable_upsample?: boolean;
    aspect_ratio?: string;
    quality?: string;
}

// Helper: Prepare headers and normalized URLs
const prepareRequest = (config: SoraConfig) => {
    const { apiKey, baseUrl = DEFAULT_BASE_URL } = config;
    let useApiKey = apiKey;
    let useBaseUrl = baseUrl;

    if (useApiKey && useApiKey.startsWith('http') && useBaseUrl && !useBaseUrl.startsWith('http')) {
        console.warn("[Sora] Detected swapped API Key and Base URL. Auto-correcting...");
        const temp = useApiKey;
        useApiKey = useBaseUrl;
        useBaseUrl = temp;
    }
    useBaseUrl = useBaseUrl.replace(/\/$/, "");
    if (!useBaseUrl.endsWith('/v1') && config.type !== 'univ2') {
        useBaseUrl += '/v1';
    }

    if (!useApiKey) throw new Error("Sora API Key is missing. Please check settings.");
    if (!useBaseUrl) throw new Error("Sora Base URL is missing. Please check settings.");

    const authHeader = useApiKey.startsWith('Bearer ') ? useApiKey : `Bearer ${useApiKey}`;

    return {
        baseUrl: useBaseUrl,
        headers: { "Authorization": authHeader }
    };
};

// Helper: Convert File/Blob/Url to Base64
export const toBase64 = async (file: File | Blob | string): Promise<string> => {
    if (typeof file === 'string') {
        if (file.startsWith('http')) return file; // Assume public URL
        if (file.startsWith('data:')) return file; // Already Base64
        // If blob url
        if (file.startsWith('blob:')) {
            const res = await fetch(file);
            const blob = await res.blob();
            return toBase64(blob);
        }
        return file;
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

export const createSoraTask = async (
    params: VideoTaskParams & { model?: string },
    config: SoraConfig
): Promise<string> => {
    const { baseUrl, headers } = prepareRequest(config);
    const { prompt, size = "1280x720", seconds = "15", image, images, model = "sora-2", enhance_prompt, enable_upsample, aspect_ratio, quality } = params;

    // Detect if using Veo model family (Strictly by name as requested) OR explicit Veo provider type
    // This allows users to force Veo logic via settings even if model name is non-standard
    const isVeo = model.toLowerCase().includes('veo') || config.type === 'veo';

    // Detect if using Grok model family (Strictly by name as requested) OR explicit Grok provider type
    const isGrok = model.toLowerCase().includes('grok') || config.type === 'grok';

    // Detect Aijisu API
    const isAijisu = baseUrl.includes('api.aijisu.cn');

    try {
        let response;
        if (config.type === 'univ2') {
            // --- Unified V2 Logic ---
            const payload: any = {
                prompt,
                model: model || 'default',
                duration: parseInt(seconds || '5'),
                aspect_ratio: aspect_ratio || "16:9",
                // watermark: false
            };

            // Handle Images
            const imagesList: string[] = [];
            if (image) imagesList.push(await toBase64(image));
            if (images) {
                for (const img of images) {
                    const b64 = await toBase64(img);
                    if (!imagesList.includes(b64)) imagesList.push(b64);
                }
            }
            if (imagesList.length > 0) {
                payload.images = imagesList;
            }

            response = await axios.post(`${baseUrl}/v2/videos/generations`, payload, {
                headers: { ...headers, "Content-Type": "application/json" }
            });
            // V2 spec returns { task_id: "..." }
            return response.data.task_id;

        } else if (isAijisu) {
            // --- Aijisu Logic (JSON - New Format) ---
            const payload: any = {
                model,
                prompt,
                quality: quality || "hd",
                aspectRatio: aspect_ratio === "9:16" ? "portrait" : "landscape"
            };

            // Handle Images (Logic learned from V2)
            const imagesList: string[] = [];
            if (image) imagesList.push(await toBase64(image));
            if (images) {
                for (const img of images) {
                    const b64 = await toBase64(img);
                    if (!imagesList.includes(b64)) imagesList.push(b64);
                }
            }
            if (imagesList.length > 0) {
                payload.image = imagesList[0];
            }

            response = await axios.post(`${baseUrl}/video/generations`, payload, {
                headers: { ...headers, "Content-Type": "application/json" }
            });

        } else if (isVeo) {
            // --- New Veo Logic ---
            // console.log("[SoraService] Using Veo Logic...");

            const payload: any = {
                model,
                prompt,
                enhance_prompt: enhance_prompt || false,
                enable_upsample: enable_upsample || false,
                aspect_ratio: aspect_ratio || "16:9" // Default to 16:9 if not provided
            };

            // Handle Images (Convert to Base64 List)
            const imagesList: string[] = [];

            // 1. Add single image if exists (Backward compat or single selection)
            if (image) {
                imagesList.push(await toBase64(image));
            }

            // 2. Add multiple images if provided
            if (images && images.length > 0) {
                for (const img of images) {
                    const b64 = await toBase64(img);
                    // Avoid duplicate if 'image' and 'images[0]' are same (basic check)
                    if (!imagesList.includes(b64)) {
                        imagesList.push(b64);
                    }
                }
            }

            if (imagesList.length > 0) {
                payload.images = imagesList;
            }

            // Using /v1/video/create endpoint
            response = await axios.post(`${baseUrl}/video/create`, payload, {
                headers: { ...headers, "Content-Type": "application/json" }
            });

        } else if (isGrok) {
            // --- Grok Logic ---
            // Using /v1/videos endpoint with multipart/form-data
            const formData = new FormData();
            formData.append('model', model);
            formData.append('prompt', prompt);

            // Grok specific parameters
            if (aspect_ratio) {
                formData.append('aspect_ratio', aspect_ratio);
            }
            if (seconds) {
                formData.append('seconds', seconds);
            }
            // Map size parameter (default to 720P if not specified)
            const grokSize = size?.includes('1080') ? '1080P' : '720P';
            formData.append('size', grokSize);

            // Handle optional input_reference image
            if (image) {
                if (typeof image === 'string' && (image.startsWith('data:') || image.startsWith('blob:'))) {
                    // Convert Base64 or Blob URL to Blob
                    const res = await fetch(image);
                    const blob = await res.blob();
                    formData.append('input_reference', blob, 'image.png');
                } else if (image instanceof File || image instanceof Blob) {
                    formData.append('input_reference', image, 'image.png');
                }
            } else if (images && images.length > 0) {
                // Use first image if multiple images provided
                const firstImage = images[0];
                if (typeof firstImage === 'string' && (firstImage.startsWith('data:') || firstImage.startsWith('blob:'))) {
                    const res = await fetch(firstImage);
                    const blob = await res.blob();
                    formData.append('input_reference', blob, 'image.png');
                } else if (firstImage instanceof File || firstImage instanceof Blob) {
                    formData.append('input_reference', firstImage, 'image.png');
                }
            }

            response = await axios.post(`${baseUrl}/videos`, formData, { headers });

        } else {
            // --- Original/Legacy Logic (Unchanged) ---
            if (image) {
                // console.log("[Sora] Creating Image-to-Video Task...");
                const formData = new FormData();
                formData.append('model', model);
                formData.append('prompt', prompt);
                formData.append('size', size);
                formData.append('seconds', seconds);

                if (typeof image === 'string' && (image.startsWith('data:') || image.startsWith('blob:'))) {
                    // Convert Base64 or Blob URL to Blob
                    const res = await fetch(image);
                    const blob = await res.blob();
                    formData.append('input_reference', blob, 'image.png');
                } else if (image instanceof File || image instanceof Blob) {
                    formData.append('input_reference', image, 'image.png');
                }

                response = await axios.post(`${baseUrl}/videos`, formData, { headers });
            } else {
                // console.log("[Sora] Creating Text-to-Video Task...");
                const formData = new FormData();
                formData.append('model', model);
                formData.append('prompt', prompt);
                formData.append('size', size);
                formData.append('seconds', seconds);

                response = await axios.post(`${baseUrl}/videos`, formData, { headers });
            }
        }

        // console.log(`[Sora] Task Created: ${response.data.id}`);
        return response.data.id;
    } catch (error: any) {
        console.error("Sora Create Task Error:", error);

        // 提取详细错误信息
        let errMsg = '';

        // 1. Axios响应错误
        if (error.response?.data) {
            const data = error.response.data;

            // 尝试多种错误格式
            if (data.error) {
                if (typeof data.error === 'string') {
                    errMsg = data.error;
                } else if (data.error.message) {
                    errMsg = data.error.message;
                    if (data.error.detail) errMsg += ` (${data.error.detail})`;
                    if (data.error.code) errMsg += ` [${data.error.code}]`;
                }
            } else if (data.message) {
                errMsg = data.message;
            } else if (data.detail) {
                errMsg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
            }

            // 添加HTTP状态码
            if (error.response.status) {
                errMsg = `[HTTP ${error.response.status}] ${errMsg || error.response.statusText}`;
            }
        }

        // 2. 网络错误或其他错误
        if (!errMsg && error.message) {
            errMsg = error.message;
        }

        // 3. 默认错误消息
        if (!errMsg) {
            errMsg = "创建视频任务失败";
        }

        throw new Error(errMsg);
    }
};

export const remixSoraVideo = async (
    sourceVideoId: string,
    prompt: string,
    config: SoraConfig
): Promise<string> => {
    const { baseUrl, headers } = prepareRequest(config);

    try {
        console.log(`[Sora] Creating Remix Task from video: ${sourceVideoId}`);
        const data = { prompt };
        const response = await axios.post(`${baseUrl}/videos/${sourceVideoId}/remix`, data, {
            headers: { ...headers, "Content-Type": "application/json" }
        });

        console.log(`[Sora] Remix Task Created: ${response.data.id}`);
        return response.data.id;
    } catch (error: any) {
        console.error("Sora Remix Task Error:", error);

        // 提取详细错误信息
        let errMsg = '';

        // 1. Axios响应错误
        if (error.response?.data) {
            const data = error.response.data;

            // 尝试多种错误格式
            if (data.error) {
                if (typeof data.error === 'string') {
                    errMsg = data.error;
                } else if (data.error.message) {
                    errMsg = data.error.message;
                    if (data.error.detail) errMsg += ` (${data.error.detail})`;
                    if (data.error.code) errMsg += ` [${data.error.code}]`;
                }
            } else if (data.message) {
                errMsg = data.message;
            } else if (data.detail) {
                errMsg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
            }

            // 添加HTTP状态码
            if (error.response.status) {
                errMsg = `[HTTP ${error.response.status}] ${errMsg || error.response.statusText}`;
            }
        }

        // 2. 网络错误或其他错误
        if (!errMsg && error.message) {
            errMsg = error.message;
        }

        // 3. 默认错误消息
        if (!errMsg) {
            errMsg = "创建视频Remix任务失败";
        }

        throw new Error(errMsg);
    }
};


export const pollSoraTask = async (
    taskId: string,
    config: SoraConfig,
    onProgress?: (status: string, progress: number) => void,
    signal?: AbortSignal
): Promise<string> => {
    const { baseUrl, headers } = prepareRequest(config);
    const pollInterval = 15000;
    const timeout = 1200000; // 20 min
    const startTime = Date.now();

    while (true) {
        if (signal?.aborted) throw new Error("Task aborted");
        if (Date.now() - startTime > timeout) throw new Error("Video generation timed out");

        try {
            let statusRes;
            // Detect Veo mode: Explicit provider type OR taskId hint
            const isVeo = config.type === 'veo' || (typeof taskId === 'string' && taskId.toLowerCase().startsWith('veo'));
            // Detect Grok mode: Explicit provider type OR taskId hint
            const isGrok = config.type === 'grok' || (typeof taskId === 'string' && taskId.toLowerCase().includes('grok'));

            if (config.type === 'univ2') {
                statusRes = await axios.get(`${baseUrl}/v2/videos/generations/${taskId}`, {
                    headers,
                    signal
                });
                // Map V2 status to internal status
                if (statusRes.data.status === 'SUCCESS') statusRes.data.status = 'succeeded';
                if (statusRes.data.status === 'FAILURE') statusRes.data.status = 'failed';
            } else if (isVeo) {
                // Veo uses query endpoint with 'id' query param
                statusRes = await axios.get(`${baseUrl}/video/query`, {
                    params: { id: taskId },
                    headers,
                    signal
                });
            } else if (isGrok) {
                // Grok uses /videos/{taskId} endpoint
                statusRes = await axios.get(`${baseUrl}/videos/${taskId}`, {
                    headers,
                    signal
                });
            } else {
                // Standard Sora/OpenAI-style endpoint
                statusRes = await axios.get(`${baseUrl}/videos/${taskId}`, {
                    headers,
                    signal
                });
            }
            const task = statusRes.data;
            const status = task.status;

            // 修复：API可能返回带%的字符串（如"25%"），需转为数字以免UI显示"25%%"
            let progress = 0;
            if (typeof task.progress === 'string') {
                progress = parseInt(task.progress.replace('%', ''), 10) || 0;
            } else if (typeof task.progress === 'number') {
                progress = task.progress;
            }

            if (onProgress) onProgress(status, progress);

            if (status === "completed" || status === "succeeded") {
                // console.log("[Sora] Task Completed, full task data:", task);
                // Comprehensive field check for various API providers
                const resultUrl = task.url ||
                    task.video_url ||
                    task.download_url ||
                    (task.data && task.data.output) || // Unified V2 single output
                    (task.data && Array.isArray(task.data.outputs) && task.data.outputs[0]) || // Unified V2 list outputs
                    (task.data && (task.data.url || task.data.video_url || task.data.download_url)) ||
                    (task.output && (task.output.url || task.output.video_url || task.output.download_url));

                if (resultUrl) {
                    return resultUrl;
                } else {
                    // Fallback direct download if url missing
                    console.warn("[Sora] 'url' field missing, attempting fallback download...");
                    return await fallbackDownload(taskId, baseUrl, headers, onProgress);
                }
            } else if (status === "failed" || status === "error") {
                console.error("[Sora] Task Failed/Error:", task);

                // 增强的错误信息提取 - 尝试多种可能的错误字段
                let errMsg = '';

                // 1. 标准的error对象格式
                if (task.error) {
                    if (typeof task.error === 'string') {
                        errMsg = task.error;
                    } else if (task.error.message) {
                        errMsg = task.error.message;
                        // 如果有详细信息，也加上
                        if (task.error.detail) {
                            errMsg += ` (详情: ${task.error.detail})`;
                        }
                        if (task.error.code) {
                            errMsg += ` [错误码: ${task.error.code}]`;
                        }
                    } else if (task.error.detail) {
                        errMsg = task.error.detail;
                    }
                }

                // 2. 顶级message字段
                if (!errMsg && task.message) {
                    errMsg = task.message;
                }

                // 3. 顶级detail字段
                if (!errMsg && task.detail) {
                    errMsg = typeof task.detail === 'string' ? task.detail : JSON.stringify(task.detail);
                }

                // 4. 404或其他HTTP状态码相关的错误
                if (!errMsg && task.status_code) {
                    errMsg = `HTTP ${task.status_code}`;
                    if (task.status_text) {
                        errMsg += `: ${task.status_text}`;
                    }
                }

                // 5. 如果还是没有错误信息，使用默认消息
                if (!errMsg) {
                    errMsg = "视频生成失败：服务器返回错误状态但未提供详细信息";
                }

                // 创建错误对象并附加原始任务数据用于调试
                const terminalError = new Error(errMsg);
                (terminalError as any).isTaskError = true;
                (terminalError as any).taskData = task; // 保留完整的任务数据用于调试
                throw terminalError;
            }

            // Wait for interval, but respect signal
            await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(resolve, pollInterval);
                if (signal) {
                    signal.addEventListener('abort', () => {
                        clearTimeout(timeoutId);
                        reject(new Error("Task aborted"));
                    }, { once: true });
                }
            });

        } catch (error: any) {
            if (error.isTaskError || error.message === "Task aborted" || error.message.includes("timed out")) throw error;
            console.warn("Polling error (retrying):", error.message);

            // Wait for interval on error too, respecting signal
            await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(resolve, pollInterval);
                if (signal) {
                    signal.addEventListener('abort', () => {
                        clearTimeout(timeoutId);
                        reject(new Error("Task aborted"));
                    }, { once: true });
                }
            });
        }
    }
};

const fallbackDownload = async (
    taskId: string,
    baseUrl: string,
    headers: any,
    onProgress?: (status: string, progress: number) => void
): Promise<string> => {
    try {
        // console.log("[Sora] Downloading Content (Fallback)...");
        if (onProgress) onProgress("downloading", 99);

        // 首先尝试获取 JSON 格式的响应
        try {
            const jsonRes = await axios.get(`${baseUrl}/videos/${taskId}/content`, {
                headers,
                responseType: 'json'
            });

            // 检查是否是新格式：包含 status、video_url、download_url 等字段
            if (jsonRes.data && typeof jsonRes.data === 'object') {
                const data = jsonRes.data;

                // 支持多种可能的 URL 字段名
                const videoUrl = data.video_url || data.download_url || data.url;

                if (videoUrl) {
                    console.log('[Sora] Detected JSON response with video URL:', videoUrl);
                    return videoUrl;
                }
            }
        } catch (jsonError) {
            // JSON 解析失败，回退到 blob 处理
            console.log('[Sora] JSON response not available, falling back to blob...');
        }

        // 回退方案：按 blob 格式处理
        const contentRes = await axios.get(`${baseUrl}/videos/${taskId}/content`, {
            headers,
            responseType: 'blob'
        });
        return URL.createObjectURL(contentRes.data);
    } catch (error: any) {
        console.error("Sora Download Error:", error);
        throw new Error("Failed to download video content.");
    }
};

/**
 * Handles OpenAI-compatible video generation with streaming.
 * Supports Text-to-Video, Image-to-Video, and Remix (via prompt URL).
 */
export const generateOpenAIVideo = async (
    params: VideoTaskParams & { model?: string },
    config: SoraConfig,
    onProgress?: (status: string, progress: number, details?: string) => void,
    signal?: AbortSignal
): Promise<string> => {
    const { baseUrl, headers } = prepareRequest(config);
    const { prompt, image, images, model = "sora2-landscape-10s" } = params;

    // Construct Messages
    let messages: any[] = [];

    // Collect all images (single 'image' + array 'images')
    const allImages: string[] = [];
    if (image) allImages.push(await toBase64(image));
    if (images) {
        for (const img of images) {
            const b64 = await toBase64(img);
            if (!allImages.includes(b64)) allImages.push(b64);
        }
    }

    if (allImages.length > 0) {
        // Image-to-Video Mode
        const content: any[] = [
            { type: "text", text: prompt }
        ];

        allImages.forEach(imgUrl => {
            content.push({
                type: "image_url",
                image_url: { url: imgUrl }
            });
        });

        messages.push({
            role: "user",
            content: content
        });
    } else {
        // Text-to-Video or Remix (URL in prompt) Mode
        messages.push({
            role: "user",
            content: prompt
        });
    }

    const isGrok = model.toLowerCase().includes('grok');

    const payload: any = {
        model,
        messages,
        stream: !isGrok // Grok example uses stream: false
    };

    if (isGrok) {
        payload.video_config = {
            aspect_ratio: params.aspect_ratio || "16:9",
            video_length: parseInt(params.seconds || "10", 10),
            resolution_name: params.size?.includes("1080") ? "1080p" : "720p",
            preset: "normal"
        };
    }

    console.log("[Sora] Starting OpenAI Stream...", { baseUrl, model, msgCount: messages.length });
    if (onProgress) onProgress("starting", 0, "Initializing stream...");

    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenAI API Error ${response.status}: ${errText}`);
        }

        let fullContent = "";

        if (!payload.stream) {
            const data = await response.json();
            // Assuming OpenAI format, content is in choices[0].message.content
            fullContent = data.choices?.[0]?.message?.content || "";
        } else {
            if (!response.body) throw new Error("No response body received");

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let done = false;
            let buffer = "";

            while (!done) {
                if (signal?.aborted) {
                    reader.cancel();
                    throw new Error("Task aborted");
                }

                const { value, done: readerDone } = await reader.read();
                done = readerDone;

                if (value) {
                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;

                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ""; // Keep incomplete line

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || !trimmed.startsWith('data: ')) continue;

                        const dataStr = trimmed.slice(6);
                        if (dataStr === '[DONE]') continue;

                        try {
                            const json = JSON.parse(dataStr);
                            const delta = json.choices?.[0]?.delta || {};

                            // Handle Progress from reasoning_content (e.g. "**Video Generation Progress**: 82% (queued)")
                            const reasoning = delta.reasoning_content;
                            if (reasoning) {
                                const progressMatch = reasoning.match(/Progress.*?:.*?(\d+)%/i);
                                if (progressMatch) {
                                    const progress = parseInt(progressMatch[1], 10);
                                    if (!isNaN(progress) && onProgress) {
                                        // Extract status text if possible (e.g. "queued" from "(queued)")
                                        let statusDetail = "Generating...";
                                        const statusMatch = reasoning.match(/\((.*?)\)/);
                                        if (statusMatch) {
                                            statusDetail = statusMatch[1];
                                        }
                                        onProgress("generating", progress, `${statusDetail} ${progress}%`);
                                    }
                                }
                            }

                            const deltaContent = delta.content || "";
                            if (deltaContent) {
                                fullContent += deltaContent;
                            }
                        } catch (e) {
                            console.warn("[Sora] JSON Parse Error in stream:", e);
                        }
                    }
                    // Only update generic progress if we haven't received specific progress updates
                    // (Keeping the generic one might be repetitive if we have specific updates, but safe as a fallback heartbeat)
                    // if (onProgress) onProgress("generating", 50, "Streaming data...");
                }
            }
        }

        console.log("[Sora] Stream Complete. Content length:", fullContent.length);

        // Final Parsing: The content should be the video URL or contain it
        // We assume the model returns the URL as the content
        const trimmedResult = fullContent.trim();

        // 1. Try to parse HTML video tag (Grok/OpenAI HTML response)
        // Example: <video ...><source src="http://.../video.mp4" ...></video>
        const htmlVideoMatch = trimmedResult.match(/<source[^>]*\s+src="([^"]+)"/);
        if (htmlVideoMatch && htmlVideoMatch[1]) {
            return htmlVideoMatch[1];
        }

        // Basic check: is it a URL?
        if (trimmedResult.startsWith('http')) {
            return trimmedResult;
        }

        // If it's markdown or JSON inside text?
        // Let's try to extract URL if buried
        // Update regex to exclude single quote ' as well to prevent 400 errors (e.g. if model returns 'url')
        const urlMatch = trimmedResult.match(/https?:\/\/[^\s)"']+/);
        if (urlMatch) {
            let url = urlMatch[0];
            // Clean specific trailing characters that might have been matched but shouldn't act as part of URL
            // e.g. trailing period if it was end of sentence in text
            while (url.endsWith('.') || url.endsWith(',') || url.endsWith(';')) {
                url = url.slice(0, -1);
            }
            return url;
        }

        // If no URL found, return full text (maybe error or message)
        return trimmedResult;

    } catch (error: any) {
        console.error("OpenAI Stream Error:", error);
        throw error;
    }
};

// Legacy wrapper
export const generateSoraVideo = async (
    params: VideoTaskParams & { model?: string },
    config: SoraConfig,
    onProgress?: (status: string, progress: number) => void
): Promise<string> => {
    const taskId = await createSoraTask(params, config);
    if (onProgress) onProgress("created", 0);
    return pollSoraTask(taskId, config, onProgress);
};
