import React, { useState } from 'react';
import { XIcon } from './Icons';

interface ErrorModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message: string;
    details?: string;
    errorType?: 'video' | 'image' | 'text' | 'general';
}

const ErrorModal: React.FC<ErrorModalProps> = ({
    isOpen,
    onClose,
    title = '操作失败',
    message,
    details,
    errorType = 'general'
}) => {
    const [showDetails, setShowDetails] = useState(false);
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleCopy = () => {
        const fullError = `${title}\n\n${message}${details ? `\n\n详细信息:\n${details}` : ''}`;
        navigator.clipboard.writeText(fullError).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const typeConfig = {
        video: { icon: '🎬', color: 'purple', title: '视频生成失败' },
        image: { icon: '🖼️', color: 'cyan', title: '图片生成失败' },
        text: { icon: '📝', color: 'indigo', title: '文本生成失败' },
        general: { icon: '⚠️', color: 'red', title: '操作失败' }
    };

    const config = typeConfig[errorType];
    const displayTitle = title || config.title;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* 背景遮罩 */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* 错误模态框 */}
            <div className="relative bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-2xl shadow-2xl border border-red-500/20 max-w-2xl w-full mx-4 overflow-hidden">
                {/* 顶部装饰条 */}
                <div className="h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500" />

                {/* 内容区域 */}
                <div className="p-6">
                    {/* 头部 */}
                    <div className="flex items-start gap-4 mb-5">
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-2xl">
                            {config.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-xl font-bold text-white mb-1">
                                {displayTitle}
                            </h2>
                            <p className="text-sm text-zinc-400">
                                请查看下方的错误详情以了解问题原因
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="flex-shrink-0 p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                        >
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* 错误消息 */}
                    <div className="bg-zinc-800/50 rounded-xl p-4 mb-4 border border-zinc-700/50">
                        <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap">
                            {message}
                        </p>
                    </div>

                    {/* 详细信息（可展开） */}
                    {details && (
                        <div className="mb-4">
                            <button
                                onClick={() => setShowDetails(!showDetails)}
                                className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-2"
                            >
                                <svg
                                    className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-90' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <span className="font-medium">
                                    {showDetails ? '隐藏' : '查看'}技术详情
                                </span>
                            </button>

                            {showDetails && (
                                <div className="bg-black/30 rounded-lg p-4 border border-zinc-700/50">
                                    <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap break-words">
                                        {details}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleCopy}
                            className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-all font-medium text-sm flex items-center justify-center gap-2"
                        >
                            {copied ? (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    已复制
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    复制错误信息
                                </>
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all font-medium text-sm shadow-lg shadow-red-900/20"
                        >
                            关闭
                        </button>
                    </div>

                    {/* 底部提示 */}
                    <div className="mt-4 pt-4 border-t border-zinc-800">
                        <p className="text-xs text-zinc-500 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            提示：如果问题持续存在，请检查API配置或联系技术支持
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ErrorModal;
