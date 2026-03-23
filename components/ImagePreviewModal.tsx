import React, { useEffect } from 'react';
import { XIcon } from './Icons';

interface ImagePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    media: { url: string; type: 'image' | 'video' } | null;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ isOpen, onClose, media }) => {
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
        }
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen || !media) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/95 animate-in fade-in duration-200"
            onClick={onClose}
        >
            {/* Close Button */}
            <button
                className="absolute top-6 right-6 p-2 bg-zinc-800/50 hover:bg-zinc-700 rounded-full text-white/70 hover:text-white transition-all shadow-lg z-50"
                onClick={onClose}
            >
                <XIcon className="w-6 h-6" />
            </button>

            {/* Content Container */}
            <div
                className="relative max-w-full max-h-full overflow-hidden rounded-lg shadow-2xl flex items-center justify-center"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking content
            >
                {media.type === 'video' ? (
                    <video
                        src={media.url}
                        controls
                        autoPlay
                        className="w-auto h-auto max-w-[90vw] max-h-[90vh] object-contain rounded-md"
                    />
                ) : (
                    <img
                        src={media.url}
                        alt="Full size preview"
                        className="w-auto h-auto max-w-full max-h-[90vh] object-contain rounded-md select-none"
                    />
                )}
            </div>
        </div>
    );
};

export default ImagePreviewModal;
