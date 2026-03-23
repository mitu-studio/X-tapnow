import React, { useState, useRef, useCallback } from 'react';
import { XIcon, Wand2Icon, UploadIcon, FileTextIcon, VideoIcon, ChevronDownIcon, MoveIcon, SplitIcon, Trash2Icon, PlusIcon } from './Icons';
import { Shot, parseSRT, parseTXT, analyzeScript, readFileContent } from '../services/scriptAnalyzerService';
import { AppSettings } from '../types/settings';

// AI 分镜模板预设
// Keep template module, but remove built-in preset content.
const AI_TEMPLATE_PRESETS = [
    {
        label: "No Template",
        value: "",
        tsc: 0
    }
];

// Custom Template Interface
interface CustomTemplate {
    label: string;
    value: string; // Used for system prompt in custom templates
    tsc: number;   // Used for XWang presets
    isCustom?: boolean;
}

const STORAGE_TEMPLATES_KEY = 'X-tapnow_custom_templates';

interface NewProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateProject: (projectName: string, shots: Shot[]) => void;
    appSettings: AppSettings;
}

const NewProjectModal: React.FC<NewProjectModalProps> = ({
    isOpen,
    onClose,
    onCreateProject,
    appSettings
}) => {
    // 状态
    const [projectName, setProjectName] = useState('');
    const [rawText, setRawText] = useState('');
    const [shots, setShots] = useState<Shot[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    // Shot Drag & Drop State
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [dragPosition, setDragPosition] = useState<'before' | 'after' | 'merge' | null>(null);

    // 模板状态
    const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_TEMPLATES_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    const [selectedTemplate, setSelectedTemplate] = useState<CustomTemplate | typeof AI_TEMPLATE_PRESETS[0]>(AI_TEMPLATE_PRESETS[0]);
    const [showTemplateMenu, setShowTemplateMenu] = useState(false);

    // Provider State
    const [selectedProviderId, setSelectedProviderId] = useState<string>(
        appSettings.defaultTextProvider || (appSettings.textProviders?.[0]?.id || '')
    );
    const [showProviderMenu, setShowProviderMenu] = useState(false);

    // Template Menu Positioning
    const templateBtnRef = useRef<HTMLButtonElement>(null);
    const [menuPosition, setMenuPosition] = useState({ left: 0, bottom: 0 });

    const handleTemplateClick = () => {
        if (showTemplateMenu) {
            setShowTemplateMenu(false);
            return;
        }

        if (templateBtnRef.current) {
            const rect = templateBtnRef.current.getBoundingClientRect();
            setMenuPosition({
                left: rect.left,
                bottom: window.innerHeight - rect.top + 8 // 8px gap above button
            });
            setShowTemplateMenu(true);
            setShowModelMenu(false);
            setShowProviderMenu(false);
            setIsAddingTemplate(false);
        }
    };

    // Derived Provider Data
    const selectedProvider = appSettings.textProviders?.find(p => p.id === selectedProviderId) || appSettings.textProviders?.[0];
    const isXWangProvider = selectedProvider?.baseUrl?.includes('xwang.store');

    // Filter templates based on provider
    const availableTemplates = isXWangProvider
        ? AI_TEMPLATE_PRESETS
        : [AI_TEMPLATE_PRESETS[0], ...customTemplates];

    // Reset selected template when provider type changes
    React.useEffect(() => {
        if (isXWangProvider) {
            if (!AI_TEMPLATE_PRESETS.find(t => t.label === selectedTemplate.label)) {
                setSelectedTemplate(AI_TEMPLATE_PRESETS[0]);
            }
        } else {
            if (customTemplates.length > 0) {
                if (!customTemplates.find(t => t.label === selectedTemplate.label)) {
                    setSelectedTemplate(customTemplates[0]);
                }
            } else {
                // Fallback or empty state for non-xwang if no custom templates
                // Creates a dummy selection or handles empty gracefully
                setSelectedTemplate(AI_TEMPLATE_PRESETS[0]);
            }
        }
    }, [isXWangProvider, customTemplates]);

    // Add Template State
    const [isAddingTemplate, setIsAddingTemplate] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateContent, setNewTemplateContent] = useState(''); // Prompt content

    const handleAddTemplate = () => {
        if (!newTemplateName.trim()) return;

        // For non-XWang, we need content (system prompt)
        if (!isXWangProvider && !newTemplateContent.trim()) return;

        const newTemplate: CustomTemplate = {
            label: newTemplateName.trim(),
            value: newTemplateContent.trim(), // System Prompt
            tsc: 0, // 0 indicates no TSC (use system prompt)
            isCustom: true
        };

        const updated = [...customTemplates, newTemplate];
        setCustomTemplates(updated);
        localStorage.setItem(STORAGE_TEMPLATES_KEY, JSON.stringify(updated));

        setSelectedTemplate(newTemplate);
        setIsAddingTemplate(false);
        setNewTemplateName('');
        setNewTemplateContent('');
        setShowTemplateMenu(false);
    };

    const handleDeleteTemplate = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        const updated = customTemplates.filter((_, i) => i !== index);
        setCustomTemplates(updated);
        localStorage.setItem(STORAGE_TEMPLATES_KEY, JSON.stringify(updated));

        // If the deleted template was selected, reset selection
        if (selectedTemplate.label === customTemplates[index]?.label) {
            if (updated.length > 0) {
                setSelectedTemplate(updated[0]);
            } else {
                setSelectedTemplate(AI_TEMPLATE_PRESETS[0]);
            }
        }
    };
    const currentModels = selectedProvider?.models || [
        { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' },
        { id: 'gemini-3-pro-preview', displayName: 'Gemini 3.0 Pro' }
    ];

    const [selectedModelId, setSelectedModelId] = useState<string>(currentModels[0]?.id || '');
    const [showModelMenu, setShowModelMenu] = useState(false);

    // Reset model when provider changes
    React.useEffect(() => {
        if (selectedProvider) {
            const defaultModel = selectedProvider.models?.[0]?.id;
            if (defaultModel) setSelectedModelId(defaultModel);
        }
    }, [selectedProviderId, selectedProvider]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // 处理文件上传
    const handleFileUpload = useCallback(async (file: File) => {
        try {
            setError(null);
            const content = await readFileContent(file);

            // Auto-fill project name if empty
            const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            setProjectName(prev => prev.trim() ? prev : fileNameWithoutExt);

            // 根据文件扩展名决定解析方式
            const ext = file.name.toLowerCase().split('.').pop();

            if (ext === 'srt') {
                const parsedShots = parseSRT(content);
                setRawText(content);
                if (parsedShots.length > 0) {
                    setShots(parsedShots);
                }
            } else {
                // txt 或其他文本文件
                setRawText(content);
            }
        } catch (err) {
            setError('文件读取失败，请重试');
            console.error(err);
        }
    }, []);

    // 处理拖拽上传
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            const ext = file.name.toLowerCase().split('.').pop();
            if (ext === 'txt' || ext === 'srt') {
                handleFileUpload(file);
            } else {
                setError('请上传 .txt 或 .srt 格式的文件');
            }
        }
    }, [handleFileUpload]);

    const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileUpload(file);
        }
        // 重置 input 以允许重新选择相同文件
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [handleFileUpload]);

    // AI 分镜处理
    const handleAIAnalyze = useCallback(async () => {
        if (!rawText.trim()) {
            setError('请先输入或上传文本内容');
            return;
        }

        if (!selectedProvider) {
            setError('请先在设置中选择文本生成 API');
            return;
        }

        if (isXWangProvider && !selectedProvider?.apiKey) {
            setError('请到 https://api.xwang.store 注册生成令牌');
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            const apiConfig = {
                apiKey: selectedProvider.apiKey,
                baseUrl: selectedProvider.baseUrl,
                type: selectedProvider.type,
                endpointMode: selectedProvider.endpointMode,
                customEndpoint: selectedProvider.customEndpoint
            };

            // 使用用户选择的 Model (从固定列表中)
            const model = selectedModelId;

            // 使用模板中的 tsc 值
            const tsc = selectedTemplate.tsc;

            const result = await analyzeScript(rawText, model, apiConfig, tsc, selectedTemplate.value);
            setShots(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'AI 分镜失败');
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    }, [rawText, selectedProvider, selectedModelId, selectedTemplate]);

    // Shot Actions
    const handleAddShot = () => {
        const newShot: Shot = {
            id: `shot-${Date.now()}`,
            text: '新镜头',
        };
        setShots(prev => [...prev, newShot]);
    };

    const handleDeleteShot = (id: string) => {
        setShots(prev => prev.filter(s => s.id !== id));
    };

    const handleSplitShot = (id: string) => {
        setShots(prev => {
            const index = prev.findIndex(s => s.id === id);
            if (index === -1) return prev;
            const shot = prev[index];
            const textParts = shot.text.split('\n').filter(t => t.trim());

            if (textParts.length <= 1) {
                // If no newline, duplicate the shot for manual editing or split by sentence (simple naive split for now)
                return [
                    ...prev.slice(0, index),
                    { ...shot, text: shot.text, id: shot.id }, // Keep original
                    { ...shot, text: "分拆镜头", id: `shot-${Date.now()}` }, // New one
                    ...prev.slice(index + 1)
                ];
            }

            // Split by lines
            const newShots = textParts.map((text, i) => ({
                ...shot,
                id: i === 0 ? shot.id : `shot-${Date.now()}-${i}`,
                text: text.trim(),
                // Only keep timing on the first one or clear it? Let's clear it for split parts to avoid overlap
                startTime: i === 0 ? shot.startTime : undefined,
                endTime: i === 0 ? shot.endTime : undefined
            }));

            return [
                ...prev.slice(0, index),
                ...newShots,
                ...prev.slice(index + 1)
            ];
        });
    };

    const handleUpdateShotText = (id: string, newText: string) => {
        setShots(prev => prev.map(s => s.id === id ? { ...s, text: newText } : s));
    };

    // Shot Drag Handlers
    const handleShotDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.effectAllowed = 'move';
        // Set invisible drag image to avoid ghost if needed, or default is fine
        setDraggingId(id);
    };

    const handleShotDragOver = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        if (!draggingId || draggingId === id) return;

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const y = e.clientY - rect.top;
        const height = rect.height;

        // Thresholds
        const mergeZone = 0.4; // middle 40% for merge
        const edgeZone = 0.3;  // top/bottom 30% for reorder

        if (y < height * edgeZone) {
            setDragPosition('before');
        } else if (y > height * (1 - edgeZone)) {
            setDragPosition('after');
        } else {
            setDragPosition('merge');
        }
        setDragOverId(id);
    };

    const handleShotDragLeave = () => {
        setDragOverId(null);
        setDragPosition(null);
    };

    const handleShotDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggingId || draggingId === targetId) {
            setDraggingId(null);
            setDragOverId(null);
            return;
        }

        setShots(prev => {
            const sourceIndex = prev.findIndex(s => s.id === draggingId);
            const targetIndex = prev.findIndex(s => s.id === targetId);
            if (sourceIndex === -1 || targetIndex === -1) return prev;

            const sourceShot = prev[sourceIndex];
            const newShots = [...prev];

            // Remove source
            newShots.splice(sourceIndex, 1);

            // Adjust target index if needed (because removal shifted indices)
            const adjustedTargetIndex = newShots.findIndex(s => s.id === targetId);

            if (dragPosition === 'before') {
                newShots.splice(adjustedTargetIndex, 0, sourceShot);
            } else if (dragPosition === 'after') {
                newShots.splice(adjustedTargetIndex + 1, 0, sourceShot);
            } else if (dragPosition === 'merge') {
                const targetShot = newShots[adjustedTargetIndex];
                const mergedShot = {
                    ...targetShot,
                    text: `${targetShot.text}\n${sourceShot.text}`,
                    // Extend time range if available
                    endTime: sourceShot.endTime || targetShot.endTime
                };
                newShots[adjustedTargetIndex] = mergedShot;
            }

            return newShots;
        });

        setDraggingId(null);
        setDragOverId(null);
        setDragPosition(null);
    };

    // 创建工程
    const handleCreate = useCallback(() => {
        // Use provided name or generate default
        const finalProjectName = projectName.trim() || `Project_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${new Date().getHours()}${new Date().getMinutes()}`;

        if (shots.length === 0) {
            setError('请先进行 AI 分镜或上传 SRT 文件');
            return;
        }

        onCreateProject(finalProjectName, shots);

        // 重置状态
        setProjectName('');
        setRawText('');
        setShots([]);
        setError(null);
    }, [projectName, shots, onCreateProject]);

    // 关闭模态框
    const handleClose = useCallback(() => {
        setProjectName('');
        setRawText('');
        setShots([]);
        setError(null);
        onClose();
    }, [onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#0d1117] border border-zinc-800 w-[1200px] h-[720px] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-[#161b22]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <FileTextIcon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-white font-semibold text-lg">新建工程</h2>
                            <p className="text-zinc-500 text-xs">CREATE NEW DRAFT</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-zinc-400 hover:text-white transition-colors p-2 hover:bg-zinc-800 rounded-lg"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel - 工程信息 */}
                    <div className="w-[420px] border-r border-zinc-800 flex flex-col overflow-hidden">
                        <div className="p-5 flex-1 overflow-y-auto space-y-5">
                            {/* 工程名称 */}
                            <div>
                                <label className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
                                    <span className="w-4 h-4 bg-violet-500/20 rounded flex items-center justify-center text-violet-400 text-xs">📁</span>
                                    工程信息
                                </label>
                                <input
                                    type="text"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    placeholder="请输入工程名称..."
                                    className="w-full bg-[#0d1117] border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                                />
                            </div>

                            {/* 文件上传区 */}
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`
                                    border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                                    ${isDragOver
                                        ? 'border-violet-500 bg-violet-500/10'
                                        : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50'
                                    }
                                `}
                            >
                                <UploadIcon className={`w-8 h-8 mx-auto mb-3 ${isDragOver ? 'text-violet-400' : 'text-zinc-600'}`} />
                                <p className={`text-sm ${isDragOver ? 'text-violet-400' : 'text-zinc-500'}`}>
                                    点击或拖拽上传 (.txt/.srt)
                                </p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".txt,.srt"
                                    onChange={handleFileInputChange}
                                    className="hidden"
                                />
                            </div>

                            {/* 原始文本输入 */}
                            <div className="flex-1 flex flex-col">
                                {/* 标题行 */}
                                <div className="flex items-center justify-between mb-2">
                                    <label className="flex items-center gap-2 text-sm text-zinc-400">
                                        <span className="text-zinc-500">✏️</span>
                                        原始文本
                                    </label>
                                    <span className="text-xs text-red-500 font-medium opacity-80 decoration-red-500/30">
                                        分镜数量不要太多，最好50个以内（根据电脑性能）
                                    </span>
                                </div>

                                {/* 文本输入框 */}
                                <textarea
                                    value={rawText}
                                    onChange={(e) => setRawText(e.target.value)}
                                    placeholder="在此输入或粘贴您的字幕文本..."
                                    className="flex-1 w-full bg-[#0d1117] border border-zinc-800 rounded-t-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors resize-none text-sm leading-relaxed min-h-[140px]"
                                />

                                {/* 底部工具栏 - 配置选项 */}
                                <div className="flex items-center bg-zinc-900/60 border border-t-0 border-zinc-800 rounded-b-lg px-3 py-2">
                                    {/* 配置选项 */}
                                    <div className="flex items-center gap-2 text-xs flex-1">
                                        {/* Provider 选择 */}
                                        <div className="relative">
                                            <button
                                                onClick={() => { setShowProviderMenu(!showProviderMenu); setShowModelMenu(false); setShowTemplateMenu(false); }}
                                                className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors"
                                                title={selectedProvider?.baseUrl}
                                            >
                                                <span className={`max-w-[100px] truncate ${!selectedProvider ? 'text-red-400' : ''}`}>
                                                    {selectedProvider ? selectedProvider.name : '选择API'}
                                                </span>
                                                <ChevronDownIcon className="w-3 h-3 opacity-50" />
                                            </button>

                                            {showProviderMenu && appSettings.textProviders && (
                                                <div className="absolute bottom-full left-0 mb-1 w-48 bg-[#18181b] border border-zinc-800 rounded-lg overflow-hidden shadow-xl z-50 py-1 max-h-60 overflow-y-auto">
                                                    {appSettings.textProviders.map(p => (
                                                        <button
                                                            key={p.id}
                                                            onClick={() => {
                                                                setSelectedProviderId(p.id);
                                                                setShowProviderMenu(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 transition-colors ${selectedProviderId === p.id ? 'text-cyan-400 bg-zinc-800/50' : 'text-zinc-400'}`}
                                                        >
                                                            <div className="font-medium truncate">{p.name}</div>
                                                            <div className="text-[10px] text-zinc-600 truncate">{p.baseUrl}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <span className="text-zinc-700">|</span>

                                        {/* Model 选择 */}
                                        <div className="relative">
                                            <button
                                                onClick={() => { if (selectedProvider) setShowModelMenu(!showModelMenu); setShowTemplateMenu(false); setShowProviderMenu(false); }}
                                                disabled={!selectedProvider}
                                                className={`flex items-center gap-1 transition-colors ${selectedProvider ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-600 cursor-not-allowed'}`}
                                            >
                                                <span className="max-w-[120px] truncate">
                                                    {currentModels.find(m => m.id === selectedModelId)?.displayName || selectedModelId || '选择模型'}
                                                </span>
                                                <ChevronDownIcon className="w-3 h-3 opacity-50" />
                                            </button>
                                            {showModelMenu && selectedProvider && (
                                                <div className="absolute bottom-full left-0 mb-1 w-48 bg-[#18181b] border border-zinc-800 rounded-lg overflow-hidden shadow-xl z-50 py-1 max-h-60 overflow-y-auto">
                                                    {currentModels.map(m => (
                                                        <button
                                                            key={m.id}
                                                            onClick={() => {
                                                                setSelectedModelId(m.id);
                                                                setShowModelMenu(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 transition-colors ${selectedModelId === m.id ? 'text-cyan-400 bg-zinc-800/50' : 'text-zinc-400'}`}
                                                        >
                                                            {m.displayName}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <span className="text-zinc-700">|</span>
                                        <div className="relative">
                                            <button
                                                ref={templateBtnRef}
                                                onClick={handleTemplateClick}
                                                className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors"
                                            >
                                                <FileTextIcon className="w-3 h-3" />
                                                <span className="truncate max-w-[100px]">{selectedTemplate.label}</span>
                                                <ChevronDownIcon className="w-3 h-3 opacity-50" />
                                            </button>
                                            {showTemplateMenu && (
                                                <>
                                                    {/* Backdrop to close menu */}
                                                    <div
                                                        className="fixed inset-0 z-[100]"
                                                        onClick={() => setShowTemplateMenu(false)}
                                                    />

                                                    {/* Fixed Menu */}
                                                    <div
                                                        className="fixed w-80 bg-[#18181b] border border-zinc-800 rounded-lg overflow-hidden shadow-xl z-[101] flex flex-col"
                                                        style={{
                                                            left: menuPosition.left,
                                                            bottom: menuPosition.bottom
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {!isAddingTemplate ? (
                                                            <>
                                                                <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                                                                    {availableTemplates.length > 0 ? availableTemplates.map((preset, idx) => {
                                                                        const isCustom = (preset as CustomTemplate).isCustom;
                                                                        const customIndex = isCustom ? customTemplates.findIndex(c => c.label === preset.label) : -1;

                                                                        return (
                                                                            <button
                                                                                key={preset.label + idx}
                                                                                onClick={() => {
                                                                                    setSelectedTemplate(preset);
                                                                                    setShowTemplateMenu(false);
                                                                                }}
                                                                                className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 transition-colors flex items-center justify-between group/item ${selectedTemplate.label === preset.label ? 'text-violet-400 bg-zinc-800/50' : 'text-zinc-400'}`}
                                                                            >
                                                                                <span className="truncate flex-1 mr-2">{preset.label}</span>
                                                                                {isCustom && (
                                                                                    <div
                                                                                        onClick={(e) => handleDeleteTemplate(e, customIndex)}
                                                                                        className="opacity-0 group-hover/item:opacity-100 hover:text-red-400 p-1 rounded hover:bg-zinc-700/50 transition-all shrink-0"
                                                                                        title="删除模板"
                                                                                    >
                                                                                        <Trash2Icon className="w-3 h-3" />
                                                                                    </div>
                                                                                )}
                                                                            </button>
                                                                        );
                                                                    }) : (
                                                                        <div className="px-3 py-4 text-center text-xs text-zinc-500">
                                                                            暂无模板，请添加
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {!isXWangProvider && (
                                                                    <div className="border-t border-zinc-800 p-1 bg-zinc-900/50">
                                                                        <button
                                                                            onClick={() => setIsAddingTemplate(true)}
                                                                            className="w-full flex items-center justify-center gap-2 px-2 py-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                                                                        >
                                                                            <PlusIcon className="w-3 h-3" />
                                                                            <span>添加自定义模板</span>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div className="p-3 bg-[#18181b] flex flex-col gap-3">
                                                                <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
                                                                    <span>新建模板</span>
                                                                </div>

                                                                <div className="space-y-2">
                                                                    <input
                                                                        type="text"
                                                                        value={newTemplateName}
                                                                        onChange={(e) => setNewTemplateName(e.target.value)}
                                                                        placeholder="模板名称"
                                                                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 placeholder-zinc-600"
                                                                        autoFocus
                                                                    />
                                                                    <textarea
                                                                        value={newTemplateContent}
                                                                        onChange={(e) => setNewTemplateContent(e.target.value)}
                                                                        placeholder="系统提示词 (System Prompt)..."
                                                                        rows={6}
                                                                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 resize-none placeholder-zinc-600 leading-relaxed"
                                                                    />
                                                                </div>

                                                                <div className="flex gap-2 pt-1">
                                                                    <button
                                                                        onClick={() => setIsAddingTemplate(false)}
                                                                        className="flex-1 py-2 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
                                                                    >
                                                                        取消
                                                                    </button>
                                                                    <button
                                                                        onClick={handleAddTemplate}
                                                                        disabled={!newTemplateName.trim() || !newTemplateContent.trim()}
                                                                        className="flex-1 py-2 text-xs text-white bg-violet-600 hover:bg-violet-500 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-900/20"
                                                                    >
                                                                        {newTemplateName && newTemplateContent ? '保存模板' : '请填写完整'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* AI 分镜按钮 - 独立显示 */}
                                <button
                                    onClick={handleAIAnalyze}
                                    disabled={isProcessing || !rawText.trim()}
                                    className={`
                                        w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all
                                        ${isProcessing || !rawText.trim()
                                            ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-500/25'
                                        }
                                    `}
                                >
                                    <Wand2Icon className="w-4 h-4" />
                                    <span>{isProcessing ? '分析中...' : 'AI 分镜'}</span>
                                </button>
                            </div>

                            {/* 错误提示 */}
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm break-all">
                                    {error.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                                        part.match(/^https?:\/\//) ? (
                                            <a
                                                key={i}
                                                href={part}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="underline hover:text-red-300"
                                            >
                                                {part}
                                            </a>
                                        ) : part
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Panel - 分镜预览 */}
                    <div className="flex-1 flex flex-col bg-[#0d1117]">
                        <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
                            <span className="w-4 h-4 bg-cyan-500/20 rounded flex items-center justify-center text-cyan-400 text-xs">📋</span>
                            <span className="text-sm text-zinc-400">分镜预览</span>
                            <span className="text-xs text-zinc-600 ml-1">{shots.length} 组</span>
                            <div className="flex-1" />
                            <button
                                onClick={() => setShots([])}
                                disabled={shots.length === 0}
                                className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                            >
                                清空
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5">
                            {shots.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 bg-zinc-900 rounded-xl flex items-center justify-center mb-4">
                                        <VideoIcon className="w-8 h-8 text-zinc-700" />
                                    </div>
                                    <p className="text-zinc-500 text-sm">暂无预览内容</p>
                                    <p className="text-zinc-600 text-xs mt-1">上传文件或输入文本后点击"AI 分镜"</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="space-y-3 pb-20">
                                        {shots.map((shot, index) => (
                                            <div
                                                key={shot.id}
                                                draggable
                                                onDragStart={(e) => handleShotDragStart(e, shot.id)}
                                                onDragOver={(e) => handleShotDragOver(e, shot.id)}
                                                onDragLeave={handleShotDragLeave}
                                                onDrop={(e) => handleShotDrop(e, shot.id)}
                                                className={`
                                                relative p-4 rounded-xl border transition-all group
                                                ${draggingId === shot.id ? 'opacity-50 ring-2 ring-violet-500/50' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}
                                                ${dragOverId === shot.id && dragPosition === 'before' ? 'border-t-2 border-t-violet-500' : ''}
                                                ${dragOverId === shot.id && dragPosition === 'after' ? 'border-b-2 border-b-violet-500' : ''}
                                                ${dragOverId === shot.id && dragPosition === 'merge' ? 'ring-2 ring-inset ring-cyan-500 bg-cyan-500/10' : ''}
                                            `}
                                            >
                                                <div className="flex items-start gap-3">
                                                    {/* Drag Handle */}
                                                    <div className="mt-1 cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400">
                                                        <MoveIcon className="w-4 h-4" />
                                                    </div>

                                                    <div className="w-6 h-6 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-md flex items-center justify-center text-cyan-400 text-xs font-medium shrink-0 mt-0.5">
                                                        {index + 1}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <textarea
                                                            value={shot.text}
                                                            onChange={(e) => handleUpdateShotText(shot.id, e.target.value)}
                                                            className="w-full bg-transparent border-none p-0 text-zinc-200 text-sm leading-relaxed focus:ring-0 focus:outline-none resize-none"
                                                            rows={shot.text.split('\n').length || 1}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && e.ctrlKey) {
                                                                    e.preventDefault();
                                                                    // Maybe shortcuts later
                                                                }
                                                            }}
                                                        />
                                                        {shot.startTime && shot.endTime && (
                                                            <p className="text-zinc-600 text-xs mt-2 select-none">
                                                                {shot.startTime} → {shot.endTime}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleSplitShot(shot.id)}
                                                            title="拆分"
                                                            className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-500 hover:text-zinc-300"
                                                        >
                                                            <SplitIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteShot(shot.id)}
                                                            title="删除"
                                                            className="p-1.5 hover:bg-red-500/10 rounded-md text-zinc-500 hover:text-red-400"
                                                        >
                                                            <Trash2Icon className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Add Shot Button */}
                                        <button
                                            onClick={handleAddShot}
                                            className="w-full py-3 border-2 border-dashed border-zinc-800 rounded-xl flex items-center justify-center gap-2 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300 transition-all hover:bg-zinc-900/50"
                                        >
                                            <PlusIcon className="w-4 h-4" />
                                            <span className="text-sm">添加镜头</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-end gap-3 bg-[#161b22]">
                    <button
                        onClick={handleClose}
                        className="px-5 py-2.5 text-zinc-400 hover:text-white transition-colors text-sm"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={shots.length === 0}
                        className={`
                            px-5 py-2.5 rounded-lg text-sm font-medium transition-all
                            ${shots.length === 0
                                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/25'
                            }
                        `}
                    >
                        创建并进入工程
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewProjectModal;
