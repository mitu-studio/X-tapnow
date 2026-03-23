import React, { useState, useRef } from 'react';
import { SearchIcon, PlusIcon, XIcon, ArrowLeftIcon, CloudUploadIcon, SaveIcon, EditIcon, Trash2Icon, CopyIcon, CheckIcon, DownloadIcon, UploadIcon } from './Icons';
import { uploadCharacter } from '../services/uploadService';

interface CharacterManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// 角色数据类型
interface Character {
    id: string;
    name?: string; // 用户输入的名称
    username: string;
    permalink?: string;
    profile_picture_url?: string;
    avatar: string; // 兼容旧字段，指向 profile_picture_url
}

// 初始角色数据为空
const INITIAL_CHARACTERS: Character[] = [];
const DEFAULT_API_BASE_URL = (import.meta.env.VITE_SORA_API_BASE_URL || '').trim();

const CharacterManagementModal: React.FC<CharacterManagementModalProps> = ({ isOpen, onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [characters, setCharacters] = useState<Character[]>(() => {
        // 从 localStorage 加载角色列表
        const saved = localStorage.getItem('sora_characters');
        return saved ? JSON.parse(saved) : INITIAL_CHARACTERS;
    });
    const [isAddingCharacter, setIsAddingCharacter] = useState(false);
    const [newCharacterName, setNewCharacterName] = useState('');
    const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [customToken, setCustomToken] = useState(() => localStorage.getItem('sora_character_token') || '');
    const [apiBaseUrl, setApiBaseUrl] = useState(() => localStorage.getItem('sora_api_base_url') || DEFAULT_API_BASE_URL);
    const [showSettings, setShowSettings] = useState(false);

    // 编辑和复制状态
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const importInputRef = useRef<HTMLInputElement>(null);

    // 重新加载角色数据（当 Modal 打开时或收到更新事件时）
    React.useEffect(() => {
        if (!isOpen) return;

        const loadChars = () => {
            const saved = localStorage.getItem('sora_characters');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    console.log('[CharacterModal] 重新加载角色:', parsed.length);
                    setCharacters(parsed);
                } catch (e) {
                    console.error('Failed to parse characters:', e);
                }
            }
        };

        const loadApiConfig = () => {
            const token = localStorage.getItem('sora_character_token') || '';
            const baseUrl = localStorage.getItem('sora_api_base_url') || DEFAULT_API_BASE_URL;
            console.log('[CharacterModal] 重新加载API配置');
            setCustomToken(token);
            setApiBaseUrl(baseUrl);
        };

        // Modal 打开时立即加载
        loadChars();
        loadApiConfig();

        // 监听存储更新事件
        window.addEventListener('sora_characters_updated', loadChars);
        window.addEventListener('storage', loadChars);
        window.addEventListener('storage', loadApiConfig);

        return () => {
            window.removeEventListener('sora_characters_updated', loadChars);
            window.removeEventListener('storage', loadChars);
            window.removeEventListener('storage', loadApiConfig);
        };
    }, [isOpen]);

    if (!isOpen) return null;

    // 过滤角色列表
    const filteredCharacters = characters.filter(char =>
        (char.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
        char.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // 处理文件上传
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('video/')) {
            // 限制文件大小为 100MB
            if (file.size > 100 * 1024 * 1024) {
                setUploadError("视频文件大小不能超过 100MB");
                return;
            }
            setUploadedVideo(file);
            setUploadError(null); // 清除之前的错误
        }
    };

    // 导出角色
    const handleExportCharacters = () => {
        const dataStr = JSON.stringify(characters, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sora_characters_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // 导入角色
    const handleImportCharacters = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const imported = JSON.parse(content);

                if (Array.isArray(imported)) {
                    // 确认导入
                    if (window.confirm(`确认导入 ${imported.length} 个角色？这将会与当前列表合并（相同ID的角色将被覆盖）。`)) {
                        const newMap = new Map();
                        // 现有角色
                        characters.forEach(c => newMap.set(c.id, c));
                        // 导入角色（覆盖）
                        imported.forEach(c => {
                            if (c.id && c.username) {
                                newMap.set(c.id, c);
                            }
                        });

                        const merged = Array.from(newMap.values());
                        setCharacters(merged);
                        localStorage.setItem('sora_characters', JSON.stringify(merged));
                        window.dispatchEvent(new Event('sora_characters_updated'));
                    }
                } else {
                    alert('文件格式错误：必须是角色数组 JSON');
                }
            } catch (err) {
                console.error("Import failed", err);
                alert('无法解析文件');
            }
            // Reset
            e.target.value = '';
        };
        reader.readAsText(file);
    };

    // 保存 token 到 localStorage
    const handleTokenChange = (token: string) => {
        setCustomToken(token);
        localStorage.setItem('sora_character_token', token);
    };

    // 保存 API Base URL 到 localStorage
    const handleBaseUrlChange = (url: string) => {
        setApiBaseUrl(url);
        localStorage.setItem('sora_api_base_url', url);
    };

    // 重置表单
    const handleCancelAdd = () => {
        setIsAddingCharacter(false);
        setNewCharacterName('');
        setUploadedVideo(null);
        setUploadError(null);
        setIsUploading(false);
    };

    // 保存角色 - 完整流程：上传视频 + 创建角色
    const handleSaveCharacter = async () => {
        if (!newCharacterName || !uploadedVideo) {
            return;
        }

        setIsUploading(true);
        setUploadError(null);

        try {
            // 执行完整的上传流程（上传视频 + 创建角色），传入自定义 token
            const result = await uploadCharacter(uploadedVideo, newCharacterName, '1,3', customToken || undefined);

            if (result.success) {
                console.log('角色创建成功！');
                console.log('视频URL:', result.videoUrl);
                console.log('角色信息:', result.character);

                // 保存角色到本地状态和 localStorage
                if (result.character) {
                    const newCharacter: Character = {
                        id: result.character.id,
                        name: newCharacterName,
                        username: result.character.username,
                        permalink: result.character.permalink,
                        profile_picture_url: result.character.profile_picture_url,
                        avatar: result.character.profile_picture_url || '',
                    };

                    const updatedCharacters = [...characters, newCharacter];
                    setCharacters(updatedCharacters);

                    // 保存到 localStorage
                    localStorage.setItem('sora_characters', JSON.stringify(updatedCharacters));
                    window.dispatchEvent(new Event('sora_characters_updated'));

                    console.log('角色已保存到本地:', newCharacter);
                }

                // 成功后重置表单
                handleCancelAdd();
            } else {
                // 上传失败
                setUploadError(result.error || '角色创建失败，请重试');
            }
        } catch (error: any) {
            console.error('保存角色失败:', error);
            setUploadError(error.message || '保存失败，请重试');
        } finally {
            setIsUploading(false);
        }
    };

    // 删除角色
    const handleDeleteCharacter = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // 阻止冒泡
        if (window.confirm('确定要删除这个角色吗？')) {
            const updatedCharacters = characters.filter(c => c.id !== id);
            setCharacters(updatedCharacters);
            localStorage.setItem('sora_characters', JSON.stringify(updatedCharacters));
            window.dispatchEvent(new Event('sora_characters_updated'));
        }
    };

    // 开始编辑
    const handleStartEdit = (character: Character, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(character.id);
        setEditingName(character.name || '');
    };

    // 取消编辑
    const handleCancelEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(null);
        setEditingName('');
    };

    // 保存编辑
    const handleSaveEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (editingId) {
            const updatedCharacters = characters.map(c => {
                if (c.id === editingId) {
                    return { ...c, name: editingName };
                }
                return c;
            });
            setCharacters(updatedCharacters);
            localStorage.setItem('sora_characters', JSON.stringify(updatedCharacters));
            window.dispatchEvent(new Event('sora_characters_updated'));
            setEditingId(null);
            setEditingName('');
        }
    };

    // 复制 ID
    const handleCopyId = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const textToCopy = `@${id}`;
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopiedId(id);
            setToastMessage(`复制成功: ${textToCopy}`);
            setTimeout(() => {
                setCopiedId(null);
                setToastMessage(null);
            }, 2000); // 2秒后清除状态
        });
    };

    // 如果正在添加角色，显示新增表单
    if (isAddingCharacter) {
        return (
            <div className="fixed inset-0 z-[999] flex items-start justify-end p-4">
                {/* 背景遮罩（透明，点击关闭） */}
                <div
                    className="absolute inset-0 bg-transparent"
                    onClick={handleCancelAdd}
                />

                {/* 悬浮窗面板 */}
                <div className="relative w-[420px] max-h-[calc(100vh-2rem)] bg-[#2a2a2f] border border-zinc-800/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right fade-in duration-300 mt-16">
                    {/* 标题栏 */}
                    <div className="flex items-center gap-3 p-6 pb-5">
                        <button
                            onClick={handleCancelAdd}
                            className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 rounded-lg hover:bg-zinc-800/50"
                        >
                            <ArrowLeftIcon className="w-5 h-5" />
                        </button>
                        <h2 className="text-lg font-medium text-white">新增角色</h2>
                    </div>

                    {/* 表单内容 */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* 角色名称 */}
                        <div>
                            <label className="block text-zinc-400 text-sm font-medium mb-2">
                                角色名称
                            </label>
                            <input
                                type="text"
                                value={newCharacterName}
                                onChange={(e) => setNewCharacterName(e.target.value)}
                                placeholder="请输入角色名称"
                                className="w-full bg-[#0f0f12] border border-zinc-800/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
                            />
                        </div>

                        {/* 角色视频上传 */}
                        <div>
                            <label className="block text-zinc-400 text-sm font-medium mb-2">
                                角色视频 (Max 3s)
                            </label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="relative w-full h-[240px] bg-[#0f0f12] border border-zinc-800/50 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-zinc-700 hover:bg-[#14141a] transition-all group"
                            >
                                {uploadedVideo ? (
                                    <div className="text-center">
                                        <div className="text-emerald-500 mb-2">
                                            <CloudUploadIcon className="w-12 h-12 mx-auto" />
                                        </div>
                                        <p className="text-white text-sm font-medium mb-1">
                                            {uploadedVideo.name}
                                        </p>
                                        <p className="text-zinc-500 text-xs">
                                            {(uploadedVideo.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="text-blue-500 mb-3 group-hover:scale-110 transition-transform">
                                            <CloudUploadIcon className="w-12 h-12" />
                                        </div>
                                        <p className="text-white text-sm font-medium mb-1">
                                            点击或拖拽上传视频
                                        </p>
                                        <p className="text-zinc-500 text-xs">
                                            仅支持视频文件，且时长 ≤ 3秒
                                        </p>
                                    </>
                                )}
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="video/*"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </div>
                    </div>

                    {/* 底部按钮 */}
                    <div className="p-6 pt-4 border-t border-zinc-800/50">
                        {/* 错误提示 */}
                        {uploadError && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                <p className="text-red-400 text-sm">{uploadError}</p>
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={handleCancelAdd}
                                disabled={isUploading}
                                className="px-6 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800/50 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSaveCharacter}
                                disabled={!newCharacterName || !uploadedVideo || isUploading}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-zinc-700 disabled:to-zinc-700 disabled:cursor-not-allowed text-white font-medium text-sm transition-all shadow-lg hover:shadow-blue-500/20 disabled:shadow-none"
                            >
                                {isUploading ? (
                                    <>
                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        <span>上传中...</span>
                                    </>
                                ) : (
                                    <>
                                        <SaveIcon className="w-4 h-4" />
                                        <span>保存</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 默认显示角色列表
    return (
        <div className="fixed inset-0 z-[999] flex items-start justify-end p-4">
            {/* Toast 提示 */}
            {toastMessage && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[1000] animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="px-4 py-2 bg-emerald-600/90 text-white text-sm font-medium rounded-full shadow-lg backdrop-blur flex items-center gap-2">
                        <CheckIcon className="w-4 h-4" />
                        {toastMessage}
                    </div>
                </div>
            )}

            {/* 背景遮罩（透明，点击关闭） */}
            <div
                className="absolute inset-0 bg-transparent"
                onClick={onClose}
            />

            {/* 悬浮窗面板 */}
            <div className="relative w-[420px] max-h-[calc(100vh-2rem)] bg-[#2a2a2f] border border-zinc-800/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right fade-in duration-300 mt-16">
                <div className="p-6 pb-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-medium text-white">sora角色管理</h2>
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`text-zinc-500 hover:text-zinc-300 transition-colors p-2 rounded-lg hover:bg-zinc-800/50 ${showSettings ? 'bg-zinc-800/50 text-zinc-300' : ''}`}
                            title="设置"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    </div>

                    {/* 设置面板 */}
                    {showSettings && (
                        <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 fade-in duration-200 bg-[#1a1a1f] p-4 rounded-xl border border-zinc-800/50">
                            <div>
                                <label className="block text-zinc-400 text-xs font-medium mb-2">
                                    API Base URL
                                </label>
                                <input
                                    type="text"
                                    value={apiBaseUrl}
                                    onChange={(e) => handleBaseUrlChange(e.target.value)}
                                    placeholder="https://your-api-base-url.com"
                                    className="w-full bg-[#0f0f12] border border-zinc-800/50 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-zinc-400 text-xs font-medium mb-2">
                                    API Token
                                </label>
                                <input
                                    type="password"
                                    value={customToken}
                                    onChange={(e) => handleTokenChange(e.target.value)}
                                    placeholder="请输入 API Token..."
                                    className="w-full bg-[#0f0f12] border border-zinc-800/50 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors font-mono"
                                />
                            </div>
                        </div>
                    )}
                </div>
                {/* 搜索栏和添加按钮 */}
                <div className="px-6 pb-5">
                    <div className="flex items-center gap-3">
                        {/* 搜索框 */}
                        <div className="flex-1 relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                                <SearchIcon className="w-4 h-4" />
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="搜索角色..."
                                className="w-full bg-[#1a1a1f] border border-zinc-800/50 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
                            />
                        </div>

                        {/* 导入导出按钮 */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleExportCharacters}
                                className="flex items-center justify-center w-10 h-10 bg-[#1a1a1f] hover:bg-zinc-800 border border-zinc-800/50 rounded-lg transition-all text-zinc-400 hover:text-white"
                                title="导出角色备份"
                            >
                                <DownloadIcon className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => importInputRef.current?.click()}
                                className="flex items-center justify-center w-10 h-10 bg-[#1a1a1f] hover:bg-zinc-800 border border-zinc-800/50 rounded-lg transition-all text-zinc-400 hover:text-white"
                                title="导入角色备份"
                            >
                                <UploadIcon className="w-5 h-5" />
                            </button>
                            <input
                                type="file"
                                ref={importInputRef}
                                onChange={handleImportCharacters}
                                accept=".json"
                                className="hidden"
                            />
                        </div>

                        {/* 添加按钮 */}
                        <button
                            onClick={() => setIsAddingCharacter(true)}
                            className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-lg transition-all active:scale-95"
                            title="添加角色"
                        >
                            <PlusIcon className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </div>

                {/* 角色列表 */}
                <div className="flex-1 overflow-y-auto px-6 pb-6">
                    <div className="space-y-3">
                        {filteredCharacters.length === 0 ? (
                            <div className="text-center py-12 text-zinc-600">
                                {searchQuery ? '未找到匹配的角色' : '暂无角色'}
                            </div>
                        ) : (
                            filteredCharacters.map((character) => (
                                <div
                                    key={character.id}
                                    className="group flex items-center gap-3 p-3 bg-[#1a1a1f] hover:bg-[#25252b] border border-zinc-800/30 hover:border-zinc-700/50 rounded-lg transition-all cursor-pointer"
                                >
                                    {/* 角色头像 */}
                                    <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-zinc-700 to-zinc-800 rounded-lg overflow-hidden">
                                        {character.profile_picture_url ? (
                                            <img
                                                src={character.profile_picture_url}
                                                alt={character.name || character.username}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    if (e.currentTarget.nextElementSibling) {
                                                        (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                                                    }
                                                }}
                                            />
                                        ) : null}
                                        <div className={`w-full h-full flex items-center justify-center text-zinc-500 ${character.profile_picture_url ? 'hidden' : ''}`}>
                                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* 角色信息 */}
                                    <div className="flex-1 min-w-0">
                                        {editingId === character.id ? (
                                            <input
                                                type="text"
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full bg-[#0f0f12] border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:outline-none mb-0.5"
                                                autoFocus
                                            />
                                        ) : (
                                            <h3 className="text-white font-medium text-sm mb-0.5 truncate select-text">
                                                {character.name}
                                            </h3>
                                        )}
                                        <div className="flex items-center gap-1.5 min-w-0 group/id">
                                            <p className="text-zinc-500 text-xs truncate font-mono">
                                                {character.username}
                                            </p>
                                        </div>
                                    </div>

                                    {/* 悬停时显示的操作按钮 */}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {editingId === character.id ? (
                                            <>
                                                <button
                                                    onClick={handleSaveEdit}
                                                    className="p-1.5 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                    title="保存"
                                                >
                                                    <CheckIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
                                                    title="取消"
                                                >
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={(e) => handleCopyId(character.username, e)}
                                                    className="p-1.5 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                    title="复制 Username"
                                                >
                                                    {copiedId === character.username ? (
                                                        <CheckIcon className="w-4 h-4 text-emerald-500" />
                                                    ) : (
                                                        <CopyIcon className="w-4 h-4" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={(e) => handleStartEdit(character, e)}
                                                    className="p-1.5 text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                    title="编辑角色"
                                                >
                                                    <EditIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteCharacter(character.id, e)}
                                                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="删除角色"
                                                >
                                                    <Trash2Icon className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CharacterManagementModal;
