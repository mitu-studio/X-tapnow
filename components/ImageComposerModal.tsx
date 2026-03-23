import React, { useState, useRef, useEffect, useCallback } from 'react';
import { XIcon, GridIcon, LayersIcon } from './Icons';
import ConfirmDialog from './ConfirmDialog';
import InputDialog from './InputDialog';
import ReferenceStitcher from './ReferenceStitcher';

interface ComposerItem {
    id: string;
    type: 'image' | 'text';
    content: string; // URL for image, text content for text
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize?: number;
    color?: string;
    zIndex: number;
    origImg?: HTMLImageElement;
    origW?: number;
    origH?: number;
}

interface ImageComposerModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialImages?: string[]; // URLs of images to add initially
    onSendToCard?: (blob: Blob) => void;
}

const ImageComposerModal: React.FC<ImageComposerModalProps> = ({ isOpen, onClose, initialImages = [], onSendToCard }) => {
    const [items, setItems] = useState<ComposerItem[]>([]);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);


    const [canvasBg, setCanvasBg] = useState('#ffffff'); // 3333 default workspace bg
    const [exportSizeSelection, setExportSizeSelection] = useState('1920,1080');
    const [mode, setMode] = useState<'free' | 'stitch'>('free');

    // Custom Confirm Dialog State
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isDanger?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });

    const [inputState, setInputState] = useState<{
        isOpen: boolean;
        title: string;
        defaultValue: string;
        defaultFontSize: number;
        onConfirm: (val: string, fs: number) => void;
    }>({
        isOpen: false,
        title: '',
        defaultValue: '',
        defaultFontSize: 36,
        onConfirm: () => { }
    });

    const dragRef = useRef<{
        isDragging: boolean;
        isResizing: boolean;
        resizeDir: string;
        startX: number;
        startY: number;
        startItemX: number;
        startItemY: number;
        startItemW: number;
        startItemH: number;
        startFontSize: number;
    }>({
        isDragging: false,
        isResizing: false,
        resizeDir: '',
        startX: 0,
        startY: 0,
        startItemX: 0,
        startItemY: 0,
        startItemW: 0,
        startItemH: 0,
        startFontSize: 36
    });

    const EDIT_WIDTH = 1280; // 3333 original edit size
    const EDIT_HEIGHT = 720;

    // Track if we have already initialized images for this session
    const hasInitializedRef = useRef(false);

    // Effect 1: Initialization Logic
    useEffect(() => {
        if (isOpen) {
            // Only add images if NOT already initialized
            if (!hasInitializedRef.current && initialImages.length > 0) {
                hasInitializedRef.current = true;
                // Add images (we trust addImageFromUrl handles async state updates correctly)
                initialImages.forEach(url => addImageFromUrl(url));
            }
        } else {
            // Reset on close
            hasInitializedRef.current = false;
            setItems([]);
            setSelectedItemId(null);
        }
    }, [isOpen, initialImages]);

    // Effect 2: Event Listeners (Keyboard/Paste)
    useEffect(() => {
        if (!isOpen) return;

        // Keyboard Delete
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' && selectedItemId) {
                // Check if not typing in prompt/input
                if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                    deleteItem(selectedItemId);
                }
            }
        };

        // Clipboard Paste (3333 original)
        const handlePaste = (e: ClipboardEvent) => {
            const clipboardItems = e.clipboardData?.items;
            if (!clipboardItems) return;

            for (let i = 0; i < clipboardItems.length; i++) {
                if (clipboardItems[i].type.startsWith('image/')) {
                    const file = clipboardItems[i].getAsFile();
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            if (ev.target?.result) addImageFromUrl(ev.target.result as string);
                        };
                        reader.readAsDataURL(file);
                        e.preventDefault();
                        break;
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('paste', handlePaste);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('paste', handlePaste);
        };
    }, [isOpen, selectedItemId]);

    const addImageFromUrl = (url: string) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            let w = img.width;
            let h = img.height;
            const maxW = EDIT_WIDTH * 0.4;
            const maxH = EDIT_HEIGHT * 0.5;
            if (w > maxW) { h = h * maxW / w; w = maxW; }
            if (h > maxH) { w = w * maxH / h; h = maxH; }

            // We need to construct the item inside the setter to get correct zIndex
            setItems(prev => {
                const newItem: ComposerItem = {
                    id,
                    type: 'image',
                    content: url,
                    x: Math.random() * (EDIT_WIDTH - w - 50) + 25,
                    y: Math.random() * (EDIT_HEIGHT - h - 50) + 25,
                    width: w,
                    height: h,
                    zIndex: prev.length + 1, // Use prev.length here
                    origImg: img,
                    origW: img.width,
                    origH: img.height
                };
                return [...prev, newItem];
            });
            setSelectedItemId(id);
        };
        img.src = url;
    };

    const addText = () => {
        setInputState({
            isOpen: true,
            title: '添加文字',
            defaultValue: '双击编辑文字',
            defaultFontSize: 36,
            onConfirm: (text, fs) => {
                if (!text) return;
                const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const newItem: ComposerItem = {
                    id,
                    type: 'text',
                    content: text,
                    x: EDIT_WIDTH / 2 - 100,
                    y: 50,
                    width: 200,
                    height: 50,
                    fontSize: fs || 36, // Use provided font size
                    color: '#333333', // 3333 original text color
                    zIndex: items.length + 1
                };
                setItems(prev => [...prev, newItem]);
                setSelectedItemId(id);
                setInputState(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        Array.from(files).forEach((file: any) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) addImageFromUrl(ev.target.result as string);
            };
            reader.readAsDataURL(file);
        });
        e.target.value = ''; // 3333 original clear value
    };

    const handleMouseDown = (e: React.MouseEvent, item: ComposerItem, type: 'move' | 'resize', dir: string = '') => {
        e.stopPropagation();
        setSelectedItemId(item.id);

        dragRef.current = {
            isDragging: type === 'move',
            isResizing: type === 'resize',
            resizeDir: dir,
            startX: e.clientX,
            startY: e.clientY,
            startItemX: item.x,
            startItemY: item.y,
            startItemW: item.width,
            startItemH: item.height,
            startFontSize: item.fontSize || 36
        };

        const onMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - dragRef.current.startX;
            const dy = moveEvent.clientY - dragRef.current.startY;

            setItems(prev => prev.map(it => {
                if (it.id !== item.id) return it;

                if (dragRef.current.isDragging) {
                    return { ...it, x: dragRef.current.startItemX + dx, y: dragRef.current.startItemY + dy };
                }

                if (dragRef.current.isResizing) {
                    let { startItemW, startItemH, startItemX, startItemY, resizeDir } = dragRef.current;
                    const ratio = startItemW / startItemH;
                    let newW = startItemW, newH = startItemH, newX = startItemX, newY = startItemY;

                    if (resizeDir === 'se') {
                        newW = Math.max(50, startItemW + dx);
                        newH = newW / ratio;
                    } else if (resizeDir === 'sw') {
                        newW = Math.max(50, startItemW - dx);
                        newH = newW / ratio;
                        newX = startItemX + startItemW - newW;
                    } else if (resizeDir === 'ne') {
                        newW = Math.max(50, startItemW + dx);
                        newH = newW / ratio;
                        newY = startItemY + startItemH - newH;
                    } else if (resizeDir === 'nw') {
                        newW = Math.max(50, startItemW - dx);
                        newH = newW / ratio;
                        newX = startItemX + startItemW - newW;
                        newY = startItemY + startItemH - newH;
                    }

                    const scaleFactor = newW / startItemW;
                    const newFontSize = Math.max(12, dragRef.current.startFontSize * scaleFactor);

                    return { ...it, width: newW, height: newH, x: newX, y: newY, fontSize: newFontSize };
                }
                return it;
            }));
        };

        const onMouseUp = () => {
            dragRef.current.isDragging = false;
            dragRef.current.isResizing = false;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const deleteItem = (id: string) => {
        setItems(prev => prev.filter(it => it.id !== id));
        if (selectedItemId === id) setSelectedItemId(null);
    };

    const clearAll = () => {
        setConfirmState({
            isOpen: true,
            title: '确认清空',
            message: '确定要清空画布上的所有内容吗？此操作无法撤销。',
            isDanger: true,
            onConfirm: () => {
                setItems([]);
                setSelectedItemId(null);
                setConfirmState(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const handleRequestClose = () => {
        if (items.length > 0) {
            setConfirmState({
                isOpen: true,
                title: '退出确认',
                message: '内容尚未保存，退出后将清空所有排版。确定退出吗？',
                isDanger: true,
                onConfirm: () => {
                    setItems([]);
                    setSelectedItemId(null);
                    onClose();
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                }
            });
            return;
        }
        setItems([]);
        setSelectedItemId(null);
        onClose();
    };

    const exportImage = async () => {
        if (items.length === 0) { alert('请先添加图片或文字'); return; }

        const canvas = await generateResultCanvas();
        if (!canvas) return;

        const targetW = canvas.width;
        const targetH = canvas.height;

        const link = document.createElement('a');
        link.download = `合成图片_${targetW}x${targetH}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    const handleSendToCardAction = async () => {
        if (items.length === 0) { alert('请先添加图片或文字'); return; }
        if (!onSendToCard) return;

        // 发送至卡片时，限制最大维度防止内存溢出导致卡顿
        const canvas = await generateResultCanvas(3840);
        if (!canvas) return;

        canvas.toBlob((blob) => {
            if (blob) {
                onSendToCard(blob);
                // 发送成功后清空内容
                setItems([]);
                setSelectedItemId(null);
            }
        }, 'image/png', 0.85); // 增加压缩
    };

    const generateResultCanvas = async (maxDim?: number) => {
        // 3333 Original Smart Scaling Logic
        let maxNeededScale = 1;
        items.forEach(item => {
            if (item.type === 'image' && item.origW) {
                const scaleForOriginal = item.origW / item.width;
                if (scaleForOriginal > maxNeededScale) {
                    maxNeededScale = scaleForOriginal;
                }
            }
        });

        let scale = maxNeededScale;

        // 限制最大缩放倍数，防止产生异常大图导致主画布卡顿
        if (maxDim) {
            const currentW = EDIT_WIDTH * scale;
            const currentH = EDIT_HEIGHT * scale;
            if (currentW > maxDim || currentH > maxDim) {
                scale = Math.min(maxDim / EDIT_WIDTH, maxDim / EDIT_HEIGHT);
            }
        }

        const targetW = Math.round(EDIT_WIDTH * scale);
        const targetH = Math.round(EDIT_HEIGHT * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        ctx.imageSmoothingEnabled = false; // 3333 original setting
        ctx.fillStyle = canvasBg;
        ctx.fillRect(0, 0, targetW, targetH);

        const sortedItems = [...items].sort((a, b) => a.zIndex - b.zIndex);

        for (const item of sortedItems) {
            if (item.type === 'image') {
                const img = item.origImg || new Image();
                if (!item.origImg) {
                    img.src = item.content;
                    await new Promise(resolve => img.onload = resolve);
                }
                ctx.drawImage(
                    img,
                    Math.round(item.x * scale),
                    Math.round(item.y * scale),
                    Math.round(item.width * scale),
                    Math.round(item.height * scale)
                );
            } else {
                const fontSize = Math.round((item.fontSize || 36) * scale);
                ctx.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
                ctx.fillStyle = item.color || '#333';
                ctx.textBaseline = 'top';
                ctx.fillText(item.content, Math.round(item.x * scale), Math.round(item.y * scale));
            }
        }
        return canvas;
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[110] flex flex-col animate-in fade-in duration-300"
            style={{ backgroundColor: '#1a1a2e', fontFamily: '"Microsoft YaHei", sans-serif' }}
        >
            {/* Toolbar - Optimized Style */}
            <div
                className="h-[64px] flex items-center px-6 gap-4 shrink-0 shadow-lg z-20"
                style={{ backgroundColor: '#2d2d44', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            >
                <div className="flex items-center gap-2 mr-2">
                    <label className="flex items-center gap-1.5 px-4 py-2 bg-[#4a90d9] hover:bg-[#357abd] rounded-md text-sm font-medium cursor-pointer transition-all shadow-sm">
                        <span>📷</span> 添加图片
                        <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileAdd} />
                    </label>

                    <button
                        onClick={addText}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#4a90d9] hover:bg-[#357abd] rounded-md text-sm font-medium transition-all shadow-sm text-white"
                    >
                        <span>📝</span> 添加文字
                    </button>

                    <div className="ml-4 flex items-center bg-black/30 rounded-lg p-1 border border-white/10">
                        <button
                            onClick={() => setMode('free')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${mode === 'free' ? 'bg-[#4a90d9] text-white shadow' : 'text-zinc-400 hover:text-white'}`}
                        >
                            <GridIcon className="w-3.5 h-3.5" />
                            自由画布
                        </button>
                        <button
                            onClick={() => setMode('stitch')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${mode === 'stitch' ? 'bg-[#4a90d9] text-white shadow' : 'text-zinc-400 hover:text-white'}`}
                        >
                            <LayersIcon className="w-3.5 h-3.5" />
                            参考图拼接
                        </button>
                    </div>
                </div>

                {mode === 'free' && (
                    <>
                        <div className="h-8 w-px bg-white/10" />

                        <div className="flex items-center gap-3 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">导出尺寸</span>
                                <select
                                    value={exportSizeSelection}
                                    onChange={(e) => setExportSizeSelection(e.target.value)}
                                    className="bg-[#1a1a2e] text-white text-xs rounded border border-white/10 px-2 py-1 outline-none cursor-pointer hover:border-[#4a90d9]/50 transition-colors"
                                >
                                    <option value="1920,1080">1920×1080 (FHD)</option>
                                    <option value="2560,1440">2560×1440 (2K)</option>
                                    <option value="3840,2160">3840×2160 (4K)</option>
                                    <option value="1280,720">1280×720 (HD)</option>
                                </select>
                            </div>

                            <div className="w-px h-4 bg-white/10" />

                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">背景</span>
                                <div className="relative group w-7 h-7">
                                    <input
                                        type="color"
                                        value={canvasBg}
                                        onChange={(e) => setCanvasBg(e.target.value)}
                                        className="absolute inset-0 w-full h-full rounded cursor-pointer border border-white/20 p-0 overflow-hidden"
                                    />
                                </div>
                            </div>
                        </div>

                    </>
                )}

                <div className="flex items-center gap-2 ml-auto">
                    {mode === 'free' && (
                        <>
                            {/* High Importance Hint */}
                            <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/15 border border-amber-500/30 rounded-md animate-pulse">
                                <span className="text-amber-400 text-sm">⚠️</span>
                                <span className="text-amber-200/90 text-[11px] font-bold tracking-tight">提示：上传素材请控制不要太大，避免处理性能下降以及后续发送至api生图生视频出错</span>
                            </div>

                            <div className="h-8 w-px bg-white/10 mx-2" />

                            <button
                                onClick={exportImage}
                                className="flex items-center gap-1.5 px-4 py-2 bg-[#4a90d9] hover:bg-[#357abd] rounded-md text-sm font-bold transition-all shadow-md text-white"
                            >
                                <span>💾</span> 导出图片
                            </button>

                            <button
                                onClick={handleSendToCardAction}
                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-md text-sm font-bold transition-all text-white shadow-md border-none cursor-pointer"
                            >
                                <span>🖼️</span> 发送至卡片
                            </button>

                            <button
                                onClick={clearAll}
                                style={{ backgroundColor: '#e74c3c' }}
                                className="px-4 py-2 hover:bg-red-600 rounded-md text-sm font-medium transition-all text-white ml-2"
                            >
                                🗑️ 清空
                            </button>
                        </>
                    )}

                    <button
                        onClick={handleRequestClose}
                        className="ml-2 p-2 hover:bg-white/10 rounded-full text-white/70 transition-colors group"
                        title="关闭合成器"
                    >
                        <XIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            </div>

            {/* Canvas Wrapper */}
            {mode === 'free' ? (
                <>
                    <div className="flex-1 overflow-auto flex justify-center p-10 bg-[#1a1a2e]">
                        <div
                            style={{
                                width: EDIT_WIDTH,
                                height: EDIT_HEIGHT,
                                backgroundColor: canvasBg,
                                position: 'relative',
                                boxShadow: '0 4px 30px rgba(0,0,0,0.5)'
                            }}
                            onMouseDown={() => setSelectedItemId(null)}
                        >
                            {items.map(item => (
                                <div
                                    key={item.id}
                                    style={{
                                        position: 'absolute',
                                        left: item.x,
                                        top: item.y,
                                        width: item.width,
                                        height: item.height,
                                        zIndex: item.zIndex,
                                        cursor: 'move',
                                    }}
                                    onMouseDown={(e) => handleMouseDown(e, item, 'move')}
                                    className={`group select-none ${selectedItemId === item.id ? 'outline-[3px] outline-[#4a90d9]' : ''}`}
                                >
                                    {item.type === 'image' ? (
                                        <img
                                            src={item.content}
                                            draggable={false}
                                            className="w-full h-full object-contain pointer-events-none display-block"
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                padding: '5px 10px',
                                                fontSize: item.fontSize,
                                                color: item.color,
                                                fontWeight: 'bold'
                                            }}
                                            className="flex items-center h-full"
                                            onDoubleClick={() => {
                                                setInputState({
                                                    isOpen: true,
                                                    title: '编辑文字',
                                                    defaultValue: item.content,
                                                    defaultFontSize: item.fontSize || 36,
                                                    onConfirm: (newText, newFs) => {
                                                        if (newText) {
                                                            setItems(prev => prev.map(it => it.id === item.id ? { ...it, content: newText, fontSize: newFs } : it));
                                                        }
                                                        setInputState(prev => ({ ...prev, isOpen: false }));
                                                    }
                                                });
                                            }}
                                        >
                                            {item.content}
                                        </div>
                                    )}

                                    {/* Resize Handles - 3333 Style */}
                                    {selectedItemId === item.id && (
                                        <>
                                            <div
                                                onMouseDown={(e) => handleMouseDown(e, item, 'resize', 'nw')}
                                                className="absolute -top-[7px] -left-[7px] w-[14px] h-[14px] bg-[#4a90d9] border-2 border-white rounded-[2px] cursor-nw-resize z-20"
                                            />
                                            <div
                                                onMouseDown={(e) => handleMouseDown(e, item, 'resize', 'ne')}
                                                className="absolute -top-[7px] -right-[7px] w-[14px] h-[14px] bg-[#4a90d9] border-2 border-white rounded-[2px] cursor-ne-resize z-20"
                                            />
                                            <div
                                                onMouseDown={(e) => handleMouseDown(e, item, 'resize', 'sw')}
                                                className="absolute -bottom-[7px] -left-[7px] w-[14px] h-[14px] bg-[#4a90d9] border-2 border-white rounded-[2px] cursor-sw-resize z-20"
                                            />
                                            <div
                                                onMouseDown={(e) => handleMouseDown(e, item, 'resize', 'se')}
                                                className="absolute -bottom-[7px] -right-[7px] w-[14px] h-[14px] bg-[#4a90d9] border-2 border-white rounded-[2px] cursor-se-resize z-20"
                                            />
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                                                style={{ backgroundColor: '#e74c3c' }}
                                                className="absolute top-1 right-1 w-6 h-6 rounded flex items-center justify-center text-white text-base opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                ×
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Original Hint Section */}
                    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-black/80 px-5 py-2 rounded-lg text-xs text-zinc-400 pointer-events-none z-[120]">
                        提示：拖拽移动 | 四角拖拽缩放 | 双击文字编辑 | Delete键删除选中
                    </div>
                </>
            ) : (
                <div className="flex-1 overflow-hidden h-[calc(100vh-64px)]">
                    <ReferenceStitcher onSendToCard={onSendToCard} onClose={onClose} />
                </div>
            )}

            <ConfirmDialog
                isOpen={confirmState.isOpen}
                title={confirmState.title}
                message={confirmState.message}
                isDanger={confirmState.isDanger}
                onConfirm={confirmState.onConfirm}
                onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
            />

            <InputDialog
                isOpen={inputState.isOpen}
                title={inputState.title}
                defaultValue={inputState.defaultValue}
                defaultFontSize={inputState.defaultFontSize}
                onConfirm={inputState.onConfirm}
                onCancel={() => setInputState(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
};

export default ImageComposerModal;
