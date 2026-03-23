import React, { useRef, useEffect } from 'react';

const ParticleCanvas: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Configuration
    const CONFIG = {
        count: 35,              // Reduced particle count for performance
        linkDistance: 150,      // Increased distance slightly to compensate for fewer particles
        baseColor: '100, 200, 255', // 基础颜色 (RGB)
        speed: 0.2,             // Slower speed
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let particles: Array<{
            x: number;
            y: number;
            vx: number;
            vy: number;
            size: number;
            opacity: number;
        }> = [];

        // Initialize particles
        const initParticles = (width: number, height: number) => {
            particles = [];
            for (let i = 0; i < CONFIG.count; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * CONFIG.speed,
                    vy: (Math.random() - 0.5) * CONFIG.speed,
                    size: Math.random() * 2 + 0.5,
                    opacity: Math.random() * 0.5 + 0.1
                });
            }
        };

        // Render loop
        const render = () => {
            if (!canvas || !ctx) return;
            const width = canvas.width;
            const height = canvas.height;

            // Clear canvas
            ctx.clearRect(0, 0, width, height);

            // Update and draw particles
            particles.forEach((p) => {
                // Update position
                p.x += p.vx;
                p.y += p.vy;

                // Bounce off edges
                if (p.x < 0 || p.x > width) p.vx *= -1;
                if (p.y < 0 || p.y > height) p.vy *= -1;

                // Draw particle
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${CONFIG.baseColor}, ${p.opacity})`;
                ctx.fill();
            });

            // Draw connections - Batch Stroking Optimization
            const thresholdSq = CONFIG.linkDistance * CONFIG.linkDistance;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${CONFIG.baseColor}, 0.05)`; // Constant low alpha for batching
            ctx.lineWidth = 0.5;

            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const p1 = particles[i];
                    const p2 = particles[j];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < thresholdSq) {
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                    }
                }
            }
            ctx.stroke(); // Single draw call for all lines

            animationFrameId = requestAnimationFrame(render);
        };

        // Handle Resize
        const handleResize = () => {
            if (canvas) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
        };

        // Initial setup
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        initParticles(canvas.width, canvas.height);
        render();

        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none z-0"
            style={{ width: '100%', height: '100%' }}
        />
    );
};

export default ParticleCanvas;
