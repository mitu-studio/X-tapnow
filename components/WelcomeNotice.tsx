import React, { useState, useEffect } from 'react';

interface WelcomeNoticeProps {
    isOpen: boolean;
    onConfirm: () => void;
}

const WelcomeNotice: React.FC<WelcomeNoticeProps> = ({ isOpen, onConfirm }) => {
    const [countdown, setCountdown] = useState(3);
    const [canConfirm, setCanConfirm] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            // 重置状态
            setCountdown(3);
            setCanConfirm(false);
            return;
        }

        // 启动倒计时
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    setCanConfirm(true);
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-gradient-to-br from-[#1a1a1f] to-[#18181b] border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/10 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border-b border-cyan-500/20 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
                            <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-cyan-100">重要提醒</h3>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-6">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-4">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div>
                                <p className="text-amber-200 font-semibold text-sm mb-1">
                                    网站不保存数据，做项目记得及时保存下载
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">
                        <p className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span><span className="font-semibold text-cyan-300">左侧工具栏</span>有导出功能，可导出整个项目</span>
                        </p>
                        <p className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>导出的 <span className="font-mono text-cyan-300">JSON数据</span> 文件可在下次导入恢复项目</span>
                        </p>
                        <p className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>数据保存在<span className="font-semibold text-cyan-300">浏览器本地</span>，<span className="font-semibold text-red-500">清除缓存会丢失（包括角色信息，所以需要记得导出保存）</span></span>
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-zinc-900/50 flex flex-col items-center gap-2 border-t border-zinc-800/50">
                    {!canConfirm && (
                        <p className="text-xs text-zinc-500 animate-pulse">
                            请仔细阅读以上提醒 ({countdown}s)
                        </p>
                    )}
                    <button
                        onClick={onConfirm}
                        disabled={!canConfirm}
                        className={`px-8 py-3 text-sm font-bold text-white rounded-lg transition-all duration-200 shadow-lg border ${canConfirm
                            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105 border-cyan-500/30 cursor-pointer'
                            : 'bg-gray-600 cursor-not-allowed opacity-50 border-gray-500/30'
                            }`}
                    >
                        {canConfirm ? '我知道了，开始使用' : `请等待 ${countdown} 秒...`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WelcomeNotice;
