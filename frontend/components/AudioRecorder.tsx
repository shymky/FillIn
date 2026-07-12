"use client";

import { useEffect, useRef, useState } from "react";

interface AudioRecorderProps {
  onTranscript: (text: string) => void;
  isListening: boolean;
  setIsListening: (listening: boolean) => void;
}

export const AudioRecorder = ({
  onTranscript,
  isListening,
  setIsListening,
}: AudioRecorderProps) => {
  const recognitionRef = useRef<any>(null);
  const [transcript, setTranscript] = useState("");
  const silenceTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + " ";
        } else {
          interim += transcript;
        }
      }

      if (final) {
        setTranscript((prev) => prev + final);
        onTranscript((prev) => prev + final);
      }

      // Reset silence timeout on speech
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }

      // Auto-stop after 0.5s silence
      silenceTimeoutRef.current = setTimeout(() => {
        recognition.stop();
      }, 500);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, [onTranscript, setIsListening]);

  const startListening = () => {
    setTranscript("");
    if (recognitionRef.current) {
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const resetTranscript = () => {
    setTranscript("");
  };

  return {
    transcript,
    setTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isListening,
  };
};
