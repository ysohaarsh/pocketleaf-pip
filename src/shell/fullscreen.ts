/** Fullscreen API with the WebKit-prefixed fallback (older iPadOS / Safari). */

interface FullscreenDocument {
  fullscreenEnabled?: boolean;
  webkitFullscreenEnabled?: boolean;
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  exitFullscreen?: () => Promise<void>;
  webkitExitFullscreen?: () => void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

interface FullscreenElement {
  requestFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => void;
}

export function fullscreenSupported(doc: FullscreenDocument): boolean {
  return Boolean(doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled);
}

export function isFullscreen(doc: FullscreenDocument): boolean {
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

export function toggleFullscreen(doc: FullscreenDocument, el: FullscreenElement): void {
  const ignore = (): void => undefined;
  if (isFullscreen(doc)) {
    if (doc.exitFullscreen) doc.exitFullscreen().catch(ignore);
    else doc.webkitExitFullscreen?.();
  } else if (el.requestFullscreen) {
    el.requestFullscreen().catch(ignore);
  } else {
    el.webkitRequestFullscreen?.();
  }
}

export function subscribeFullscreen(doc: FullscreenDocument, listener: () => void): () => void {
  doc.addEventListener('fullscreenchange', listener);
  doc.addEventListener('webkitfullscreenchange', listener);
  return () => {
    doc.removeEventListener('fullscreenchange', listener);
    doc.removeEventListener('webkitfullscreenchange', listener);
  };
}
