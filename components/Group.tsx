import React, { useState, useRef, useEffect } from 'react';
import { GroupData, NodeData, ViewportTransform } from '../types';
import { ChevronDownIcon, ChevronRightIcon, MoveIcon, FolderIcon, Trash2Icon, PlayIcon, VideoIcon, FileTextIcon, Wand2Icon, SaveIcon } from './Icons';

interface GroupProps {
    group: GroupData;
    nodes: NodeData[];
    viewport: ViewportTransform;
    isSelected: boolean;
    onMouseDown: (e: React.MouseEvent) => void;
    onResize: (e: React.MouseEvent, direction: 'nw' | 'ne' | 'sw' | 'se') => void;
    onTitleChange: (newTitle: string) => void;
    onContextMenu: (e: React.MouseEvent) => void;
    onDelete: () => void;
    onRun: (mode: 'video' | 'text' | 'all') => void;
}

const Group: React.FC<GroupProps> = ({
    group,
    nodes,
    viewport,
    isSelected,
    onMouseDown,
    onResize,
    onTitleChange,
    onContextMenu,
    onDelete,
    onRun
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(group.title);
    const [showRunMenu, setShowRunMenu] = useState(false);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const runMenuRef = useRef<HTMLDivElement>(null);

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onDelete();
    };

    useEffect(() => {
        if (isEditing && titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.select();
        }
    }, [isEditing]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (runMenuRef.current && !runMenuRef.current.contains(event.target as Node)) {
                setShowRunMenu(false);
            }
        };

        if (showRunMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showRunMenu]);

    const handleTitleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
    };

    const handleTitleBlur = () => {
        setIsEditing(false);
        if (editTitle.trim() !== group.title) {
            onTitleChange(editTitle.trim() || 'Untitled Group');
        }
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleTitleBlur();
        }
    };

    const handleRunClick = (e: React.MouseEvent, mode: 'video' | 'text' | 'all') => {
        e.stopPropagation();
        onRun(mode);
        setShowRunMenu(false);
    };

    // Style for the group container - now fully controlled by React State
    const style: React.CSSProperties = {
        transform: `translate(${group.position.x}px, ${group.position.y}px)`,
        width: `${group.width}px`,
        height: `${group.height}px`,
        zIndex: 0,
    };

    // Determine color theme
    const baseColor = group.color || 'bg-slate-800/20';
    const borderColor = isSelected ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'border-slate-700/50';

    return (
        <div
            className={`absolute rounded-xl border backdrop-blur-sm select-none group transition-shadow ${borderColor} ${baseColor}`}
            style={style}
            onMouseDown={onMouseDown}
            onContextMenu={onContextMenu}
            data-group-id={group.id}
        >
            {/* Floating Action Bar (Visible when selected) */}
            {isSelected && (
                <div
                    className="absolute -top-14 left-1/2 -translate-x-1/2 h-10 bg-[#18181b] border border-zinc-800 rounded-full flex items-center px-4 gap-4 shadow-xl z-50 whitespace-nowrap"
                    onMouseDown={(e) => e.stopPropagation()} // Prevent drag conflict
                >
                    {/* Run Button with Menu */}
                    <div className="relative" ref={runMenuRef}>
                        <button
                            className="flex items-center gap-2 group/btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowRunMenu(!showRunMenu);
                            }}
                        >
                            <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center group-hover/btn:bg-blue-500 transition-colors">
                                <PlayIcon className="w-2.5 h-2.5 text-white fill-white" />
                            </div>
                            <span className="text-sm text-zinc-200 group-hover/btn:text-white font-medium">一键执行</span>
                        </button>

                        {/* Dropdown Menu */}
                        {showRunMenu && (
                            <div className="absolute top-full left-0 mt-3 w-36 bg-[#18181b] border border-zinc-800 rounded-lg shadow-xl overflow-hidden z-[100] flex flex-col py-1">
                                <button
                                    onClick={(e) => handleRunClick(e, 'video')}
                                    className="px-3 py-2 text-xs text-left text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                                >
                                    <VideoIcon className="w-3.5 h-3.5 text-blue-500" />
                                    <span>只执行视频</span>
                                </button>
                                <button
                                    onClick={(e) => handleRunClick(e, 'text')}
                                    className="px-3 py-2 text-xs text-left text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                                >
                                    <FileTextIcon className="w-3.5 h-3.5 text-green-500" />
                                    <span>只文本推理</span>
                                </button>
                                <div className="h-px bg-zinc-800 mx-2 my-1" />
                                <button
                                    onClick={(e) => handleRunClick(e, 'all')}
                                    className="px-3 py-2 text-xs text-left text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                                >
                                    <Wand2Icon className="w-3.5 h-3.5 text-purple-500" />
                                    <span>全部执行</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Ungroup Button */}
                    <button
                        className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
                        onClick={handleDeleteClick}
                    >
                        <FolderIcon className="w-3.5 h-3.5" />
                        <span className="text-xs">解组</span>
                    </button>
                </div>
            )}

            {/* Header / Title Bar */}
            <div
                className="h-10 border-b border-transparent group-hover:border-slate-700/50 flex items-center px-4 gap-2 transition-colors relative"
                onDoubleClick={handleTitleDoubleClick}
            >
                {/* Title */}
                <div className="flex-1 min-w-0">
                    {isEditing ? (
                        <input
                            ref={titleInputRef}
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={handleTitleBlur}
                            onKeyDown={handleTitleKeyDown}
                            className="w-full bg-slate-900/80 border border-blue-500 rounded px-1.5 py-0.5 text-sm text-white focus:outline-none"
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <div className="text-sm font-medium text-slate-400 group-hover:text-slate-200 transition-colors truncate cursor-text">
                            {group.title}
                        </div>
                    )}
                </div>

                {/* Drag Handle Indicator */}
                <div className="opacity-0 group-hover:opacity-50 cursor-grab active:cursor-grabbing text-slate-500">
                    <MoveIcon className="w-3 h-3" />
                </div>
            </div>

            {/* Resize Handles */}
            {isSelected && (
                <>
                    <div
                        className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-transparent cursor-nw-resize z-10"
                        onMouseDown={(e) => onResize(e, 'nw')}
                    />
                    <div
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-transparent cursor-ne-resize z-10"
                        onMouseDown={(e) => onResize(e, 'ne')}
                    />
                    <div
                        className="absolute -bottom-1.5 -left-1.5 w-4 h-4 bg-transparent cursor-sw-resize z-10"
                        onMouseDown={(e) => onResize(e, 'sw')}
                    />
                    <div
                        className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full border border-blue-400/50 bg-slate-800 cursor-se-resize z-10 flex items-center justify-center hover:bg-blue-500 transition-colors"
                        onMouseDown={(e) => onResize(e, 'se')}
                    >
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                    </div>
                </>
            )}
        </div>
    );
};

export default Group;
