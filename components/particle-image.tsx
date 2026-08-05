'use client';

import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

interface Particle {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
}

interface ParticleImageProps {
  src: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  spacing?: number;
  backgroundThreshold?: number;
  interactionRadius?: number;
  interactionStrength?: number;
  settleStiffness?: number;
  settleDamping?: number;
}

export default function ParticleImage({
  src,
  label,
  align = 'left',
  className,
  spacing = 4,
  backgroundThreshold = 0.88,
  interactionRadius = 104,
  interactionStrength = 22,
  settleStiffness = 90,
  settleDamping = 18,
}: ParticleImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }

    const view = canvas.ownerDocument.defaultView;
    if (!view) {
      return;
    }

    let particles: Particle[] = [];
    let image: HTMLImageElement | undefined;
    let animationFrame = 0;
    let resizeFrame = 0;
    let lastFrameTime = 0;
    let width = 0;
    let height = 0;
    let pointer: { x: number; y: number; time: number } | undefined;
    let pointerVx = 0;
    let pointerVy = 0;
    let disposed = false;
    let reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const draw = () => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = getComputedStyle(canvas).color;

      for (const particle of particles) {
        context.globalAlpha = particle.alpha;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      }

      context.globalAlpha = 1;
    };

    const stopAnimation = () => {
      if (animationFrame) {
        view.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      lastFrameTime = 0;
    };

    const animate = (time: number) => {
      animationFrame = 0;
      if (disposed || reducedMotion) {
        return;
      }

      const elapsed = lastFrameTime ? (time - lastFrameTime) / 1000 : 1 / 60;
      const dt = Math.min(Math.max(elapsed, 1 / 240), 1 / 30);
      lastFrameTime = time;
      let moving = false;

      for (const particle of particles) {
        const dx = particle.baseX - particle.x;
        const dy = particle.baseY - particle.y;
        particle.vx += (dx * settleStiffness - particle.vx * settleDamping) * dt;
        particle.vy += (dy * settleStiffness - particle.vy * settleDamping) * dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;

        if (
          Math.abs(dx) < 0.02 &&
          Math.abs(dy) < 0.02 &&
          Math.abs(particle.vx) < 0.05 &&
          Math.abs(particle.vy) < 0.05
        ) {
          particle.x = particle.baseX;
          particle.y = particle.baseY;
          particle.vx = 0;
          particle.vy = 0;
        } else {
          moving = true;
        }
      }

      draw();
      if (moving) {
        animationFrame = view.requestAnimationFrame(animate);
      } else {
        lastFrameTime = 0;
      }
    };

    const startAnimation = () => {
      if (!animationFrame && !reducedMotion && particles.length) {
        animationFrame = view.requestAnimationFrame(animate);
      }
    };

    const resetParticles = () => {
      for (const particle of particles) {
        particle.x = particle.baseX;
        particle.y = particle.baseY;
        particle.vx = 0;
        particle.vy = 0;
      }
      stopAnimation();
      draw();
    };

    const sampleImage = () => {
      if (!image) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      width = Math.round(rect.width);
      height = Math.round(rect.height);
      if (width < 1 || height < 1) {
        return;
      }

      const dpr = Math.min(view.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const sampleWidth = Math.max(1, Math.ceil(width / spacing));
      const sampleHeight = Math.max(1, Math.ceil(height / spacing));
      const sampleCanvas = canvas.ownerDocument.createElement('canvas');
      const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
      if (!sampleContext) {
        return;
      }

      sampleCanvas.width = sampleWidth;
      sampleCanvas.height = sampleHeight;
      const scale = Math.min(sampleWidth / image.naturalWidth, sampleHeight / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const offsetX =
        align === 'left'
          ? 0
          : align === 'right'
            ? sampleWidth - drawWidth
            : (sampleWidth - drawWidth) / 2;
      sampleContext.drawImage(
        image,
        offsetX,
        (sampleHeight - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );

      const pixels = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;
      const stepX = width / sampleWidth;
      const stepY = height / sampleHeight;
      const pointSize = Math.min(stepX, stepY);
      const nextParticles: Particle[] = [];

      for (let y = 0; y < sampleHeight; y += 1) {
        for (let x = 0; x < sampleWidth; x += 1) {
          const index = (y * sampleWidth + x) * 4;
          const alpha = pixels[index + 3] / 255;
          if (alpha < 0.04) {
            continue;
          }

          const luminance =
            (0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2]) / 255;
          if (luminance >= backgroundThreshold) {
            continue;
          }

          const darkness = (backgroundThreshold - luminance) / backgroundThreshold;
          const baseX = (x + 0.5) * stepX;
          const baseY = (y + 0.5) * stepY;
          nextParticles.push({
            baseX,
            baseY,
            x: baseX,
            y: baseY,
            vx: 0,
            vy: 0,
            radius: Math.max(0.45, pointSize * (0.14 + darkness * 0.3)),
            alpha: alpha * (0.2 + darkness * 0.8),
          });
        }
      }

      particles = nextParticles;
      draw();
    };

    const scheduleResize = () => {
      if (resizeFrame) {
        return;
      }
      resizeFrame = view.requestAnimationFrame(() => {
        resizeFrame = 0;
        sampleImage();
      });
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || reducedMotion || !particles.length) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const point = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        time: view.performance.now(),
      };
      const previous = pointer;
      pointer = point;
      if (!previous) {
        return;
      }

      const elapsed = (point.time - previous.time) / 1000;
      if (elapsed <= 0 || elapsed > 0.12) {
        pointerVx = 0;
        pointerVy = 0;
        return;
      }

      pointerVx += ((point.x - previous.x) / elapsed - pointerVx) * 0.35;
      pointerVy += ((point.y - previous.y) / elapsed - pointerVy) * 0.35;
      const rawSpeed = Math.hypot(pointerVx, pointerVy);
      const speedDeadzone = 120;
      if (rawSpeed <= speedDeadzone) {
        return;
      }

      const directionX = pointerVx / rawSpeed;
      const directionY = pointerVy / rawSpeed;
      const impulse = Math.min(interactionStrength, (rawSpeed - speedDeadzone) * 0.04);

      for (const particle of particles) {
        const dx = particle.x - point.x;
        const dy = particle.y - point.y;
        const distance = Math.hypot(dx, dy);
        if (distance >= interactionRadius) {
          continue;
        }

        const falloff = 1 - distance / interactionRadius;
        const force = impulse * falloff * falloff;
        const radialX = distance === 0 ? -directionX : dx / distance;
        const radialY = distance === 0 ? -directionY : dy / distance;
        particle.vx += (radialX * 0.8 + directionX * 0.2) * force;
        particle.vy += (radialY * 0.8 + directionY * 0.2) * force;
      }

      startAnimation();
    };

    const resetPointer = () => {
      pointer = undefined;
      pointerVx = 0;
      pointerVy = 0;
    };

    const motionQuery = view.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      if (reducedMotion) {
        resetParticles();
      }
    };

    const loadedImage = new view.Image();
    loadedImage.crossOrigin = 'anonymous';
    loadedImage.src = src;
    loadedImage
      .decode()
      .then(() => {
        if (!disposed) {
          image = loadedImage;
          sampleImage();
        }
      })
      .catch(error => console.error('[particle-image]', error));

    const resizeObserver = new view.ResizeObserver(scheduleResize);
    resizeObserver.observe(canvas);
    const themeObserver = new MutationObserver(draw);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    motionQuery.addEventListener('change', onMotionChange);
    canvas.addEventListener('pointermove', onPointerMove, { passive: true });
    canvas.addEventListener('pointerleave', resetPointer, { passive: true });
    canvas.addEventListener('pointercancel', resetPointer, { passive: true });

    return () => {
      disposed = true;
      stopAnimation();
      if (resizeFrame) {
        view.cancelAnimationFrame(resizeFrame);
      }
      resizeObserver.disconnect();
      themeObserver.disconnect();
      motionQuery.removeEventListener('change', onMotionChange);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', resetPointer);
      canvas.removeEventListener('pointercancel', resetPointer);
    };
  }, [
    align,
    backgroundThreshold,
    interactionRadius,
    interactionStrength,
    settleDamping,
    settleStiffness,
    spacing,
    src,
  ]);

  return (
    <div className={cn('relative mr-auto aspect-square w-full max-w-64', className)}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className="text-foreground absolute inset-0 size-full"
      />
    </div>
  );
}
