const VIDEO_UPLOAD_URL = '/api/upload';
const DEFAULT_API_BASE_URL = (import.meta.env.VITE_SORA_API_BASE_URL || '').trim();
const DEFAULT_CHARACTER_TOKEN = (import.meta.env.VITE_SORA_CHARACTER_TOKEN || '').trim();

const DEFAULT_TIMEOUT = 600000;
const UPLOAD_TIMEOUT = 200000;

const getApiBaseUrl = () => {
    const baseUrl = localStorage.getItem('sora_api_base_url') || DEFAULT_API_BASE_URL;
    return baseUrl.trim();
};

const getAuthToken = (customToken?: string) => {
    return (
        customToken?.trim() ||
        localStorage.getItem('sora_character_token')?.trim() ||
        DEFAULT_CHARACTER_TOKEN
    );
};

const createAuthHeader = (token: string): HeadersInit => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
};

async function fetchWithTimeout(url: string, options: RequestInit & { timeout?: number } = {}) {
    const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal,
        });
        clearTimeout(id);
        return response;
    } catch (error: any) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${Math.round(timeout / 1000)}s`);
        }
        throw error;
    }
}

export interface UploadResponse {
    success: boolean;
    url?: string;
    videoUrl?: string;
    message?: string;
    error?: string;
    expires_in?: string;
    size?: number;
}

export interface CreateCharacterRequest {
    url: string;
    timestamps: string;
}

export interface CreateCharacterResponse {
    success: boolean;
    character?: {
        id: string;
        username: string;
        permalink?: string;
        profile_picture_url?: string;
    };
    characterId?: string;
    message?: string;
    error?: string;
}

export async function uploadVideo(videoFile: File): Promise<UploadResponse> {
    try {
        const formData = new FormData();
        formData.append('video', videoFile);

        const token = getAuthToken();

        const response = await fetchWithTimeout(VIDEO_UPLOAD_URL, {
            method: 'POST',
            headers: createAuthHeader(token),
            body: formData,
            timeout: UPLOAD_TIMEOUT,
        });

        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 401) {
                throw new Error('Upload unauthorized. Configure character token in settings or VITE_SORA_CHARACTER_TOKEN.');
            }
            throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        const normalizedUrl = result.url || result.videoUrl;

        return {
            success: result.success ?? true,
            url: normalizedUrl,
            videoUrl: normalizedUrl,
            expires_in: result.expires_in,
            size: result.size,
            message: result.message || 'Upload successful',
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Upload failed',
        };
    }
}

export async function createCharacter(
    videoUrl: string,
    timestamps: string = '1,3',
    customToken?: string
): Promise<CreateCharacterResponse> {
    try {
        const token = getAuthToken(customToken);
        if (!token) {
            throw new Error('Character token is required. Set it in Character Management or VITE_SORA_CHARACTER_TOKEN.');
        }

        const baseUrl = getApiBaseUrl();
        if (!baseUrl) {
            throw new Error('Character API base URL is missing. Set sora_api_base_url or VITE_SORA_API_BASE_URL.');
        }

        const createUrl = `${baseUrl.replace(/\/+$/, '')}/sora/v1/characters`;
        const requestBody: CreateCharacterRequest = {
            url: videoUrl,
            timestamps,
        };

        const response = await fetchWithTimeout(createUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...createAuthHeader(token),
            },
            body: JSON.stringify(requestBody),
            timeout: DEFAULT_TIMEOUT,
        });

        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 401) {
                throw new Error('Character creation unauthorized. Check your token.');
            }
            throw new Error(`Create character failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();

        return {
            success: true,
            character: {
                id: result.id,
                username: result.username,
                permalink: result.permalink,
                profile_picture_url: result.profile_picture_url,
            },
            characterId: result.id,
            message: result.message || 'Character created successfully',
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Create character failed',
        };
    }
}

export async function uploadCharacter(
    videoFile: File,
    characterName: string,
    timestamps: string = '1,3',
    customToken?: string
): Promise<{
    success: boolean;
    videoUrl?: string;
    character?: {
        id: string;
        username: string;
        permalink?: string;
        profile_picture_url?: string;
    };
    characterId?: string;
    error?: string;
}> {
    try {
        console.log('Start uploading character asset:', characterName);

        const uploadResult = await uploadVideo(videoFile);
        if (!uploadResult.success || !uploadResult.url) {
            throw new Error(uploadResult.error || 'Video upload failed');
        }

        const createResult = await createCharacter(uploadResult.url, timestamps, customToken);
        if (!createResult.success) {
            throw new Error(createResult.error || 'Character creation failed');
        }

        return {
            success: true,
            videoUrl: uploadResult.url,
            character: createResult.character,
            characterId: createResult.characterId,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Character upload failed',
        };
    }
}
