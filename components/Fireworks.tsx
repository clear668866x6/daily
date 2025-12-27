
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  active: boolean;
  onClose: () => void;
}

export const Fireworks: React.FC<Props> = ({ active, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Handle closing on interaction
  useEffect(() => {
    if (!active) return;

    const handleInteraction = () => {
      onClose();
    };

    // "Click any key" interpreted as keyboard or mouse click
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);

    return () => {
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, [active, onClose]);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    let fireworks: Firework[] = [];
    
    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Configuration
    const gravity = 0.05;
    const friction = 0.98;
    const colors = ['#ff0043', '#14fc56', '#1e90ff', '#e4fc14', '#fe00fe', '#00ffeb', '#ffffff', '#ffa500'];

    class Particle {
        x: number;
        y: number;
        vx: number;
        vy: number;
        alpha: number;
        color: string;
        decay: number;

        constructor(x: number, y: number, color: string) {
            this.x = x;
            this.y = y;
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 2; 
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.alpha = 1;
            this.color = color;
            this.decay = Math.random() * 0.015 + 0.010;
        }

        update() {
            this.vx *= friction;
            this.vy *= friction;
            this.vy += gravity;
            this.x += this.vx;
            this.y += this.vy;
            this.alpha -= this.decay;
        }

        draw(ctx: CanvasRenderingContext2D) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, this.alpha);
            ctx.beginPath();
            ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.restore();
        }
    }

    class Firework {
        x: number;
        y: number;
        targetY: number;
        vy: number;
        color: string;
        exploded: boolean;

        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = canvas.height;
            this.targetY = Math.random() * (canvas.height / 2);
            this.vy = -Math.random() * 4 - 10;
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.exploded = false;
        }

        update() {
            this.y += this.vy;
            this.vy += 0.15;

            if (this.vy >= 0 || this.y <= this.targetY) {
                this.exploded = true;
                this.createExplosion();
            }
        }

        createExplosion() {
            const particleCount = 60;
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle(this.x, this.y, this.color));
            }
        }

        draw(ctx: CanvasRenderingContext2D) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            
            // Trail
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x, this.y + 15);
            ctx.strokeStyle = this.color;
            ctx.stroke();
        }
    }

    let ticker = 0;
    const loop = () => {
        // Darken background for trail effect
        // Using createPortal allows us to overlay the whole screen.
        // We use a dark background fill to make it look like a modal/overlay.
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (ticker % 20 === 0) {
            fireworks.push(new Firework());
        }
        ticker++;

        for (let i = fireworks.length - 1; i >= 0; i--) {
            fireworks[i].update();
            fireworks[i].draw(ctx);
            if (fireworks[i].exploded) {
                fireworks.splice(i, 1);
            }
        }

        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            particles[i].draw(ctx);
            if (particles[i].alpha <= 0) {
                particles.splice(i, 1);
            }
        }

        animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
        window.removeEventListener('resize', resize);
        cancelAnimationFrame(animationFrameId);
    };
  }, [active]);

  if (!active) return null;

  // Use Portal to ensure it sits on top of everything (z-index logic works relative to body)
  return createPortal(
    <canvas 
        ref={canvasRef} 
        className="fixed inset-0 z-[99999] cursor-pointer"
        style={{ touchAction: 'none' }}
    />,
    document.body
  );
};
