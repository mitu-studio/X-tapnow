import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ViewportTransform } from '../types';

interface InfiniteCanvasProps {
    viewport: ViewportTransform;
    onViewportChange: (viewport: ViewportTransform) => void;
    children: React.ReactNode;
    // Callback when mouse down occurs on the canvas (but NOT consuming it for pan)
    onCanvasMouseDown?: (e: React.MouseEvent) => void;
    onCanvasDeselect?: () => void;
    className?: string;
    background?: React.ReactNode;
}

/**
 * A canvas that can be panned and zoomed.
 */
const InfiniteCanvas: React.FC<InfiniteCanvasProps> = ({
    viewport,
    onViewportChange,
    children,
    onCanvasMouseDown,
    onCanvasDeselect,
    className = '',
    background
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Zoom management
    const handleWheel = (e: React.WheelEvent) => {
        // e.deltaY is positive when zooming out, negative when zooming in
        const delta = -e.deltaY;

        // Perceived zoom factor should be exponential for consistency
        const factor = Math.pow(1.1, delta / 100);

        const newScale = Math.min(Math.max(viewport.k * factor, 0.05), 5);

        // Mouse position in screen coordinates
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Current world coordinates of the mouse
        const worldX = (mouseX - viewport.x) / viewport.k;
        const worldY = (mouseY - viewport.y) / viewport.k;

        // Formula for zooming to a point:
        // New Screen Position = ViewportPos + WorldPos * NewScale
        // We want the screen position to stay the same (mouseX, mouseY).
        // mouseX = newX + worldX * newScale  =>  newX = mouseX - worldX * newScale
        const newX = mouseX - worldX * newScale;
        const newY = mouseY - worldY * newScale;

        onViewportChange({ x: newX, y: newY, k: newScale });
    };

    // We use a ref to track panning state to avoid stale closures in window listeners
    const panState = useRef({
        isPanning: false,
        startX: 0,
        startY: 0,
        initialX: 0,
        initialY: 0,
        hasMoved: false
    });

    const handlePointerDown = (e: React.PointerEvent) => {
        // Only trigger panning if clicking directly on the canvas background
        // or if it's the middle mouse button
        const isBackgroundClick = e.target === e.currentTarget;

        // Pan Trigger: Middle Click OR (Left Click on background without Space)
        if (e.button === 1 || (e.button === 0 && !isSpacePressed && isBackgroundClick)) {
            // Prevent default to stop browser selection/drag-drop interference
            e.preventDefault();
            // Capture pointer so we get move/up events even outside the window
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

            panState.current = {
                isPanning: true,
                startX: e.clientX,
                startY: e.clientY,
                initialX: viewport.x,
                initialY: viewport.y,
                hasMoved: false
            };
            document.body.style.cursor = 'grabbing';
        }
        // Box Selection Trigger: Left Click + Space (on background)
        else if (e.button === 0 && isSpacePressed && isBackgroundClick) {
            if (onCanvasMouseDown) {
                onCanvasMouseDown(e as unknown as React.MouseEvent);
            }
        }
    };

    // Track space key for panning context
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
                    setIsSpacePressed(true);
                }
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') setIsSpacePressed(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Use a ref for the scale to keep event listeners stable
    const scaleRef = useRef(viewport.k);
    useEffect(() => {
        scaleRef.current = viewport.k;
    }, [viewport.k]);

    useEffect(() => {
        const handlePointerMove = (e: PointerEvent) => {
            if (panState.current.isPanning) {
                const dx = e.clientX - panState.current.startX;
                const dy = e.clientY - panState.current.startY;

                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                    panState.current.hasMoved = true;
                }

                onViewportChange({
                    x: panState.current.initialX + dx,
                    y: panState.current.initialY + dy,
                    k: scaleRef.current
                });
            }
        };

        const handlePointerUp = (e: PointerEvent) => {
            if (panState.current.isPanning) {
                if (!panState.current.hasMoved) {
                    if (onCanvasDeselect) {
                        onCanvasDeselect();
                    }
                }
                panState.current.isPanning = false;
                document.body.style.cursor = 'default';
            }
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [onViewportChange, onCanvasDeselect]);

    // Important: Prevent default wheel behavior (scroll)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const onWheel = (e: WheelEvent) => e.preventDefault();
        container.addEventListener('wheel', onWheel, { passive: false });
        return () => container.removeEventListener('wheel', onWheel);
    }, []);

    return (
        <div
            ref={containerRef}
            className={`w-screen h-screen relative overflow-hidden bg-[#1a1a1a] select-none cursor-grab ${className}`}
            onPointerDown={handlePointerDown}
            onWheel={handleWheel}
        >
            {background}
            <div
                className="absolute origin-top-left"
                style={{
                    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.k})`,
                }}
            >
                {children}
            </div>
        </div>
    );
};

export default InfiniteCanvas;
