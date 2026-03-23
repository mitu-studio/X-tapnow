import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    DownloadIcon,
    LayersIcon,
    HistoryIcon,
    XIcon,
    CloudUploadIcon,
    UploadIcon,
    ImageIcon,
    Trash2Icon
} from './Icons';

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Categories Configuration
const CATEGORIES = [
    { id: 'shot', label: '镜头参考', suffix: '--分镜参考', defaultName: 'generated-' },
    { id: 'scene', label: '场景参考', suffix: '--场景参考', defaultName: 'generated-' },
    { id: 'character', label: '人物参考', suffix: '--人物参考', defaultName: 'gemini-ima' },
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

interface ImageItem {
    id: string;
    file?: File;
    url: string;
    name: string;
}

interface ImageCardProps {
    image: ImageItem;
    onRemove: () => void;
    onNameChange: (name: string) => void;
    onReplace: (file: File) => void;
}

const ImageCard: React.FC<ImageCardProps> = ({ image, onRemove, onNameChange, onReplace }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleReplace = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onReplace(e.target.files[0]);
        }
    };

    return (
        <div className="bg-zinc-900/40 rounded-xl p-3 border border-zinc-800/50 flex flex-col gap-3 group mb-4">
            {/* Image Preview */}
            <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-zinc-800 bg-black/20">
                <img
                    src={image.url}
                    alt="preview"
                    className="w-full h-full object-cover opacity-90 transition-opacity hover:opacity-100"
                />
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-500/90 text-white rounded-md opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                >
                    <Trash2Icon className="w-3 h-3" />
                </button>
            </div>

            {/* Input Field */}
            <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500">自定义名称 (可选)</label>
                <div className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 focus-within:border-zinc-700 transition-colors">
                    <input
                        type="text"
                        value={image.name}
                        onChange={(e) => onNameChange(e.target.value)}
                        className="w-full bg-transparent text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none font-mono"
                    />
                </div>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-between items-center">
                <div
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors flex items-center gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleReplace}
                    />
                    <UploadIcon className="w-3 h-3" />
                    <span>本地上传</span>
                </div>
            </div>
        </div>
    );
};

interface CategoryColumnProps {
    category: typeof CATEGORIES[number];
    images: ImageItem[];
    onAddImages: (files: File[]) => void;
    onUpdateImage: (id: string, updates: Partial<ImageItem>) => void;
    onRemoveImage: (id: string) => void;
}

const CategoryColumn: React.FC<CategoryColumnProps> = ({ category, images, onAddImages, onUpdateImage, onRemoveImage }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onAddImages(Array.from(e.target.files));
            e.target.value = '';
        }
    };

    return (
        <div className="flex flex-col h-full border-r border-zinc-800 last:border-r-0 min-w-[200px]">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-900/20">
                <div className="flex items-center gap-2">
                    <h3 className="text-zinc-100 font-bold text-sm">{category.label}</h3>
                    <span className="text-zinc-500 text-xs font-medium">({images.length})</span>
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors border border-zinc-700/50"
                        title="上传"
                    >
                        <UploadIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                        className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors border border-zinc-700/50"
                        title="图库"
                    >
                        <ImageIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {images.map((img) => (
                    <ImageCard
                        key={img.id}
                        image={img}
                        onRemove={() => onRemoveImage(img.id)}
                        onNameChange={(name) => onUpdateImage(img.id, { name })}
                        onReplace={(file) => onUpdateImage(img.id, { file, url: URL.createObjectURL(file) })}
                    />
                ))}

                {images.length === 0 && (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border border-dashed border-zinc-800 rounded-xl aspect-video flex flex-col items-center justify-center gap-2 text-zinc-600 hover:bg-zinc-800/30 hover:border-zinc-700 cursor-pointer transition-all"
                    >
                        <CloudUploadIcon className="w-6 h-6 opacity-40" />
                        <span className="text-xs">点击上传</span>
                    </div>
                )}
            </div>
        </div>
    );
};

interface ReferenceStitcherProps {
    onClose?: () => void;
    onSendToCard?: (blob: Blob) => void;
}

const ReferenceStitcher: React.FC<ReferenceStitcherProps> = ({ onClose, onSendToCard }) => {
    // State
    const [images, setImages] = useState<Record<CategoryId, ImageItem[]>>({
        shot: [],
        scene: [],
        character: []
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleAddImages = (categoryId: CategoryId, files: File[]) => {
        const categoryConfig = CATEGORIES.find(c => c.id === categoryId);
        if (!categoryConfig) return;

        const newImages = files.map(file => ({
            id: generateId(),
            file,
            url: URL.createObjectURL(file),
            name: categoryConfig.defaultName
        }));

        setImages(prev => ({
            ...prev,
            [categoryId]: [...prev[categoryId], ...newImages]
        }));
    };

    const handleUpdateImage = (categoryId: CategoryId, imageId: string, updates: Partial<ImageItem>) => {
        setImages(prev => ({
            ...prev,
            [categoryId]: prev[categoryId].map(img => img.id === imageId ? { ...img, ...updates } : img)
        }));
    };

    const handleRemoveImage = (categoryId: CategoryId, imageId: string) => {
        setImages(prev => ({
            ...prev,
            [categoryId]: prev[categoryId].filter(img => img.id !== imageId)
        }));
    };

    const drawCanvas = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = 1200;
        const height = 900;
        const textColor = '#000000';
        const bgColor = '#ffffff';
        const font = "bold 20px Inter, system-ui, sans-serif";

        canvas.width = width;
        canvas.height = height;

        // Fill White
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);

        // Helper: Load Image
        const loadImage = (url: string): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = url;
            });
        };

        // Helper: Draw images in a specified rectangle
        // Strategy: Divide the rect into a grid based on number of images
        const drawImagesInRect = async (imgList: ImageItem[], x: number, y: number, w: number, h: number, suffix: string) => {
            if (imgList.length === 0) return;

            // For Shot (Top Half), we prefer horizontal split if 2 images
            // For others, grid
            const count = imgList.length;
            let cols = Math.ceil(Math.sqrt(count));
            let rows = Math.ceil(count / cols);

            // Special case for top row (Shot) to prefer horizontal strip
            if (w > h * 2 && count <= 3) {
                rows = 1;
                cols = count;
            }

            const cellW = w / cols;
            const cellH = h / rows;
            const textHeight = 40;

            for (let i = 0; i < count; i++) {
                const imgData = imgList[i];
                const img = await loadImage(imgData.url);

                const r = Math.floor(i / cols);
                const c = i % cols;

                const cellX = x + c * cellW;
                const cellY = y + r * cellH;

                // Drawing area inside cell (minus padding and text)
                const padding = 20;
                const drawX = cellX + padding;
                const drawY = cellY + padding;
                const drawW = cellW - padding * 2;
                const drawH = cellH - padding * 2 - textHeight;

                // Fit Image
                const imgRatio = img.width / img.height;
                const targetRatio = drawW / drawH;

                let renderW, renderH, renderX, renderY;

                if (imgRatio > targetRatio) {
                    renderW = drawW;
                    renderH = drawW / imgRatio;
                    renderX = drawX;
                    renderY = drawY + (drawH - renderH) / 2;
                } else {
                    renderH = drawH;
                    renderW = drawH * imgRatio;
                    renderY = drawY;
                    renderX = drawX + (drawW - renderW) / 2;
                }

                ctx.drawImage(img, renderX, renderY, renderW, renderH);

                // Draw Text
                const label = `${imgData.name}${suffix}`;
                ctx.fillStyle = textColor;
                ctx.font = font;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(label, cellX + cellW / 2, drawY + drawH + 10);
            }
        };

        const shotH = height / 2;
        const bottomH = height / 2;

        // Draw Shot
        await drawImagesInRect(images.shot, 0, 0, width, shotH, CATEGORIES[0].suffix);
        // Draw Scene (Bottom Left)
        await drawImagesInRect(images.scene, 0, shotH, width / 2, bottomH, CATEGORIES[1].suffix);
        // Draw Character (Bottom Right)
        await drawImagesInRect(images.character, width / 2, shotH, width / 2, bottomH, CATEGORIES[2].suffix);

    }, [images]);

    useEffect(() => {
        drawCanvas();
    }, [drawCanvas]);

    const handleDownload = () => {
        if (!canvasRef.current) return;
        const link = document.createElement('a');
        link.download = `ref-stitch-${Date.now()}.png`;
        link.href = canvasRef.current.toDataURL('image/png');
        link.click();
    };

    const handleSplice = () => {
        setIsGenerating(true);
        setTimeout(() => {
            drawCanvas();
            setIsGenerating(false);
        }, 600);
    };

    const handleSendToCardAction = () => {
        if (!canvasRef.current || !onSendToCard) return;
        canvasRef.current.toBlob((blob) => {
            if (blob) {
                onSendToCard(blob);
            }
        }, 'image/png', 0.85);
    };

    const totalImages = images.shot.length + images.scene.length + images.character.length;

    return (
        <div className="flex flex-col h-full w-full bg-[#09090b] text-zinc-100 font-sans overflow-hidden">

            {/* Header (Integrated into parent in a real scenario, but keeping inner layout) */}
            {/* If the parent handles the header, we might skip this, but here we have the toolbar inside. */}

            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar - 3 Columns */}
                <div className="w-[45%] flex-shrink-0 flex border-r border-zinc-800 bg-[#09090b]">
                    {CATEGORIES.map(cat => (
                        <CategoryColumn
                            key={cat.id}
                            category={cat}
                            images={images[cat.id]}
                            onAddImages={(files) => handleAddImages(cat.id, files)}
                            onUpdateImage={(imgId, updates) => handleUpdateImage(cat.id, imgId, updates)}
                            onRemoveImage={(imgId) => handleRemoveImage(cat.id, imgId)}
                        />
                    ))}
                </div>

                {/* Right Main Area */}
                <div className="flex-1 relative bg-[#0c0c0e] flex flex-col">

                    {/* Canvas Area */}
                    <div className="flex-1 flex items-center justify-center p-8 pb-32">
                        <div className="relative shadow-2xl shadow-black rounded-sm overflow-hidden bg-white max-w-full max-h-full border border-zinc-800">
                            <canvas
                                ref={canvasRef}
                                className="block w-auto h-auto max-w-full max-h-[calc(100vh-10rem)] object-contain"
                            />
                            {totalImages === 0 && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-zinc-100/5">
                                    <div className="text-zinc-400 text-sm bg-black/50 px-4 py-2 rounded backdrop-blur">
                                        请在左侧添加参考图
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Top Right Floating Actions */}
                    <div className="absolute top-6 right-6 flex flex-col gap-3">


                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-3 px-4 py-2.5 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/50 rounded-lg text-sm transition-all backdrop-blur"
                        >
                            <DownloadIcon className="w-4 h-4" />
                            <span>下载图片</span>
                        </button>



                        {onSendToCard && (
                            <button
                                onClick={handleSendToCardAction}
                                className="flex items-center gap-3 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg"
                            >
                                <ImageIcon className="w-4 h-4" />
                                <span>发送至卡片</span>
                            </button>
                        )}

                        {onClose && (
                            <button
                                onClick={onClose}
                                className="flex items-center gap-3 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors shadow-lg"
                            >
                                <XIcon className="w-4 h-4" />
                                <span>关闭</span>
                            </button>
                        )}
                    </div>

                    {/* Bottom Action Button */}


                </div>
            </div>
        </div>
    );
};

export default ReferenceStitcher;
