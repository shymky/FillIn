"use client";

import * as React from "react";

type SRResult = {
  transcript: string;
  isFinal: boolean;
};

type SREvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<SRResult> & { isFinal: boolean }>;
};

type SRErrorEvent = { error: string; message?: string };

type SRInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SRCtor = new () => SRInstance;

function getSR(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRCtor;
    webkitSpeechRecognition?: SRCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const OKAY_RE = /^okay[.,!?]?$/i;
function filterHallucination(text: string): string {
  const tokens = text.trim().split(/\s+/);
  let trailingOkay = 0;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (OKAY_RE.test(tokens[i])) trailingOkay++;
    else break;
  }
  if (trailingOkay >= 3) tokens.length = tokens.length - trailingOkay;
  return tokens.join(" ");
}

export type SpeechRecognitionOptions = {
  lang?: string;
  silenceMs?: number;
  enabled?: boolean;
};

export type UseSpeechRecognitionResult = {
  supported: boolean;
  isListening: boolean;
  transcript: string;
  previousTranscript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
};

export function useSpeechRecognition({
  lang = "en-US",
  silenceMs = 500,
}: SpeechRecognitionOptions = {}): UseSpeechRecognitionResult {
  const [supported, setSupported] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const [transcript, setTranscript] = React.useState("");
  const [previousTranscript, setPreviousTranscript] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const recognitionRef = React.useRef<SRInstance | null>(null);
  const silenceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const restartTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const shouldContinueRef = React.useRef(false);
  const finalBufferRef = React.useRef("");
  const networkRetryRef = React.useRef(0);
  const NETWORK_MAX_RETRIES = 4;

  React.useEffect(() => {
    setSupported(!!getSR());
  }, []);

  const clearSilenceTimer = React.useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const clearRestartTimer = React.useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const armSilenceTimer = React.useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      // move current utterance to "previous" so user still sees history
      setTranscript((cur) => {
        if (cur.trim()) setPreviousTranscript(cur);
        return "";
      });
      finalBufferRef.current = "";
    }, silenceMs);
  }, [silenceMs, clearSilenceTimer]);

  const reset = React.useCallback(() => {
    clearSilenceTimer();
    finalBufferRef.current = "";
    setTranscript("");
    setPreviousTranscript("");
  }, [clearSilenceTimer]);

  const start = React.useCallback(() => {
    const SR = getSR();
    if (!SR) {
      setError("This browser does not support the Web Speech API");
      return;
    }
    if (recognitionRef.current) return;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const alt = e.results[i][0];
        if (!alt) continue;
        if (e.results[i].isFinal) {
          finalBufferRef.current = (
            finalBufferRef.current +
            " " +
            alt.transcript
          ).trim();
        } else {
          interim += alt.transcript;
        }
      }
      const combined = (finalBufferRef.current + " " + interim).trim();
      const cleaned = filterHallucination(combined);
      setTranscript(cleaned);
      armSilenceTimer();
      // If we're getting results, the connection is healthy again.
      networkRetryRef.current = 0;
    };

    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "network") {
        // Transient — let onend handle exponential-backoff restart.
        if (networkRetryRef.current >= NETWORK_MAX_RETRIES) {
          setError(
            "Speech recognition network error. Chromeの音声認識はGoogleのクラウドAPIに接続します。VPN/プロキシ/企業ネットワークで https://www.google.com への接続がブロックされていないか、Safariで開いてみるなどを試してください。",
          );
        }
        return;
      }
      setError(e.error || "recognition error");
    };

    rec.onend = () => {
      if (!shouldContinueRef.current) {
        setIsListening(false);
        recognitionRef.current = null;
        return;
      }
      const attempt = networkRetryRef.current;
      if (attempt >= NETWORK_MAX_RETRIES) {
        shouldContinueRef.current = false;
        setIsListening(false);
        recognitionRef.current = null;
        return;
      }
      // Backoff: 0ms first, then 250, 500, 1000, 2000ms
      const delay = attempt === 0 ? 0 : 250 * 2 ** (attempt - 1);
      networkRetryRef.current = attempt + 1;
      clearRestartTimer();
      restartTimerRef.current = setTimeout(() => {
        if (!shouldContinueRef.current) return;
        try {
          rec.start();
        } catch {
          // Ignore: onend will fire again and we'll retry.
        }
      }, delay);
    };

    shouldContinueRef.current = true;
    networkRetryRef.current = 0;
    recognitionRef.current = rec;
    try {
      rec.start();
      setIsListening(true);
      setError(null);
    } catch (e) {
      shouldContinueRef.current = false;
      recognitionRef.current = null;
      setError(String(e));
      setIsListening(false);
    }
  }, [lang, armSilenceTimer, clearRestartTimer]);

  const stop = React.useCallback(() => {
    shouldContinueRef.current = false;
    clearSilenceTimer();
    clearRestartTimer();
    networkRetryRef.current = 0;
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        try {
          rec.abort();
        } catch {}
      }
    }
  }, [clearSilenceTimer, clearRestartTimer]);

  React.useEffect(() => {
    return () => {
      shouldContinueRef.current = false;
      clearSilenceTimer();
      clearRestartTimer();
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.abort();
        } catch {}
      }
      recognitionRef.current = null;
    };
  }, [clearSilenceTimer, clearRestartTimer]);

  return {
    supported,
    isListening,
    transcript,
    previousTranscript,
    error,
    start,
    stop,
    reset,
  };
}
