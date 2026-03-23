import React, { useState, useEffect } from 'react';
import { SaveIcon, XIcon, Wand2Icon } from './Icons';
import { WorkflowEntry, getWorkflowLibrary, saveWorkflowToLibrary, deleteWorkflowFromLibrary } from '../services/storageService';
import { NodeData, Connection } from '../types';

interface WorkflowLibraryPanelProps {
    isOpen: boolean;
    onClose: () => void;
    currentNodes: NodeData[];
    currentConnections: Connection[];
    currentViewport: { x: number; y: number; k: number };
    onLoadWorkflow: (workflow: WorkflowEntry) => void;
}

const WorkflowLibraryPanel: React.FC<WorkflowLibraryPanelProps> = ({
    isOpen,
    onClose,
    currentNodes,
    currentConnections,
    currentViewport,
    onLoadWorkflow
}) => {
    const [workflows, setWorkflows] = useState<WorkflowEntry[]>([]);
    const [isNaming, setIsNaming] = useState(false);
    const [newWorkflowName, setNewWorkflowName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Reload when opening or saving
    useEffect(() => {
        if (isOpen) {
            loadWorkflows();
        }
    }, [isOpen]);

    const loadWorkflows = async () => {
        setIsLoading(true);
        const list = await getWorkflowLibrary();
        // Sort by newest first
        setWorkflows(list.sort((a, b) => b.timestamp - a.timestamp));
        setIsLoading(false);
    };

    const handleSaveClick = () => {
        setIsNaming(true);
        // Default name
        setNewWorkflowName(`Workflow ${new Date().toLocaleDateString()}`);
    };

    const confirmSave = async () => {
        if (!newWorkflowName.trim()) return;

        await saveWorkflowToLibrary(
            newWorkflowName,
            currentNodes,
            currentConnections,
            currentViewport
        );

        setIsNaming(false);
        await loadWorkflows();
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Delete this workflow?')) {
            await deleteWorkflowFromLibrary(id);
            await loadWorkflows();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="absolute left-24 top-1/2 -translate-y-1/2 h-[600px] w-80 bg-[#18181b] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-[40]">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-[#27272a]">
                <div className="font-semibold text-zinc-200">我的工作流</div>
                {/* Save Button */}
                <div className="relative">
                    {isNaming ? (
                        <div className="absolute right-0 top-0 flex items-center gap-1 bg-zinc-900 border border-zinc-700 rounded-lg p-1 z-50">
                            <input
                                autoFocus
                                value={newWorkflowName}
                                onChange={e => setNewWorkflowName(e.target.value)}
                                className="w-32 bg-transparent text-sm text-white px-1 outline-none"
                                onKeyDown={e => e.key === 'Enter' && confirmSave()}
                            />
                            <button onClick={confirmSave} className="text-teal-400 hover:text-teal-300 px-1">✓</button>
                            <button onClick={() => setIsNaming(false)} className="text-red-400 hover:text-red-300 px-1">✕</button>
                        </div>
                    ) : (
                        <button
                            onClick={handleSaveClick}
                            className="w-8 h-8 flex items-center justify-center bg-[#096c70] text-teal-100 rounded-lg hover:bg-[#0b8085] transition-colors shadow-lg shadow-teal-900/20"
                            title="Save current workflow"
                        >
                            <SaveIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
                {isLoading ? (
                    <div className="text-zinc-500 text-center py-8 text-sm">Loading...</div>
                ) : workflows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-zinc-600 gap-2 border-2 border-dashed border-zinc-800/50 rounded-xl m-2">
                        <Wand2Icon className="w-8 h-8 opacity-20" />
                        <span className="text-xs">No saved workflows</span>
                    </div>
                ) : (
                    workflows.map(wf => (
                        <div
                            key={wf.id}
                            onClick={() => onLoadWorkflow(wf)}
                            className="group relative flex flex-col bg-zinc-900/50 border border-zinc-800 hover:border-teal-500/50 rounded-xl overflow-hidden cursor-pointer transition-all hover:bg-zinc-800"
                        >
                            {/* Card Preview Placeholder */}
                            <div className="h-28 bg-[#09090b] flex items-center justify-center relative">
                                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-700 to-transparent" />
                                <div className="text-zinc-700 group-hover:text-teal-500/50 transition-colors">
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                        <rect x="2" y="2" width="20" height="20" rx="5" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                </div>
                                <div className="absolute bottom-2 right-2 flex gap-1 items-center bg-zinc-950/80 px-2 py-0.5 rounded text-[10px] text-zinc-500 font-mono">
                                    {wf.nodes.length} N
                                </div>
                            </div>

                            {/* Card Footer */}
                            <div className="p-3 bg-[#1e1e20] border-t border-zinc-800/50 flex items-center justify-between">
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-medium text-zinc-300 truncate group-hover:text-white transition-colors">
                                        {wf.name}
                                    </span>
                                    <span className="text-[10px] text-zinc-500">
                                        {new Date(wf.timestamp).toLocaleDateString()}
                                    </span>
                                </div>

                                <button
                                    onClick={(e) => handleDelete(wf.id, e)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 rounded transition-all"
                                >
                                    <XIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default WorkflowLibraryPanel;
