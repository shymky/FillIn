"use client";

import * as React from "react";

/**
 * Client-side driver for the FastAPI /stt/stream WebSocket.
 *
 * Captures microphone at 16 kHz mono float32 via an AudioWorklet and streams
 * the raw PCM bytes to the server. Receives incremental transcripts back and
 * exposes the same shape as {@link useSpeechRecognition} so pages can swap
 * implementations without a rewrite.
 */

export type UseLocalWhisperResult = {
  supported: boolean;
  isListening: boolean;
  transcript: string;
  previousTranscript: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
  /** Latest server-side elapsed_ms for a transcribe pass (perf HUD) */
  lastElapsedMs: number | null;
};

function getApiBase(): { http: string; ws: string } {
  if (typeof window === "undefined") {
    return { http: "", ws: "" };
  }
  const envHttp = process.env.NEXT_PUBLIC_API_URL;
  if (envHttp) {
    const url = new URL(envHttp);
    const wsProto = url.protocol === "https:" ? "wss:" : "ws:";
    return {
      http: envHttp.replace(/\/$/, ""),
      ws: `${wsProto}//${url.host}`,
    };
  }
  // Default: same host, port 9000
  const host = window.location.hostname;
  const isHttps = window.location.protocol === "https:";
  return {
    http: `${isHttps ? "https" : "http"}://${host}:9000`,
    ws: `${isHttps ? "wss" : "ws"}://${host}:9000`,
  };
}

export function useLocalWhisper(): UseLocalWhisperResult {
  const [isListening, setIsListening] = React.useState(false);
  const [transcript, setTranscript] = React.useState("");
  const [previousTranscript, setPreviousTranscript] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [lastElapsedMs, setLastElapsedMs] = React.useState<number | null>(null);

  // Runtime handles that must NOT trigger re-renders when they change.
  const wsRef = React.useRef<WebSocket | null>(null);
  const acRef = React.useRef<AudioContext | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const nodeRef = React.useRef<AudioWorkletNode | null>(null);
  const sourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null);

  const supported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof AudioWorkletNode !== "undefined";

  const teardown = React.useCallback(() => {
    try {
      nodeRef.current?.port.close();
      nodeRef.current?.disconnect();
    } catch {}
    try {
      sourceRef.current?.disconnect();
    } catch {}
    try {
      acRef.current?.close();
    } catch {}
    for (const t of streamRef.current?.getTracks() ?? []) {
      try {
        t.stop();
      } catch {}
    }
    try {
      wsRef.current?.close();
    } catch {}
    nodeRef.current = null;
    sourceRef.current = null;
    acRef.current = null;
    streamRef.current = null;
    wsRef.current = null;
  }, []);

  const reset = React.useCallback(() => {
    setTranscript((cur) => {
      if (cur.trim()) setPreviousTranscript(cur);
      return "";
    });
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "reset" }));
    }
  }, []);

  const start = React.useCallback(async () => {
    if (!supported) {
      setError("Microphone or AudioWorklet not supported in this browser");
      return;
    }
    if (isListening) return;
    setError(null);
    setTranscript("");
    setPreviousTranscript("");
    setLastElapsedMs(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ac = new AC({ sampleRate: 16000 });
      acRef.current = ac;
      await ac.audioWorklet.addModule("/audio-worklet.js");

      const source = ac.createMediaStreamSource(stream);
      sourceRef.current = source;
      const node = new AudioWorkletNode(ac, "pcm-processor");
      nodeRef.current = node;

      const { ws: wsBase } = getApiBase();
      const ws = new WebSocket(`${wsBase}/stt/stream`);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      let opened = false;
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
          opened = true;
          resolve();
        };
        ws.onerror = () => {
          if (!opened) reject(new Error("Failed to connect to STT server"));
        };
      });

      ws.onmessage = (e) => {
        try {
          const payload = JSON.parse(String(e.data));
          if (payload.type === "transcript") {
            const t = String(payload.text ?? "");
            setTranscript((cur) => {
              // If server flushed to empty (silence reset) and we had text,
              // preserve it as "previous" for the user.
              if (!t && cur.trim()) {
                setPreviousTranscript(cur);
                return "";
              }
              return t;
            });
            if (typeof payload.elapsed_ms === "number") {
              setLastElapsedMs(payload.elapsed_ms);
            }
          }
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        setIsListening(false);
      };

      node.port.onmessage = (e: MessageEvent<Float32Array>) => {
        const buf = e.data;
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(buf.buffer);
        }
      };

      source.connect(node);
      // Don't connect node -> destination: we don't want to hear ourselves.

      setIsListening(true);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to start local whisper";
      setError(msg);
      teardown();
      setIsListening(false);
    }
  }, [isListening, supported, teardown]);

  const stop = React.useCallback(() => {
    teardown();
    setIsListening(false);
  }, [teardown]);

  React.useEffect(() => {
    return () => teardown();
  }, [teardown]);

  return {
    supported,
    isListening,
    transcript,
    previousTranscript,
    error,
    start,
    stop,
    reset,
    lastElapsedMs,
  };
}
