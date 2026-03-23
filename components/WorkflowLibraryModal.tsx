import React, { useState, useEffect } from 'react';
import { XIcon, DownloadIcon, FolderIcon } from './Icons'; // Reuse existing icons or add new ones
import { WorkflowEntry, getWorkflowLibrary, saveWorkflowToLibrary, deleteWorkflowFromLibrary } from '../services/storageService';
import { NodeData, Connection } from '../types';

interface WorkflowLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentNodes: NodeData[];
    currentConnections: Connection[];
    currentViewport: { x: number; y: number; k: number };
    onLoadWorkflow: (workflow: WorkflowEntry) => void;
}

const WorkflowLibraryModal: React.FC<WorkflowLibraryModalProps> = ({
    isOpen,
    onClose,
    currentNodes,
    currentConnections,
    currentViewport,
    onLoadWorkflow
}) => {
    const [workflows, setWorkflows] = useState<WorkflowEntry[]>([]);
    const [newWorkflowName, setNewWorkflowName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Load workflows when modal opens
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

    const handleSave = async () => {
        if (!newWorkflowName.trim()) return;

        await saveWorkflowToLibrary(
            newWorkflowName,
            currentNodes,
            currentConnections,
            currentViewport
        );

        setNewWorkflowName('');
        await loadWorkflows();
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this workflow?')) {
            await deleteWorkflowFromLibrary(id);
            await loadWorkflows();
        }
    };

    const handleLoad = (workflow: WorkflowEntry) => {
        if (confirm('Loading a workflow will replace your current workspace. Unsaved changes will be lost. Continue?')) {
            onLoadWorkflow(workflow);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-[#18181b] border border-zinc-800 w-[600px] h-[500px] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-[#27272a]">
                    <div className="flex items-center gap-2 text-white font-medium">
                        <FolderIcon className="w-5 h-5 text-teal-400" />
                        <span>Workflow Library</span>
                    </div>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Save New Section */}
                    <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
                        <label className="block text-xs text-zinc-500 mb-2 uppercase tracking-wider font-bold">Save Current Workflow</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newWorkflowName}
                                onChange={(e) => setNewWorkflowName(e.target.value)}
                                placeholder="Enter workflow name..."
                                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors"
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            />
                            <button
                                onClick={handleSave}
                                disabled={!newWorkflowName.trim()}
                                className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                                Save
                            </button>
                        </div>
                    </div>

                    {/* List Section */}
                    <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                        <label className="block text-xs text-zinc-500 mb-3 uppercase tracking-wider font-bold">Saved Workflows</label>

                        {isLoading ? (
                            <div className="text-zinc-500 text-center py-8">Loading...</div>
                        ) : workflows.length === 0 ? (
                            <div className="text-zinc-500 text-center py-8 border-2 border-dashed border-zinc-800 rounded-xl">
                                No saved workflows yet.
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {workflows.map(workflow => (
                                    <div
                                        key={workflow.id}
                                        onClick={() => handleLoad(workflow)}
                                        className="group flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-teal-500/50 hover:bg-zinc-800 transition-all cursor-pointer"
                                    >
                                        <div className="flex flex-col gap-1">
                                            <span className="text-zinc-200 font-medium group-hover:text-teal-400 transition-colors">{workflow.name}</span>
                                            <div className="flex items-center gap-3 text-xs text-zinc-500">
                                                <span>{new Date(workflow.timestamp).toLocaleDateString()} {new Date(workflow.timestamp).toLocaleTimeString()}</span>
                                                <span>•</span>
                                                <span>{workflow.nodes.length} nodes</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => handleDelete(workflow.id, e)}
                                                className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkflowLibraryModal;
