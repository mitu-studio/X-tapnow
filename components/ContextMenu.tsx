import React, { useEffect, useRef } from 'react';

interface ContextMenuItem {
    label?: string;
    onClick?: () => void;
    danger?: boolean;
    icon?: React.ReactNode;
    shortcut?: string;
    children?: ContextMenuItem[];
    separator?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [activeSubmenu, setActiveSubmenu] = React.useState<number | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        // Use mousedown to capture clicks outside immediately
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Adjust position if it goes off screen (basic)
    const style = {
        top: Math.min(y, window.innerHeight - 300),
        left: Math.min(x, window.innerWidth - 250)
    };

    return (
        <div
            ref={menuRef}
            className="absolute z-[100] min-w-[200px] bg-[#1a1a1c] border border-zinc-800 rounded-lg shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-75"
            style={style}
            onContextMenu={(e) => e.preventDefault()}
        >
            {items.map((item, index) => {
                if (item.separator) {
                    return <div key={index} className="h-px bg-zinc-800 my-1 mx-2" />;
                }

                return (
                    <div
                        key={index}
                        className="relative group"
                        onMouseEnter={() => setActiveSubmenu(index)}
                        onMouseLeave={() => setActiveSubmenu(null)}
                    >
                        <button
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors 
                                ${item.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-zinc-300 hover:bg-cyan-500/10 hover:text-cyan-400'}
                                ${activeSubmenu === index ? 'bg-cyan-500/10 text-cyan-400' : ''}
                            `}
                            onClick={(e) => {
                                if (item.children) return;
                                e.stopPropagation();
                                item.onClick?.();
                                onClose();
                            }}
                        >
                            <div className="flex items-center gap-3">
                                {item.icon && <span className="opacity-70">{item.icon}</span>}
                                <span className={item.danger ? "font-medium" : ""}>{item.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {item.shortcut && <span className="text-xs text-zinc-500 font-mono">{item.shortcut}</span>}
                                {item.children && (
                                    <svg className="w-3.5 h-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                )}
                            </div>
                        </button>

                        {/* Submenu */}
                        {item.children && activeSubmenu === index && (
                            <div
                                className="absolute left-full top-0 ml-1 min-w-[180px] bg-[#1a1a1c] border border-zinc-800 rounded-lg shadow-2xl p-1.5 animate-in fade-in slide-in-from-left-2 duration-75"
                            >
                                {/* Invisible bridge to prevent closing when crossing the gap */}
                                <div className="absolute right-full top-0 w-2 h-full bg-transparent" />

                                {item.children.map((subItem, subIndex) => (
                                    subItem.separator ? (
                                        <div key={subIndex} className="h-px bg-zinc-800 my-1 mx-2" />
                                    ) : (
                                        <button
                                            key={subIndex}
                                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-zinc-300 hover:bg-cyan-500/10 hover:text-cyan-400`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                subItem.onClick?.();
                                                onClose();
                                            }}
                                        >
                                            {subItem.icon && <span className="opacity-70">{subItem.icon}</span>}
                                            <span>{subItem.label}</span>
                                        </button>
                                    )
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ContextMenu;
