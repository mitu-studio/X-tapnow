export interface Position {
  x: number;
  y: number;
}

export interface NodeData {
  id: string;
  type: 'image' | 'prompt' | 'input' | 'video' | 'text';
  source?: 'grid' | 'canvas';
  title?: string;
  position: Position;
  content?: string; // Image URL (blob:...) - 主图片或当前显示的图片
  blob?: Blob;      // Actual binary data for persistence - 主图片Blob
  allImages?: string[]; // 所有生成的图片URLs（用于多图支持）
  allBlobs?: Blob[];    // 所有图片的Blob数据
  currentImageIndex?: number; // 当前选中的图片索引（默认0）
  prompt?: string;
  status?: 'idle' | 'loading' | 'success' | 'error';
  progress?: number; // 0-100
  taskId?: string; // For resuming polling
  remixedFromVideoId?: string; // 用于 remix 模式，记录源视频的 taskId
  errorDetails?: string; // 完整的错误信息详情（用于调试和显示）
  width: number;
  height: number;
  selected?: boolean;
  providerId?: string; // API提供商ID（可选，未指定则使用默认）
  modelId?: string;    // 模型ID（可选，未指定则使用提供商的第一个模型）
  params?: {
    model: string;
    aspectRatio: string;
    resolution: string;
    batchSize: number;
    systemPrompt?: string;
    duration?: string;
    seconds?: string;
    quality?: string;
    enhance_prompt?: boolean;
    enable_upsample?: boolean;
  };
  groupId?: string;
  fontSize?: number; // 文本节点字体大小（px），默认 14
  startTime?: number; // timestamp when generation started
  executionTime?: number; // duration in ms
}

export interface GroupData {
  id: string;
  title: string;
  position: Position;
  width: number;
  height: number;
  color?: string;
  collapsed?: boolean;
  selected?: boolean;
}

export interface Connection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  // For simplicity, assuming single input/output flow for this demo
}

export interface ViewportTransform {
  x: number;
  y: number;
  k: number; // scale
}

export interface GenerationConfig {
  prompt: string;
  model: string;
  aspectRatio: string;
  count: number;
}

export interface GridState {
  prompt: string;
  duration: string;
  aspectRatio: string;
  resolution: string;
  count: number;
  uploadedImage: Blob | null;
  providerId: string;
  modelId: string;
}
