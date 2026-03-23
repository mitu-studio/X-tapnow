import React from 'react';
import { PlusIcon, SettingsIcon, DownloadIcon, UploadIcon, FolderIcon, VideoIcon, TypeIcon, BookmarkIcon, LayersIcon, FileTextIcon } from './Icons';


interface SidebarProps {
  onAddNode: () => void;
  onAddVideoNode: () => void;
  onAddTextNode: () => void;
  onOpenSettings: () => void;
  onSave: () => void;
  onLoad: () => void;
  onToggleLibrary: () => void;
  isLibraryOpen: boolean;
  onTogglePresets: () => void;
  isPresetsOpen: boolean;
  onOpenComposer: () => void;
  onNewProject: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  onAddNode,
  onAddVideoNode,
  onAddTextNode,
  onOpenSettings,
  onSave,
  onLoad,
  onToggleLibrary,
  isLibraryOpen,
  onTogglePresets,
  isPresetsOpen,
  onOpenComposer,
  onNewProject
}) => {
  return (
    <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-50">
      <div className="bg-[#27272a] border border-zinc-800 rounded-2xl p-2 flex flex-col gap-2 shadow-xl">
        <SidebarBtn icon={<PlusIcon />} label="Add Image Node" onClick={onAddNode} primary />
        <SidebarBtn icon={<VideoIcon />} label="Add Video Node" onClick={onAddVideoNode} primary />
        <SidebarBtn icon={<TypeIcon />} label="Add Text Node" onClick={onAddTextNode} primary />
        <SidebarBtn icon={<FileTextIcon />} label="新建工程" onClick={onNewProject} primary />
        <div className="h-px bg-zinc-800 my-1 mx-2" />
        <SidebarBtn
          icon={<FolderIcon />}
          label="My Workflows"
          onClick={onToggleLibrary}
          isActive={isLibraryOpen}
        />
        <SidebarBtn
          icon={<BookmarkIcon />}
          label="Prompt Presets"
          onClick={onTogglePresets}
          isActive={isPresetsOpen}
        />
        <SidebarBtn icon={<DownloadIcon />} label="Export Project" onClick={onSave} />
        <SidebarBtn icon={<UploadIcon />} label="Import Project" onClick={onLoad} />
        <div className="h-px bg-zinc-800 my-1 mx-2" />
        <SidebarBtn icon={<SettingsIcon />} label="Settings" onClick={onOpenSettings} />
        <div className="h-px bg-zinc-800 my-1 mx-2" />
        <SidebarBtn icon={<LayersIcon />} label="视觉合成" onClick={onOpenComposer} />
      </div>
    </div>
  );
};

const SidebarBtn = ({
  icon,
  label,
  onClick,
  primary,
  isActive
}: {
  icon: React.ReactNode,
  label: string,
  onClick?: () => void,
  primary?: boolean,
  isActive?: boolean
}) => (
  <button
    onClick={onClick}
    className={`
      w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 group relative
      ${primary
        ? 'bg-zinc-700 text-white hover:bg-zinc-600'
        : isActive
          ? 'bg-white text-zinc-900 shadow-lg scale-105'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}
    `}
  >
    <div className="w-5 h-5 [&>svg]:w-full [&>svg]:h-full">{icon}</div>

    {/* Tooltip */}
    {!isActive && (
      <div className="absolute left-full ml-3 px-2 py-1 bg-zinc-900 text-zinc-300 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap border border-zinc-800 z-50 shadow-lg">
        {label}
      </div>
    )}
  </button>
);

export default Sidebar;
