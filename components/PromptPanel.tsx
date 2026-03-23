import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Wand2Icon, ChevronDownIcon, RatioIcon, MonitorIcon, LayersIcon, SettingsIcon, FileTextIcon, Trash2Icon, SparklesIcon, MaximizeIcon } from './Icons';
import { AppSettings } from '../types/settings';


interface PromptPanelProps {
    initialPrompt?: string;
    initialParams?: any;
    status?: string;
    nodeType: 'image' | 'video' | 'text';
    appSettings: AppSettings;
    providerId?: string;
    modelId?: string;
    onGenerate: (prompt: string, config: any) => void;
    onPromptChange?: (prompt: string) => void;
    onParamsChange?: (config: any) => void;
    onProviderChange?: (providerId: string) => void;
    onModelChange?: (modelId: string) => void;
}

const RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'];
const GROK_RATIOS = ['16:9', '9:16', '1:1', '2:3', '3:2']; // Grok妯″瀷鏀寔鐨勫楂樻瘮
const GROK_RESOLUTIONS = ['720P', '1080P'];

// Separate resolution lists
const IMG_RESOLUTIONS = ['1k', '2k', '4k'];
const VIDEO_RESOLUTIONS = ['1280x720', '720x1280'];
const QUALITY_OPTIONS = ['standard', 'hd'];

const COUNTS = [1, 2, 4];
const DURATIONS = ['4s', '6s', '8s', '10s', '12s', '15s'];
const STORAGE_TEMPLATES_KEY = 'X-tapnow_prompt_panel_templates';

const SYSTEM_PROMPT_PRESETS = [
    {
        label: "基础模板",
        value: "你是一个专业写作助手。请基于输入内容输出结构化、清晰、可执行的结果。"
    }
];

const MentionStyles = () => (
    <style>{`
        .mention-tag {
            display: inline-flex;
            align-items: center;
            background: rgba(234, 88, 12, 0.2);
            border: 1px solid rgba(234, 88, 12, 0.5);
            color: #fb923c;
            border-radius: 4px;
            padding: 0 4px;
            margin: 0 2px;
            font-size: 0.9em;
            vertical-align: baseline;
            user-select: none;
        }
        .mention-delete {
            margin-left: 4px;
            cursor: pointer;
            color: #fb923c;
            opacity: 0.7;
            border: none;
            background: none;
            padding: 0;
            font-size: 1.1em;
            line-height: 1;
        }
        .mention-delete:hover {
            opacity: 1;
            color: #fff;
        }
        .custom-input {
            width: 100%;
            background: transparent;
            color: #e4e4e7;
            font-size: 0.875rem;
            outline: none;
            min-height: 60px;
            max-height: 300px;
            overflow-y: auto;
            font-weight: 300;
            line-height: 1.625;
            white-space: pre-wrap;
            word-break: break-word;
        }
        .custom-input:empty::before {
            content: attr(data-placeholder);
            color: #71717a;
        }
    `}</style>
);

interface Character {
    id: string;
    name?: string;
    username: string;
    avatar?: string;
    profile_picture_url?: string;
}

const PromptPanel: React.FC<PromptPanelProps> = ({ initialPrompt = '', initialParams, status, nodeType, appSettings, providerId, modelId, onGenerate, onPromptChange, onParamsChange, onProviderChange, onModelChange }) => {
    const [prompt, setPrompt] = useState(initialPrompt);

    // Resolve Provider and Models (New Logic)
    const providers = nodeType === 'image' ? appSettings.imageProviders : nodeType === 'video' ? appSettings.videoProviders : appSettings.textProviders;
    const selectedProvider = providerId ? providers.find(p => p.id === providerId) : providers.find(p => p.isDefault) || providers[0];
    const providerModels = selectedProvider?.models || [];
    const effectiveModelId = modelId || providerModels[0]?.id || '';

    // Configuration State - Initialize from props or default
    const [model, setModel] = useState(() => {
        // Prefer specific modelId prop, then initialParams, then effective default
        if (modelId) return modelId;
        const initial = initialParams?.model;
        // Check if initial is valid in current provider? Maybe not strictly necessary if we sync below
        if (initial) return initial;
        return effectiveModelId;
    });

    // Sync internal model state with effectiveModelId when it changes (e.g. provider switch)
    useEffect(() => {
        if (effectiveModelId && effectiveModelId !== model) {
            setModel(effectiveModelId);
        }
    }, [effectiveModelId]);

    const [aspectRatio, setAspectRatio] = useState(initialParams?.aspectRatio || '16:9');
    const [resolution, setResolution] = useState(() => {
        // Initialize with correct default based on nodeType to avoid extra renders
        const initial = initialParams?.resolution;
        if (initial) return initial;
        return nodeType === 'video' ? VIDEO_RESOLUTIONS[0] : IMG_RESOLUTIONS[1];
    });
    const [count, setCount] = useState(initialParams?.batchSize || 1);
    const [duration, setDuration] = useState(initialParams?.seconds || (initialParams?.duration ? initialParams.duration.replace('s', '') : '15'));
    const [systemPrompt, setSystemPrompt] = useState(initialParams?.systemPrompt || '');
    // Veo State
    const [enhancePrompt, setEnhancePrompt] = useState(initialParams?.enhance_prompt || false);
    const [enableUpsample, setEnableUpsample] = useState(initialParams?.enable_upsample || false);
    const [quality, setQuality] = useState(initialParams?.quality || 'hd');

    const isLoading = status === 'loading';
    const isVideo = nodeType === 'video';
    const isGrok = model.toLowerCase().includes('grok'); // 妫€娴嬫槸鍚︽槸Grok妯″瀷
    const displayResolutions = isGrok ? GROK_RESOLUTIONS : (isVideo ? VIDEO_RESOLUTIONS : IMG_RESOLUTIONS);
    const displayRatios = isGrok ? GROK_RATIOS : RATIOS; // Grok浣跨敤涓撶敤瀹介珮姣旓紝鍏朵粬浣跨敤閫氱敤瀹介珮姣?
    // UI State
    const [activeMenu, setActiveMenu] = useState<'model' | 'ratio' | 'res' | 'count' | 'duration' | 'system' | 'provider' | 'apimodel' | 'quality' | null>(null);
    const [showSystemPrompt, setShowSystemPrompt] = useState(false);

    const systemPromptRef = useRef<HTMLTextAreaElement>(null);

    // Stop wheel propagation for main prompt
    useEffect(() => {
        const el = contentRef.current;
        if (!el) return;
        const handleWheel = (e: WheelEvent) => e.stopPropagation();
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, []);

    // Stop wheel propagation for system prompt
    useEffect(() => {
        const el = systemPromptRef.current;
        if (!el) return;
        const handleWheel = (e: WheelEvent) => e.stopPropagation();
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [showSystemPrompt]);

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setActiveMenu(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    // Sync internal state if prop changes (Prompt)
    useEffect(() => {
        if (initialPrompt !== undefined && initialPrompt !== prompt) {
            setPrompt(initialPrompt);
        }
    }, [initialPrompt]);

    // Sync Params back to parent immediately on change
    useEffect(() => {
        onParamsChange?.({
            model,
            aspectRatio,
            aspect_ratio: aspectRatio,
            resolution,
            size: resolution,
            quality,
            batchSize: count,
            seconds: duration,
            systemPrompt, // Pass system prompt
            enhance_prompt: enhancePrompt,
            enable_upsample: enableUpsample
        });
    }, [model, aspectRatio, resolution, quality, count, duration, systemPrompt, enhancePrompt, enableUpsample]);

    // Auto-adjust aspect ratio for Grok model
    useEffect(() => {
        if (isGrok && !displayRatios.includes(aspectRatio)) {
            // 濡傛灉褰撳墠瀹介珮姣斾笉琚獹rok鏀寔锛屽垏鎹㈠埌榛樿鐨?6:9
            setAspectRatio('16:9');
        }
    }, [isGrok, aspectRatio, displayRatios]);

    // Validate and auto-adjust resolution
    useEffect(() => {
        if (displayResolutions.length > 0 && !displayResolutions.includes(resolution)) {
            setResolution(displayResolutions[0]);
        }
    }, [resolution, displayResolutions]);

    const toggleMenu = (e: React.MouseEvent, menu: 'model' | 'ratio' | 'res' | 'count' | 'duration' | 'system' | 'quality') => {
        e.stopPropagation(); // Prevent window click from immediately closing it
        setActiveMenu(prev => prev === menu ? null : menu);
    };

    const getModelLabel = () => {
        // Try to find in current provider models
        const pModel = providerModels.find(m => m.id === model);
        if (pModel) return pModel.displayName;
        // Fallback to model ID or 'Model' if not found
        return model || 'Model';
    };

    // ... (鍦?PromptPanel 缁勪欢鍐呴儴)

    // Character Mention Logic
    const [characters, setCharacters] = useState<Character[]>(() => {
        try {
            const stored = localStorage.getItem('sora_characters');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    const [showMention, setShowMention] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');

    // Custom Templates Loading
    const [customTemplates, setCustomTemplates] = useState<any[]>([]);

    useEffect(() => {
        const loadCustomTemplates = () => {
            try {
                const saved = localStorage.getItem(STORAGE_TEMPLATES_KEY);
                if (saved) {
                    setCustomTemplates(JSON.parse(saved));
                }
            } catch (e) {
                console.error("Failed to load custom templates", e);
            }
        };
        loadCustomTemplates();
        window.addEventListener('storage', loadCustomTemplates); // Sync across tabs/components
        return () => window.removeEventListener('storage', loadCustomTemplates);
    }, []);


    // Add Template Logic
    const [isAddingTemplate, setIsAddingTemplate] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateContent, setNewTemplateContent] = useState('');

    const handleAddTemplate = () => {
        if (!newTemplateName.trim() || !newTemplateContent.trim()) return;

        const newTemplate = {
            label: newTemplateName.trim(),
            value: newTemplateContent.trim(),
            isCustom: true
        };

        const updated = [...customTemplates, newTemplate];
        setCustomTemplates(updated);
        localStorage.setItem(STORAGE_TEMPLATES_KEY, JSON.stringify(updated));

        // Select it
        setSystemPrompt(newTemplate.value);

        // Reset and close add mode
        setNewTemplateName('');
        setNewTemplateContent('');
        setIsAddingTemplate(false);
        setActiveMenu(null);
    };

    const handleDeleteTemplate = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        const updated = customTemplates.filter((_, i) => i !== index);
        setCustomTemplates(updated);
        localStorage.setItem(STORAGE_TEMPLATES_KEY, JSON.stringify(updated));

        // If deleted one was selected, reset
        if (customTemplates[index].value === systemPrompt) {
            setSystemPrompt('');
        }
    };

    // contentRef for div
    const contentRef = useRef<HTMLDivElement>(null);
    const lastHtmlRef = useRef('');

    // Load characters
    useEffect(() => {
        const loadChars = () => {
            const stored = localStorage.getItem('sora_characters');
            if (stored) {
                try {
                    setCharacters(JSON.parse(stored));
                } catch (e) {
                    console.error("Failed to parse characters", e);
                }
            }
        };

        loadChars();
        // Optional: Listen for storage events to sync if multiple tabs or modal updates
        window.addEventListener('storage', loadChars);
        // Custom event for internal updates
        window.addEventListener('sora_characters_updated', loadChars);

        return () => {
            window.removeEventListener('storage', loadChars);
            window.removeEventListener('sora_characters_updated', loadChars);
        };
    }, []);

    // Helper: Escape HTML
    const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Helper: Format text to HTML with mentions
    // Helper: Format text to HTML with mentions
    const formatToHtml = (text: string) => {
        let html = escapeHtml(text || '');
        if (characters.length > 0) {
            const sorted = [...characters].sort((a, b) => b.username.length - a.username.length);
            sorted.forEach(char => {
                const regex = new RegExp(`@${char.username}\\b`, 'g');
                html = html.replace(regex, `<span class="mention-tag" contenteditable="false" data-username="${char.username}">@${char.name || char.username}<button class="mention-delete">脳</button></span>`);
            });
        }
        return html.replace(/\n/g, '<br>');
    };

    // Sync logic: Handle Node Switch & Character Updates
    const prevInitialRef = useRef(initialPrompt);

    useLayoutEffect(() => {
        if (!contentRef.current) return;

        const initialChanged = initialPrompt !== prevInitialRef.current;
        prevInitialRef.current = initialPrompt;

        if (initialChanged) {
            // Only force reset DOM if the new prop is different from current state
            // This prevents cursor jumps when parent echoes back the input value
            if (initialPrompt !== prompt) {
                const html = formatToHtml(initialPrompt || '');
                contentRef.current.innerHTML = html;
                lastHtmlRef.current = html;
                setPrompt(initialPrompt || '');
            }
        } else {
            // Check if we need to apply highlights to existing text (e.g. chars loaded)
            // But verify we're not interfering with typing simply by checking plain text match
            // Actually, we should only update if HTML structure significantly differs (e.g. new mention tags)
            const html = formatToHtml(prompt);

            // Only update if the sanitized text content matches but HTML is different
            // This implies we simply need to "upgrade" the presentation (e.g. text -> capsule)
            // If text content differs (e.g. during composition), DO NOT TOUCH.
            // Also update if div is empty but we have content (initial mount scenario)
            const divText = contentRef.current.innerText.replace(/\n/g, '');
            const pText = prompt.replace(/\n/g, '');
            const isEmpty = !contentRef.current.innerHTML.trim();

            if (divText === pText || isEmpty) {
                if (contentRef.current.innerHTML !== html) {
                    contentRef.current.innerHTML = html;
                    lastHtmlRef.current = html;
                }
            }
        }
    }, [initialPrompt, characters]);

    const handleContentInput = (e: React.FormEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const html = target.innerHTML;

        // Parse text
        const clone = target.cloneNode(true) as HTMLElement;
        const mentions = clone.querySelectorAll('.mention-tag');
        mentions.forEach(el => {
            const u = el.getAttribute('data-username');
            el.replaceWith(`@${u}`);
        });

        let text = clone.innerText;
        if (text === '\n') text = '';

        setPrompt(text);
        onPromptChange?.(text);
        lastHtmlRef.current = html;

        // Mention Detection
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const anchorNode = selection.anchorNode;
            const anchorOffset = selection.anchorOffset;

            if (anchorNode && anchorNode.nodeType === Node.TEXT_NODE) {
                const textContent = anchorNode.textContent || '';
                const beforeCursor = textContent.slice(0, anchorOffset);
                const lastAt = beforeCursor.lastIndexOf('@');

                if (lastAt !== -1) {
                    const query = beforeCursor.slice(lastAt + 1);
                    if (!query.includes(' ') && !query.includes('\u00A0') && query.length < 20) {
                        setShowMention(true);
                        setMentionQuery(query);
                        return;
                    }
                }
            }
        }
        setShowMention(false);
    };

    const handleSelectCharacter = (char: Character) => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const textNode = range.startContainer;

        if (textNode.nodeType === Node.TEXT_NODE) {
            const text = textNode.textContent || '';
            const endPos = range.startOffset;
            const startPos = endPos - (mentionQuery.length + 1);

            if (startPos >= 0) {
                range.setStart(textNode, startPos);
                range.setEnd(textNode, endPos);
                range.deleteContents();

                const span = document.createElement('span');
                span.className = 'mention-tag';
                span.contentEditable = 'false';
                span.setAttribute('data-username', char.username);
                span.innerHTML = `@${char.name || char.username}<button class="mention-delete">脳</button>`;

                range.insertNode(span);

                const space = document.createTextNode('\u00A0');
                range.setStartAfter(span);
                range.insertNode(space);

                range.setStartAfter(space);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);

                if (contentRef.current) {
                    handleContentInput({ currentTarget: contentRef.current } as any);
                }
                contentRef.current?.focus();
            }
        }
        setShowMention(false);
    };

    const handleContainerClick = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).classList.contains('mention-delete')) {
            const tag = (e.target as HTMLElement).closest('.mention-tag');
            tag?.remove();
            if (contentRef.current) {
                handleContentInput({ currentTarget: contentRef.current } as any);
            }
        }
    };

    // Filter characters
    const filteredCharacters = characters.filter(c => {
        const q = mentionQuery.toLowerCase();
        return (c.name || '').toLowerCase().includes(q) || c.username.toLowerCase().includes(q);
    });

    return (
        <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-2 translate-y-full w-[460px] max-w-[90vw] z-[60]"
            onMouseDown={(e) => e.stopPropagation()} // Prevent drag propagation
            onWheel={(e) => e.stopPropagation()}
        >
            <div className={`border rounded-2xl shadow-2xl flex flex-col p-4 gap-4 ring-1 ring-black/20 ${isVideo ? 'bg-[#1a1025] border-purple-500/40' : 'bg-[#18181b] border-zinc-700/60'}`}>
                {/* Input Area */}
                <div className="relative">
                    {/* Character Mention List */}
                    {showMention && filteredCharacters.length > 0 && (
                        <div className="absolute bottom-full left-0 mb-2 w-64 max-h-48 overflow-y-auto bg-[#18181b] border border-zinc-700 rounded-lg shadow-xl z-[100] custom-scrollbar flex flex-col p-1">
                            {filteredCharacters.map(char => (
                                <button
                                    key={char.id}
                                    onClick={(e) => {
                                        e.stopPropagation(); // prevent textarea blur or other clicks
                                        handleSelectCharacter(char);
                                    }}
                                    className="flex items-center gap-3 p-2 hover:bg-zinc-800 rounded-md transition-colors text-left group"
                                >
                                    {/* Avatar */}
                                    <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0 border border-zinc-700">
                                        {(char.avatar || char.profile_picture_url) ? (
                                            <img src={char.avatar || char.profile_picture_url} alt={char.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500 font-bold">
                                                {(char.name || 'U')[0]}
                                            </div>
                                        )}
                                    </div>
                                    {/* Info */}
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-zinc-200 text-sm font-medium truncate group-hover:text-cyan-400 transition-colors">{char.name || 'Unnamed'}</span>
                                        <span className="text-zinc-500 text-[10px] truncate font-mono">@{char.username}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    <MentionStyles />
                    <div
                        ref={contentRef}
                        contentEditable
                        onInput={handleContentInput}
                        onClick={handleContainerClick}
                        className="custom-input scrollbar-hide"
                        data-placeholder={
                            nodeType === 'video'
                                ? "Describe the video you want to generate..."
                                : nodeType === 'text'
                                    ? "Explain what to do with the text..."
                                    : "Describe your imagination here..."
                        }
                        onKeyDown={(e) => e.stopPropagation()}
                    />
                </div>

                {/* System Prompt Input - Collapsible */}
                {nodeType === 'text' && showSystemPrompt && (
                    <div className="px-4 pb-2 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">System Guidelines</span>
                            {/* Preset Selector */}
                            <div className="flex gap-2">
                                {SYSTEM_PROMPT_PRESETS.filter(p => !!p.value.trim()).map((preset, idx) => (
                                    <button
                                        key={idx}
                                        onClick={(e) => {
                                            e.stopPropagation(); // prevent closing
                                            setSystemPrompt(preset.value);
                                        }}
                                        className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-cyan-400 border border-zinc-700 transition-colors"
                                        title={preset.value.slice(0, 100) + '...'}
                                    >
                                        Load: {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <textarea
                            ref={systemPromptRef}
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            placeholder="System Guidelines (e.g. 'You are a translator', 'Output JSON only')..."
                            className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs text-zinc-300 placeholder-zinc-500 outline-none focus:border-cyan-500/50 transition-colors h-24 resize-none font-mono overflow-y-auto custom-scrollbar"
                        />
                    </div>
                )}

                {/* Controls Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5 relative gap-2">
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-2 text-xs font-medium text-zinc-400 flex-1">

                        {/* API Provider Selector */}
                        {/* Provider */}
                        <div className="relative">
                            <button
                                onClick={(e) => toggleMenu(e, 'provider' as any)}
                                className="flex items-center gap-1 hover:text-white transition-colors"
                                title={selectedProvider?.name}
                            >
                                <SettingsIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="max-w-[80px] truncate">{selectedProvider?.name || 'Provider'}</span>
                                <ChevronDownIcon className="w-3 h-3 opacity-50 flex-shrink-0" />
                            </button>
                            {activeMenu === 'provider' && (
                                <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden shadow-xl z-50 py-1">
                                    {providers.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => { onProviderChange?.(p.id); setActiveMenu(null); }}
                                            className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 transition-colors ${selectedProvider?.id === p.id ? 'text-white bg-zinc-800/50' : 'text-zinc-400'}`}
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* API Model */}
                        {providerModels.length > 0 && (
                            <div className="relative">
                                <button
                                    onClick={(e) => toggleMenu(e, 'apimodel' as any)}
                                    className="flex items-center gap-1 hover:text-white transition-colors"
                                    title={providerModels.find(m => m.id === effectiveModelId)?.displayName}
                                >
                                    <Wand2Icon className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="max-w-[80px] truncate">{providerModels.find(m => m.id === effectiveModelId)?.displayName || 'Model'}</span>
                                    <ChevronDownIcon className="w-3 h-3 opacity-50 flex-shrink-0" />
                                </button>
                                {activeMenu === 'apimodel' && (
                                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden shadow-xl z-50 py-1">
                                        {providerModels.map(m => (
                                            <button
                                                key={m.id}
                                                onClick={() => { onModelChange?.(m.id); setActiveMenu(null); }}
                                                className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 transition-colors ${effectiveModelId === m.id ? 'text-white bg-zinc-800/50' : 'text-zinc-400'}`}
                                            >
                                                {m.displayName}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Template (Text Only) */}
                        {nodeType === 'text' && (
                            <div className="relative">
                                <button
                                    onClick={(e) => toggleMenu(e, 'system')}
                                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-colors ${systemPrompt ? 'text-cyan-400 bg-cyan-400/10 ring-1 ring-cyan-400/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                                >
                                    <FileTextIcon className="w-3.5 h-3.5" />
                                    <span>
                                        {[...SYSTEM_PROMPT_PRESETS, ...customTemplates].find(p => p.value === systemPrompt)?.label || 'Template'}
                                    </span>
                                    <ChevronDownIcon className="w-3 h-3 opacity-50" />
                                </button>
                                {activeMenu === 'system' && (
                                    <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden shadow-xl z-50 py-1" onClick={e => e.stopPropagation()}>
                                        {isAddingTemplate ? (
                                            <div className="p-3 bg-zinc-900 border-b border-zinc-800 space-y-2">
                                                <div className="text-xs font-bold text-zinc-400">Add Template</div>
                                                <input
                                                    className="w-full bg-black/20 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:border-cyan-500 outline-none"
                                                    placeholder="Template name"
                                                    value={newTemplateName}
                                                    onChange={e => setNewTemplateName(e.target.value)}
                                                    autoFocus
                                                />
                                                <textarea
                                                    className="w-full bg-black/20 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:border-cyan-500 outline-none resize-none h-16"
                                                    placeholder="System prompt content..."
                                                    value={newTemplateContent}
                                                    onChange={e => setNewTemplateContent(e.target.value)}
                                                />
                                                <div className="flex gap-2 pt-1">
                                                    <button
                                                        onClick={() => setIsAddingTemplate(false)}
                                                        className="flex-1 py-1 text-xs text-zinc-500 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={handleAddTemplate}
                                                        disabled={!newTemplateName.trim() || !newTemplateContent.trim()}
                                                        className="flex-1 py-1 text-xs text-black bg-cyan-500 hover:bg-cyan-400 rounded disabled:opacity-50"
                                                    >
                                                        Save
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => { setSystemPrompt(''); setActiveMenu(null); }}
                                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 transition-colors ${!systemPrompt ? 'text-cyan-400 bg-zinc-800/50' : 'text-zinc-400'}`}
                                                >
                                                    No Template
                                                </button>

                                                {(() => {
                                                    const presets = SYSTEM_PROMPT_PRESETS.filter(p => !!p.value.trim());

                                                    return (
                                                        <>
                                                            {presets.length > 0 && <div className="px-3 py-1 text-[10px] text-zinc-600 font-bold uppercase tracking-wider bg-zinc-900/50 mt-1">Preset</div>}
                                                            {presets.map((preset, idx) => (
                                                                <button
                                                                    key={preset.label + idx}
                                                                    onClick={() => {
                                                                        setSystemPrompt(preset.value);
                                                                        setActiveMenu(null);
                                                                    }}
                                                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 transition-colors ${systemPrompt === preset.value ? 'text-cyan-400 bg-zinc-800/50' : 'text-zinc-400'}`}
                                                                >
                                                                    {preset.label}
                                                                </button>
                                                            ))}

                                                            {customTemplates.length > 0 && <div className="px-3 py-1 text-[10px] text-zinc-600 font-bold uppercase tracking-wider bg-zinc-900/50 mt-1">Custom</div>}
                                                            {customTemplates.map((tpl, idx) => (
                                                                <div key={idx} className={`group flex items-center justify-between hover:bg-zinc-800 pr-2 ${systemPrompt === tpl.value ? 'bg-zinc-800/50' : ''}`}>
                                                                    <button
                                                                        onClick={() => {
                                                                            setSystemPrompt(tpl.value);
                                                                            setActiveMenu(null);
                                                                        }}
                                                                        className={`flex-1 text-left px-3 py-2 text-xs transition-colors ${systemPrompt === tpl.value ? 'text-cyan-400' : 'text-zinc-400'}`}
                                                                    >
                                                                        {tpl.label}
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => handleDeleteTemplate(e, idx)}
                                                                        className="p-1 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                        title="Delete template"
                                                                    >
                                                                        <Trash2Icon className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ))}

                                                            <button
                                                                onClick={() => setIsAddingTemplate(true)}
                                                                className="w-full flex items-center justify-center gap-1 py-2 text-xs text-zinc-500 hover:text-cyan-400 hover:bg-zinc-800/50 border-t border-zinc-800/50 mt-1 transition-colors"
                                                            >
                                                                <span className="text-lg leading-none">+</span> Add Custom Template
                                                            </button>
                                                        </>
                                                    );
                                                })()}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Aspect Ratio - For Image OR Grok Video */}
                        {((!isVideo && nodeType !== 'text') || (isVideo && isGrok)) && (
                            <div className="relative">
                                <div
                                    className={`flex items-center gap-1.5 cursor-pointer transition-colors group ${activeMenu === 'ratio' ? 'text-zinc-100' : 'hover:text-zinc-200'}`}
                                    onClick={(e) => toggleMenu(e, 'ratio')}
                                >
                                    <RatioIcon className="w-3.5 h-3.5" />
                                    <span>{aspectRatio}</span>
                                </div>
                                {activeMenu === 'ratio' && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-20 bg-[#1f1f22] border border-zinc-700 rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                        {displayRatios.map(r => (
                                            <div
                                                key={r}
                                                className={`px-3 py-2 text-center cursor-pointer hover:bg-zinc-700/50 transition-colors ${aspectRatio === r ? 'text-cyan-400' : 'text-zinc-300'}`}
                                                onClick={() => setAspectRatio(r)}
                                            >
                                                {r}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Resolution - Hide for Text */}
                        {nodeType !== 'text' && (
                            <div className="relative">
                                <div
                                    className={`flex items-center gap-1.5 cursor-pointer transition-colors group ${activeMenu === 'res' ? 'text-zinc-100' : 'hover:text-zinc-200'}`}
                                    onClick={(e) => toggleMenu(e, 'res')}
                                >
                                    <MonitorIcon className="w-3.5 h-3.5" />
                                    <span>{resolution}</span>
                                </div>
                                {activeMenu === 'res' && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-32 bg-[#1f1f22] border border-zinc-700 rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                        {displayResolutions.map(r => (
                                            <div
                                                key={r}
                                                className={`px-3 py-2 text-center cursor-pointer hover:bg-zinc-700/50 transition-colors ${resolution === r ? 'text-cyan-400' : 'text-zinc-300'}`}
                                                onClick={() => setResolution(r)}
                                            >
                                                {r}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {isVideo ? (
                            /* Duration Selector for Video - Hide for Veo, Show for Grok */
                            !model.toLowerCase().includes('veo') && (
                                <div className="relative">
                                    <div
                                        className={`flex items-center gap-1.5 cursor-pointer transition-colors group ${activeMenu === 'duration' ? 'text-zinc-100' : 'hover:text-zinc-200'}`}
                                        onClick={(e) => toggleMenu(e, 'duration')}
                                    >
                                        {/* Using Layers Icon as placeholder or we can use another icon */}
                                        <LayersIcon className="w-3.5 h-3.5" />
                                        <span>{duration}s</span>
                                    </div>
                                    {activeMenu === 'duration' && (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-20 bg-[#1f1f22] border border-zinc-700 rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                            {(isGrok ? ['6s', '10s', '15s'] : DURATIONS).map(d => (
                                                <div
                                                    key={d}
                                                    className={`px-3 py-2 text-center cursor-pointer hover:bg-zinc-700/50 transition-colors ${duration === d.replace('s', '') ? 'text-purple-400' : 'text-zinc-300'}`}
                                                    onClick={() => setDuration(d.replace('s', ''))}
                                                >
                                                    {d}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        ) : nodeType !== 'text' ? (
                            /* Batch Count for Image */
                            <div className="relative">
                                <div
                                    className={`flex items-center gap-1.5 cursor-pointer transition-colors group ${activeMenu === 'count' ? 'text-zinc-100' : 'hover:text-zinc-200'}`}
                                    onClick={(e) => toggleMenu(e, 'count')}
                                >
                                    <LayersIcon className="w-3.5 h-3.5" />
                                    <span>{count}</span>
                                </div>
                                {activeMenu === 'count' && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-16 bg-[#1f1f22] border border-zinc-700 rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                        {COUNTS.map(c => (
                                            <div
                                                key={c}
                                                className={`px-3 py-2 text-center cursor-pointer hover:bg-zinc-700/50 transition-colors ${count === c ? 'text-cyan-400' : 'text-zinc-300'}`}
                                                onClick={() => setCount(c)}
                                            >
                                                {c}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : null}

                        {/* Veo Specific Controls - Only show if model contains 'veo' and not Grok */}
                        {isVideo && model.toLowerCase().includes('veo') && !isGrok && (
                            <>
                                <button
                                    onClick={() => setEnhancePrompt(!enhancePrompt)}
                                    className={`flex items-center gap-1.5 cursor-pointer transition-all border px-2 py-0.5 rounded-md ${enhancePrompt
                                        ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30 shadow-[0_0_10px_rgba(250,204,21,0.2)]'
                                        : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-800'}`}
                                    title="Prompt Enhance"
                                >
                                    <SparklesIcon className={`w-3.5 h-3.5 ${enhancePrompt ? 'fill-current' : ''}`} />
                                    <span className="text-[10px] font-medium">Prompt Enhance</span>
                                </button>
                                <button
                                    onClick={() => setEnableUpsample(!enableUpsample)}
                                    className={`flex items-center gap-1.5 cursor-pointer transition-all border px-2 py-0.5 rounded-md ${enableUpsample
                                        ? 'text-green-400 bg-green-400/10 border-green-400/30 shadow-[0_0_10px_rgba(74,222,128,0.2)]'
                                        : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-800'}`}
                                    title="瓒呭垎"
                                >
                                    <MaximizeIcon className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-medium">瓒呭垎</span>
                                </button>
                            </>
                        )}
                    </div>

                    {/* Quality (Video Only) */}
                    {isVideo && (
                        <div className="relative">
                            <div
                                className={`flex items-center gap-1.5 cursor-pointer transition-colors group ${activeMenu === 'quality' ? 'text-zinc-100' : 'hover:text-zinc-200'}`}
                                onClick={(e) => toggleMenu(e, 'quality')}
                            >
                                <span className="font-bold border border-zinc-600 rounded px-1 text-[10px] h-3.5 flex items-center">{quality === 'hd' ? 'HD' : 'SD'}</span>
                                {/* <span>{quality}</span> */}
                            </div>
                            {activeMenu === 'quality' && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-24 bg-[#1f1f22] border border-zinc-700 rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                    {QUALITY_OPTIONS.map(q => (
                                        <div
                                            key={q}
                                            className={`px-3 py-2 text-center cursor-pointer hover:bg-zinc-700/50 transition-colors ${quality === q ? 'text-cyan-400' : 'text-zinc-300'}`}
                                            onClick={() => setQuality(q)}
                                        >
                                            {q}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action Button */}
                    <button
                        onClick={() => !isLoading && onGenerate(prompt, { model, aspect_ratio: aspectRatio, size: resolution, quality, batchSize: count, seconds: duration, systemPrompt, enhance_prompt: enhancePrompt, enable_upsample: enableUpsample })}
                        disabled={isLoading}
                        className={`flex items-center gap-2 font-bold text-xs py-1.5 px-4 rounded-full transition-all active:scale-95 
                            ${isLoading ? 'opacity-50 cursor-not-allowed grayscale' : ''}
                            ${isVideo ? 'bg-purple-600 hover:bg-purple-500 text-white hover:shadow-[0_0_15px_rgba(168,85,247,0.5)]' :
                                nodeType === 'text' ? 'bg-indigo-500 hover:bg-indigo-400 text-white hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]' :
                                    'bg-cyan-500 hover:bg-cyan-400 text-black hover:shadow-[0_0_15px_rgba(6,182,212,0.5)]'}`}
                    >
                        {isLoading ? (
                            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Wand2Icon className="w-3.5 h-3.5" />
                        )}
                        <span>
                            {isLoading ? 'Processing...' : (nodeType === 'text' ? 'AI Action' : isVideo ? 'Generate Video' : 'Generate')}
                        </span>
                    </button>
                </div>
            </div>
        </div >
    );
};

export default PromptPanel;




