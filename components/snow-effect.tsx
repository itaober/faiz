'use client';

import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';

import { DEFAULT_SNOW_CONFIG, SNOW_DENSITY, SnowEngine } from '@/lib/snow';

interface ISnowEffectProps {
  enabled?: boolean;
  density?: 'light' | 'normal' | 'heavy';
  className?: string;
}

export function SnowEffect({
  enabled = true,
  density = 'normal',
  className = '',
}: ISnowEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SnowEngine | null>(null);
  const { resolvedTheme } = useTheme();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !enabled) return;

    if (isMobile && resolvedTheme === 'light') {
      engineRef.current?.stop();
      return;
    }

    const count = SNOW_DENSITY[density];
    const color =
      resolvedTheme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(160, 160, 160, 0.5)';

    if (!engineRef.current) {
      // Force initialization with window size to ensure full screen coverage
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;

      engineRef.current = new SnowEngine(canvasRef.current, {
        ...DEFAULT_SNOW_CONFIG,
        count,
        color,
      });

      // Call resize again to ensure correct DPR handling
      engineRef.current.resize(window.innerWidth, window.innerHeight);
      engineRef.current.start();
    } else {
      engineRef.current.updateConfig({ count, color });
      engineRef.current.resume();
    }

    const handleResize = () => {
      if (engineRef.current && canvasRef.current) {
        engineRef.current.resize(window.innerWidth, window.innerHeight);
      }
    };

    const handleVisibilityChange = () => {
      if (!engineRef.current) return;
      if (document.hidden) {
        engineRef.current.pause();
      } else {
        engineRef.current.resume();
      }
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      engineRef.current?.stop();
    };
  }, [enabled, density, resolvedTheme, isMobile]);

  if (!enabled || (isMobile && resolvedTheme === 'light')) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none fixed inset-0 z-[9999] ${className}`}
      aria-hidden="true"
    />
  );
}
