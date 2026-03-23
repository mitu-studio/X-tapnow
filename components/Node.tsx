import React, { useState, useRef, useCallback } from 'react';
import { NodeData } from '../types';
import { AppSettings } from '../types/settings';
import { DownloadIcon, MaximizeIcon, PlusIcon, SparklesIcon, UploadIcon, PlayIcon, TypeIcon, InfoIcon, FontSizePlusIcon, FontSizeMinusIcon } from './Icons';
import PromptPanel from './PromptPanel';

interface NodeProps {
    data: NodeData;
    scale: number;
    isSelected: boolean;
    showPanel?: boolean; // New prop
    appSettings: AppSettings; // For provider/model selection
    onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
    onNodeClick?: (e: React.MouseEvent, nodeId: string) => void; // Explicit click handler for logic separation
    onDoubleClick?: (nodeId: string) => void; // Double click handler for focus/zoom
    onConnectStart: (e: React.MouseEvent, nodeId: string, handleType: 'source' | 'target') => void;
    onConnectEnd: (e: React.MouseEvent, nodeId: string, handleType: 'source' | 'target') => void;
    onGenerate: (nodeId: string, prompt: string, config: any) => void;
    onMaximize?: (url: string, type: 'image' | 'video') => void;
    onUpload?: (nodeId: string, dataUrl: string) => void;
    onDownload?: (nodeId: string) => void;
    onResize?: (id: string, width: number, height: number) => void;
    onContextMenu?: (e: React.MouseEvent, id: string) => void;
    onPromptChange?: (nodeId: string, prompt: string) => void;
    onParamsChange?: (nodeId: string, params: any) => void;
    onContentChange?: (nodeId: string, content: string) => void;
    onDismissError?: (nodeId: string) => void;
    onTitleChange?: (nodeId: string, title: string) => void;
    onProviderChange?: (nodeId: string, providerId: string) => void;
    onModelChange?: (nodeId: string, modelId: string) => void;
    isAutoResize?: boolean;
    getFinalPrompt?: (nodeId: string) => string;
    onImageSwitch?: (nodeId: string, imageIndex: number) => void;
    onFontSizeChange?: (nodeId: string, fontSize: number) => void;
}

const Node = React.memo(({
    data,
    scale,
    isSelected,
    showPanel,
    appSettings,
    onMouseDown,
    onNodeClick,
    onDoubleClick,
    onConnectStart,
    onConnectEnd,
    onGenerate,
    onMaximize,
    onUpload,
    onDownload,
    onResize,
    onContextMenu,
    onPromptChange,
    onParamsChange,
    onContentChange,
    onDismissError,
    onTitleChange,
    onProviderChange,
    onModelChange,
    isAutoResize,
    getFinalPrompt,
    onImageSwitch,
    onFontSizeChange
}: NodeProps) => {
    const [hovered, setHovered] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleInputValue, setTitleInputValue] = useState('');
    const [showFinalPrompt, setShowFinalPrompt] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Stop wheel propagation natively to prevent canvas zoom
    React.useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const handleWheel = (e: WheelEvent) => {
            e.stopPropagation();
            // We don't prevent default, so scrolling still occurs
        };

        textarea.addEventListener('wheel', handleWheel, { passive: false });
        return () => textarea.removeEventListener('wheel', handleWheel);
    }, [data.type, data.content]); // Re-bind if type or content changes

    // Position styles
    const style: React.CSSProperties = {
        transform: `translate(${data.position.x}px, ${data.position.y}px)`,
        width: data.width,
        height: data.height,
        zIndex: isSelected ? 50 : 10,
        willChange: 'transform', // Optimization: Hint browser to promote to layer
        contain: 'layout style', // Optimization: Scope layout/style calculations
    };

    // ... Handlers ...

    const handleTitleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditingTitle(true);
        setTitleInputValue(data.title || '');
    };

    const handleTitleBlur = () => {
        setIsEditingTitle(false);
        if (titleInputValue !== data.title && onTitleChange) {
            onTitleChange(data.id, titleInputValue);
        }
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleTitleBlur();
        }
    };

    const handleUploadClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && onUpload) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const result = ev.target?.result as string;
                if (result) {
                    onUpload(data.id, result);
                }
            };
            reader.readAsDataURL(file);
        }
        // Reset input
        if (e.target) e.target.value = '';
    };

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDownload) {
            onDownload(data.id);
        }
    };

    const handleMaximize = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (data.content && onMaximize) {
            onMaximize(data.content, data.type === 'video' ? 'video' : 'image');
        }
    };

    const handleFontSizeChange = (e: React.MouseEvent, delta: number) => {
        e.stopPropagation();
        if (onFontSizeChange) {
            const currentSize = data.fontSize || 14; // 默认 14px
            const newSize = Math.max(10, Math.min(32, currentSize + delta)); // 限制在 10-32px 之间
            onFontSizeChange(data.id, newSize);
        }
    };


    // Resize Handle State
    const resizeRef = useRef<{
        isResizing: boolean;
        startX: number;
        startY: number;
        startWidth: number;
        startHeight: number;
    }>({ isResizing: false, startX: 0, startY: 0, startWidth: 0, startHeight: 0 });

    const handleResizeMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        resizeRef.current = {
            isResizing: true,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: data.width,
            startHeight: data.height
        };

        window.addEventListener('mousemove', handleResizeMove);
        window.addEventListener('mouseup', handleResizeUp);
    };

    const handleResizeMove = useCallback((e: MouseEvent) => {
        if (!resizeRef.current.isResizing || !onResize) return;

        const dx = (e.clientX - resizeRef.current.startX) / scale; // Adjust for viewport scale
        const dy = (e.clientY - resizeRef.current.startY) / scale;

        const newWidth = Math.max(200, resizeRef.current.startWidth + dx); // Min 200px
        const newHeight = Math.max(150, resizeRef.current.startHeight + dy); // Min 150px

        onResize(data.id, newWidth, newHeight);
    }, [data.id, onResize, scale]);

    const handleResizeUp = useCallback(() => {
        resizeRef.current.isResizing = false;
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeUp);
    }, [handleResizeMove]);

    // Cleanup listeners on unmount
    React.useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', handleResizeMove);
            window.removeEventListener('mouseup', handleResizeUp);
        };
    }, [handleResizeMove, handleResizeUp]);


    return (
        <div
            data-node-id={data.id}
            className={`node-element absolute flex flex-col group transition-shadow duration-200 ${data.type === 'text' ? '' : 'select-none'} ${isSelected ? 'z-50' : 'z-10'}`}
            style={style}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onContextMenu={(e) => onContextMenu?.(e, data.id)}
        >
            {/* Floating Label */}
            {isEditingTitle ? (
                <input
                    autoFocus
                    className="absolute -top-6 left-1 w-[200px] text-[10px] text-zinc-200 font-medium px-2 py-0.5 bg-zinc-900 border border-cyan-500 rounded-full outline-none shadow-lg z-50 pointer-events-auto"
                    value={titleInputValue}
                    onChange={(e) => setTitleInputValue(e.target.value)}
                    onBlur={handleTitleBlur}
                    onKeyDown={handleTitleKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                />
            ) : (
                <div
                    className="absolute -top-6 left-1 max-w-[200px] truncate text-[10px] text-zinc-400 font-medium px-2 py-0.5 bg-zinc-900/80 rounded-full border border-zinc-800 pointer-events-auto cursor-text whitespace-nowrap shadow-sm backdrop-blur-sm"
                    onDoubleClick={handleTitleDoubleClick}
                    title="Double-click to rename"
                >
                    {data.title || 'Untitled'}
                </div>
            )}

            {/* Node Visual Body */}
            <div
                className={`
                relative bg-zinc-900 rounded-3xl overflow-hidden
                border-2 ${isSelected ? 'border-cyan-500' : 'border-zinc-800 hover:border-zinc-600'}
                w-full h-full
            `}
                onMouseDown={(e) => onMouseDown(e, data.id)}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (onDoubleClick) {
                        onDoubleClick(data.id);
                    }
                }}
            >
                {/* ... existing content ... */}

                {/* Resize Handle */}
                <div
                    className={`absolute bottom-0 right-0 w-6 h-6 z-50 cursor-se-resize flex items-end justify-end p-1 ${hovered || isSelected ? 'opacity-100' : 'opacity-0'} transition-opacity`}
                    onMouseDown={handleResizeMouseDown}
                >
                    <div className="w-2 h-2 bg-zinc-600 rounded-br-lg rounded-tl-sm group-hover:bg-cyan-500 transition-colors" />
                </div>

                {/* Hidden File Input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                />

                {/* Header / Tools (Visible on hover) */}
                <div className={`absolute top-2 left-2 flex gap-1 z-20 transition-opacity duration-200 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
                    {/* Upload Button - Visible only for media */}
                    {data.type !== 'text' && (
                        <button
                            className="p-1.5 bg-zinc-800/80 rounded-lg hover:bg-zinc-700 text-zinc-300"
                            onClick={handleUploadClick}
                            title="Upload / Replace Image"
                        >
                            <UploadIcon className="w-3 h-3" />
                        </button>
                    )}

                    {/* Text Icon for Text Nodes */}
                    {data.type === 'text' && (
                        <div className="p-1.5 bg-zinc-800/80 rounded-lg text-cyan-500">
                            <TypeIcon className="w-3 h-3" />
                        </div>
                    )}

                    {/* Font Size Controls - Visible only for text nodes */}
                    {data.type === 'text' && (
                        <>
                            <button
                                className="p-1.5 bg-zinc-800/80 rounded-lg hover:bg-zinc-700 text-zinc-300"
                                onClick={(e) => handleFontSizeChange(e, -2)}
                                title="减小字体"
                            >
                                <FontSizeMinusIcon className="w-3 h-3" />
                            </button>
                            <div className="px-2 py-1.5 bg-zinc-800/80 rounded-lg text-[10px] text-zinc-400 font-mono">
                                {data.fontSize || 14}px
                            </div>
                            <button
                                className="p-1.5 bg-zinc-800/80 rounded-lg hover:bg-zinc-700 text-zinc-300"
                                onClick={(e) => handleFontSizeChange(e, 2)}
                                title="增大字体"
                            >
                                <FontSizePlusIcon className="w-3 h-3" />
                            </button>
                        </>
                    )}

                    {/* Download & Maximize - Visible only if content exists */}
                    {data.content && (
                        <>
                            <button
                                className="p-1.5 bg-zinc-800/80 rounded-lg hover:bg-zinc-700 text-zinc-300"
                                onClick={handleDownload}
                                title="Download Content"
                            >
                                <DownloadIcon className="w-3 h-3" />
                            </button>
                            {data.type !== 'text' && (
                                <button
                                    className="p-1.5 bg-zinc-800/80 rounded-lg hover:bg-zinc-700 text-zinc-300"
                                    onClick={handleMaximize}
                                    title="View Full Size"
                                >
                                    <MaximizeIcon className="w-3 h-3" />
                                </button>
                            )}
                        </>
                    )}
                </div>




                {/* Content Area */}
                <div className="relative w-full h-full flex items-center justify-center bg-zinc-950/50">

                    {
                        data.status === 'loading' ? (
                            <div className="flex flex-col items-center gap-2">
                                <div className="relative flex items-center justify-center">
                                    {/* Circular Progress Bar */}
                                    <svg className="w-12 h-12 -rotate-90 transform" viewBox="0 0 48 48">
                                        {/* Track */}
                                        <circle
                                            cx="24"
                                            cy="24"
                                            r="18"
                                            fill="none"
                                            stroke="currentColor"
                                            className="text-zinc-800"
                                            strokeWidth="3"
                                        />
                                        {/* Indicator */}
                                        <circle
                                            cx="24"
                                            cy="24"
                                            r="18"
                                            fill="none"
                                            stroke="currentColor"
                                            className="text-cyan-500 transition-all duration-300 ease-out"
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                            // Circumference = 2 * pi * 18 ≈ 113.1
                                            strokeDasharray="113.1"
                                            strokeDashoffset={113.1 - (113.1 * (data.progress || 0)) / 100}
                                        />
                                    </svg>

                                    <div className="absolute flex flex-col items-center justify-center">
                                        {/* Percentage text inside circle */}
                                        <span className="text-[10px] text-cyan-500 font-bold font-mono">
                                            {data.progress || 0}%
                                        </span>
                                    </div>
                                </div>
                                <span className="text-[10px] text-zinc-500 font-medium tracking-wide animate-pulse">GENERATING</span>
                            </div>
                        ) : data.status === 'error' ? (
                            <div className="flex flex-col items-center gap-3 p-6 text-center">
                                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                                    <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs font-bold text-red-400 uppercase tracking-widest">Generation Failed</span>
                                    <p className="text-[11px] text-zinc-400 leading-relaxed max-w-[200px] line-clamp-3">
                                        {data.title?.replace('Error: ', '') || 'An unknown error occurred'}
                                    </p>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onGenerate(data.id, data.prompt || '', data.params);
                                        }}
                                        className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full text-[10px] font-bold transition-colors border border-zinc-700"
                                    >
                                        Try Again
                                    </button>
                                    {data.type === 'text' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDismissError?.(data.id);
                                            }}
                                            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full text-[10px] font-bold transition-colors border border-zinc-700"
                                        >
                                            Confirm
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : data.type === 'text' ? (
                            <div className="w-full h-full flex flex-col pt-8 bg-zinc-900/30 overflow-hidden">
                                <textarea
                                    ref={textareaRef}
                                    className="w-full h-full px-4 pb-4 bg-transparent text-zinc-300 resize-none outline-none border-none placeholder-zinc-700 leading-relaxed font-mono select-auto overflow-y-auto custom-scrollbar"
                                    style={{ fontSize: `${data.fontSize || 14}px` }}
                                    placeholder="Start typing your content here... Use the panel below to let AI transform or extend this text."
                                    value={data.content || ''}
                                    onChange={(e) => onContentChange?.(data.id, e.target.value)}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onWheel={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                        // Stop propagation for certain keys so global shortcuts don't trigger
                                        if (e.key === 'Delete' || e.key === 'Backspace' || e.key === ' ') {
                                            e.stopPropagation();
                                        }
                                    }}
                                />
                            </div>
                        ) : data.content ? (
                            data.type === 'video' ? (
                                <div className="relative w-full h-full group/video">
                                    <video
                                        key={data.content}
                                        ref={videoRef}
                                        src={data.content}
                                        className="w-full h-full object-cover block"
                                        controls={isPlaying}
                                        loop
                                        playsInline
                                        onPlay={() => setIsPlaying(true)}
                                        onPause={() => setIsPlaying(false)}
                                        onLoadedMetadata={(e) => {
                                            if (isAutoResize && onResize) {
                                                const vid = e.currentTarget;
                                                const aspect = vid.videoWidth / vid.videoHeight;
                                                const height = data.width / aspect;
                                                if (Math.abs(height - data.height) > 1) {
                                                    onResize(data.id, data.width, height);
                                                }
                                            }
                                        }}
                                    />
                                    {!isPlaying && (
                                        <div
                                            className="absolute inset-0 flex items-center justify-center bg-black/10 z-10 pointer-events-none"
                                        >
                                            <div
                                                className="p-3 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 shadow-lg cursor-pointer pointer-events-auto transition-transform duration-200 hover:scale-110 active:scale-95"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsPlaying(true);
                                                    videoRef.current?.play();
                                                }}
                                                onMouseDown={(e) => e.stopPropagation()}
                                            >
                                                <PlayIcon className="w-8 h-8 text-white drop-shadow-md" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="relative w-full h-full">
                                    <img
                                        src={data.content}
                                        alt="Node content"
                                        className="w-full h-full object-cover block select-none pointer-events-none"
                                        onLoad={(e) => {
                                            if (isAutoResize && onResize) {
                                                const img = e.currentTarget;
                                                const aspect = img.naturalWidth / img.naturalHeight;
                                                const height = (data.width / aspect) + 40; // Add some padding for UI
                                                if (Math.abs(height - data.height) > 2) {
                                                    onResize(data.id, data.width, height);
                                                }
                                            }
                                        }}
                                    />

                                    {/* 多图数字选择器 */}
                                    {data.allImages && data.allImages.length > 1 && (
                                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/10">
                                            {/* 图片计数 */}
                                            <span className="text-[10px] text-white/70 font-medium">
                                                {(data.currentImageIndex ?? 0) + 1}/{data.allImages.length}
                                            </span>

                                            <div className="w-px h-3 bg-white/20" />

                                            {/* 数字按钮 */}
                                            <div className="flex gap-1">
                                                {data.allImages.map((_, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onImageSwitch?.(data.id, idx);
                                                        }}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        className={`
                                                            w-6 h-6 rounded-md text-[10px] font-bold transition-all
                                                            ${idx === (data.currentImageIndex ?? 0)
                                                                ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/50 scale-110'
                                                                : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
                                                            }
                                                        `}
                                                        title={`切换到图片 ${idx + 1}`}
                                                    >
                                                        {idx + 1}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        ) : (
                            <div className="text-zinc-600 flex flex-col items-center gap-2">
                                <div className="w-12 h-12 rounded-2xl bg-zinc-800/50 flex items-center justify-center">
                                    <SparklesIcon className="w-5 h-5 opacity-20" />
                                </div>
                                <span className="text-[10px] uppercase tracking-widest opacity-40">Empty Canvas</span>
                            </div>
                        )
                    }
                </div>

                {/* Overlay Gradient for Text readability if needed */}
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

                {/* Final Prompt Info Icon (Bottom Center) */}
                {(data.prompt || getFinalPrompt) && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30">
                        <div
                            className="relative p-1.5 bg-zinc-800/80 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-cyan-400 cursor-help transition-all"
                            onMouseEnter={() => setShowFinalPrompt(true)}
                            onMouseLeave={() => setShowFinalPrompt(false)}
                            onMouseDown={(e) => e.stopPropagation()}
                            title="查看最终提示词"
                        >
                            <InfoIcon className="w-3 h-3" />

                            {/* Final Prompt Tooltip */}
                            {showFinalPrompt && (
                                <div
                                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 max-w-[80vw] p-3 bg-zinc-900/95 border border-zinc-700 rounded-lg shadow-xl z-50 pointer-events-none backdrop-blur-sm"
                                    style={{ wordBreak: 'break-word' }}
                                >
                                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">最终提示词</div>
                                    <div className="text-xs text-zinc-300 leading-relaxed max-h-60 overflow-auto custom-scrollbar whitespace-pre-wrap">
                                        {getFinalPrompt ? getFinalPrompt(data.id) : data.prompt}
                                    </div>
                                    {/* Arrow */}
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 border-r border-b border-zinc-700 rotate-45" />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Embedded Prompt Panel (Visible when selected) - Absolute positioning to not affect height */}
            {showPanel && (
                <div className="absolute top-full left-0 w-full pt-4 z-50 cursor-auto">
                    <PromptPanel
                        initialPrompt={data.prompt}
                        initialParams={data.params}
                        status={data.status}
                        nodeType={data.type === 'video' ? 'video' : data.type === 'text' ? 'text' : 'image'}
                        appSettings={appSettings}
                        providerId={data.providerId}
                        modelId={data.modelId}
                        onGenerate={(prompt, config) => onGenerate(data.id, prompt, config)}
                        onPromptChange={(txt) => onPromptChange?.(data.id, txt)}
                        onParamsChange={(params) => onParamsChange?.(data.id, params)}
                        onProviderChange={(id) => onProviderChange?.(data.id, id)}
                        onModelChange={(id) => onModelChange?.(data.id, id)}
                    />
                </div>
            )}

            {/* Connection Handles */}

            {/* Input Handle (Left) */}
            {/* Input Handle (Left) */}
            <div
                className="absolute top-1/2 -left-6 -translate-y-1/2 w-12 h-12 flex items-center justify-center cursor-crosshair z-30 group/handle"
                onMouseDown={(e) => { e.stopPropagation(); onConnectStart(e, data.id, 'target'); }}
                onMouseUp={(e) => { e.stopPropagation(); onConnectEnd(e, data.id, 'target'); }}
            >
                <div className="w-3.5 h-3.5 rounded-full bg-zinc-900 border-2 border-zinc-600 group-hover/handle:border-cyan-400 group-hover/handle:scale-125 transition-all shadow-lg flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 group-hover/handle:bg-cyan-400 transition-colors" />
                </div>
            </div>

            {/* Output Handle (Right) */}
            <div
                className="absolute top-1/2 -right-6 -translate-y-1/2 w-12 h-12 flex items-center justify-center cursor-crosshair z-30 group/handle"
                onMouseDown={(e) => { e.stopPropagation(); onConnectStart(e, data.id, 'source'); }}
                onMouseUp={(e) => { e.stopPropagation(); onConnectEnd(e, data.id, 'source'); }}
            >
                <div className="w-3.5 h-3.5 rounded-full bg-zinc-900 border-2 border-zinc-600 group-hover/handle:border-cyan-400 group-hover/handle:scale-125 transition-all shadow-lg flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 group-hover/handle:bg-cyan-400 transition-colors" />
                </div>
            </div>
        </div>
    );
});

export default Node;
