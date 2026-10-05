import { useEffect, useRef } from 'react';
import type { GameHost } from '../engine/api';
import { lcdOverlayVars } from './screenScale';

interface ScreenProps {
  host: GameHost;
  powered: boolean;
  /** Draw the CSS LCD overlay (dot grid, grain, vignette). */
  lcd: boolean;
}

/**
 * The LCD window. The host owns the canvas size (integer scaling); this component only
 * reports the available box and mirrors the resulting scale into a CSS var for the overlay.
 */
export function Screen({ host, powered, lcd }: ScreenProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) host.attachCanvas(canvas);
  }, [host]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const report = (): void => {
      const { width, height } = box.getBoundingClientRect();
      if (width > 0 && height > 0) host.resize(width, height, window.devicePixelRatio || 1);
    };
    const observer = new ResizeObserver(report);
    observer.observe(box);
    // Zooming changes devicePixelRatio without resizing the box.
    window.addEventListener('resize', report);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', report);
    };
  }, [host]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;
    const sync = (): void => {
      const { scale, grid } = lcdOverlayVars(canvas.clientWidth);
      frame.style.setProperty('--lcd-scale', String(scale));
      frame.dataset.grid = grid ? 'on' : 'off';
    };
    const observer = new ResizeObserver(sync);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="screen" data-powered={powered ? 'on' : 'off'} ref={boxRef}>
      <div className="screen__frame" ref={frameRef}>
        <canvas
          ref={canvasRef}
          className="screen__canvas"
          data-testid="screen"
          aria-label="Game screen"
          role="img"
          width={160}
          height={144}
        />
        {lcd && powered && <div className="screen__lcd" aria-hidden="true" />}
      </div>
    </div>
  );
}
