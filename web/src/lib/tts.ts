"use client";

// Fetch-based TTS: fetch() downloads the audio blob first, then plays from a
// local Blob URL. This eliminates the AbortError race that occurs in React dev
// mode where useEffect cleanup calls pause() before audio.play() resolves.
//
// Audio is proxied through /api/tts (Next.js route handler → localhost:9000)
// so the browser always hits the same origin — avoids cross-origin LAN fetch
// failures that occur inconsistently in Chrome with 192.168.x.x targets.

let currentController: AbortController | null = null;
let currentAudio: HTMLAudioElement | null = null;
let currentBlobUrl: string | null = null;

export function ttsUrl(
  text: string,
  opts: { voice?: string; lang?: string; rate?: string } = {},
): string {
  const params = new URLSearchParams({ text });
  if (opts.voice) params.set("voice", opts.voice);
  if (opts.lang) params.set("lang", opts.lang);
  if (opts.rate) params.set("rate", opts.rate);
  return `/api/tts?${params.toString()}`;
}

export function stopSpeech(): void {
  currentController?.abort();
  currentController = null;

  if (currentAudio) {
    try { currentAudio.pause(); } catch { /* ignore */ }
    currentAudio = null;
  }

  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = null;
  }
}

export async function speak(
  text: string,
  opts: { voice?: string; lang?: string; rate?: string; playbackRate?: number } = {},
): Promise<void> {
  const trimmed = text.replace(/\//g, " ").trim();
  if (!trimmed) return;
  stopSpeech();

  // Phase 1: fetch audio as blob (network, abortable).
  // If useEffect cleanup fires here, controller.abort() is called and we return cleanly.
  const controller = new AbortController();
  currentController = controller;

  const url = ttsUrl(trimmed, opts);
  let blobUrl: string;
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`TTS ${res.status}`);
    blobUrl = URL.createObjectURL(await res.blob());
  } catch (e) {
    if (currentController === controller) currentController = null;
    // Browsers differ: Chrome may throw TypeError instead of DOMException for aborted fetches
    const isAbort = (e instanceof DOMException || e instanceof Error) && (e as Error).name === "AbortError";
    if (isAbort || controller.signal.aborted) return;
    console.warn("TTS fetch failed:", url, e);
    return;
  }

  // Discard if another speak() started while we were fetching.
  if (currentController !== controller) { URL.revokeObjectURL(blobUrl); return; }
  currentController = null;
  currentBlobUrl = blobUrl;

  // Phase 2: play from Blob URL (local memory — audio.play() resolves instantly,
  // no network race, no AbortError possible from pause()).
  const audio = new Audio(blobUrl);
  if (opts.playbackRate !== undefined) audio.playbackRate = opts.playbackRate;
  currentAudio = audio;

  return new Promise<void>((resolve) => {
    const settle = () => {
      if (currentAudio === audio) currentAudio = null;
      if (currentBlobUrl === blobUrl) { URL.revokeObjectURL(blobUrl); currentBlobUrl = null; }
      resolve();
    };
    audio.addEventListener("ended", settle, { once: true });
    audio.addEventListener("error", settle, { once: true });
    audio.play().then(undefined, settle);
  });
}

export async function speakRepeat(
  text: string,
  count: number,
  opts: { voice?: string; lang?: string; rate?: string } = {},
  onEach?: (i: number) => void,
): Promise<void> {
  for (let i = 0; i < count; i++) {
    onEach?.(i + 1);
    await speak(text, opts);
  }
}

export function detectLang(text: string): "ja" | "en" {
  return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(text)
    ? "ja"
    : "en";
}
