import React, { useState, useEffect, useRef } from 'react';
import { XIcon } from './Icons';
import { ApiProvider, AppSettings } from '../types/settings';
import ProviderCard from './ProviderCard';
import ProviderEditor from './ProviderEditor';
import { exportSettings, importSettings } from '../services/storageService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

type TabType = 'image' | 'video' | 'text';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [activeTab, setActiveTab] = useState<TabType>('image');
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [editingProvider, setEditingProvider] = useState<ApiProvider | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync props to local state when opening
  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
      setIsEditing(false);
      setEditingProvider(null);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'image' as const, label: '图像生成', icon: '🖼️', color: 'cyan' },
    { id: 'video' as const, label: '视频生成', icon: '🎬', color: 'purple' },
    { id: 'text' as const, label: '文本生成', icon: '✍️', color: 'indigo' },
  ];

  const currentTab = tabs.find(t => t.id === activeTab)!;

  // 获取当前标签页的提供商列表
  const getCurrentProviders = (): ApiProvider[] => {
    switch (activeTab) {
      case 'image': return localSettings.imageProviders;
      case 'video': return localSettings.videoProviders;
      case 'text': return localSettings.textProviders;
    }
  };

  // 更新当前标签页的提供商列表
  const updateCurrentProviders = (providers: ApiProvider[]) => {
    const newSettings = { ...localSettings };
    switch (activeTab) {
      case 'image':
        newSettings.imageProviders = providers;
        break;
      case 'video':
        newSettings.videoProviders = providers;
        break;
      case 'text':
        newSettings.textProviders = providers;
        break;
    }
    setLocalSettings(newSettings);
  };

  const handleAddProvider = () => {
    setEditingProvider(null);
    setIsEditing(true);
  };

  const handleEditProvider = (provider: ApiProvider) => {
    setEditingProvider(provider);
    setIsEditing(true);
  };

  const handleDeleteProvider = (id: string) => {
    const providers = getCurrentProviders();
    const newProviders = providers.filter(p => p.id !== id);

    // 如果删除的是默认提供商，设置第一个为默认
    const deletedWasDefault = providers.find(p => p.id === id)?.isDefault;
    if (deletedWasDefault && newProviders.length > 0) {
      newProviders[0].isDefault = true;
    }

    updateCurrentProviders(newProviders);
    setProviderToDelete(null);
  };

  const handleSetDefault = (id: string) => {
    const providers = getCurrentProviders();
    const newProviders = providers.map(p => ({
      ...p,
      isDefault: p.id === id
    }));
    updateCurrentProviders(newProviders);
  };

  const handleSaveProvider = (provider: ApiProvider) => {
    const providers = getCurrentProviders();
    const existingIndex = providers.findIndex(p => p.id === provider.id);

    let newProviders: ApiProvider[];
    if (existingIndex >= 0) {
      // 编辑现有提供商
      newProviders = [...providers];
      newProviders[existingIndex] = provider;
    } else {
      // 添加新提供商
      // 如果这是第一个提供商，自动设为默认
      if (providers.length === 0) {
        provider.isDefault = true;
      }
      // 如果新提供商标记为默认，取消其他提供商的默认标记
      if (provider.isDefault) {
        newProviders = providers.map(p => ({ ...p, isDefault: false }));
        newProviders.push(provider);
      } else {
        newProviders = [...providers, provider];
      }
    }

    updateCurrentProviders(newProviders);
    setIsEditing(false);
    setEditingProvider(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingProvider(null);
  };

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  // 导出配置
  const handleExport = () => {
    exportSettings(localSettings);
  };

  // 导入配置
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const importedSettings = await importSettings(file);
      setLocalSettings(importedSettings);
      alert('配置导入成功！请点击保存按钮应用更改。');
    } catch (error) {
      alert(`导入失败：${error instanceof Error ? error.message : '未知错误'}`);
    }

    // 重置文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const currentProviders = getCurrentProviders();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80">
      <div className="bg-[#18181b] w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white">模型设置</h2>
          <div className="flex items-center gap-2">
            {/* 导入导出按钮 */}
            <button
              onClick={handleImportClick}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
              title="导入配置"
            >
              📥 导入
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
              title="导出配置"
            >
              📤 导出
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </div>

        {/* Tabs Navigation */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setIsEditing(false);
                setEditingProvider(null);
              }}
              className={`
                flex-1 px-6 py-3 text-sm font-medium transition-all relative
                ${activeTab === tab.id
                  ? `text-${tab.color}-400`
                  : 'text-zinc-500 hover:text-zinc-300'
                }
              `}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-base">{tab.icon}</span>
                <span>{tab.label}</span>
              </div>
              {activeTab === tab.id && (
                <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-${tab.color}-500`} />
              )}
            </button>
          ))}
        </div>

        {/* General Settings - Only visible when not editing */}
        {!isEditing && (
          <div className="px-6 py-4 bg-zinc-900/30 border-b border-zinc-800">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-zinc-200 mb-1">批量生成并发控制</h3>
                <p className="text-xs text-zinc-500">同时最多执行多少个生成任务（推荐：1-20）</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={localSettings.concurrencyLimit || 15}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 15;
                    const clamped = Math.max(1, value);
                    setLocalSettings({ ...localSettings, concurrencyLimit: clamped });
                  }}
                  className="w-20 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-sm text-center focus:outline-none focus:border-cyan-500 transition-colors"
                />
                <span className="text-xs text-zinc-500">个任务</span>
              </div>
            </div>
          </div>
        )}

        {/* Body - Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isEditing ? (
            /* 编辑/添加模式 */
            <ProviderEditor
              provider={editingProvider}
              onSave={handleSaveProvider}
              onCancel={handleCancelEdit}
              color={currentTab.color}
              tabType={activeTab}
            />
          ) : (
            /* 列表模式 */
            <div className="space-y-4">
              {/* 添加按钮 */}
              <button
                onClick={handleAddProvider}
                className={`w-full border-2 border-dashed border-zinc-700 hover:border-${currentTab.color}-500/50 rounded-lg p-4 text-sm text-zinc-500 hover:text-${currentTab.color}-400 transition-all flex items-center justify-center gap-2`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                添加新提供商
              </button>

              {activeTab === 'video' && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                  <p className="text-xs text-purple-200">
                    推荐默认提供商 xwang（Sora /v1/videos）。
                    <a
                      href="https://api.xwang.store"
                      target="_blank"
                      rel="noreferrer"
                      className="ml-1 text-purple-300 underline hover:text-purple-200"
                    >
                      前往 https://api.xwang.store
                    </a>
                  </p>
                </div>
              )}

              {/* Text Generation Hint */}
              {activeTab === 'text' && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 flex items-start gap-3">
                  <div className="mt-0.5 text-indigo-400">ℹ️</div>
                  <div>
                    <p className="text-xs text-indigo-200 font-medium">提示词生成说明</p>
                    <p className="text-xs text-indigo-300/80 mt-1 leading-relaxed">
                      提示词优化/文本生成模板是内置在 API 服务端的 Prompt 逻辑。目前仅在
                      <span className="text-indigo-400 font-mono mx-1">https://api.xwang.store</span>
                      下生效。使用其他 OpenAI 格式 API 时可能仅进行普通提示词以及对话补全。
                    </p>
                  </div>
                </div>
              )}

              {/* 提供商列表 */}
              {currentProviders.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-zinc-500">暂无配置的提供商</p>
                  <p className="text-xs text-zinc-600 mt-1">点击上方按钮添加</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {currentProviders.map((provider) => (
                    <ProviderCard
                      key={provider.id}
                      provider={provider}
                      onEdit={() => handleEditProvider(provider)}
                      onDelete={() => setProviderToDelete(provider.id)}
                      onSetDefault={() => handleSetDefault(provider.id)}
                      color={currentTab.color}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isEditing && (
          <div className="px-6 py-4 bg-zinc-900/50 border-t border-zinc-800 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className={`px-6 py-2 bg-${currentTab.color}-600 hover:bg-${currentTab.color}-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-${currentTab.color}-900/20 transition-all active:scale-95`}
            >
              保存更改
            </button>
          </div>
        )}

        {/* 删除确认对话框 */}
        {providerToDelete && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-2xl">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-sm mx-4">
              <h3 className="text-lg font-semibold text-white mb-2">确认删除</h3>
              <p className="text-sm text-zinc-400 mb-4">
                确定要删除这个提供商吗？此操作无法撤销。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setProviderToDelete(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => handleDeleteProvider(providerToDelete)}
                  className="flex-1 px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsModal;
