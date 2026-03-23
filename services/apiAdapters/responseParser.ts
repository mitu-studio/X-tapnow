// OpenAI Response Parser

export interface ParsedImageResponse {
    images: string[];
    originalResponse: any;
}

export class OpenAIResponseParser {
    static parseImageResponse(data: any): ParsedImageResponse {
        const images: string[] = [];

        // 策略1: 标准格式 (data[])
        if (data.data && Array.isArray(data.data)) {
            for (const item of data.data) {
                if (item.b64_json) {
                    images.push(`data:image/png;base64,${item.b64_json}`);
                } else if (item.url) {
                    images.push(item.url);
                }
            }
            if (images.length > 0) {
                return { images, originalResponse: data };
            }
        }

        // 策略2: Chat Completions格式 (choices[].message.content)
        const content = data.choices?.[0]?.message?.content;
        if (typeof content === 'string' && content.trim()) {
            const extracted = this.extractImagesFromContent(content);
            if (extracted.length > 0) {
                images.push(...extracted);
                return { images, originalResponse: data };
            }
        }

        return { images, originalResponse: data };
    }

    private static extractImagesFromContent(content: string): string[] {
        const images: string[] = [];
        const seen = new Set<string>();

        // 1. Markdown图片: ![alt](url)
        const markdownRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        let match;
        while ((match = markdownRegex.exec(content)) !== null) {
            const url = match[2].trim();
            if (url && !seen.has(url)) {
                images.push(url);
                seen.add(url);
            }
        }

        // 2. Markdown链接（图片扩展名）: [text](url.jpg)
        const linkRegex = /\[([^\]]*)\]\(([^)]+\.(jpg|jpeg|png|gif|webp|bmp)[^)]*)\)/gi;
        while ((match = linkRegex.exec(content)) !== null) {
            const url = match[2].trim();
            if (url && !seen.has(url)) {
                images.push(url);
                seen.add(url);
            }
        }

        // 3. 纯URL (以http开头，以图片扩展名结尾)
        const urlRegex = /https?:\/\/[^\s<>"]+?\.(jpg|jpeg|png|gif|webp|bmp)[^\s<>"]*/gi;
        while ((match = urlRegex.exec(content)) !== null) {
            const url = match[0].trim();
            if (url && !seen.has(url)) {
                images.push(url);
                seen.add(url);
            }
        }

        // 4. JSON格式
        try {
            const parsed = JSON.parse(content);
            if (parsed.images && Array.isArray(parsed.images)) {
                for (const url of parsed.images) {
                    if (typeof url === 'string' && url.trim() && !seen.has(url)) {
                        images.push(url.trim());
                        seen.add(url);
                    }
                }
            } else if (parsed.url && typeof parsed.url === 'string') {
                if (!seen.has(parsed.url)) {
                    images.push(parsed.url);
                }
            }
        } catch (e) {
            // 不是JSON
        }

        return images;
    }
}
