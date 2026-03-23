import React, { useMemo, useRef, useState, useEffect } from 'react';
import { NodeData, ViewportTransform } from '../types';

interface MinimapProps {
    nodes: NodeData[];
    viewport: ViewportTransform;
    onViewportChange: (v: ViewportTransform) => void;
}

const MINIMAP_WIDTH = 240;
const MINIMAP_HEIGHT = 160;
const PADDING = 500; // World padding

const Minimap: React.FC<MinimapProps> = ({ nodes, viewport, onViewportChange }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [isMinimapVisible, setIsMinimapVisible] = useState(true);

    // Calculate world bounding box
    const { worldBounds, scale, offset } = useMemo(() => {
        if (nodes.length === 0) {
            return {
                worldBounds: { x: 0, y: 0, w: 1000, h: 1000 },
                scale: 0.1,
                offset: { x: 0, y: 0 }
            };
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        nodes.forEach(n => {
            if (n.position.x < minX) minX = n.position.x;
            if (n.position.y < minY) minY = n.position.y;
            if (n.position.x + n.width > maxX) maxX = n.position.x + n.width;
            if (n.position.y + n.height > maxY) maxY = n.position.y + n.height;
        });

        // Add padding
        minX -= PADDING;
        minY -= PADDING;
        maxX += PADDING;
        maxY += PADDING;

        const w = maxX - minX;
        const h = maxY - minY;

        // Calculate scale to fit
        const scaleX = MINIMAP_WIDTH / w;
        const scaleY = MINIMAP_HEIGHT / h;
        const s = Math.min(scaleX, scaleY);

        // Center offsets
        const mapContentW = w * s;
        const mapContentH = h * s;
        const offX = (MINIMAP_WIDTH - mapContentW) / 2;
        const offY = (MINIMAP_HEIGHT - mapContentH) / 2;

        return {
            worldBounds: { x: minX, y: minY, w, h },
            scale: s,
            offset: { x: offX, y: offY }
        };
    }, [nodes]);

    // Helper: World -> Minimap coordinates
    const toMinimap = (wx: number, wy: number) => {
        return {
            x: (wx - worldBounds.x) * scale + offset.x,
            y: (wy - worldBounds.y) * scale + offset.y
        };
    };

    // Helper: Minimap -> World coordinates
    const toWorld = (mx: number, my: number) => {
        return {
            x: (mx - offset.x) / scale + worldBounds.x,
            y: (my - offset.y) / scale + worldBounds.y
        };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        updateViewportFromEvent(e);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isDragging) {
            updateViewportFromEvent(e);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
    };

    const updateViewportFromEvent = (e: React.PointerEvent) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const targetWorldPos = toWorld(mx, my);

        // Center viewport on targetWorldPos
        // CenterX = WindowWidth/2 - ViewportX / k -> ViewportX = -CenterX * k + WindowWidth/2 ?
        // Viewport: ScreenX = ViewportX + WorldX * k
        // WorldX = (ScreenX - ViewportX) / k
        // We want WorldX center to be at Screen Center.
        // ScreenW/2 = ViewportX + targetWorldPos.x * k
        // ViewportX = ScreenW/2 - targetWorldPos.x * k

        onViewportChange({
            x: window.innerWidth / 2 - targetWorldPos.x * viewport.k,
            y: window.innerHeight / 2 - targetWorldPos.y * viewport.k,
            k: viewport.k
        });
    };

    // Calculate visible viewport rect on minimap
    const viewportRect = useMemo(() => {
        // Visible World Area
        // left: -viewport.x / k
        // top: -viewport.y / k
        // w: window.innerWidth / k
        // h: window.innerHeight / k

        const vx = -viewport.x / viewport.k;
        const vy = -viewport.y / viewport.k;
        const vw = window.innerWidth / viewport.k;
        const vh = window.innerHeight / viewport.k;

        const p1 = toMinimap(vx, vy);
        const p2 = toMinimap(vx + vw, vy + vh);

        return {
            x: p1.x,
            y: p1.y,
            w: Math.max(p2.x - p1.x, 4), // Min size visibility
            h: Math.max(p2.y - p1.y, 4)
        };
    }, [viewport, worldBounds, scale, offset]);

    if (nodes.length === 0) return null;

    return (
        <>
            {/* 小地图主体 */}
            {isMinimapVisible && (
                <div
                    className="absolute bottom-24 right-6 z-50 bg-[#18181b]/90 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden backdrop-blur-sm select-none"
                    style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
                >
                    <div
                        ref={containerRef}
                        className="w-full h-full relative cursor-crosshair active:cursor-grabbing"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                    >
                        {/* Nodes */}
                        {nodes.map(node => {
                            const pos = toMinimap(node.position.x, node.position.y);
                            const width = node.width * scale;
                            const height = node.height * scale;

                            let bg = '#52525b';
                            if (node.type === 'image') bg = '#10b981';
                            if (node.type === 'video') bg = '#3b82f6';
                            if (node.type === 'text') bg = '#a1a1aa';

                            return (
                                <div
                                    key={node.id}
                                    className="absolute rounded-[1px]"
                                    style={{
                                        left: pos.x,
                                        top: pos.y,
                                        width: Math.max(width, 2),
                                        height: Math.max(height, 2),
                                        backgroundColor: bg,
                                        opacity: 0.8
                                    }}
                                />
                            );
                        })}

                        {/* Viewport Frame */}
                        <div
                            className="absolute border border-cyan-500 bg-cyan-500/10 pointer-events-none"
                            style={{
                                left: viewportRect.x,
                                top: viewportRect.y,
                                width: viewportRect.w,
                                height: viewportRect.h,
                            }}
                        />
                    </div>
                </div>
            )}

            {/* 控制按钮 */}
            <div className="absolute bottom-14 right-6 z-50 flex flex-row gap-2">
                {/* 问号按钮 - 显示快捷键 */}
                <button
                    onClick={() => setShowShortcuts(!showShortcuts)}
                    className="w-8 h-8 bg-[#18181b]/90 hover:bg-zinc-800 border border-zinc-700 rounded-md shadow-lg backdrop-blur-sm transition-all duration-200 flex items-center justify-center group"
                    title="快捷键提示"
                >
                    <svg
                        className="w-5 h-5 text-zinc-400 group-hover:text-cyan-400 transition-colors"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                </button>

                {/* 显示/隐藏小地图按钮 */}
                <button
                    onClick={() => setIsMinimapVisible(!isMinimapVisible)}
                    className="w-8 h-8 bg-[#18181b]/90 hover:bg-zinc-800 border border-zinc-700 rounded-md shadow-lg backdrop-blur-sm transition-all duration-200 flex items-center justify-center group"
                    title={isMinimapVisible ? "隐藏小地图" : "显示小地图"}
                >
                    {isMinimapVisible ? (
                        <svg
                            className="w-5 h-5 text-zinc-400 group-hover:text-cyan-400 transition-colors"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                        </svg>
                    ) : (
                        <svg
                            className="w-5 h-5 text-zinc-400 group-hover:text-cyan-400 transition-colors"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                            />
                        </svg>
                    )}
                </button>
            </div>

            {/* 快捷键提示弹窗 */}
            {showShortcuts && (
                <div
                    className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center backdrop-blur-sm"
                    onClick={() => setShowShortcuts(false)}
                >
                    <div
                        className="bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <svg
                                    className="w-5 h-5 text-cyan-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                                    />
                                </svg>
                                键盘快捷键
                            </h3>
                            <button
                                onClick={() => setShowShortcuts(false)}
                                className="text-zinc-400 hover:text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-3">
                            <ShortcutItem keys={["Space"]} description="平移画布（拖拽）" />
                            <ShortcutItem keys={["Delete"]} description="删除选中的节点/连接" />
                            <ShortcutItem keys={["Backspace"]} description="删除选中的节点/连接" />
                            <ShortcutItem keys={["Escape"]} description="取消选择" />
                            <ShortcutItem keys={["Ctrl", "G"]} description="将选中节点创建为分组" />
                            <ShortcutItem keys={["Ctrl", "C"]} description="复制选中的节点" />
                            <ShortcutItem keys={["Shift"]} description="多选节点（配合点击）" />
                            <ShortcutItem keys={["鼠标滚轮"]} description="缩放画布" />
                        </div>

                        <div className="mt-6 pt-4 border-t border-zinc-800">
                            <p className="text-sm text-zinc-500 text-center">
                                提示：点击背景或按 ESC 关闭此窗口
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// 快捷键项组件
const ShortcutItem: React.FC<{ keys: string[]; description: string }> = ({ keys, description }) => {
    return (
        <div className="flex items-center justify-between py-2 px-3 bg-zinc-900/50 rounded-lg hover:bg-zinc-900 transition-colors">
            <div className="flex items-center gap-2">
                {keys.map((key, idx) => (
                    <React.Fragment key={idx}>
                        {idx > 0 && <span className="text-zinc-600">+</span>}
                        <kbd className="px-2 py-1 text-xs font-semibold text-cyan-400 bg-zinc-800 border border-zinc-700 rounded shadow-sm">
                            {key}
                        </kbd>
                    </React.Fragment>
                ))}
            </div>
            <span className="text-sm text-zinc-400">{description}</span>
        </div>
    );
};

export default Minimap;

