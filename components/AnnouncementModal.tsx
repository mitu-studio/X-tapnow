
import React, { useRef, useEffect } from 'react';
import { XIcon, CheckIcon } from './Icons';

interface AnnouncementModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ChangeLogItem {
    version: string;
    date: string;
    features: string[];
}

const CHANGELOG: ChangeLogItem[] = [
    {
        version: 'v0.9.0',
        date: '2026-01-27',
        features: [
            '🌊 支持 OpenAI 格式的流式视频生成（SSE Streaming）支持本地逆向的',
            '🔄 优化 Remix 工作流：自动检测连接的视频节点并将其 URL 附加到提示词中',
            '🖼️ 优化 Image-to-Video：支持通过 OpenAI 格式上传图片 URL',
            '🐞 修复：OpenAI 视频生成时 URL 尾部可能包含特殊字符导致 400 错误的问题'
        ]
    },
    {
        version: 'v0.8.0',
        date: '2026-01-26',
        features: [
            '🚀 正式接入 Google Veo 视频生成模型，接口为(/v1/video/create)',
            '🔧 适配 Veo 任务状态查询接口 (/v1/video/query)',
            '✨ 支持 Veo 专属参数：提示词增强、超分及图片参考',
            '🐛 修复了多图上传参数的类型兼容性问题'
        ]
    }
];

const AnnouncementModal: React.FC<AnnouncementModalProps> = ({ isOpen, onClose }) => {
    const modalRef = useRef<HTMLDivElement>(null);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                ref={modalRef}
                className="w-[500px] max-h-[80vh] bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
                    <div>
                        <h2 className="text-lg font-bold text-white">更新日志</h2>
                        <p className="text-xs text-zinc-500">查看最近的功能更新与改进</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-0">
                    <div className="divide-y divide-zinc-800/50">
                        {CHANGELOG.map((log, index) => (
                            <div key={index} className="p-5 hover:bg-zinc-900/20 transition-colors">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono font-bold">
                                            {log.version}
                                        </span>
                                        <span className="text-xs text-zinc-500">{log.date}</span>
                                    </div>
                                    {index === 0 && (
                                        <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                            Latest
                                        </span>
                                    )}
                                </div>
                                <ul className="space-y-2">
                                    {log.features.map((feature, fIndex) => (
                                        <li key={fIndex} className="flex items-start gap-2 text-sm text-zinc-300">
                                            <span className="mt-1.5 w-1 h-1 rounded-full bg-zinc-600 flex-shrink-0" />
                                            <span className="leading-relaxed">{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-900/30 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-zinc-100 hover:bg-white text-black text-sm font-medium rounded-lg transition-colors shadow-lg shadow-white/5"
                    >
                        知道了
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AnnouncementModal;
