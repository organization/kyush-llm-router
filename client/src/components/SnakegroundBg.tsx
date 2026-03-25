import { onCleanup, onMount } from 'solid-js';

declare global {
  interface Window {
    Snakeground?: new (
      canvas: HTMLCanvasElement,
      opts?: Record<string, unknown>
    ) => {
      stop?: () => void;
      setPageHeight?: (height: number) => void;
    };
  }
}

const SCRIPT_ID = 'snakeground-script';
const SCRIPT_SRC = '/snakeground.js';
const SEED_STORAGE_KEY = 'snakeground-seed';

export default function SnakegroundBg(props: { opts?: Record<string, unknown> }) {
  let canvasRef: HTMLCanvasElement | undefined;
  let wrapRef: HTMLDivElement | undefined;
  let snakeground: { stop?: () => void; setPageHeight?: (height: number) => void } | undefined;

  const onScroll = () => {
    if (!wrapRef) return;

    const scrollY = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = maxScroll > 0 ? scrollY / maxScroll : 0;
    const offset = 5 - ratio * 30;

    wrapRef.style.transform = `translateY(${offset}%)`;
    snakeground?.setPageHeight?.(document.documentElement.scrollHeight);
  };

  const mountSnakeground = () => {
    if (!canvasRef || !window.Snakeground || snakeground) {
      return;
    }

    const storedSeed = window.localStorage.getItem(SEED_STORAGE_KEY);
    const seed = storedSeed ? Number(storedSeed) : Date.now();

    if (!storedSeed) {
      window.localStorage.setItem(SEED_STORAGE_KEY, String(seed));
    }

    snakeground = new window.Snakeground(canvasRef, {
      seed,
      pageHeight: document.documentElement.scrollHeight,
      ...props.opts,
    });

    onScroll();
  };

  onMount(() => {
    const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    if (window.Snakeground) {
      mountSnakeground();
    } else if (existingScript) {
      existingScript.addEventListener('load', mountSnakeground, { once: true });
    } else {
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.defer = true;
      script.addEventListener('load', mountSnakeground, { once: true });
      document.head.appendChild(script);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  });

  onCleanup(() => {
    snakeground?.stop?.();
    window.removeEventListener('scroll', onScroll);
  });

  return (
    <div ref={wrapRef} class="pub-bg-canvas-wrap">
      <canvas ref={canvasRef} class="pub-bg-canvas" />
    </div>
  );
}
