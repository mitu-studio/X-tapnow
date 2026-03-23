import React, { useState, useEffect } from 'react';
import { NodeData, GridState } from '../types';
import { AppSettings, ApiProvider } from '../types/settings';
import { VideoIcon, Wand2Icon, UploadIcon, PlayIcon, CheckIcon, XIcon, Trash2Icon, Loader2Icon, DownloadIcon, MaximizeIcon } from './Icons';

interface GridModeViewProps {
    nodes: NodeData[];
    settings: AppSettings;
    onCreateTask: (prompt: string, config: any, image?: any) => void;
    onDeleteNode: (nodeId: string) => void;
    onMaximize: (url: string, type: 'image' | 'video') => void;
    gridState: GridState;
    onStateChange: (newState: Partial<GridState>) => void;
}

export const GridModeView: React.FC<GridModeViewProps> = ({ nodes, settings, onCreateTask, onDeleteNode, onMaximize, gridState, onStateChange }) => {
    // Destructure state from props
    const { prompt, duration, aspectRatio, resolution, count, uploadedImage, providerId, modelId } = gridState;

    // Preview URL state (derived from uploadedImage blob, local only is fine as blob persists in parent)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Initialize preview if image exists
    useEffect(() => {
        if (uploadedImage) {
            setPreviewUrl(URL.createObjectURL(uploadedImage));
        } else {
            setPreviewUrl(null);
        }
    }, [uploadedImage]);

    const videoProviders = settings?.videoProviders || [];
    // Helper handlers to update parent state
    const updateState = (updates: Partial<GridState>) => onStateChange(updates);

    const setPrompt = (val: string) => updateState({ prompt: val });
    const setDuration = (val: string) => updateState({ duration: val });
    const setAspectRatio = (val: string) => updateState({ aspectRatio: val });
    const setResolution = (val: string) => updateState({ resolution: val });
    const setCount = (val: number) => updateState({ count: val });
    const setProviderId = (val: string) => updateState({ providerId: val });
    const setModelId = (val: string) => updateState({ modelId: val });
    const setUploadedImage = (val: Blob | null) => updateState({ uploadedImage: val });

    const currentProvider = videoProviders.find(p => p.id === providerId) || videoProviders.find(p => p.isDefault) || videoProviders[0];

    // Initialize and sync provider/model defaults
    React.useEffect(() => {
        const defRef = videoProviders.find(p => p.isDefault) || videoProviders[0];

        // If current provider is not set, or is no longer valid, or if global default changed relative to empty state (initial load logic)
        // We want to update IF:
        // 1. No provider selected yet.
        // 2. The currently selected provider no longer exists in the list.
        // 3. User expects "Sync from Canvas" -> implies if global default changes, we should follow it unless user manually changed it locally?
        //    Actually, simpler: Just ensure valid defaults.

        const currentData = videoProviders.find(p => p.id === providerId);

        if (!providerId || !currentData) {
            if (defRef) {
                setProviderId(defRef.id);
                if (defRef.models.length > 0) {
                    setModelId(defRef.models[0].id);
                }
            }
        } else if (defRef && defRef.id !== providerId && !currentData.isDefault) {
            // If global default changed, and current selection is NOT the new default...
            // Should we overwrite? 
            // "api sync from canvas" implies "What I see in Settings is what I see here".
            // Since Grid Mode is ephemeral (unmounts on close), it usually resets.
            // But if specific "sync" is asked, maybe we should react to prop changes.
            // Let's assume if settings update, we refresh the default.
            setProviderId(defRef.id);
            if (defRef.models.length > 0) {
                setModelId(defRef.models[0].id);
            }
        }
    }, [settings?.videoProviders, settings?.defaultVideoProvider]); // track list or default flag changes

    // Update model when provider changes (fixed for state lift)
    const handleProviderChange = (newPId: string) => {
        // We update both provider and default model in one state update if possible, or sequential
        // Since updateState merges, sequential is fine for now, or build object
        const newP = videoProviders.find(p => p.id === newPId);
        if (newP && newP.models.length > 0) {
            updateState({ providerId: newPId, modelId: newP.models[0].id });
        } else {
            setProviderId(newPId);
        }
    };

    // Filter for video nodes only, reverse to show newest first
    const videoNodes = React.useMemo(() => [...nodes].filter(n => n.type === 'video').reverse(), [nodes]);

    // Virtual Scrolling State
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerWidth, setContainerWidth] = useState(1200); // Default guess

    // Grid config based on container width
    const getColumns = (width: number) => {
        if (width >= 1280) return 4;
        if (width >= 1000) return 3;
        if (width >= 640) return 2;
        return 1;
    };

    React.useEffect(() => {
        if (!scrollContainerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });

        resizeObserver.observe(scrollContainerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    };

    // Calculate visible range
    const columns = getColumns(containerWidth);
    const rowHeight = 320; // Approximation of Card height + gap
    const totalRows = Math.ceil(videoNodes.length / columns);
    const totalHeight = totalRows * rowHeight;

    // Buffer rows
    const buffer = 2;
    const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
    const visibleRowCount = Math.ceil((scrollContainerRef.current?.clientHeight || 800) / rowHeight) + 2 * buffer;
    const endRow = Math.min(totalRows, startRow + visibleRowCount);

    const startIndex = startRow * columns;
    const endIndex = endRow * columns;

    const visibleNodes = videoNodes.slice(startIndex, endIndex);
    const offsetY = startRow * rowHeight;

    const runningCount = videoNodes.filter(n => n.status === 'loading').length;
    const successCount = videoNodes.filter(n => n.status === 'success').length;
    const errorCount = videoNodes.filter(n => n.status === 'error').length;

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        // Select all finished nodes (success or error)
        const selectableNodes = videoNodes.filter(n => n.status === 'success' || n.status === 'error');
        if (selectedIds.size === selectableNodes.length && selectableNodes.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(selectableNodes.map(n => n.id)));
        }
    };

    // Calculate download candidates
    // If selection exists, use selection. Otherwise use all successful nodes.
    const downloadCandidates = React.useMemo(() => {
        const successNodes = videoNodes.filter(n => n.status === 'success' && n.content);
        if (selectedIds.size > 0) {
            return successNodes.filter(n => selectedIds.has(n.id));
        }
        return successNodes;
    }, [videoNodes, selectedIds]);

    const handleBatchDownload = async () => {
        const nodesToDownload = downloadCandidates;
        if (nodesToDownload.length === 0) return;

        for (let i = 0; i < nodesToDownload.length; i++) {
            const node = nodesToDownload[i];
            const link = document.createElement('a');
            link.href = node.content!;
            link.download = `video-${node.id}.mp4`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            // Delay to prevent browser blocking
            if (i < nodesToDownload.length - 1) {
                await new Promise(r => setTimeout(r, 500));
            }
        }
    };

    const handleBatchDelete = () => {
        if (selectedIds.size === 0) return;

        if (window.confirm(`确定要删除选中的 ${selectedIds.size} 个任务吗？`)) {
            Array.from(selectedIds).forEach(id => {
                onDeleteNode(id);
            });
            setSelectedIds(new Set());
        }
    };

    // Derived states for header
    const successfulNodesCount = videoNodes.filter(n => n.status === 'success' && n.content).length;
    const isAllSelected = successfulNodesCount > 0 && selectedIds.size === successfulNodesCount;
    const hasSelection = selectedIds.size > 0;

    const handleCreate = () => {
        if (!prompt.trim()) return;
        onCreateTask(prompt, { duration, aspectRatio, resolution, count, model: modelId, providerId: providerId }, uploadedImage);
        // Optional: clear prompt
        // setPrompt(''); 
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadedImage(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };

    const handleClearImage = () => {
        setUploadedImage(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="absolute inset-0 bg-[#09090b] text-white flex z-40 p-4 pt-16"> {/* Add padding top for the header bar */}

            <div className="flex w-full h-full bg-[#09090b] rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl">

                {/* Left Sidebar - Creator */}
                <div className="w-[360px] border-r border-zinc-800 flex flex-col p-6 gap-6 bg-[#0c0c0e] shrink-0">
                    {/* Header */}
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                            创建新视频
                        </h2>
                        <p className="text-zinc-500 text-xs mt-1">配置您的视频生成参数。</p>
                    </div>

                    {/* Prompt Input */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-zinc-400">提示词 (双击展开详细)</label>
                        <textarea
                            className="w-full h-32 bg-[#18181b] border border-zinc-700/50 rounded-xl p-3 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all resize-none placeholder:text-zinc-600 text-zinc-200"
                            placeholder="描述您的视频..."
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                        />
                    </div>

                    {/* Image Upload (Optional) */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-zinc-400">上传图片 (可选)</label>

                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                        />

                        {!previewUrl ? (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full h-10 border border-zinc-700/50 border-dashed rounded-xl flex items-center justify-center gap-2 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-all bg-[#18181b] hover:bg-zinc-800"
                            >
                                <UploadIcon className="w-4 h-4" />
                                <span className="text-xs">上传图片</span>
                            </button>
                        ) : (
                            <div className="relative w-full h-32 rounded-xl overflow-hidden border border-zinc-700/50 group">
                                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-1.5 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700"
                                        title="Replace"
                                    >
                                        <UploadIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={handleClearImage}
                                        className="p-1.5 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30"
                                        title="Remove"
                                    >
                                        <Trash2Icon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                        <p className="text-[10px] text-zinc-600">支持上传本地图片作为视频生成参考 (仅限一张)</p>
                    </div>

                    {/* Settings Grid */}
                    <div className="flex flex-col gap-4">
                        {/* API Provider & Model Selection */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-zinc-500">API 提供商</label>
                                <div className="relative group">
                                    <select
                                        value={providerId}
                                        onChange={(e) => handleProviderChange(e.target.value)}
                                        className="w-full bg-[#18181b] border border-zinc-700/50 rounded-lg p-2.5 text-sm text-zinc-200 appearance-none focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                                    >
                                        {videoProviders.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 text-xs">▼</div>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-zinc-500">模型</label>
                                    <button
                                        onClick={() => {
                                            const def = videoProviders.find(p => p.isDefault) || videoProviders[0];
                                            if (def) {
                                                handleProviderChange(def.id);
                                            }
                                        }}
                                        className="text-[10px] text-cyan-500 hover:text-cyan-400 cursor-pointer"
                                        title="重置为全局默认"
                                    >
                                        重置
                                    </button>
                                </div>
                                <div className="relative group">
                                    <select
                                        value={modelId}
                                        onChange={(e) => setModelId(e.target.value)}
                                        className="w-full bg-[#18181b] border border-zinc-700/50 rounded-lg p-2.5 text-sm text-zinc-200 appearance-none focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                                    >
                                        {currentProvider?.models.map(m => (
                                            <option key={m.id} value={m.id}>{m.displayName}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 text-xs">▼</div>
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-zinc-800/50 w-full" />

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-zinc-500">时长</label>
                                <div className="relative group">
                                    <select
                                        value={duration}
                                        onChange={(e) => setDuration(e.target.value)}
                                        className="w-full bg-[#18181b] border border-zinc-700/50 rounded-lg p-2.5 text-sm text-zinc-200 appearance-none focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                                    >
                                        <option value="15s">15 秒</option>
                                        <option value="10s">10 秒</option>
                                    </select>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 text-xs">▼</div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-zinc-500">方向</label>
                                <div className="relative group">
                                    <select
                                        value={aspectRatio}
                                        onChange={(e) => setAspectRatio(e.target.value)}
                                        className="w-full bg-[#18181b] border border-zinc-700/50 rounded-lg p-2.5 text-sm text-zinc-200 appearance-none focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                                    >
                                        <option value="16:9">横屏 (16:9)</option>
                                        <option value="9:16">竖屏 (9:16)</option>
                                        <option value="1:1">方屏 (1:1)</option>
                                        <option value="21:9">宽屏 (21:9)</option>
                                    </select>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 text-xs">▼</div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-zinc-500">分辨率</label>
                                <div className="relative group">
                                    <select
                                        value={resolution}
                                        onChange={(e) => setResolution(e.target.value)}
                                        className="w-full bg-[#18181b] border border-zinc-700/50 rounded-lg p-2.5 text-sm text-zinc-200 appearance-none focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                                    >
                                        <option value="720p">720p (标清)</option>
                                        <option value="1080p">1080p (高清)</option>
                                    </select>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 text-xs">▼</div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-zinc-500">生成数量</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="4"
                                    value={count}
                                    onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                                    className="w-full bg-[#18181b] border border-zinc-700/50 rounded-lg p-2.5 text-sm text-zinc-200 focus:outline-none focus:border-cyan-500/50"
                                />
                            </div>
                        </div>

                        <div className="flex-1"></div>

                        {/* Submit Button */}
                        <button
                            onClick={handleCreate}
                            className="w-full bg-white text-black font-bold h-12 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all active:scale-95 shadow-lg shadow-white/5"
                        >
                            <PlayIcon className="w-4 h-4 fill-current" />
                            开始生成
                        </button>
                    </div>
                </div>

                {/* Main Content (Task List) */}
                <div className="flex-1 flex flex-col bg-[#09090b] min-w-0">
                    {/* Header */}
                    <div className="h-16 border-b border-zinc-800/50 flex items-center px-8 gap-6 bg-[#09090b]">
                        <span className="font-bold text-white">任务列表</span>
                        <div className="h-4 w-px bg-zinc-800"></div>
                        <div className="flex items-center gap-4 text-sm font-medium">
                            <span className="text-zinc-500">共 {videoNodes.length} 个</span>
                            <span className="text-cyan-500">{runningCount} 进行中</span>
                            <span className="text-emerald-500">{successCount} 完成</span>
                            <span className="text-red-500">{errorCount} 失败</span>
                        </div>

                        {/* Batch Download Button Area */}
                        <div className="ml-auto flex items-center gap-4">
                            {/* Select All */}
                            {(videoNodes.some(n => n.status === 'success' || n.status === 'error')) && (
                                <button
                                    onClick={toggleSelectAll}
                                    className="text-xs text-zinc-400 hover:text-white transition-colors"
                                >
                                    {isAllSelected ? '取消全选' : '全选'}
                                </button>
                            )}

                            {/* Batch Delete */}
                            {hasSelection && (
                                <button
                                    onClick={handleBatchDelete}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-transparent hover:border-red-500/20"
                                    title="删除选中任务"
                                >
                                    <Trash2Icon className="w-4 h-4" />
                                    <span>删除 ({selectedIds.size})</span>
                                </button>
                            )}

                            <button
                                onClick={handleBatchDownload}
                                disabled={downloadCandidates.length === 0}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border border-transparent
                                    ${downloadCandidates.length > 0
                                        ? 'bg-zinc-800 text-white hover:bg-zinc-700 hover:border-zinc-700 hover:text-cyan-400 shadow-sm'
                                        : 'bg-zinc-900/50 text-zinc-600 cursor-not-allowed'}`}
                                title={hasSelection ? `下载选中的 ${downloadCandidates.length} 个视频` : `下载所有 ${downloadCandidates.length} 个已完成的视频`}
                            >
                                <DownloadIcon className="w-4 h-4" />
                                {hasSelection ? `下载选中 (${downloadCandidates.length})` : `包含下载 (${downloadCandidates.length})`}
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto p-8 custom-scrollbar relative"
                    >
                        {videoNodes.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-4">
                                <div className="w-24 h-24 rounded-3xl bg-zinc-900/50 flex items-center justify-center border border-zinc-800/50">
                                    <div className="text-sm">暂无任务</div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
                                <div
                                    className="grid gap-6 absolute top-0 left-0 right-0"
                                    style={{
                                        transform: `translateY(${offsetY}px)`,
                                        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`
                                    }}
                                >
                                    {visibleNodes.map(node => (
                                        <TaskCard
                                            key={node.id}
                                            node={node}
                                            isSelected={selectedIds.has(node.id)}
                                            onToggleSelection={(node.status === 'success' || node.status === 'error') ? () => toggleSelection(node.id) : undefined}
                                            onDelete={() => onDeleteNode(node.id)}
                                            onMaximize={onMaximize}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};



// Helper for live timer
function GenerationTimer({ startTime }: { startTime: number }) {
    const [elapsed, setElapsed] = useState(Date.now() - startTime);

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(Date.now() - startTime);
        }, 100);
        return () => clearInterval(interval);
    }, [startTime]);

    return <span className="text-cyan-400 animate-pulse">{(elapsed / 1000).toFixed(1)}s</span>;
}

// Subcomponent: Task Card
interface TaskCardProps {
    node: NodeData;
    isSelected?: boolean;
    onToggleSelection?: () => void;
    onDelete: () => void;
    onMaximize: (url: string, type: 'image' | 'video') => void;
    key?: React.Key;
}

function TaskCard({ node, isSelected, onToggleSelection, onDelete, onMaximize }: TaskCardProps) {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const [isHovering, setIsHovering] = React.useState(false);

    const handleMouseEnter = () => {
        setIsHovering(true);
        if (videoRef.current) {
            videoRef.current.play().catch(() => { });
        }
    };

    const handleMouseLeave = () => {
        setIsHovering(false);
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0; // Reset preview
        }
    };

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (node.content) {
            const link = document.createElement('a');
            link.href = node.content;
            link.download = `video-${node.id}.mp4`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleMaximize = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (node.content) {
            onMaximize(node.content, node.type === 'video' ? 'video' : 'image');
        }
    };

    const handleCheckboxClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleSelection && onToggleSelection();
    };

    return (
        <div
            className={`bg-[#18181b] border rounded-xl overflow-hidden group shadow-lg transition-all flex flex-col relative
            ${isSelected ? 'border-cyan-500/50 ring-1 ring-cyan-500/50' : 'border-zinc-800 hover:border-zinc-700'}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Selection Checkbox (Visible on hover or selected) */}
            {onToggleSelection && (
                <div
                    onClick={handleCheckboxClick}
                    className={`absolute top-2 left-2 z-30 w-5 h-5 rounded border cursor-pointer flex items-center justify-center transition-all
                    ${isSelected
                            ? 'bg-cyan-500 border-cyan-500'
                            : 'bg-black/40 border-white/30 hover:border-white/80 opacity-0 group-hover:opacity-100'}`}
                >
                    {isSelected && <CheckIcon className="w-3.5 h-3.5 text-black" />}
                </div>
            )}

            {/* Preview Area */}
            <div className="aspect-video bg-zinc-900 relative overflow-hidden">
                {node.status === 'success' && node.content ? (
                    node.type === 'video' ? (
                        <video
                            ref={videoRef}
                            src={node.content}
                            className="w-full h-full object-cover"
                            muted // Required for autoplay/hover play without interaction
                            loop
                            playsInline
                        />
                    ) : (
                        <img src={node.content} className="w-full h-full object-cover" alt="result" />
                    )
                ) : node.status === 'loading' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs text-cyan-500 font-mono">{node.progress || 0}%</span>
                    </div>
                ) : node.status === 'error' ? (
                    <div className="absolute inset-0 flex items-center justify-center text-red-500 gap-2">
                        <XIcon className="w-6 h-6" />
                        <span className="text-xs">Failed</span>
                    </div>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-700">
                        <VideoIcon className="w-8 h-8 opacity-20" />
                    </div>
                )}


                {/* Status Badge */}
                <div className={`absolute top-2 ${onToggleSelection ? 'left-8' : 'left-2'} px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-medium border border-white/10 text-white flex items-center gap-1 z-10 transition-all`}>
                    {node.status === 'success' ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> :
                        node.status === 'loading' ? <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" /> :
                            node.status === 'error' ? <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> :
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />}
                    {node.status === 'success' ? 'Finished' : node.status === 'loading' ? 'Generating' : node.status === 'error' ? 'Error' : 'Idle'}
                </div>

                {/* Overlaid Actions (Download & Maximize) */}
                {node.status === 'success' && (
                    <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        <button
                            onClick={handleMaximize}
                            className="p-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-white hover:bg-black/80 transition-colors"
                            title="全屏预览"
                        >
                            <MaximizeIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={handleDownload}
                            className="p-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-white hover:bg-black/80 transition-colors"
                            title="下载视频"
                        >
                            <DownloadIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}



                {/* Duration / Generation Time Overlay */}
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[10px] text-white font-mono shadow-sm z-10 pointer-events-none flex items-center gap-1">
                    {node.status === 'loading' && node.startTime ? (
                        <GenerationTimer startTime={node.startTime} />
                    ) : node.status === 'success' && node.executionTime ? (
                        <span className="text-emerald-400">{(node.executionTime / 1000).toFixed(1)}s</span>
                    ) : (
                        <span className="text-zinc-400">{node.params?.duration || '5s'}</span>
                    )}
                </div>
            </div>

            {/* Info Area */}
            <div className="p-3 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-zinc-200 truncate" title={node.title}>{node.title || 'Untitled Video'}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate" title={node.prompt}>{node.prompt || 'No prompt provided'}</p>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                    <Trash2Icon className="w-4 h-4" />
                </button>
            </div>

            {/* Meta Info */}
            <div className="px-3 pb-3 flex items-center gap-3 text-[10px] text-zinc-600 font-mono">
                <span>{node.params?.aspectRatio || '16:9'}</span>
                <span>{node.params?.duration || '5s'}</span>
                <span>{node.params?.resolution || '720p'}</span>
            </div>
        </div >
    );
}


