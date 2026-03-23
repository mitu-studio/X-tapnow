import { generateText } from './geminiService';
import { ApiProviderType, EndpointMode } from '../types/settings';

export interface Shot {
    id: string;
    text: string;        // 分镜描述/镜头内容
    startTime?: string;  // 开始时间（如果来自SRT）
    endTime?: string;    // 结束时间（如果来自SRT）
}

interface ApiConfig {
    apiKey?: string;
    baseUrl?: string;
    type?: ApiProviderType;
    endpointMode?: EndpointMode;
    customEndpoint?: string;
}

/**
 * 解析 SRT 字幕文件格式
 * SRT 格式示例:
 * 1
 * 00:00:01,000 --> 00:00:04,000
 * 这是第一句字幕
 * 
 * 2
 * 00:00:04,500 --> 00:00:08,000
 * 这是第二句字幕
 */
export function parseSRT(content: string): Shot[] {
    const shots: Shot[] = [];
    const blocks = content.trim().split(/\n\s*\n/);

    for (const block of blocks) {
        const lines = block.trim().split('\n');
        if (lines.length < 2) continue;

        // 第一行是序号
        const idLine = lines[0].trim();

        // 第二行是时间码
        const timeLine = lines[1].trim();
        const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2}[,.:]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.:]\d{3})/);

        if (timeMatch) {
            const startTime = timeMatch[1].replace(',', '.');
            const endTime = timeMatch[2].replace(',', '.');

            // 剩余行是字幕文本
            const text = lines.slice(2).join('\n').trim();

            if (text) {
                shots.push({
                    id: `shot-${idLine}`,
                    text,
                    startTime,
                    endTime
                });
            }
        }
    }

    return shots;
}

/**
 * 解析普通文本文件
 * 按段落分割（空行分隔）或按行分割
 */
export function parseTXT(content: string): string[] {
    // 首先尝试按段落分割
    const paragraphs = content.trim().split(/\n\s*\n/);

    if (paragraphs.length > 1) {
        return paragraphs.map(p => p.trim()).filter(Boolean);
    }

    // 如果只有一个段落，按行分割
    return content.trim().split('\n').map(line => line.trim()).filter(Boolean);
}

/**
 * 使用 AI 分析文本并生成分镜
 */
export async function analyzeScript(
    text: string,
    model: string,
    apiConfig: ApiConfig,
    tsc?: number,
    customSystemPrompt?: string
): Promise<Shot[]> {
    const defaultSystemPrompt = `你是一个专业的分镜师和视频策划专家。请分析用户提供的文本内容，将其拆分为适合视频制作的分镜镜头。

要求：
1. 每个分镜应该是一个独立的视觉场景
2. 分镜描述应该简洁但具体，便于后续图片/视频生成
3. 保持原文的核心信息和情感
4. 如果文本是对话或旁白，转换为视觉化的场景描述

请以 JSON 数组格式返回，格式如下：
[
  {"id": "1", "text": "场景描述..."},
  {"id": "2", "text": "场景描述..."}
]

只返回 JSON 数组，不要包含其他文字说明。`;

    // 使用自定义提示或默认提示
    // 只有在没有 tsc 参数时才携带 systemPrompt
    const systemPrompt = tsc ? undefined : (customSystemPrompt?.trim() || defaultSystemPrompt);

    const userPrompt = text;

    try {
        const result = await generateText(
            userPrompt,
            model,
            apiConfig,
            [],           // 无参考图片
            systemPrompt,
            tsc           // 传递 tsc 参数
        );

        // 尝试解析结果
        let shots: any[] = [];
        let contentToParse = result.trim();

        // 尝试从 Markdown 代码块中提取内容 (支持 json, text, 或无标记)
        const codeBlockMatch = contentToParse.match(/```(?:\w+)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            contentToParse = codeBlockMatch[1].trim();
        }

        try {
            // 尝试解析 JSON
            const parsed = JSON.parse(contentToParse);

            if (Array.isArray(parsed)) {
                shots = parsed;
            } else {
                throw new Error('解析结果不是数组');
            }
        } catch (jsonError) {
            // JSON 解析失败，回退到按行分割
            console.log('JSON 解析失败，尝试按行分割文本', jsonError);

            // 按换行符分割，合并可能的分镜内容
            // 支持真实换行符 (\r\n, \n) 和字面量换行符 (\\n)
            const lines = contentToParse.split(/\\n|\r?\n/).filter(line => line.trim());

            shots = lines.map((line, index) => ({
                id: `shot-${index + 1}`,
                text: line.trim()
            }));
        }

        if (shots.length === 0) {
            throw new Error('未能从 AI 响应中提取有效分镜');
        }

        return shots.map((shot: any, index: number) => ({
            id: shot.id || `shot-${index + 1}`,
            text: shot.text || shot.description || (typeof shot === 'string' ? shot : ''),
            startTime: shot.startTime,
            endTime: shot.endTime
        })).filter((shot: Shot) => shot.text);

    } catch (error) {
        console.error('AI 分镜解析失败:', error);
        throw new Error(`AI 分镜失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
}

/**
 * 读取上传的文件内容
 */
export function readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            resolve(content);
        };
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsText(file);
    });
}
