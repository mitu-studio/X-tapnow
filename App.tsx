import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import './index.css';
import Node from './components/Node';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import ImagePreviewModal from './components/ImagePreviewModal';
import GlobalVideoPromptModal from './components/GlobalVideoPromptModal';
import PromptPresetsModal from './components/PromptPresetsModal';
import { NodeData, Connection, ViewportTransform, Position, GroupData } from './types';
import ParticleCanvas from './components/ParticleCanvas';
import InfiniteCanvas from './components/InfiniteCanvas';
import Group from './components/Group';
import { generateImage, generateText } from './services/geminiService';
import { createSoraTask, pollSoraTask, remixSoraVideo, generateOpenAIVideo } from './services/soraService';
import { GridModeView } from './components/GridModeView';
import {
    MaximizeIcon,
    Wand2Icon,
    UploadIcon,
    ImageIcon,
    VideoIcon,
    FileTextIcon,
    LayersIcon,
    UsersIcon,
    GridIcon,
    MoveIcon,
    FileIcon,
    CopyIcon,
    Trash2Icon,
    EditIcon,
    FolderIcon,
    ScanIcon,
    CornerUpLeftIcon,
    PaletteIcon,
    BookOpenIcon,
    HistoryIcon
} from './components/Icons';
import ContextMenu from './components/ContextMenu';
import ConfirmDialog from './components/ConfirmDialog';
import WelcomeNotice from './components/WelcomeNotice';
import AnnouncementModal from './components/AnnouncementModal';
import Minimap from './components/Minimap';
import {
    saveProjectToIndexedDB,
    loadProjectFromIndexedDB,
    exportProjectToJson,
    importProjectFromJson,
    exportWorkflowToJson,
    WorkflowEntry,
    initializeSettings,
    saveSettings
} from './services/storageService';
import { AppSettings } from './types/settings';
import WorkflowLibraryPanel from './components/WorkflowLibraryPanel';
import CharacterManagementModal from './components/CharacterManagementModal';
import ImageComposerModal from './components/ImageComposerModal';
import NewProjectModal from './components/NewProjectModal';
import { Shot } from './services/scriptAnalyzerService';

// Initial dummy data
const INITIAL_NODES: NodeData[] = [];

const INITIAL_CONNECTIONS: Connection[] = [];

const App: React.FC = () => {
    // --- State ---
    const [nodes, setNodes] = useState<NodeData[]>(INITIAL_NODES);
    const [connections, setConnections] = useState<Connection[]>(INITIAL_CONNECTIONS);
    const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, k: 1 });
    const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
    const [groups, setGroups] = useState<GroupData[]>([]); // Moved before refs

    // Refs moved down


    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{
        x: number,
        y: number,
        type: 'node' | 'canvas' | 'group',
        nodeId?: string,
        groupId?: string,
        canvasX?: number,
        canvasY?: number,
        connectionSource?: { nodeId: string; handleType: 'source' | 'target' }
    } | null>(null);

    // Connection state: Tracks which node/handle started the drag
    const [connectingParams, setConnectingParams] = useState<{ nodeId: string; handleType: 'source' | 'target' } | null>(null);

    // Group Dragging State (for UI sync)
    const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
    const [resizingGroup, setResizingGroup] = useState<{
        groupId: string;
        startX: number;
        startY: number;
        initialX: number;
        initialY: number;
        initialW: number;
        initialH: number;
        direction: string;
    } | null>(null);

    // Confirm Dialog State
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isDanger?: boolean;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // Box Selection State
    const [selectionBox, setSelectionBox] = useState<{ startWorldX: number; startWorldY: number; currentWorldX: number; currentWorldY: number } | null>(null);
    const [isSpacePressed, setIsSpacePressed] = useState(false);

    // Feature Flags / Toggles
    const [isAutoResize, setIsAutoResize] = useState(false);

    // Settings State - New Multi-API System
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [appSettings, setAppSettings] = useState<AppSettings>(() => {
        return initializeSettings();
    });
    const [globalVideoPrompt, setGlobalVideoPrompt] = useState(() => localStorage.getItem('global_video_prompt') || '');
    const [isGlobalVideoPromptOpen, setIsGlobalVideoPromptOpen] = useState(false);

    // View Mode State
    const [viewMode, setViewMode] = useState<'canvas' | 'grid'>('canvas');

    // Media Preview State (Image / Video)
    const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

    // Workflow Library State
    const [isWorkflowLibraryOpen, setIsWorkflowLibraryOpen] = useState(false);

    // Prompt Presets State
    const [isPromptPresetsOpen, setIsPromptPresetsOpen] = useState(false);

    // Character Management State
    // Character Management State
    const [isCharacterManagementOpen, setIsCharacterManagementOpen] = useState(false);

    // Lifted Grid Mode State (Persists across view switches)
    const [gridState, setGridState] = useState<any>({ // Using 'any' briefly to match types.ts interface structure manually or import it
        prompt: '',
        duration: '15s',
        aspectRatio: '16:9',
        resolution: '720p',
        count: 1,
        uploadedImage: null,
        providerId: '',
        modelId: ''
    });

    // Welcome Notice State
    const [showWelcomeNotice, setShowWelcomeNotice] = useState(() => {
        return !localStorage.getItem('welcome_notice_seen');
    });

    // Image Composer State
    const [isImageComposerOpen, setIsImageComposerOpen] = useState(false);
    const [composerInitialImages, setComposerInitialImages] = useState<string[]>([]);

    // New Project Modal State
    const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

    // Announcement Modal State
    const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);

    // Connection state: Tracks which node/handle started the drag


    // File Input Ref
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const uploadPosRef = useRef<{ x: number, y: number } | null>(null);

    // Task Abort Controllers
    const taskControllersRef = useRef<Map<string, AbortController>>(new Map());

    // Refs for stable callbacks (Moved here to have access to all state variables)
    const nodesRef = useRef(nodes);
    const selectedNodeIdsRef = useRef(selectedNodeIds);
    const groupsRef = useRef(groups);
    const connectionsRef = useRef(connections);
    const appSettingsRef = useRef(appSettings);
    const isAutoResizeRef = useRef(isAutoResize);
    const globalVideoPromptRef = useRef(globalVideoPrompt);
    const viewportRef = useRef(viewport);
    const resizingGroupRef = useRef(resizingGroup);
    const connectingParamsRef = useRef(connectingParams);
    const selectionBoxRef = useRef(selectionBox);

    useLayoutEffect(() => {
        nodesRef.current = nodes;
        selectedNodeIdsRef.current = selectedNodeIds;
        groupsRef.current = groups;
        connectionsRef.current = connections;
        appSettingsRef.current = appSettings;
        isAutoResizeRef.current = isAutoResize;
        globalVideoPromptRef.current = globalVideoPrompt;
        viewportRef.current = viewport;
        resizingGroupRef.current = resizingGroup;
        connectingParamsRef.current = connectingParams;
        selectionBoxRef.current = selectionBox;
    }, [nodes, selectedNodeIds, groups, connections, appSettings, isAutoResize, globalVideoPrompt, viewport, resizingGroup, connectingParams, selectionBox]);

    const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 }); // Screen coordinates

    // Context Menu Handlers
    const handleNodeContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
        e.preventDefault();
        e.stopPropagation(); // Stop propagation to canvas
        setContextMenu({ x: e.clientX, y: e.clientY, type: 'node', nodeId });
    }, []);

    const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        // Convert screen coordinates to canvas coordinates for node creation
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            type: 'canvas',
            canvasX: canvasPos.x,
            canvasY: canvasPos.y
        });
    }, [viewport]);

    const handleCloseContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    // Deletion Logic
    const handleDeleteNode = useCallback((targetId?: string) => {
        // Determine which IDs to delete
        const idsToDelete = targetId ? new Set([targetId]) : selectedNodeIds;

        if (idsToDelete.size === 0) return;

        // Abort ongoing tasks
        idsToDelete.forEach(id => {
            taskControllersRef.current.get(id)?.abort();
            taskControllersRef.current.delete(id);
        });

        // Update Nodes
        setNodes(prev => prev.filter(n => !idsToDelete.has(n.id)));

        // Update Connections
        setConnections(prev => prev.filter(c => !idsToDelete.has(c.fromNodeId) && !idsToDelete.has(c.toNodeId)));

        // Clear selection if necessary
        if (!targetId) {
            setSelectedNodeIds(new Set());
        } else {
            // If we deleted specific node that was selected, remove it from selection
            if (selectedNodeIds.has(targetId)) {
                setSelectedNodeIds(prev => {
                    const next = new Set(prev);
                    next.delete(targetId);
                    return next;
                });
            }
        }
    }, [selectedNodeIds]);

    const handleDeleteConnection = useCallback((connId: string) => {
        setConnections(prev => prev.filter(c => c.id !== connId));
        if (selectedConnectionId === connId) setSelectedConnectionId(null);
    }, [selectedConnectionId]);

    // Keyboard Shortcuts (Delete)
    // Keyboard Shortcuts (Delete & Space)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !e.repeat) {
                setIsSpacePressed(true);
            }

            // Ignore if typing in an input/textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedNodeIds.size > 0) {
                    handleDeleteNode();
                }
                if (selectedConnectionId) {
                    handleDeleteConnection(selectedConnectionId);
                }
            }

            if (e.key === 'Escape') {
                setSelectedNodeIds(new Set());
                setSelectedConnectionId(null);
                setConnectingParams(null);
                setSelectionBox(null);
            }


            // Group (Ctrl+G)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G')) {
                e.preventDefault();
                if (selectedNodeIds.size > 0) {
                    handleCreateGroup(Array.from(selectedNodeIds));
                }
            }

            // Copy (Ctrl+C)
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

                if (selectedNodeIds.size > 0) {
                    const nodesToCopy = nodes.filter(n => selectedNodeIds.has(n.id)).map(n => ({
                        ...n,
                        status: 'idle',
                        progress: 0,
                        taskId: undefined,
                        selected: false
                    }));
                    const clipboardData = {
                        type: 'X-tapnow-nodes',
                        nodes: nodesToCopy
                    };
                    navigator.clipboard.writeText(JSON.stringify(clipboardData));
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                setIsSpacePressed(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [selectedNodeIds, selectedConnectionId, handleDeleteNode, handleDeleteConnection, nodes]);

    // Clear selection on background click (only if not panning or selecting)
    const handleBackgroundClick = useCallback(() => {
        // Handled in MouseUp if no drag occurred
        // But keeping this for safety if called explicitly
        // Update: Logic moved to MouseDown/Up handling
    }, []);

    // Sora Polling Helper
    const monitorSoraTask = useCallback(async (nodeId: string, taskId: string, providerId?: string) => {
        // Create AbortController for this node
        const controller = new AbortController();
        taskControllersRef.current.set(nodeId, controller);

        try {
            // Get video provider config from settings
            const currentSettings = appSettingsRef.current;
            const videoProvider = (providerId
                ? currentSettings.videoProviders.find(p => p.id === providerId)
                : currentSettings.videoProviders.find(p => p.isDefault))
                || currentSettings.videoProviders[0];

            if (!videoProvider) {
                throw new Error('No video provider configured');
            }
            const config = {
                apiKey: videoProvider.apiKey,
                baseUrl: videoProvider.baseUrl,
                type: videoProvider.type,
                endpointMode: videoProvider.endpointMode,
                customEndpoint: videoProvider.customEndpoint
            };
            const videoUrl = await pollSoraTask(taskId, config, (status, progress) => {
                setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, title: `Generating... ${progress}%`, progress: progress } : n));
            }, controller.signal);

            // console.log("[Sora] Monitor success, video URL:", videoUrl);

            // Directly use the returned video URL instead of downloading it as a blob
            setNodes(prev => prev.map(n => {
                if (n.id === nodeId) {
                    return {
                        ...n,
                        type: 'video',
                        status: 'success',
                        content: videoUrl, // Use direct URL
                        blob: undefined,   // No local blob
                        title: 'Generated Video',
                        progress: 100,
                        executionTime: n.startTime ? Date.now() - n.startTime : undefined
                    };
                }
                return n;
            }));
        } catch (error: any) {
            if (error.message === "Task aborted") {
                console.log(`[Sora] Polling aborted for node ${nodeId}`);
                return;
            }

            console.error("[Sora] Monitor failed:", error);

            // 如果错误对象中包含taskData，也打印出来帮助调试
            if (error.taskData) {
                console.error("[Sora] Task data from error:", error.taskData);
            }

            // 提取详细的错误信息用于显示
            let displayError = error.message || 'Generation failed';

            // 限制错误信息长度，避免UI显示过长
            const maxErrorLength = 100;
            if (displayError.length > maxErrorLength) {
                displayError = displayError.substring(0, maxErrorLength) + '...';
            }

            setNodes(prev => prev.map(n =>
                n.id === nodeId
                    ? {
                        ...n,
                        status: 'error',
                        title: '错误: ' + displayError,
                        // 保留完整错误信息在节点数据中，可以在控制台查看
                        errorDetails: error.message
                    }
                    : n
            ));
        } finally {
            taskControllersRef.current.delete(nodeId);
        }
    }, []);

    // --- Storage Logic ---

    // Auto-load on startup
    useEffect(() => {
        const load = async () => {
            const data = await loadProjectFromIndexedDB();
            if (data) {
                setNodes(data.nodes);
                setConnections(data.connections);
                if (data.viewport) setViewport(data.viewport);
                if ((data as any).groups) setGroups((data as any).groups);

                // Resume pending Sora tasks
                data.nodes.forEach(n => {
                    if (n.type === 'video' && n.status === 'loading' && n.taskId) {
                        monitorSoraTask(n.id, n.taskId, n.providerId);
                    }
                });
            }
        };
        load();
    }, []);

    // Auto-save on change (debounced)
    const saveToDB = useCallback(() => {
        // @ts-ignore - storage service update pending
        saveProjectToIndexedDB(nodes, connections, viewport, groups);
    }, [nodes, connections, viewport, groups]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            saveToDB();
        }, 5000); // Save after 5 seconds of inactivity to reduce stutter

        return () => clearTimeout(timeoutId);
    }, [saveToDB]);

    // Export Handler
    const handleExport = async () => {
        // @ts-ignore - storage service update pending
        await exportProjectToJson(nodes, connections, viewport, groups);
    };

    // Toggle Workflow Library
    const handleToggleLibrary = () => {
        setIsWorkflowLibraryOpen(prev => !prev);
    };

    const handleLoadWorkflow = (workflow: WorkflowEntry) => {
        // 1. Calculate offset to center new nodes in the current viewport
        if (workflow.nodes.length === 0) return;

        // Calculate Workflow Bounding Box
        const wfMinX = Math.min(...workflow.nodes.map(n => n.position.x));
        const wfMaxX = Math.max(...workflow.nodes.map(n => n.position.x + n.width));
        const wfMinY = Math.min(...workflow.nodes.map(n => n.position.y));
        const wfMaxY = Math.max(...workflow.nodes.map(n => n.position.y + n.height));

        const wfWidth = wfMaxX - wfMinX;
        const wfHeight = wfMaxY - wfMinY;
        const wfCenterX = wfMinX + wfWidth / 2;
        const wfCenterY = wfMinY + wfHeight / 2;

        // Calculate Viewport Center in Canvas Coordinates
        // Screen Center: (window.innerWidth / 2, window.innerHeight / 2)
        // Canvas X = (Screen X - viewport.x) / viewport.k
        const canvasCenterX = (window.innerWidth / 2 - viewport.x) / viewport.k;
        const canvasCenterY = (window.innerHeight / 2 - viewport.y) / viewport.k;

        // Offset = Target Center - Workflow Center
        const offsetX = canvasCenterX - wfCenterX;
        const offsetY = canvasCenterY - wfCenterY;

        // 2. Generate ID Map to avoid conflicts
        const nodeIdMap = new Map<string, string>();
        workflow.nodes.forEach(n => {
            nodeIdMap.set(n.id, `n-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
        });

        // Generate Group ID Map
        const groupIdMap = new Map<string, string>();
        if (workflow.groups) {
            workflow.groups.forEach(g => {
                groupIdMap.set(g.id, `g-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
            });
        }

        // 3. Prepare new nodes with new IDs and Positions
        const newNodes = workflow.nodes.map(n => ({
            ...n,
            id: nodeIdMap.get(n.id)!,
            position: {
                x: n.position.x + offsetX,
                y: n.position.y + offsetY
            },
            groupId: n.groupId ? groupIdMap.get(n.groupId) : undefined, // 更新groupId引用
            selected: false // Ensure imported nodes aren't auto-selected immediately in a confusing way (or maybe they should be?)
            // status is already 'idle' from save logic
        }));

        // 4. Prepare new connections with new IDs
        const newConnections = workflow.connections.map(c => ({
            ...c,
            id: `c-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            fromNodeId: nodeIdMap.get(c.fromNodeId)!,
            toNodeId: nodeIdMap.get(c.toNodeId)!
        })).filter(c => c.fromNodeId && c.toNodeId); // Safety check

        // 5. Prepare new groups with new IDs and Positions
        const newGroups = workflow.groups ? workflow.groups.map(g => ({
            ...g,
            id: groupIdMap.get(g.id)!,
            position: {
                x: g.position.x + offsetX,
                y: g.position.y + offsetY
            }
        })) : [];

        // 6. Merge and Save
        const updatedNodes = [...nodes, ...newNodes];
        const updatedConnections = [...connections, ...newConnections];
        const updatedGroups = [...groups, ...newGroups];

        setNodes(updatedNodes);
        setConnections(updatedConnections);
        setGroups(updatedGroups);

        // Optional: Select the new nodes to highlight what was added
        // setSelectedNodeId(null); 

        // Persist - 包含groups数据
        saveProjectToIndexedDB(updatedNodes, updatedConnections, viewport, updatedGroups);
    };

    // Import Handler
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const data = await importProjectFromJson(file);
            setNodes(data.nodes);
            setConnections(data.connections);
            if (data.viewport) setViewport(data.viewport);
            if (data.groups) setGroups(data.groups); // 恢复分组数据

            // Handle Full Backup Data (Settings & Characters)
            let extrasRestored = false;
            const restoredItems: string[] = [];

            if (data.characters && Array.isArray(data.characters)) {
                console.log(`[Import] 恢复 ${data.characters.length} 个角色`);
                localStorage.setItem('sora_characters', JSON.stringify(data.characters));
                // Dispatch event so PromptPanel and Modal update immediately
                window.dispatchEvent(new Event('sora_characters_updated'));
                extrasRestored = true;
                restoredItems.push(`${data.characters.length} 个角色`);
            } else {
                console.log('[Import] 导入文件中未包含角色数据');
            }

            if (data.settings) {
                console.log('[Import] 恢复应用设置');
                setAppSettings(data.settings);
                saveSettings(data.settings);
                extrasRestored = true;
                restoredItems.push('应用设置');
            }

            if (data.extraConfig) {
                console.log('[Import] 恢复额外配置:', Object.keys(data.extraConfig));
                Object.entries(data.extraConfig).forEach(([key, value]) => {
                    localStorage.setItem(key, value as string);
                });
                extrasRestored = true;
                restoredItems.push('API配置');
            }

            if (extrasRestored) {
                alert(`✅ 导入成功！\n已恢复：${restoredItems.join('、')}`);
            }

            // Also update DB immediately - 包含groups数据
            saveProjectToIndexedDB(data.nodes, data.connections, data.viewport, data.groups || []);
        } catch (err) {
            console.error('Failed to load project:', err);
            // Error will be shown in console, no modal needed
        }

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Refs for Dragging
    // Refs for Dragging
    // canvasRef is now inside InfiniteCanvas, but we still use refs for logic
    const dragRef = useRef<{
        isDraggingNode: boolean;
        isDraggingGroup: boolean;
        nodeId: string | null;
        groupId: string | null;
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
        initialNodePos?: Position;
    }>({
        isDraggingNode: false,
        isDraggingGroup: false,
        nodeId: null,
        groupId: null,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0
    });

    const rafRef = useRef<number>();

    // --- Helpers ---
    const screenToCanvas = useCallback((sx: number, sy: number) => {
        const currentViewport = viewportRef.current;
        return {
            x: (sx - currentViewport.x) / currentViewport.k,
            y: (sy - currentViewport.y) / currentViewport.k
        };
    }, []);

    // --- Handlers ---

    const handleSaveSettings = (settings: AppSettings) => {
        setAppSettings(settings);
        saveSettings(settings);
    };

    const handleSaveGlobalVideoPrompt = (prompt: string) => {
        setGlobalVideoPrompt(prompt);
        localStorage.setItem('global_video_prompt', prompt);
    };

    const handleWelcomeNoticeConfirm = () => {
        localStorage.setItem('welcome_notice_seen', 'true');
        setShowWelcomeNotice(false);
    };

    const handleProviderChange = useCallback((nodeId: string, providerId: string) => {
        setNodes(prev => prev.map(n =>
            n.id === nodeId ? { ...n, providerId, modelId: undefined } : n
        ));
        // 注意：切换提供商时清空modelId，让UI自动选择该提供商的第一个模型
    }, []);

    const handleModelChange = useCallback((nodeId: string, modelId: string) => {
        setNodes(prev => prev.map(n =>
            n.id === nodeId ? { ...n, modelId } : n
        ));
    }, []);

    const handleComposeSelected = useCallback((nodeIds?: Set<string>) => {
        const ids = nodeIds || selectedNodeIds;
        const imagesToCompose = nodes
            .filter(n => ids.has(n.id) && n.content && (n.type === 'image' || n.type === 'video'))
            .map(n => n.content!);

        if (imagesToCompose.length === 0) {
            alert('请先选择包含图片的节点');
            return;
        }

        setComposerInitialImages(imagesToCompose);
        setIsImageComposerOpen(true);
        setContextMenu(null);
    }, [nodes, selectedNodeIds]);

    const handleComposerSendToCard = useCallback(async (blob: Blob) => {
        const center = screenToCanvas(window.innerWidth / 2, window.innerHeight / 2);
        // Create a File object from the Blob to match createImageNodeAt's signature
        const file = new File([blob], `composition_${Date.now()}.png`, { type: 'image/png' });
        await createImageNodeAt(file, center.x - 170, center.y - 120);
        setIsImageComposerOpen(false);
        // Optionally clear composer state? User said "close and clear" for X button, 
        // for this action we also probably want to close it.
    }, [screenToCanvas, isAutoResize]);

    // 处理新建工程分镜结果 - 将分镜转换为节点
    // 处理新建工程分镜结果 - 将分镜转换为节点
    const handleCreateProjectFromShots = useCallback((projectName: string, shots: Shot[]) => {
        if (shots.length === 0) return;

        // 标准节点尺寸 (参考 addNewTextNode 和 addNewVideoNode)
        const TEXT_NODE_WIDTH = 340;
        const TEXT_NODE_HEIGHT = 240;
        const VIDEO_NODE_WIDTH = 480;
        const VIDEO_NODE_HEIGHT = 320;

        const GAP_X = 100;

        // 分组配置
        const GROUP_PADDING = 30;
        const GROUP_HEADER = 40;

        // 计算分组总宽高
        // 布局: [Text] --gap-- [Text] --gap-- [Video]
        const GROUP_WIDTH = TEXT_NODE_WIDTH + GAP_X + TEXT_NODE_WIDTH + GAP_X + VIDEO_NODE_WIDTH + GROUP_PADDING * 2;
        const GROUP_HEIGHT = Math.max(TEXT_NODE_HEIGHT, VIDEO_NODE_HEIGHT) + GROUP_PADDING * 2 + GROUP_HEADER;
        const ROW_SPACING = GROUP_HEIGHT + 60; // 组间距

        // Starting Position (Centered roughly)
        const center = screenToCanvas(window.innerWidth / 2, window.innerHeight / 2);
        const startX = center.x - GROUP_WIDTH / 2; // Center the group horizontally
        const startY = center.y - (shots.length * ROW_SPACING) / 2;

        const newNodes: NodeData[] = [];
        const newConnections: Connection[] = [];
        const newGroups: GroupData[] = [];

        shots.forEach((shot, index) => {
            const rowY = startY + index * ROW_SPACING;

            // 创建分组
            const groupId = `g-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
            const group: GroupData = {
                id: groupId,
                title: `${projectName} - 镜头 ${index + 1}`,
                position: { x: startX, y: rowY },
                width: GROUP_WIDTH,
                height: GROUP_HEIGHT,
                // color: '#1e1e24' // Optional: default group color
            };
            newGroups.push(group);

            // 节点起始坐标 (相对于世界坐标)
            const nodesStartX = startX + GROUP_PADDING;
            const nodesStartY = rowY + GROUP_HEADER + GROUP_PADDING;

            // 垂直居中偏移 (以最高的节点为基准)
            const maxHeight = Math.max(TEXT_NODE_HEIGHT, VIDEO_NODE_HEIGHT);
            const textCenterOffsetY = (maxHeight - TEXT_NODE_HEIGHT) / 2;
            const videoCenterOffsetY = (maxHeight - VIDEO_NODE_HEIGHT) / 2;

            // 1. Text Node (Script)
            const textNodeId = `n-${Date.now()}-${index}-text-${Math.random().toString(36).substr(2, 9)}`;
            const textNode: NodeData = {
                id: textNodeId,
                type: 'text',
                title: `${projectName} - 镜头 ${index + 1} (剧本)`,
                content: shot.text,
                position: { x: nodesStartX, y: nodesStartY + textCenterOffsetY },
                width: TEXT_NODE_WIDTH,
                height: TEXT_NODE_HEIGHT,
                status: 'idle',
                progress: 0,
                groupId: groupId
            };

            // 2. Text Node (Prompt)
            const promptNodeId = `n-${Date.now()}-${index}-prompt-${Math.random().toString(36).substr(2, 9)}`;
            const promptNode: NodeData = {
                id: promptNodeId,
                type: 'text',
                title: `镜头 ${index + 1} 提示词`,
                content: '', // Empty content
                position: { x: nodesStartX + TEXT_NODE_WIDTH + GAP_X, y: nodesStartY + textCenterOffsetY },
                width: TEXT_NODE_WIDTH,
                height: TEXT_NODE_HEIGHT,
                status: 'idle',
                progress: 0,
                groupId: groupId
            };

            // 3. Video Node (Output)
            const videoNodeId = `n-${Date.now()}-${index}-video-${Math.random().toString(36).substr(2, 9)}`;
            const videoNode: NodeData = {
                id: videoNodeId,
                type: 'video',
                title: `镜头 ${index + 1} 视频`,
                position: { x: nodesStartX + (TEXT_NODE_WIDTH + GAP_X) * 2, y: nodesStartY + videoCenterOffsetY },
                width: VIDEO_NODE_WIDTH,
                height: VIDEO_NODE_HEIGHT,
                status: 'idle',
                progress: 0,
                groupId: groupId,
                // Default video params
                params: {
                    model: 'sora-2',
                    aspectRatio: '16:9',
                    resolution: '1280x720',
                    batchSize: 1
                }
            };

            // Add Nodes
            newNodes.push(textNode, promptNode, videoNode);

            // Add Connections
            newConnections.push(
                {
                    id: `c-${Date.now()}-${index}-1-${Math.random().toString(36).substr(2, 9)}`,
                    fromNodeId: textNodeId,
                    toNodeId: promptNodeId
                },
                {
                    id: `c-${Date.now()}-${index}-2-${Math.random().toString(36).substr(2, 9)}`,
                    fromNodeId: promptNodeId,
                    toNodeId: videoNodeId
                }
            );
        });

        // Update State
        setNodes(prev => [...prev, ...newNodes]);
        setConnections(prev => [...prev, ...newConnections]);
        setGroups(prev => [...prev, ...newGroups]);

        // Close Modal
        setIsNewProjectModalOpen(false);

        // Center Viewport on the first group
        setViewport({
            x: window.innerWidth / 2 - (startX + GROUP_WIDTH / 2),
            y: window.innerHeight / 2 - startY,
            k: 0.6 // Zoom out a bit to see more
        });
    }, [screenToCanvas]);

    // Handle Mouse Down only for Selection (Pan is handled by InfiniteCanvas)
    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        setContextMenu(null); // Close context menu
        // InfiniteCanvas captures Space+Click and Middle Click for Panning.
        // This callback is only fired for other clicks (e.g. Left Click on background).

        if (e.button === 0) {
            setSelectedGroupId(null); // Clear group selection
            // Start Box Selection in World Coordinates
            const worldPos = screenToCanvas(e.clientX, e.clientY);
            setSelectionBox({
                startWorldX: worldPos.x,
                startWorldY: worldPos.y,
                currentWorldX: worldPos.x,
                currentWorldY: worldPos.y
            });
            if (!e.shiftKey) {
                setSelectedNodeIds(new Set()); // Clear if not adding
            }
        }
    };

    const handleNodeMouseDown = useCallback((e: React.MouseEvent, id: string) => {
        setContextMenu(null); // Close context menu
        e.stopPropagation(); // Prevent canvas pan/select logic
        if (e.button === 0) {
            setSelectedConnectionId(null);

            // Access latest state via refs
            const currentSelected = selectedNodeIdsRef.current;
            const currentNodes = nodesRef.current;

            // Selection Logic
            let newSelected = new Set(currentSelected);

            if (e.shiftKey || e.ctrlKey) {
                // Toggle
                if (newSelected.has(id)) {
                    newSelected.delete(id);
                } else {
                    newSelected.add(id);
                }
            } else {
                // If clicking an unselected node without modifiers, select ONLY it
                // If clicking a selected node without modifiers, KEEP selection (to allow dragging group)
                if (!newSelected.has(id)) {
                    newSelected.clear();
                    newSelected.add(id);
                }
            }
            setSelectedNodeIds(newSelected);

            const node = currentNodes.find(n => n.id === id);
            if (!node) return;

            dragRef.current.isDraggingNode = true;
            dragRef.current.nodeId = id; // Primary drag node
            dragRef.current.startX = e.clientX;
            dragRef.current.startY = e.clientY;

            // Store initial positions of ALL selected nodes for group drag
            // We can re-use 'initialNodePos' but we need it for all selected nodes.
            // Let's modify dragRef to support multiple.
            // But 'types' is hard to change in dragRef without refactor.
            // Let's just assume we calculate deltas in MouseMove using 'startX'.
            dragRef.current.initialNodePos = { ...node.position }; // Used for single delta bounds check if needed

            // We need to capture the initial positions of ALL nodes to drag them correctly
            // Let's verify we can do this without complex state.
            // In MouseMove, we calculate dx, dy. We apply this dx,dy to specific node's initial pos.
            // So we need initial positions.
            // Let's add a temporary property to nodes? No.
            // Custom Ref property
            (dragRef.current as any).initialSelectedNodes = currentNodes.filter(n => newSelected.has(n.id)).map(n => ({ id: n.id, x: n.position.x, y: n.position.y }));
        }
    }, []);

    const handleNodeClick = useCallback((e: React.MouseEvent, id: string) => {
        // Pure selection toggle, no drag initiation
        e.stopPropagation();

        const currentSelected = selectedNodeIdsRef.current;
        let newSelected = new Set(currentSelected);
        if (e.shiftKey || e.ctrlKey) {
            // Toggle
            if (newSelected.has(id)) {
                newSelected.delete(id);
            } else {
                newSelected.add(id);
            }
        } else {
            // Select Only
            newSelected.clear();
            newSelected.add(id);
        }
        setSelectedNodeIds(newSelected);
        setSelectedConnectionId(null);
    }, []);

    const handleNodeDoubleClick = useCallback((nodeId: string) => {
        const node = nodesRef.current.find(n => n.id === nodeId);
        if (!node) return;

        // 计算节点中心在世界坐标中的位置
        const nodeCenterX = node.position.x + node.width / 2;
        const nodeCenterY = node.position.y + node.height / 2;

        // 计算屏幕中心
        const screenCenterX = window.innerWidth / 2;
        const screenCenterY = window.innerHeight / 2;

        // 目标缩放比例：适中的放大，既能看清卡片又不会过于放大
        const targetScale = 1.2;

        // 计算新的 viewport 偏移量，使节点中心对齐到屏幕中心
        // 屏幕坐标 = viewport.x + 世界坐标 * scale
        // 我们希望：screenCenterX = newX + nodeCenterX * targetScale
        // 因此：newX = screenCenterX - nodeCenterX * targetScale
        const newX = screenCenterX - nodeCenterX * targetScale;
        const newY = screenCenterY - nodeCenterY * targetScale;

        // 使用动画平滑过渡
        const currentViewport = viewportRef.current;
        const startX = currentViewport.x;
        const startY = currentViewport.y;
        const startK = currentViewport.k;

        const duration = 300; // 动画持续时间（毫秒）
        const startTime = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // 使用缓动函数 (easeInOutCubic)
            const eased = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            setViewport({
                x: startX + (newX - startX) * eased,
                y: startY + (newY - startY) * eased,
                k: startK + (targetScale - startK) * eased
            });

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }, []);

    // --- Group Handlers ---

    const handleCreateGroup = (nodeIds?: string[], position?: Position) => {
        let x = 0, y = 0, w = 300, h = 200;
        let includedNodeIds: string[] = [];

        if (nodeIds && nodeIds.length > 0) {
            includedNodeIds = nodeIds;
            const selectedNodes = nodes.filter(n => nodeIds.includes(n.id));
            if (selectedNodes.length > 0) {
                const minX = Math.min(...selectedNodes.map(n => n.position.x));
                const minY = Math.min(...selectedNodes.map(n => n.position.y));
                const maxX = Math.max(...selectedNodes.map(n => n.position.x + n.width));
                const maxY = Math.max(...selectedNodes.map(n => n.position.y + n.height));

                const padding = 20;
                x = minX - padding;
                y = minY - padding - 40;
                w = maxX - minX + padding * 2;
                h = maxY - minY + padding * 2 + 40;
            }
        } else if (position) {
            x = position.x;
            y = position.y;
        } else {
            const center = screenToCanvas(window.innerWidth / 2, window.innerHeight / 2);
            x = center.x - 150;
            y = center.y - 100;
        }

        const newGroup: GroupData = {
            id: `g-${Date.now()}`,
            title: 'New Group',
            position: { x, y },
            width: w,
            height: h
        };

        setGroups(prev => [...prev, newGroup]);
        if (includedNodeIds.length > 0) {
            setNodes(prev => prev.map(n => includedNodeIds.includes(n.id) ? { ...n, groupId: newGroup.id } : n));
        }
    };

    const handleGroupTitleChange = (groupId: string, newTitle: string) => {
        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, title: newTitle } : g));
    };

    const handleGroupColorChange = (groupId: string, colorClass: string) => {
        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, color: colorClass } : g));
    };

    const handleGroupResizeStart = (e: React.MouseEvent, groupId: string, direction: 'nw' | 'ne' | 'sw' | 'se') => {
        e.stopPropagation();
        e.preventDefault();
        const group = groups.find(g => g.id === groupId);
        if (!group) return;

        setResizingGroup({
            groupId,
            direction,
            startX: e.clientX,
            startY: e.clientY,
            initialX: group.position.x,
            initialY: group.position.y,
            initialW: group.width,
            initialH: group.height
        });
    };

    const handleDeleteGroup = (groupId: string, deleteContent: boolean) => {
        setGroups(prev => prev.filter(g => g.id !== groupId));
        if (deleteContent) {
            setNodes(prev => prev.filter(n => n.groupId !== groupId));
            // Also cleanup connections
            setConnections(prev => prev.filter(c => {
                const nodeIds = nodes.filter(n => n.groupId === groupId).map(n => n.id);
                return !nodeIds.includes(c.fromNodeId) && !nodeIds.includes(c.toNodeId);
            }));
        } else {
            setNodes(prev => prev.map(n => n.groupId === groupId ? { ...n, groupId: undefined } : n));
        }
    };

    const handleGroupContextMenu = (e: React.MouseEvent, groupId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            type: 'group',
            groupId
        });
    };

    const handleGroupMouseDown = useCallback((e: React.MouseEvent, groupId: string) => {
        e.stopPropagation();
        setContextMenu(null);
        setSelectedGroupId(groupId);
        setDraggingGroupId(groupId);

        dragRef.current.isDraggingGroup = true;
        dragRef.current.groupId = groupId;
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;

        const currentGroups = groupsRef.current;
        const currentNodes = nodesRef.current;

        const group = currentGroups.find(g => g.id === groupId);
        const children = currentNodes.filter(n => n.groupId === groupId);

        if (group) {
            (dragRef.current as any).initialGroupState = { ...group };
            (dragRef.current as any).initialGroupChildren = children.map(n => ({ id: n.id, x: n.position.x, y: n.position.y }));
        }
    }, []);

    const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
        const viewport = viewportRef.current;
        const resizingGroup = resizingGroupRef.current;
        const selectionBox = selectionBoxRef.current;
        const connectingParams = connectingParamsRef.current;

        // Group Resizing
        if (resizingGroup) {
            const dx = (e.clientX - resizingGroup.startX) / viewport.k;
            const dy = (e.clientY - resizingGroup.startY) / viewport.k;

            let newX = resizingGroup.initialX;
            let newY = resizingGroup.initialY;
            let newW = resizingGroup.initialW;
            let newH = resizingGroup.initialH;

            if (resizingGroup.direction.includes('e')) newW = Math.max(100, resizingGroup.initialW + dx);
            if (resizingGroup.direction.includes('s')) newH = Math.max(60, resizingGroup.initialH + dy);
            if (resizingGroup.direction.includes('w')) {
                const w = Math.max(100, resizingGroup.initialW - dx);
                newX = resizingGroup.initialX + (resizingGroup.initialW - w);
                newW = w;
            }
            if (resizingGroup.direction.includes('n')) {
                const h = Math.max(60, resizingGroup.initialH - dy);
                newY = resizingGroup.initialY + (resizingGroup.initialH - h);
                newH = h;
            }

            // Direct DOM manipulation for smooth resizing
            const groupEl = document.querySelector(`[data-group-id="${resizingGroup.groupId}"]`) as HTMLElement;
            if (groupEl) {
                groupEl.style.width = `${newW}px`;
                groupEl.style.height = `${newH}px`;
                groupEl.style.transform = `translate(${newX}px, ${newY}px)`;
            }
            return;
        }

        // Group Dragging (React State with RAF throttling)
        if (dragRef.current.isDraggingGroup && dragRef.current.groupId) {
            const dx = (e.clientX - dragRef.current.startX) / viewport.k;
            const dy = (e.clientY - dragRef.current.startY) / viewport.k;

            const initialGroup = (dragRef.current as any).initialGroupState;
            const children = (dragRef.current as any).initialGroupChildren;

            // Use RAF to throttle state updates for smooth performance
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }

            rafRef.current = requestAnimationFrame(() => {
                // Update Group Position
                setGroups(prev => prev.map(g =>
                    g.id === dragRef.current.groupId
                        ? { ...g, position: { x: initialGroup.position.x + dx, y: initialGroup.position.y + dy } }
                        : g
                ));

                // Update Children Positions
                if (children && children.length > 0) {
                    setNodes(prev => prev.map(n => {
                        const child = children.find((c: any) => c.id === n.id);
                        if (child) {
                            return { ...n, position: { x: child.x + dx, y: child.y + dy } };
                        }
                        return n;
                    }));
                }
            });
            return;
        }

        // Node Dragging (React State with RAF throttling)
        if (dragRef.current.isDraggingNode && (dragRef.current as any).initialSelectedNodes) {
            const dx = (e.clientX - dragRef.current.startX) / viewport.k;
            const dy = (e.clientY - dragRef.current.startY) / viewport.k;

            const initialPositions = (dragRef.current as any).initialSelectedNodes as { id: string, x: number, y: number }[];

            // Use RAF to throttle state updates
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }

            rafRef.current = requestAnimationFrame(() => {
                setNodes(prev => prev.map(n => {
                    const init = initialPositions.find(p => p.id === n.id);
                    if (init) {
                        return { ...n, position: { x: init.x + dx, y: init.y + dy } };
                    }
                    return n;
                }));
            });
            return;
        }

        // Only update mouse position state if it's visually needed (e.g. drawing connection line)
        if (connectingParams) {
            setMousePos({ x: e.clientX, y: e.clientY });
        }

        // Box Selection
        if (selectionBox) {
            const worldPos = screenToCanvas(e.clientX, e.clientY);
            setSelectionBox(prev => prev ? ({ ...prev, currentWorldX: worldPos.x, currentWorldY: worldPos.y }) : null);

            const rectX = Math.min(selectionBox.startWorldX, worldPos.x);
            const rectY = Math.min(selectionBox.startWorldY, worldPos.y);
            const rectW = Math.abs(worldPos.x - selectionBox.startWorldX);
            const rectH = Math.abs(worldPos.y - selectionBox.startWorldY);

            const newSelection = new Set<string>();
            const currentNodes = nodesRef.current;
            currentNodes.forEach(n => {
                if (
                    rectX < n.position.x + n.width &&
                    rectX + rectW > n.position.x &&
                    rectY < n.position.y + n.height &&
                    rectY + rectH > n.position.y
                ) {
                    newSelection.add(n.id);
                }
            });

            setSelectedNodeIds(newSelection);
        }
    }, [screenToCanvas, nodesRef]);

    const handleGlobalMouseUp = useCallback((e: MouseEvent) => {
        const viewport = viewportRef.current;
        const resizingGroup = resizingGroupRef.current;
        const connectingParams = connectingParamsRef.current;
        const groups = groupsRef.current;

        // Group Resizing End
        if (resizingGroup) {
            const dx = (e.clientX - resizingGroup.startX) / viewport.k;
            const dy = (e.clientY - resizingGroup.startY) / viewport.k;

            setGroups(prev => prev.map(g => {
                if (g.id === resizingGroup.groupId) {
                    let newX = resizingGroup.initialX;
                    let newY = resizingGroup.initialY;
                    let newW = resizingGroup.initialW;
                    let newH = resizingGroup.initialH;

                    if (resizingGroup.direction.includes('e')) newW = Math.max(100, resizingGroup.initialW + dx);
                    if (resizingGroup.direction.includes('s')) newH = Math.max(60, resizingGroup.initialH + dy);
                    if (resizingGroup.direction.includes('w')) {
                        const w = Math.max(100, resizingGroup.initialW - dx);
                        newX = resizingGroup.initialX + (resizingGroup.initialW - w);
                        newW = w;
                    }
                    if (resizingGroup.direction.includes('n')) {
                        const h = Math.max(60, resizingGroup.initialH - dy);
                        newY = resizingGroup.initialY + (resizingGroup.initialH - h);
                        newH = h;
                    }

                    return { ...g, position: { x: newX, y: newY }, width: newW, height: newH };
                }
                return g;
            }));
            setResizingGroup(null);
            return;
        }

        // Group Dragging End - Clean up and ensure final position sync
        if (dragRef.current.isDraggingGroup && dragRef.current.groupId) {
            // Cancel any pending RAF
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = undefined;
            }

            // Final position update to ensure accuracy
            const dx = (e.clientX - dragRef.current.startX) / viewport.k;
            const dy = (e.clientY - dragRef.current.startY) / viewport.k;
            const initialGroup = (dragRef.current as any).initialGroupState;
            const children = (dragRef.current as any).initialGroupChildren;

            setGroups(prev => prev.map(g =>
                g.id === dragRef.current.groupId
                    ? { ...g, position: { x: initialGroup.position.x + dx, y: initialGroup.position.y + dy } }
                    : g
            ));

            if (children && children.length > 0) {
                setNodes(prev => prev.map(n => {
                    const child = children.find((c: any) => c.id === n.id);
                    if (child) {
                        return { ...n, position: { x: child.x + dx, y: child.y + dy } };
                    }
                    return n;
                }));
            }

            // Clean up
            setDraggingGroupId(null);
            dragRef.current.isDraggingGroup = false;
            dragRef.current.groupId = null;
            (dragRef.current as any).initialGroupState = null;
            (dragRef.current as any).initialGroupChildren = null;
            return;
        }

        // Node Dragging End - Clean up and apply grouping logic
        if (dragRef.current.isDraggingNode && (dragRef.current as any).initialSelectedNodes) {
            // Cancel any pending RAF
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = undefined;
            }

            const dx = (e.clientX - dragRef.current.startX) / viewport.k;
            const dy = (e.clientY - dragRef.current.startY) / viewport.k;

            const initialPositions = (dragRef.current as any).initialSelectedNodes as { id: string, x: number, y: number }[];
            const affectedIds = new Set(initialPositions.map(p => p.id));

            // Final position update with sticky grouping logic
            setNodes(prev => prev.map(n => {
                if (affectedIds.has(n.id)) {
                    const init = initialPositions.find(p => p.id === n.id);
                    if (init) {
                        const newX = init.x + dx;
                        const newY = init.y + dy;

                        // Sticky Grouping Logic
                        let newGroupId = n.groupId;
                        const cx = newX + n.width / 2;
                        const cy = newY + n.height / 2;

                        // Check if dropped into a group
                        const targetGroup = groups.find(g =>
                            !g.collapsed &&
                            cx >= g.position.x && cx <= g.position.x + g.width &&
                            cy >= g.position.y && cy <= g.position.y + g.height
                        );

                        if (targetGroup) {
                            newGroupId = targetGroup.id;
                        } else {
                            // Check if moved out of current group
                            if (n.groupId) {
                                const currentGroup = groups.find(g => g.id === n.groupId);
                                if (currentGroup) {
                                    const inGroup =
                                        cx >= currentGroup.position.x && cx <= currentGroup.position.x + currentGroup.width &&
                                        cy >= currentGroup.position.y && cy <= currentGroup.position.y + currentGroup.height;
                                    if (!inGroup) {
                                        newGroupId = undefined;
                                    }
                                } else {
                                    newGroupId = undefined;
                                }
                            }
                        }
                        return { ...n, position: { x: newX, y: newY }, groupId: newGroupId };
                    }
                }
                return n;
            }));

            // Clean up
            dragRef.current.isDraggingNode = false;
            dragRef.current.nodeId = null;
            (dragRef.current as any).initialSelectedNodes = null;
        }

        setSelectionBox(null);

        // Handle dropped connection on canvas
        if (connectingParams) {
            const canvasX = (e.clientX - viewport.x) / viewport.k;
            const canvasY = (e.clientY - viewport.y) / viewport.k;

            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                type: 'canvas',
                canvasX,
                canvasY,
                connectionSource: connectingParams
            });
        }

        setConnectingParams(null);
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [handleGlobalMouseMove, handleGlobalMouseUp]);


    // --- Connection Logic ---

    const handleConnectStart = (e: React.MouseEvent, nodeId: string, handleType: 'source' | 'target') => {
        // Start connection dragging from either input or output
        setConnectingParams({ nodeId, handleType });
    };

    const handleConnectEnd = (e: React.MouseEvent, targetNodeId: string, targetHandleType: 'source' | 'target') => {
        if (!connectingParams) return;

        // Prevent self-connection
        if (connectingParams.nodeId === targetNodeId) return;

        let fromNodeId: string;
        let toNodeId: string;

        // Logic: Must connect Source -> Target (Output -> Input)
        if (connectingParams.handleType === 'source' && targetHandleType === 'target') {
            fromNodeId = connectingParams.nodeId;
            toNodeId = targetNodeId;
        } else if (connectingParams.handleType === 'target' && targetHandleType === 'source') {
            // Dragged from Input to Output (Reverse connection)
            fromNodeId = targetNodeId;
            toNodeId = connectingParams.nodeId;
        } else {
            // Incompatible handles (Input->Input or Output->Output)
            return;
        }

        // Check if connection already exists
        const exists = connections.some(c => c.fromNodeId === fromNodeId && c.toNodeId === toNodeId);
        if (!exists) {
            const newConn: Connection = {
                id: `c-${Date.now()}`,
                fromNodeId,
                toNodeId
            };
            setConnections(prev => [...prev, newConn]);
        }

        setConnectingParams(null);
    };


    // --- Actions ---

    const readFileAsBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const createImageNodeAt = async (file: File, x: number, y: number) => {
        const url = URL.createObjectURL(file);

        let width = 340;
        let height = 240;

        const create = (w: number, h: number) => {
            const newNode: NodeData = {
                id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: 'image',
                position: { x, y },
                width: w,
                height: h,
                title: file.name,
                content: url,
                blob: file,
                status: 'success'
            };
            setNodes(prev => [...prev, newNode]);
            setSelectedNodeIds(new Set([newNode.id]));
        };

        if (isAutoResize) {
            const img = new Image();
            img.onload = () => {
                const maxWidth = 512;
                let newW = img.width;
                let newH = img.height;
                if (newW > maxWidth) {
                    const ratio = maxWidth / newW;
                    newW = maxWidth;
                    newH = img.height * ratio;
                }
                create(newW, newH + 80); // 80px for header/UI
            };
            img.src = url;
        } else {
            create(width, height);
        }
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        for (const f of files) {
            const file = f as File;
            if (file.type.startsWith('image/')) {
                const pos = screenToCanvas(e.clientX, e.clientY);
                await createImageNodeAt(file, pos.x - 170, pos.y - 120);
            }
        }
    };

    const handleImageInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type.startsWith('image/')) {
            let x, y;
            if (uploadPosRef.current) {
                x = uploadPosRef.current.x - 170;
                y = uploadPosRef.current.y - 120;
                uploadPosRef.current = null;
            } else {
                const center = screenToCanvas(window.innerWidth / 2, window.innerHeight / 2);
                x = center.x - 170;
                y = center.y - 120;
            }
            await createImageNodeAt(file, x, y);
        }

        // Reset input
        if (imageInputRef.current) {
            imageInputRef.current.value = '';
        }
    };

    // Paste Handling
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (isImageComposerOpen) return; // 合成器开启时，主画布不响应粘贴
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (!e.clipboardData) return;
            // 1. Try Image Paste
            const items = e.clipboardData.items;
            let imageFound = false;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith('image/')) {
                    const file = items[i].getAsFile();
                    if (file) {
                        e.preventDefault();
                        const pos = screenToCanvas(mousePos.x, mousePos.y);
                        createImageNodeAt(file, pos.x - 170, pos.y - 120);
                        imageFound = true;
                    }
                }
            }

            if (imageFound) return;

            // 2. Try Node Paste (Text/JSON)
            const text = e.clipboardData.getData('text');
            if (text) {
                try {
                    const data = JSON.parse(text);
                    if (data.type === 'X-tapnow-nodes' && Array.isArray(data.nodes)) {
                        e.preventDefault();
                        const nodesToPaste = data.nodes as NodeData[];
                        if (nodesToPaste.length === 0) return;

                        // Calculate bounds top-left
                        let minX = Infinity, minY = Infinity;
                        nodesToPaste.forEach(n => {
                            if (n.position.x < minX) minX = n.position.x;
                            if (n.position.y < minY) minY = n.position.y;
                        });

                        const targetPos = screenToCanvas(mousePos.x, mousePos.y);

                        const newNodes = nodesToPaste.map((n, index) => {
                            const offsetX = n.position.x - minX;
                            const offsetY = n.position.y - minY;
                            return {
                                ...n,
                                id: `${n.type}-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
                                position: {
                                    x: targetPos.x + offsetX,
                                    y: targetPos.y + offsetY
                                },
                                selected: true
                            };
                        });

                        setNodes(prev => {
                            const unselected = prev.map(n => ({ ...n, selected: false }));
                            return [...unselected, ...newNodes];
                        });
                        setSelectedNodeIds(new Set(newNodes.map(n => n.id)));
                    }
                } catch (err) {
                    // Ignore
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [mousePos, viewport, isImageComposerOpen]); // Added isImageComposerOpen to dependencies

    const addNewNode = (x?: number, y?: number) => {
        let pos;
        if (x !== undefined && y !== undefined) {
            // x, y are already canvas coordinates from context menu
            pos = { x, y };
        } else {
            // Default to screen center
            pos = screenToCanvas(window.innerWidth / 2, window.innerHeight / 2);
        }

        const newNode: NodeData = {
            id: `n-${Date.now()}`,
            type: 'image',
            position: { x: pos.x - 170, y: pos.y - 120 }, // Center offset
            width: 340,
            height: 240,
            title: 'New Generation',
            content: '', // Empty initially
            status: 'idle'
        };
        setNodes(prev => [...prev, newNode]);
        setSelectedNodeIds(new Set([newNode.id]));

        // Auto-connect if created from a drag
        if (contextMenu?.connectionSource) {
            const { nodeId: sourceId, handleType } = contextMenu.connectionSource;
            const isFromSource = handleType === 'source';
            setConnections(prev => [...prev, {
                id: `c-auto-${Date.now()}`,
                fromNodeId: isFromSource ? sourceId : newNode.id,
                toNodeId: isFromSource ? newNode.id : sourceId
            }]);
        }
    };

    const addNewVideoNode = (x?: number, y?: number) => {
        let pos;
        if (x !== undefined && y !== undefined) {
            pos = { x, y };
        } else {
            pos = screenToCanvas(window.innerWidth / 2, window.innerHeight / 2);
        }

        const newNode: NodeData = {
            id: `v-${Date.now()}`,
            type: 'video',
            position: { x: pos.x - 240, y: pos.y - 160 }, // Center offset (480/2, 320/2)
            width: 480, // Video might need wider aspect
            height: 320,
            title: 'New Video',
            content: '',
            status: 'idle',
            params: {
                model: 'sora-2', // Default params for video
                aspectRatio: '16:9',
                resolution: '1280x720',
                batchSize: 1
            }
        };
        setNodes(prev => [...prev, newNode]);
        setSelectedNodeIds(new Set([newNode.id]));

        // Auto-connect if created from a drag
        if (contextMenu?.connectionSource) {
            const { nodeId: sourceId, handleType } = contextMenu.connectionSource;
            const isFromSource = handleType === 'source';
            setConnections(prev => [...prev, {
                id: `c-auto-${Date.now()}`,
                fromNodeId: isFromSource ? sourceId : newNode.id,
                toNodeId: isFromSource ? newNode.id : sourceId
            }]);
        }
    };

    const addNewTextNode = (x?: number, y?: number) => {
        let pos;
        if (x !== undefined && y !== undefined) {
            pos = { x, y };
        } else {
            pos = screenToCanvas(window.innerWidth / 2, window.innerHeight / 2);
        }

        const newNode: NodeData = {
            id: `t-${Date.now()}`,
            type: 'text',
            position: { x: pos.x - 170, y: pos.y - 120 }, // Center offset
            width: 340,
            height: 240,
            title: 'Note',
            content: '',
            status: 'idle'
        };
        setNodes(prev => [...prev, newNode]);
        setSelectedNodeIds(new Set([newNode.id]));

        // Auto-connect if created from a drag
        if (contextMenu?.connectionSource) {
            const { nodeId: sourceId, handleType } = contextMenu.connectionSource;
            const isFromSource = handleType === 'source';
            setConnections(prev => [...prev, {
                id: `c-auto-${Date.now()}`,
                fromNodeId: isFromSource ? sourceId : newNode.id,
                toNodeId: isFromSource ? newNode.id : sourceId
            }]);
        }
    };

    const handlePromptChange = useCallback((nodeId: string, prompt: string) => {
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, prompt } : n));
    }, []);

    const handleContentChange = useCallback((nodeId: string, content: string) => {
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, content } : n));
    }, []);

    const handleParamsChange = useCallback((nodeId: string, params: any) => {
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, params } : n));
    }, []);

    const handleDismissError = useCallback((nodeId: string) => {
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, status: 'idle' } : n));
    }, []);

    const handleFontSizeChange = useCallback((nodeId: string, fontSize: number) => {
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, fontSize } : n));
    }, []);


    const handleBatchGenerate = async () => {
        const nodesToGen = nodes.filter(n => selectedNodeIds.has(n.id));
        const CONCURRENCY_LIMIT = appSettings.concurrencyLimit || 15; // 使用用户设置的并发数

        // Queue wrapper
        const queue: (() => Promise<void>)[] = nodesToGen.map(node => async () => {
            if (node.prompt) {
                const config = node.params || {
                    model: 'gemini-2.0-flash-exp',
                    aspectRatio: '16:9',
                    resolution: '2k',
                    batchSize: 1
                };
                try {
                    await handleGenerate(node.id, node.prompt, config, true); // silent = true
                } catch (e) {
                    console.error(`Failed to generate node ${node.id}`, e);
                    // Error is already handled inside handleGenerate to update node status
                }
            }
        });

        // Worker function
        const worker = async () => {
            while (queue.length > 0) {
                const task = queue.shift();
                if (task) await task();
            }
        };

        // Start workers
        const workers = Array(Math.min(nodesToGen.length, CONCURRENCY_LIMIT)).fill(null).map(() => worker());
        await Promise.all(workers);

        // Force save after batch complete
        saveToDB();
    };

    // Helper function to get the final prompt for a node after connection processing
    const getFinalPromptForNode = useCallback((nodeId: string): string => {
        const currentNodes = nodesRef.current;
        const currentConnections = connectionsRef.current;
        const currentGlobalVideoPrompt = globalVideoPromptRef.current;

        const node = currentNodes.find(n => n.id === nodeId);
        if (!node) return '';

        const inputConnections = currentConnections.filter(c => c.toNodeId === nodeId);

        if (node.type === 'video') {
            // For video nodes: combine upstream text content with prompt
            const connectedTextContent = inputConnections
                .map(conn => currentNodes.find(n => n.id === conn.fromNodeId))
                .filter(n => n && n.type === 'text' && n.content)
                .map(n => n!.content)
                .join(' ');

            const nodePrompt = node.prompt || '';
            let finalPrompt = connectedTextContent ? `${connectedTextContent} ${nodePrompt}` : nodePrompt;

            // Add global video prompt if set
            if (currentGlobalVideoPrompt) {
                finalPrompt = `${currentGlobalVideoPrompt} ${finalPrompt}`;
            }

            return finalPrompt;
        } else if (node.type === 'text') {
            // For text nodes: combine instruction (prompt) with upstream content
            const upstreamContent = inputConnections
                .map(conn => {
                    const sourceNode = currentNodes.find(n => n.id === conn.fromNodeId);
                    if (!sourceNode) return '';
                    return sourceNode.content || sourceNode.prompt || '';
                })
                .filter(Boolean)
                .join('\n\n');

            const nodePrompt = node.prompt || '';

            // Don't show system prompt in the tooltip, only the actual user input
            if (upstreamContent) {
                // Processing mode: instruction + content to process
                if (nodePrompt) {
                    return `${nodePrompt}\n\n${upstreamContent}`;
                } else {
                    return upstreamContent;
                }
            } else {
                // Creation mode: show the card's prompt
                return nodePrompt;
            }
        } else {
            // For image nodes: just return the prompt
            return node.prompt || '';
        }
    }, []);

    const handleGenerate = useCallback(async (
        nodeId: string,
        prompt: string,
        config: any,
        silent: boolean = false,
        overrideNodes?: NodeData[],
        overrideConnections?: Connection[]
    ) => {
        const currentNodes = overrideNodes || nodesRef.current;
        const currentConnections = overrideConnections || connectionsRef.current;
        const currentSettings = appSettingsRef.current;
        const currentGlobalVideoPrompt = globalVideoPromptRef.current;
        const isAutoResize = isAutoResizeRef.current;

        // Fetch latest node state to ensure params (like systemPrompt) are fresh
        const currentNode = currentNodes.find(n => n.id === nodeId);
        const latestConfig = currentNode?.params || config;

        // Update node to loading
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, status: 'loading', title: prompt.slice(0, 30) + '...', prompt: prompt } : n));

        // Collect Reference Images from Input Nodes
        const inputConnections = currentConnections.filter(c => c.toNodeId === nodeId);
        const referenceImages: (string | Blob)[] = [];

        inputConnections.forEach(conn => {
            const sourceNode = currentNodes.find(n => n.id === conn.fromNodeId);
            if (sourceNode && sourceNode.content) {
                if (sourceNode.blob) {
                    referenceImages.push(sourceNode.blob);
                } else if (sourceNode.content.startsWith('data:image') || sourceNode.content.startsWith('blob:')) {
                    referenceImages.push(sourceNode.content);
                }
            }
        });

        try {
            if (currentNodes.find(n => n.id === nodeId)?.type === 'video') {
                // SORA VIDEO GENERATION

                // Get video provider config from node or default
                const node = currentNodes.find(n => n.id === nodeId)!;
                const videoProvider = (node.providerId
                    ? currentSettings.videoProviders.find(p => p.id === node.providerId)
                    : currentSettings.videoProviders.find(p => p.isDefault))
                    || currentSettings.videoProviders[0];

                if (!videoProvider) {
                    throw new Error('No video provider configured. Please add one in Settings.');
                }

                // Check for connected video nodes (for remix mode)
                const connectedVideoNode = inputConnections
                    .map(conn => currentNodes.find(n => n.id === conn.fromNodeId))
                    .find(n => n && n.type === 'video' && n.taskId);

                let taskId: string;

                // Use node's modelId if specified, otherwise use default
                const modelId = node.modelId || config.model || videoProvider.models[0]?.id || 'sora2-landscape-10s';

                // Calculate actual size string from resolution/aspect-ratio
                let sizeStr = '1280x720';
                const res = (config.resolution || config.size || '720p').toLowerCase();
                const ar = config.aspectRatio || config.aspect_ratio || '16:9';

                if (res && res.includes('x')) {
                    sizeStr = res;
                } else if (res === '1080p') {
                    if (ar === '16:9') sizeStr = '1920x1080';
                    else if (ar === '9:16') sizeStr = '1080x1920';
                    else if (ar === '1:1') sizeStr = '1080x1080';
                    else if (ar === '21:9') sizeStr = '2560x1098';
                    else if (ar === '2:3') sizeStr = '1080x1620';
                    else if (ar === '3:2') sizeStr = '1620x1080';
                    else sizeStr = '1920x1080'; // Fallback
                } else {
                    // 720p default
                    if (ar === '16:9') sizeStr = '1280x720';
                    else if (ar === '9:16') sizeStr = '720x1280';
                    else if (ar === '1:1') sizeStr = '768x768';
                    else if (ar === '21:9') sizeStr = '1680x720';
                    else if (ar === '2:3') sizeStr = '720x1080';
                    else if (ar === '3:2') sizeStr = '1080x720';
                    else sizeStr = '1280x720'; // Fallback
                }

                if (videoProvider.type === 'openai' || videoProvider.type === 'veo' && videoProvider.endpointMode === 'chat') {
                    // --- OPENAI / STREAMING MODE ---
                    // This handles Text-to-Video, Image-to-Video, and Remix (if prompt contains URL)
                    // Note: We group "veo" here if endpointMode is 'chat' to allow flexible config, though logic below is specific to OpenAI stream format. 
                    // Strictly speaking the user asked for "OpenAI default mode".

                    // 1. Prepare Prompt just like Normal Mode
                    const connectedTextContent = inputConnections
                        .map(conn => currentNodes.find(n => n.id === conn.fromNodeId))
                        .filter(n => n && n.type === 'text' && n.content)
                        .map(n => n!.content)
                        .join(' ');
                    let finalPrompt = prompt;
                    if (connectedTextContent) finalPrompt = `${connectedTextContent} ${prompt}`;
                    if (currentGlobalVideoPrompt) finalPrompt = `${currentGlobalVideoPrompt} ${finalPrompt}`;

                    // Check for connected video nodes (Remix Helper) - Append URL to prompt if not present
                    const connectedVideoNode = inputConnections
                        .map(conn => currentNodes.find(n => n.id === conn.fromNodeId))
                        .find(n => n && n.type === 'video' && n.content);

                    if (connectedVideoNode && connectedVideoNode.content && !finalPrompt.includes(connectedVideoNode.content)) {
                        // Only append if it looks like a URL
                        if (connectedVideoNode.content.startsWith('http')) {
                            finalPrompt = `${connectedVideoNode.content} ${finalPrompt}`;
                        }
                    }



                    // Prepare AbortController
                    const controller = new AbortController();
                    taskControllersRef.current.set(nodeId, controller);

                    setNodes(prev => prev.map(n => n.id === nodeId ? {
                        ...n,
                        status: 'loading',
                        title: 'Starting Stream...',
                        progress: 0,
                        taskId: undefined // No polling task ID
                    } : n));

                    try {
                        const videoUrl = await generateOpenAIVideo(
                            {
                                prompt: finalPrompt,
                                image: referenceImages[0],
                                images: referenceImages,
                                model: modelId,
                                seconds: config.seconds || (config.duration ? config.duration.replace('s', '') : '10'), // Pass seconds
                                size: sizeStr, // Pass calculated size
                                aspect_ratio: config.aspect_ratio || config.aspectRatio // Pass aspect_ratio (handle UI/API mismatch)
                            },
                            {
                                apiKey: videoProvider.apiKey,
                                baseUrl: videoProvider.baseUrl,
                                type: videoProvider.type,
                                endpointMode: videoProvider.endpointMode,
                                customEndpoint: videoProvider.customEndpoint
                            },
                            (status, progress, details) => {
                                setNodes(prev => prev.map(n => n.id === nodeId ? {
                                    ...n,
                                    title: details || `Streaming... ${progress}%`,
                                    progress: progress
                                } : n));
                            },
                            controller.signal
                        );

                        // Success
                        setNodes(prev => prev.map(n => n.id === nodeId ? {
                            ...n,
                            type: 'video',
                            status: 'success',
                            content: videoUrl,
                            title: 'Generated Video',
                            progress: 100
                        } : n));

                    } catch (err: any) {
                        if (err.message === "Task aborted") return;
                        throw err; // Re-throw to be caught by outer catch
                    } finally {
                        taskControllersRef.current.delete(nodeId);
                    }

                } else if (connectedVideoNode && connectedVideoNode.taskId) {
                    // REMIX MODE: Connected to another video node
                    console.log(`[Video Generation] Remix mode: using source video ${connectedVideoNode.taskId}`);

                    // 1. Gather Upstream Text Content (for combining with prompt)
                    const connectedTextContent = inputConnections
                        .map(conn => currentNodes.find(n => n.id === conn.fromNodeId))
                        .filter(n => n && n.type === 'text' && n.content)
                        .map(n => n!.content)
                        .join(' ');

                    // 2. Build final prompt
                    let finalPrompt = prompt;
                    if (connectedTextContent) {
                        finalPrompt = `${connectedTextContent} ${prompt}`;
                    }

                    // 3. Add Global Video Prompt if set
                    if (currentGlobalVideoPrompt) {
                        finalPrompt = `${currentGlobalVideoPrompt} ${finalPrompt}`;
                    }

                    // Create remix task
                    taskId = await remixSoraVideo(
                        connectedVideoNode.taskId,
                        finalPrompt,
                        {
                            apiKey: videoProvider.apiKey,
                            baseUrl: videoProvider.baseUrl,
                            type: videoProvider.type,
                            endpointMode: videoProvider.endpointMode,
                            customEndpoint: videoProvider.customEndpoint
                        }
                    );

                    setNodes(prev => prev.map(n => n.id === nodeId ? {
                        ...n,
                        taskId,
                        title: 'Remixing Video...',
                        progress: 0,
                        startTime: Date.now(),
                        remixedFromVideoId: connectedVideoNode.taskId
                    } : n));

                    // Monitor
                    await monitorSoraTask(nodeId, taskId, videoProvider.id);

                } else {
                    // NORMAL MODE: Regular video generation or image-to-video
                    // 1. Gather Upstream Text Content
                    const connectedTextContent = inputConnections
                        .map(conn => currentNodes.find(n => n.id === conn.fromNodeId))
                        .filter(n => n && n.type === 'text' && n.content)
                        .map(n => n!.content)
                        .join(' ');

                    // 2. Combine with User Prompt
                    let finalPrompt = prompt;
                    if (connectedTextContent) {
                        finalPrompt = `${connectedTextContent} ${prompt}`;
                    }

                    // 3. Add Global Video Prompt if set
                    if (currentGlobalVideoPrompt) {
                        finalPrompt = `${currentGlobalVideoPrompt} ${finalPrompt}`;
                    }



                    taskId = await createSoraTask(
                        {
                            prompt: finalPrompt,
                            size: sizeStr,
                            seconds: config.seconds || (config.duration ? config.duration.replace('s', '') : '15'),
                            model: modelId,
                            image: referenceImages[0], // Keep for backward compatibility (Sora)
                            images: referenceImages, // Pass full array for Veo
                            enhance_prompt: config.enhance_prompt,
                            enable_upsample: config.enable_upsample,
                            aspect_ratio: config.aspectRatio // Map UI property to API property
                        },
                        {
                            apiKey: videoProvider.apiKey,
                            baseUrl: videoProvider.baseUrl,
                            type: videoProvider.type,
                            endpointMode: videoProvider.endpointMode,
                            customEndpoint: videoProvider.customEndpoint
                        }
                    );

                    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, taskId, title: 'Task Created', progress: 0, startTime: Date.now() } : n));

                    // Monitor
                    await monitorSoraTask(nodeId, taskId, videoProvider.id);
                }


            } else if (currentNodes.find(n => n.id === nodeId)?.type === 'text') {
                // TEXT GENERATION
                const node = currentNodes.find(n => n.id === nodeId)!;

                // 1. Gather Upstream Content (from connected nodes)
                const incomingConnections = currentConnections.filter(c => c.toNodeId === nodeId);
                const upstreamContent = incomingConnections
                    .map(conn => {
                        const sourceNode = currentNodes.find(n => n.id === conn.fromNodeId);
                        if (!sourceNode) return '';
                        // Prefer content, fallback to prompt (e.g. for image nodes where prompt describes it)
                        return sourceNode.content || sourceNode.prompt || '';
                    })
                    .filter(Boolean)
                    .join('\n\n');

                // 2. Determine User Prompt (Input)
                // Rule: Combine current prompt (instruction) with upstream content (material to process)
                let userPrompt: string;
                if (upstreamContent) {
                    // Processing mode: instruction + content
                    if (prompt) {
                        userPrompt = `${prompt}\n\n${upstreamContent}`;
                    } else {
                        userPrompt = upstreamContent;
                    }
                } else {
                    // Creation mode: just use the prompt
                    userPrompt = prompt;
                }

                // 3. System Prompt
                // Ensure system prompt is passed correctly from node params
                const systemPrompt = latestConfig.systemPrompt || '';

                // Get text provider config from node or default
                const textProvider = (node.providerId
                    ? currentSettings.textProviders.find(p => p.id === node.providerId)
                    : currentSettings.textProviders.find(p => p.isDefault))
                    || currentSettings.textProviders[0];

                if (!textProvider) {
                    throw new Error('No text provider configured. Please add one in Settings.');
                }

                // Use node's modelId if specified, otherwise use config.model or first available
                const modelId = node.modelId || latestConfig.model || textProvider.models[0]?.id || 'gpt-4';

                const responseText = await generateText(
                    userPrompt,
                    modelId,
                    {
                        apiKey: textProvider.apiKey,
                        baseUrl: textProvider.baseUrl,
                        type: textProvider.type,
                        endpointMode: textProvider.endpointMode,
                        customEndpoint: textProvider.customEndpoint
                    },
                    referenceImages,
                    systemPrompt
                );

                setNodes(prev => prev.map(n => n.id === nodeId ? {
                    ...n,
                    status: 'success',
                    content: responseText,
                } : n));
            } else {
                // GEMINI IMAGE GENERATION
                // Get image provider config from node or default
                const node = currentNodes.find(n => n.id === nodeId)!;
                const imageProvider = (node.providerId
                    ? currentSettings.imageProviders.find(p => p.id === node.providerId)
                    : currentSettings.imageProviders.find(p => p.isDefault))
                    || currentSettings.imageProviders[0];

                if (!imageProvider) {
                    throw new Error('No image provider configured. Please add one in Settings.');
                }

                // Use node's modelId if specified, otherwise use config.model or first available
                const modelId = node.modelId || latestConfig.model || imageProvider.models[0]?.id || 'gemini-2.0-flash-exp';

                console.log(`[App] Image generation for node ${nodeId}:`, {
                    providerId: imageProvider.id,
                    providerName: imageProvider.name,
                    providerType: imageProvider.type,
                    nodeModelId: node.modelId,
                    configModel: latestConfig.model,
                    finalModelId: modelId,
                    aspectRatio: latestConfig.aspectRatio || latestConfig.aspect_ratio,
                    resolution: latestConfig.resolution || latestConfig.size
                });

                const imageResult = await generateImage(
                    prompt,
                    modelId,
                    latestConfig.aspectRatio || latestConfig.aspect_ratio,
                    latestConfig.resolution || latestConfig.size,
                    {
                        apiKey: imageProvider.apiKey,
                        baseUrl: imageProvider.baseUrl,
                        type: imageProvider.type,
                        endpointMode: imageProvider.endpointMode,
                        customEndpoint: imageProvider.customEndpoint
                    }, // Pass configured API settings
                    referenceImages // Pass collected inputs
                );

                // 处理所有图片，转换为Blob URL
                const allBlobUrls: string[] = [];
                const allBlobs: Blob[] = [];

                for (const imgData of imageResult.allImages) {
                    const response = await fetch(imgData);
                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    allBlobUrls.push(blobUrl);
                    allBlobs.push(blob);
                }

                setNodes(prev => prev.map(n => {
                    if (n.id === nodeId) {
                        let newHeight = n.height;
                        let newWidth = n.width;

                        const ar = latestConfig.aspectRatio || latestConfig.aspect_ratio;
                        if (isAutoResize && ar) {
                            try {
                                const [w, h] = ar.split(':').map(Number);
                                if (w && h) {
                                    const aspect = w / h;
                                    // Adjust height based on current width and aspect ratio
                                    // Node content height = width / aspect
                                    // Add 80px for header/UI padding approximation
                                    newHeight = (newWidth / aspect) + 80;
                                }
                            } catch (e) { }
                        }

                        return {
                            ...n,
                            status: 'success',
                            content: allBlobUrls[0],      // 显示第一张图片
                            blob: allBlobs[0],             // 第一张图片的Blob
                            allImages: allBlobUrls,        // 所有图片URLs
                            allBlobs: allBlobs,            // 所有图片Blobs
                            currentImageIndex: 0,          // 当前显示第一张
                            width: newWidth,
                            height: newHeight
                        };
                    }
                    return n;
                }));
            }

        } catch (e: any) {
            console.error('[Generate] Error details:', e);

            // 提取详细的错误信息
            let displayError = e.message || 'Generation failed';

            // 限制显示长度
            const maxErrorLength = 80;
            let shortError = displayError;
            if (displayError.length > maxErrorLength) {
                shortError = displayError.substring(0, maxErrorLength) + '...';
            }

            setNodes(prev => prev.map(n =>
                n.id === nodeId
                    ? {
                        ...n,
                        status: 'error',
                        title: '错误: ' + shortError,
                        errorDetails: displayError // 保存完整错误信息，会在卡片顶部显示
                    }
                    : n
            ));

            // 错误已经通过errorDetails保存到节点，会在卡片顶部以横幅形式显示
            // 不再需要弹窗提示
        }
    }, [monitorSoraTask]);

    const handleGroupRun = useCallback(async (groupId: string, mode: 'video' | 'text' | 'all') => {
        const currentNodes = nodesRef.current;
        const currentConnections = connectionsRef.current;
        const groupNodes = currentNodes.filter(n => n.groupId === groupId);

        if (groupNodes.length === 0) return;

        let nodesToRun: NodeData[] = [];

        const shouldSkipTextNode = (n: NodeData) => {
            // Skip text nodes that have no prompt and no inputs (e.g. Script nodes)
            if (n.type === 'text') {
                const hasPrompt = !!n.prompt && n.prompt.trim().length > 0;
                const hasInputs = currentConnections.some(c => c.toNodeId === n.id);
                // Also respect the explicit title check just in case
                const isScriptTitle = n.title && n.title.includes('(剧本)');

                if ((!hasPrompt && !hasInputs) || isScriptTitle) {
                    return true;
                }
            }
            return false;
        };

        if (mode === 'video') {
            nodesToRun = groupNodes.filter(n => n.type === 'video');
        } else if (mode === 'text') {
            nodesToRun = groupNodes.filter(n => n.type === 'text' && !shouldSkipTextNode(n));
        } else if (mode === 'all') {
            nodesToRun = groupNodes.filter(n =>
                ['text', 'video', 'image'].includes(n.type) && !shouldSkipTextNode(n)
            );
        }

        if (nodesToRun.length === 0) return;

        const CONCURRENCY_LIMIT = appSettingsRef.current.concurrencyLimit || 15;

        // Queue wrapper
        const queue: (() => Promise<void>)[] = nodesToRun.map(node => async () => {
            const safePrompt = node.prompt || '';
            const config = node.params || {};

            try {
                await handleGenerate(node.id, safePrompt, config, true);
            } catch (e) {
                console.error(`Failed to generate node ${node.id}`, e);
            }
        });

        // Worker function
        const worker = async () => {
            while (queue.length > 0) {
                const task = queue.shift();
                if (task) await task();
            }
        };

        // Start workers
        const workers = Array(Math.min(nodesToRun.length, CONCURRENCY_LIMIT)).fill(null).map(() => worker());
        await Promise.all(workers);
        saveToDB();
    }, [handleGenerate]);

    const handleNodeResize = useCallback((id: string, width: number, height: number) => {
        setNodes(prev => prev.map(n => n.id === id ? { ...n, width, height } : n));
    }, []);

    const handleUpload = useCallback((nodeId: string, dataUrl: string) => {
        const isAutoResize = isAutoResizeRef.current;
        // Since we are moving to Blobs elsewhere, we should ideally handle it as Blob here too
        // if dataUrl is already a dataUrl, it's fine for now but Blobs are better.
        // Convert to blob just to be consistent
        const handleWithBlob = async (url: string) => {
            const res = await fetch(url);
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);

            if (isAutoResize) {
                const img = new Image();
                img.onload = () => {
                    setNodes(prev => prev.map(n => {
                        if (n.id === nodeId) {
                            const maxWidth = 512;
                            let newW = img.width;
                            let newH = img.height;
                            if (newW > maxWidth) {
                                const ratio = maxWidth / newW;
                                newW = maxWidth;
                                newH = img.height * ratio;
                            }

                            return {
                                ...n,
                                content: blobUrl,
                                blob: blob, // Store actual blob
                                status: 'success',
                                title: 'Uploaded Image',
                                width: newW,
                                height: newH + 80
                            };
                        }
                        return n;
                    }));
                };
                img.src = blobUrl;
            } else {
                setNodes(prev => prev.map(n => {
                    if (n.id === nodeId) {
                        return {
                            ...n,
                            content: blobUrl,
                            blob: blob, // Store actual blob
                            status: 'success',
                            title: 'Uploaded Image'
                        };
                    }
                    return n;
                }));
            }
        };
        handleWithBlob(dataUrl);
    }, []);

    const handleNodeTitleChange = useCallback((id: string, title: string) => {
        setNodes(prev => prev.map(n => n.id === id ? { ...n, title } : n));
    }, []);

    const handleNodeMaximize = useCallback((url: string, type: 'image' | 'video') => {
        setPreviewMedia({ url, type });
    }, []);

    // 处理图片切换（轮播功能）
    const handleImageSwitch = useCallback((nodeId: string, imageIndex: number) => {
        setNodes(prev => prev.map(n => {
            if (n.id === nodeId && n.allImages && n.allBlobs) {
                if (imageIndex >= 0 && imageIndex < n.allImages.length) {
                    return {
                        ...n,
                        content: n.allImages[imageIndex],
                        blob: n.allBlobs[imageIndex],
                        currentImageIndex: imageIndex
                    };
                }
            }
            return n;
        }));
    }, []);

    // Helper to create task from Grid Mode
    const handleCreateTask = useCallback((prompt: string, config: any, imageContent?: string | Blob) => {
        const center = screenToCanvas(window.innerWidth / 2, window.innerHeight / 2);
        // Add minimal random offset
        const offset = (Math.random() - 0.5) * 50;

        const timestamp = Date.now();
        const videoNodeId = `v-${timestamp}`;
        const newNodes: NodeData[] = [];
        const newConnections: Connection[] = [];

        // 1. Determine iteration count
        const taskCount = config.count || 1;
        const videoNodeIds: string[] = [];

        // 2. Loop to create Video Nodes
        for (let i = 0; i < taskCount; i++) {
            const iterTimestamp = timestamp + i;
            const iterVideoNodeId = `v-${iterTimestamp}`;
            videoNodeIds.push(iterVideoNodeId);

            // Lay them out in a grid or stack?
            // Simple stack with offset
            const iterOffset = offset + (i * 20);
            const iterPos = {
                x: center.x - 240 + iterOffset + (i % 2) * 20,
                y: center.y - 160 + iterOffset + Math.floor(i / 2) * 20
            };

            const videoNode: NodeData = {
                id: iterVideoNodeId,
                type: 'video',
                position: iterPos,
                width: 480,
                height: 320,
                title: (prompt.slice(0, 20) || 'New Video Task') + (taskCount > 1 ? ` #${i + 1}` : ''),
                prompt: prompt,
                content: '',
                status: 'idle',
                source: 'grid',
                params: {
                    model: config.model || 'sora-2',
                    aspectRatio: config.aspectRatio || '16:9',
                    resolution: config.resolution || '720p',
                    batchSize: 1, // Individual node is 1, loop handles count
                    duration: config.duration,
                    seconds: (config.duration || '15s').replace('s', '')
                },
                providerId: config.providerId
            };
            newNodes.push(videoNode);
        }

        // No need to push single videoNode anymore as we loop


        // 2. If Image Provided, Create Image Node and Connect
        if (imageContent) {
            const imageNodeId = `img-${timestamp}`;
            let contentStr = '';
            let blobData: Blob | undefined = undefined;

            if (typeof imageContent === 'string') {
                contentStr = imageContent;
            } else {
                contentStr = URL.createObjectURL(imageContent);
                blobData = imageContent;
            }

            // Find reference position (from first video node)
            const refPos = newNodes.length > 0 ? newNodes[0].position : { x: center.x - 240 + offset, y: center.y - 160 + offset };

            const imageNode: NodeData = {
                id: imageNodeId,
                type: 'image',
                position: { x: refPos.x - 380, y: refPos.y + 20 }, // Left of first video
                width: 340,
                height: 280,
                source: 'grid', // Mark as grid-generated
                title: 'Reference Image',
                content: contentStr,
                blob: blobData,
                status: 'success'
            };
            newNodes.push(imageNode);

            // Connect Image to ALL video nodes
            videoNodeIds.forEach((vid, idx) => {
                newConnections.push({
                    id: `c-${timestamp}-${idx}`,
                    fromNodeId: imageNodeId,
                    toNodeId: vid
                });
            });
        }

        setNodes(prev => [...prev, ...newNodes]);
        setConnections(prev => [...prev, ...newConnections]);

        // Prepare merged data for immediate execution
        const mergedNodes = [...nodesRef.current, ...newNodes];
        const mergedConnections = [...connectionsRef.current, ...newConnections];

        // Trigger generation for each video node created
        // We need to pass the specific node params. Can get from newNodes.
        videoNodeIds.forEach(vid => {
            const node = newNodes.find(n => n.id === vid);
            if (node && node.params) {
                handleGenerate(vid, prompt, node.params, true, mergedNodes, mergedConnections);
            }
        });
    }, [handleGenerate, screenToCanvas]);

    // --- Rendering ---

    // Render Connections with Culling
    const renderConnections = () => {
        const padding = 200;
        const screenW = window.innerWidth / viewport.k;
        const screenH = window.innerHeight / viewport.k;
        const viewLeft = -viewport.x / viewport.k - padding;
        const viewTop = -viewport.y / viewport.k - padding;
        const viewRight = viewLeft + screenW + padding * 2;
        const viewBottom = viewTop + screenH + padding * 2;

        return connections.filter(conn => {
            const fromNode = nodes.find(n => n.id === conn.fromNodeId);
            const toNode = nodes.find(n => n.id === conn.toNodeId);
            if (!fromNode || !toNode) return false;

            // Exclude connections involving grid-generated nodes from main canvas render
            if (fromNode.source === 'grid' || toNode.source === 'grid') return false;

            // Culling with padding to prevent flickering at edges
            const padding = 200;
            const isNodeVisible = (n: any) => (
                n.position.x + n.width > viewLeft - padding &&
                n.position.x < viewRight + padding &&
                n.position.y + n.height > viewTop - padding &&
                n.position.y < viewBottom + padding
            );

            return isNodeVisible(fromNode) || isNodeVisible(toNode);
        }).map(conn => {
            const fromNode = nodes.find(n => n.id === conn.fromNodeId)!;
            const toNode = nodes.find(n => n.id === conn.toNodeId)!;

            const startX = fromNode.position.x + fromNode.width;
            const startY = fromNode.position.y + fromNode.height / 2;
            const endX = toNode.position.x;
            const endY = toNode.position.y + toNode.height / 2;

            // Stable Bezier Curve Calculation
            const dx = Math.abs(endX - startX);
            const curvature = Math.max(dx * 0.5, 50); // Minimum curvature for stability
            const cp1x = startX + curvature;
            const cp1y = startY;
            const cp2x = endX - curvature;
            const cp2y = endY;

            const pathD = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
            const isConnSelected = selectedConnectionId === conn.id;

            return (
                <g key={conn.id}>
                    <path
                        className="connection-path-hit"
                        data-connection-id={conn.id}
                        data-from-node={conn.fromNodeId}
                        data-to-node={conn.toNodeId}
                        d={pathD}
                        stroke="transparent"
                        strokeWidth="15"
                        fill="none"
                        style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedConnectionId(conn.id);
                            setSelectedNodeIds(new Set());
                        }}
                    />
                    <path
                        className="connection-path"
                        data-connection-id={conn.id}
                        data-from-node={conn.fromNodeId}
                        data-to-node={conn.toNodeId}
                        d={pathD}
                        stroke={isConnSelected ? "#22d3ee" : "#52525b"}
                        strokeWidth={isConnSelected ? "3" : "2"}
                        fill="none"
                        strokeOpacity={isConnSelected ? "1" : "0.8"}
                        style={{ pointerEvents: 'none', transition: 'none' }}
                    />
                </g>
            );
        });
    };

    // Render Active Drag Line
    const renderActiveConnection = () => {
        if (!connectingParams) return null;

        const node = nodes.find(n => n.id === connectingParams.nodeId);
        if (!node) return null;

        const mouseCanvas = screenToCanvas(mousePos.x, mousePos.y);
        let startX, startY, endX, endY;

        if (connectingParams.handleType === 'source') {
            // Dragging from Output (Right) -> Mouse
            startX = node.position.x + node.width;
            startY = node.position.y + node.height / 2;
            endX = mouseCanvas.x;
            endY = mouseCanvas.y;
        } else {
            // Dragging from Input (Left) -> Mouse
            // Visually we want the line to end at the input, so treat mouse as start
            startX = mouseCanvas.x;
            startY = mouseCanvas.y;
            endX = node.position.x;
            endY = node.position.y + node.height / 2;
        }

        const dist = Math.abs(endX - startX);
        const cp1x = startX + dist * 0.5;
        const cp1y = startY;
        const cp2x = endX - dist * 0.5;
        const cp2y = endY;

        const pathD = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;

        return (
            <path d={pathD} stroke="#22d3ee" strokeWidth="2" fill="none" strokeDasharray="5,5" />
        );
    };

    // Download Node Media
    const handleDownloadNodeMedia = async (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        // If no content (e.g. empty or text node without specific file), fallback to project export?
        if (!node.content && node.type !== 'text') {
            handleExport();
            return;
        }

        // 如果有多张图片，询问用户下载当前还是全部
        if (node.allImages && node.allImages.length > 1 && node.type === 'image') {
            const downloadAll = confirm(`此节点包含 ${node.allImages.length} 张图片。\n\n点击"确定"下载所有图片\n点击"取消"仅下载当前显示的图片`);

            if (downloadAll) {
                // 下载所有图片
                for (let i = 0; i < node.allImages.length; i++) {
                    try {
                        const response = await fetch(node.allImages[i]);
                        const blob = await response.blob();
                        const a = document.createElement('a');
                        a.href = window.URL.createObjectURL(blob);
                        a.download = `X-tapnow_image_${Date.now()}_${i + 1}.png`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(a.href);

                        // 添加延迟避免浏览器阻止多个下载
                        if (i < node.allImages.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 300));
                        }
                    } catch (error) {
                        console.error(`Failed to download image ${i + 1}:`, error);
                    }
                }
                return;
            }
        }

        let url = node.content;
        let ext = 'png';
        let mime = 'image/png';

        if (node.type === 'video') {
            ext = 'mp4';
            mime = 'video/mp4';
        } else if (node.type === 'text') {
            const blob = new Blob([node.content || node.description || ''], { type: 'text/plain' });
            url = URL.createObjectURL(blob);
            ext = 'txt';
            mime = 'text/plain';
        }

        if (!url) {
            handleExport();
            return;
        }

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
            const blob = await response.blob();

            try {
                // @ts-ignore
                if (window.showSaveFilePicker) {
                    // @ts-ignore
                    const handle = await window.showSaveFilePicker({
                        suggestedName: `X-tapnow_${node.type}_${Date.now()}.${ext}`,
                        types: [{
                            description: 'Media File',
                            accept: { [mime]: [`.${ext}`] },
                        }],
                    });
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    return;
                }
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error('File System Access API failed, falling back to download:', err);
                } else {
                    return; // User cancelled
                }
            }

            // Fallback to standard download (blob)
            const a = document.createElement('a');
            a.href = window.URL.createObjectURL(blob);
            a.download = `X-tapnow_${node.type}_${Date.now()}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(a.href);

        } catch (error) {
            console.error('Download failed:', error);
            // Fallback: Direct Link (might open in new tab if CORS blocks download attr, but better than nothing)
            const a = document.createElement('a');
            a.href = url;
            a.download = `X-tapnow_${node.type}_${Date.now()}.${ext}`;
            a.target = "_blank"; // Ensure it opens even if blocked
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    return (
        <div
            className="w-screen h-screen bg-[#09090b] relative overflow-hidden font-sans text-white"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onContextMenu={handleCanvasContextMenu}
        >
            {/* Background Pattern - Moved inside InfiniteCanvas */}

            {/* Workflow Library Panel - Only in Canvas Mode */}
            {viewMode === 'canvas' && (
                <WorkflowLibraryPanel
                    isOpen={isWorkflowLibraryOpen}
                    onClose={() => setIsWorkflowLibraryOpen(false)}
                    currentNodes={nodes}
                    currentConnections={connections}
                    currentViewport={viewport}
                    onLoadWorkflow={handleLoadWorkflow}
                />
            )}

            {/* View Mode Switcher */}
            <div className="absolute top-6 left-6 z-[60] flex items-center gap-1 bg-zinc-900/90 border border-zinc-800 p-1 rounded-lg backdrop-blur-md shadow-xl">
                <button
                    onClick={() => setViewMode('canvas')}
                    className={`
                        flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                        ${viewMode === 'canvas' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}
                    `}
                >
                    <MoveIcon className="w-3.5 h-3.5" />
                    <span>Canvas</span>
                </button>
                <div className="w-px h-3 bg-zinc-700 mx-1"></div>
                <button
                    onClick={() => setViewMode('grid')}
                    className={`
                        flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                        ${viewMode === 'grid' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}
                    `}
                >
                    <GridIcon className="w-3.5 h-3.5" />
                    <span>List</span>
                </button>
            </div>

            {/* Sidebar - Only in Canvas Mode */}
            {viewMode === 'canvas' && (
                <Sidebar
                    onAddNode={addNewNode}
                    onAddVideoNode={addNewVideoNode}
                    onAddTextNode={addNewTextNode}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                    onSave={handleExport}
                    onLoad={handleImportClick}
                    onToggleLibrary={handleToggleLibrary}
                    isLibraryOpen={isWorkflowLibraryOpen}
                    onTogglePresets={() => setIsPromptPresetsOpen(prev => !prev)}
                    isPresetsOpen={isPromptPresetsOpen}
                    onOpenComposer={() => setIsImageComposerOpen(true)}
                    onNewProject={() => setIsNewProjectModalOpen(true)}
                />
            )}

            {/* Grid Mode View - Conditionally rendered to free resources */}
            {viewMode === 'grid' && (
                <GridModeView
                    nodes={nodes}
                    settings={appSettings}
                    onCreateTask={handleCreateTask}
                    onDeleteNode={handleDeleteNode}
                    onMaximize={handleNodeMaximize}
                    gridState={gridState}
                    onStateChange={(updates) => setGridState((prev: any) => ({ ...prev, ...updates }))}
                />
            )}

            {/* Settings Modal */}
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                settings={appSettings}
                onSave={handleSaveSettings}
            />

            {/* Prompt Presets Modal */}
            <PromptPresetsModal
                isOpen={isPromptPresetsOpen}
                onClose={() => setIsPromptPresetsOpen(false)}
            />

            <ImagePreviewModal
                isOpen={!!previewMedia}
                media={previewMedia}
                onClose={() => setPreviewMedia(null)}
            />

            <GlobalVideoPromptModal
                isOpen={isGlobalVideoPromptOpen}
                onClose={() => setIsGlobalVideoPromptOpen(false)}
                onSave={handleSaveGlobalVideoPrompt}
                initialPrompt={globalVideoPrompt}
            />


            {viewMode === 'canvas' && (
                <InfiniteCanvas
                    viewport={viewport}
                    onViewportChange={(v) => {
                        setViewport(v);
                        setContextMenu(null);
                    }}
                    onCanvasMouseDown={handleCanvasMouseDown}
                    onCanvasDeselect={() => {
                        setSelectedNodeIds(new Set());
                        setSelectedConnectionId(null);
                    }}
                >
                    {/* Groups Layer */}
                    {groups.map(group => (
                        <Group
                            key={group.id}
                            group={group}
                            nodes={nodes.filter(n => n.groupId === group.id && n.source !== 'grid')}
                            viewport={viewport}
                            isSelected={selectedGroupId === group.id}
                            onMouseDown={(e) => handleGroupMouseDown(e, group.id)}
                            onResize={(e, dir) => handleGroupResizeStart(e, group.id, dir)}
                            onTitleChange={(title) => handleGroupTitleChange(group.id, title)}
                            onContextMenu={(e) => handleGroupContextMenu(e, group.id)}
                            onDelete={() => {
                                // Ask user whether to dissolve or delete completely
                                const result = window.confirm(
                                    '删除分组：\n\n' +
                                    '【确定】= 仅解散分组（保留节点）\n' +
                                    '【取消】= 返回\n\n' +
                                    '如需彻底删除分组及内容，请右键使用菜单'
                                );
                                if (result) {
                                    // User clicked OK: dissolve group (keep nodes)
                                    handleDeleteGroup(group.id, false);
                                }
                            }}
                            onRun={(mode) => handleGroupRun(group.id, mode)}
                        />
                    ))}

                    {/* Connections Layer - Rendered after groups so they appear on top */}
                    <svg
                        className="absolute top-0 left-0 w-[10000px] h-[10000px] pointer-events-none overflow-visible"
                        style={{ transform: 'translateZ(0)', zIndex: 0 }}
                    >
                        {renderConnections().filter(pathElement => {
                            // This is hacking the JSX result which is messy. Better to filter data inside renderConnections.
                            // But I can't easily see renderConnections definition right now without another view.
                            // Let's assume renderConnections iterates 'connections' state.
                            // If I can't find it, I'll filter connections passed to it if it accepted args, but it takes none.
                            return true;
                        })}
                        {renderActiveConnection()}
                    </svg>

                    {/* Viewport Culling: Only render nodes that are visible in the current viewport AND not grid-hidden */}
                    {nodes.filter(node => node.source !== 'grid').filter(node => {
                        // Always render videos to avoid reload/buffering when scrolling back
                        if (node.type === 'video') return true;

                        const padding = 200; // Extra buffer area
                        const screenW = window.innerWidth / viewport.k;
                        const screenH = window.innerHeight / viewport.k;
                        const viewLeft = -viewport.x / viewport.k - padding;
                        const viewTop = -viewport.y / viewport.k - padding;
                        const viewRight = viewLeft + screenW + padding * 2;
                        const viewBottom = viewTop + screenH + padding * 2;

                        return (
                            node.position.x + node.width > viewLeft &&
                            node.position.x < viewRight &&
                            node.position.y + node.height > viewTop &&
                            node.position.y < viewBottom
                        );
                    }).map(node => (
                        <Node
                            key={node.id}
                            data={node}
                            scale={viewport.k}
                            isSelected={selectedNodeIds.has(node.id)}
                            showPanel={selectedNodeIds.has(node.id) && selectedNodeIds.size === 1 && !selectionBox}
                            onMouseDown={handleNodeMouseDown}
                            onNodeClick={handleNodeClick}
                            onDoubleClick={handleNodeDoubleClick}
                            onConnectStart={handleConnectStart}
                            onConnectEnd={handleConnectEnd}
                            onGenerate={handleGenerate}
                            onMaximize={handleNodeMaximize}
                            onUpload={handleUpload}
                            onResize={handleNodeResize}
                            onContextMenu={handleNodeContextMenu}
                            onPromptChange={handlePromptChange}
                            onContentChange={handleContentChange}
                            onParamsChange={handleParamsChange}
                            onDismissError={handleDismissError}
                            onTitleChange={handleNodeTitleChange}
                            onDownload={handleDownloadNodeMedia}
                            appSettings={appSettings}
                            onProviderChange={handleProviderChange}
                            onModelChange={handleModelChange}
                            isAutoResize={isAutoResize}
                            getFinalPrompt={getFinalPromptForNode}
                            onImageSwitch={handleImageSwitch}
                            onFontSizeChange={handleFontSizeChange}
                        />
                    ))}

                    {/* Selection Box - Now in World Space */}
                    {selectionBox && (
                        <div
                            className="absolute border-2 border-cyan-500 bg-cyan-500/5 pointer-events-none z-[100]"
                            style={{
                                left: Math.min(selectionBox.startWorldX, selectionBox.currentWorldX),
                                top: Math.min(selectionBox.startWorldY, selectionBox.currentWorldY),
                                width: Math.abs(selectionBox.currentWorldX - selectionBox.startWorldX),
                                height: Math.abs(selectionBox.currentWorldY - selectionBox.startWorldY)
                            }}
                        />
                    )}
                </InfiniteCanvas>
            )}

            {/* Batch Selection Toolbar */}
            {selectedNodeIds.size > 1 && !selectionBox && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#18181b]/95 border border-zinc-700/50 rounded-full p-2 px-4 shadow-2xl z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
                    <span className="text-zinc-400 text-xs font-medium px-2">{selectedNodeIds.size} Selected</span>
                    <div className="h-4 w-px bg-zinc-700 mx-1" />
                    <button
                        onClick={handleBatchGenerate}
                        className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs py-1.5 px-4 rounded-full transition-all shadow-lg hover:shadow-cyan-500/20 active:scale-95"
                    >
                        <Wand2Icon className="w-3.5 h-3.5" />
                        <span>Generate All</span>
                    </button>
                    <button
                        onClick={() => handleComposeSelected()}
                        className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs py-1.5 px-4 rounded-full transition-all border border-zinc-700 shadow-lg active:scale-95"
                    >
                        <LayersIcon className="w-3.5 h-3.5" />
                        <span>合成选中</span>
                    </button>
                    {/* Could add delete button here too for convenience */}
                </div>
            )}

            {/* Selection Box is now rendered inside InfiniteCanvas as a child */}

            {/* Helper Functions for Image Upload */}
            {/* These should be defined inside the component, but for this specific tool call I am inserting them here which is inside JSX if I am not careful. */}
            {/* Wait, I cannot insert functions inside the return/JSX block. I need to find where separate functions are defined. */}
            {/* I will use a different strategy. I'll read the code around HandleDrop (line 730) again to insert there. */}

            {viewMode === 'canvas' && (
                <>
                    {/* Tutorial Button */}
                    <a
                        href="https://lqz7rkd392b.feishu.cn/wiki/TvIFwUSyEi2rPYkOroFcXZxMnq3?from=from_copylink"
                        target="_blank"
                        rel="noreferrer"
                        className="absolute bottom-6 left-6 z-50 flex items-center gap-2 bg-zinc-900/95 border border-zinc-800 rounded-full p-2 px-4 shadow-xl hover:bg-zinc-800 hover:text-white text-zinc-400 transition-all cursor-pointer group"
                    >
                        <BookOpenIcon className="w-4 h-4 group-hover:text-blue-400 transition-colors" />
                        <span className="text-xs font-medium">教程</span>
                    </a>

                    {/* Zoom Controls (Bottom Right) - Below Minimap */}
                    <div className="absolute bottom-6 right-6 flex items-center gap-4 bg-zinc-900/95 border border-zinc-800 rounded-full p-2 px-4 shadow-xl z-50">
                        <button
                            className="text-zinc-400 hover:text-white"
                            onClick={() => setViewport(prev => ({ ...prev, k: Math.max(0.1, prev.k - 0.1) }))}
                        >
                            -
                        </button>
                        <div className="w-24 h-1 bg-zinc-700 rounded-full overflow-hidden relative group cursor-pointer">
                            <div
                                className="absolute top-0 left-0 h-full bg-zinc-400 group-hover:bg-white transition-all"
                                style={{ width: `${Math.min(100, viewport.k * 50)}%` }}
                            />
                        </div>
                        <span className="text-xs text-zinc-500 w-8 text-right">{Math.round(viewport.k * 100)}%</span>
                        <button
                            className="text-zinc-400 hover:text-white"
                            onClick={() => setViewport(prev => ({ ...prev, k: Math.min(5, prev.k + 0.1) }))}
                        >
                            +
                        </button>
                        <div className="w-px h-4 bg-zinc-700 mx-1"></div>
                        <button
                            onClick={() => setViewport({ x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 150, k: 1 })}
                            className="text-zinc-500 hover:text-white transition-colors p-1"
                            title="Reset View"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                        </button>
                    </div>

                    {/* Top Controls (Center) */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 pointer-events-auto">
                        <button
                            onClick={() => setIsAutoResize(!isAutoResize)}
                            className={`
                        flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors text-xs font-medium
                        ${isAutoResize
                                    ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400'
                                    : 'bg-zinc-900/80 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                                }
                    `}
                        >
                            <MaximizeIcon className="w-3.5 h-3.5" />
                            <span>Auto-Resize</span>
                        </button>
                    </div>
                </>
            )}

            {/* Top Right Controls */}
            <div className="absolute top-4 right-8 z-40 flex items-center gap-3">
                {/* Sora Character Management Button */}
                <button
                    onClick={() => setIsCharacterManagementOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors text-xs font-medium pointer-events-auto bg-zinc-900/80 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                    title="Sora 角色管理"
                >
                    <UsersIcon className="w-3.5 h-3.5" />
                    <span>Sora</span>
                </button>

                {/* Announcement / Changelog Button */}
                <button
                    onClick={() => setIsAnnouncementOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors text-xs font-medium pointer-events-auto bg-zinc-900/80 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                    title="更新日志"
                >
                    <HistoryIcon className="w-3.5 h-3.5" />
                    <span>更新日志</span>
                </button>

                {/* Global Video Prompt Button */}
                <button
                    onClick={() => setIsGlobalVideoPromptOpen(true)}
                    className={
                        `flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors text-xs font-medium pointer-events-auto
                        ${globalVideoPrompt
                            ? 'bg-purple-500/10 border-purple-500/50 text-purple-400'
                            : 'bg-zinc-900/80 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                        }`
                    }
                    title="设置全局视频提示词"
                >
                    <VideoIcon className="w-3.5 h-3.5" />
                    <span>全局视频提示</span>
                </button>

                <div className="text-zinc-500 text-sm font-medium tracking-wider pointer-events-none select-none">
                    XIANG
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={handleCloseContextMenu}
                    items={contextMenu.type === 'group' ? [
                        {
                            label: '重命名',
                            icon: <EditIcon className="w-4 h-4 text-blue-400" />,
                            onClick: () => { /* Logic handled by double click for now, or we can focus input */ }
                        },
                        {
                            label: '颜色',
                            icon: <PaletteIcon className="w-4 h-4 text-pink-400" />,
                            children: [
                                { label: '默认灰', onClick: () => handleGroupColorChange(contextMenu.groupId!, 'bg-slate-800/20') },
                                { label: '蓝色', icon: <div className="w-3 h-3 rounded-full bg-blue-500/50" />, onClick: () => handleGroupColorChange(contextMenu.groupId!, 'bg-blue-500/20') },
                                { label: '绿色', icon: <div className="w-3 h-3 rounded-full bg-emerald-500/50" />, onClick: () => handleGroupColorChange(contextMenu.groupId!, 'bg-emerald-500/20') },
                                { label: '黄色', icon: <div className="w-3 h-3 rounded-full bg-yellow-500/50" />, onClick: () => handleGroupColorChange(contextMenu.groupId!, 'bg-yellow-500/20') },
                                { label: '红色', icon: <div className="w-3 h-3 rounded-full bg-red-500/50" />, onClick: () => handleGroupColorChange(contextMenu.groupId!, 'bg-red-500/20') },
                                { label: '紫色', icon: <div className="w-3 h-3 rounded-full bg-purple-500/50" />, onClick: () => handleGroupColorChange(contextMenu.groupId!, 'bg-purple-500/20') },
                                { label: '青色', icon: <div className="w-3 h-3 rounded-full bg-cyan-500/50" />, onClick: () => handleGroupColorChange(contextMenu.groupId!, 'bg-cyan-500/20') },
                            ]
                        },
                        { separator: true },
                        {
                            label: '解散分组',
                            icon: <ScanIcon className="w-4 h-4" />,
                            onClick: () => {
                                const groupId = contextMenu.groupId!;
                                const nodesInGroup = nodes.filter(n => n.groupId === groupId);
                                const nodeCount = nodesInGroup.length;

                                setConfirmDialog({
                                    isOpen: true,
                                    title: '解散分组',
                                    message: `此操作将解散分组，但保留所有 ${nodeCount} 个节点。\n\n节点将恢复为独立状态。`,
                                    isDanger: false,
                                    onConfirm: () => {
                                        handleDeleteGroup(groupId, false);
                                        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                    }
                                });
                            }
                        },
                        {
                            label: '彻底删除',
                            danger: true,
                            icon: <Trash2Icon className="w-4 h-4" />,
                            onClick: () => {
                                const groupId = contextMenu.groupId!;
                                const nodesInGroup = nodes.filter(n => n.groupId === groupId);
                                const nodeCount = nodesInGroup.length;

                                setConfirmDialog({
                                    isOpen: true,
                                    title: '彻底删除分组',
                                    message: `⚠️ 此操作将删除分组及其内部的所有 ${nodeCount} 个节点！\n\n删除后无法恢复，请谨慎操作。`,
                                    isDanger: true,
                                    onConfirm: () => {
                                        handleDeleteGroup(groupId, true);
                                        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                    }
                                });
                            }
                        }
                    ] : contextMenu.type === 'node' ? (() => {
                        const node = nodes.find(n => n.id === contextMenu.nodeId);
                        const isMediaNode = node && (node.type === 'image' || node.type === 'video');

                        return [
                            {
                                label: '创建分组',
                                icon: <FolderIcon className="w-4 h-4 text-yellow-500" />,
                                onClick: () => {
                                    if (selectedNodeIds.size > 0) {
                                        handleCreateGroup(Array.from(selectedNodeIds));
                                    } else if (contextMenu.nodeId) {
                                        handleCreateGroup([contextMenu.nodeId]);
                                    }
                                }
                            },
                            { separator: true },
                            {
                                label: '下载',
                                icon: <UploadIcon className="w-4 h-4 rotate-180" />, // Save/Download
                                onClick: () => {
                                    if (contextMenu.nodeId) {
                                        handleDownloadNodeMedia(contextMenu.nodeId);
                                    }
                                }
                            },
                            // Only show Compose option for Image/Video nodes
                            ...(isMediaNode ? [{
                                label: '发送至合成',
                                icon: <LayersIcon className="w-4 h-4 text-blue-400" />,
                                onClick: () => handleComposeSelected(new Set([contextMenu.nodeId!]))
                            }] : []),
                            {
                                label: '复制',
                                icon: <CopyIcon className="w-4 h-4" />,
                                onClick: () => {
                                    const node = nodes.find(n => n.id === contextMenu.nodeId);
                                    if (node) {
                                        const clipboardData = {
                                            type: 'X-tapnow-nodes',
                                            nodes: [{ ...node, status: 'idle', progress: 0, taskId: undefined, selected: false }]
                                        };
                                        navigator.clipboard.writeText(JSON.stringify(clipboardData));
                                    }
                                }
                            },
                            {
                                label: '删除',
                                icon: <Trash2Icon className="w-4 h-4" />,
                                danger: true,
                                onClick: () => {
                                    if (contextMenu.nodeId) {
                                        if (selectedNodeIds.has(contextMenu.nodeId!) && selectedNodeIds.size > 1) {
                                            setNodes(prev => prev.filter(n => !selectedNodeIds.has(n.id)));
                                            setConnections(prev => prev.filter(c => !selectedNodeIds.has(c.fromNodeId) && !selectedNodeIds.has(c.toNodeId)));
                                            setSelectedNodeIds(new Set());
                                        } else {
                                            setNodes(prev => prev.filter(n => n.id !== contextMenu.nodeId));
                                            setConnections(prev => prev.filter(c => c.fromNodeId !== contextMenu.nodeId && c.toNodeId !== contextMenu.nodeId));
                                        }
                                    }
                                }
                            }
                        ]
                    })() : contextMenu.connectionSource ? [
                        {
                            label: '图片节点',
                            icon: <ImageIcon className="w-4 h-4 text-emerald-500" />,
                            onClick: () => addNewNode(contextMenu.canvasX, contextMenu.canvasY)
                        },
                        {
                            label: '视频节点',
                            icon: <VideoIcon className="w-4 h-4 text-blue-500" />,
                            onClick: () => addNewVideoNode(contextMenu.canvasX, contextMenu.canvasY)
                        },
                        {
                            label: '文本节点',
                            icon: <FileTextIcon className="w-4 h-4 text-gray-400" />,
                            onClick: () => addNewTextNode(contextMenu.canvasX, contextMenu.canvasY)
                        }
                    ] : [
                        {
                            label: '新建分组',
                            icon: <FolderIcon className="w-4 h-4 text-yellow-500" />,
                            onClick: () => {
                                if (contextMenu.canvasX && contextMenu.canvasY) {
                                    handleCreateGroup(undefined, { x: contextMenu.canvasX, y: contextMenu.canvasY });
                                }
                            }
                        },
                        {
                            label: '上传',
                            icon: <UploadIcon className="w-4 h-4" />,
                            onClick: () => {
                                if (contextMenu.canvasX && contextMenu.canvasY) {
                                    uploadPosRef.current = { x: contextMenu.canvasX, y: contextMenu.canvasY };
                                }
                                imageInputRef.current?.click();
                            }
                        },
                        {
                            label: '添加节点',
                            // icon: <PlusIcon className="w-4 h-4" />, // Optional, screenshot doesn't show icon for parent
                            children: [
                                {
                                    label: '图片节点',
                                    icon: <ImageIcon className="w-4 h-4 text-emerald-500" />,
                                    onClick: () => addNewNode(contextMenu.canvasX, contextMenu.canvasY)
                                },
                                {
                                    label: '视频节点',
                                    icon: <VideoIcon className="w-4 h-4 text-blue-500" />,
                                    onClick: () => addNewVideoNode(contextMenu.canvasX, contextMenu.canvasY)
                                },
                                {
                                    label: '文本节点',
                                    icon: <FileTextIcon className="w-4 h-4 text-gray-400" />,
                                    onClick: () => addNewTextNode(contextMenu.canvasX, contextMenu.canvasY)
                                }
                            ]
                        },
                        { separator: true },
                        {
                            label: '清空画布',
                            danger: true,
                            onClick: () => {
                                setConfirmDialog({
                                    isOpen: true,
                                    title: '清空画布',
                                    message: '删除后不可撤销，请确认',
                                    isDanger: true,
                                    onConfirm: () => {
                                        setNodes([]);
                                        setConnections([]);
                                        setGroups([]); // 清除分组
                                        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                    }
                                });
                            }
                        }
                    ]}
                />
            )}

            {viewMode === 'canvas' && (
                <Minimap
                    nodes={nodes}
                    viewport={viewport}
                    onViewportChange={(v) => {
                        setViewport(v);
                        setContextMenu(null);
                    }}
                />
            )}

            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".json"
                onChange={handleFileChange}
            />
            {/* Hidden Image Input */}
            <input
                type="file"
                ref={imageInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageInputChange}
            />


            <WelcomeNotice
                isOpen={showWelcomeNotice}
                onConfirm={handleWelcomeNoticeConfirm}
            />

            <AnnouncementModal
                isOpen={isAnnouncementOpen}
                onClose={() => setIsAnnouncementOpen(false)}
            />

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                isDanger={confirmDialog.isDanger}
            />

            <CharacterManagementModal
                isOpen={isCharacterManagementOpen}
                onClose={() => setIsCharacterManagementOpen(false)}
            />
            {/* Image Composer Modal */}
            <ImageComposerModal
                isOpen={isImageComposerOpen}
                onClose={() => {
                    setIsImageComposerOpen(false);
                    setComposerInitialImages([]);
                }}
                initialImages={composerInitialImages}
                onSendToCard={handleComposerSendToCard}
            />

            {/* New Project Modal */}
            <NewProjectModal
                isOpen={isNewProjectModalOpen}
                onClose={() => setIsNewProjectModalOpen(false)}
                onCreateProject={handleCreateProjectFromShots}
                appSettings={appSettings}
            />
        </div>
    );
};

export default App;
