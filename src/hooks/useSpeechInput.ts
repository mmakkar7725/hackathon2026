"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface SpeechRecognitionInstance {
  continuous: boolean;
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  start: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionCtor;
    SpeechRecognition?: SpeechRecognitionCtor;
  }
}

export function useSpeechInput(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  const recognition = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const RecognitionConstructor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!RecognitionConstructor) {
      return null;
    }

    const instance = new RecognitionConstructor();
    instance.continuous = false;
    instance.lang = "en-US";
    instance.interimResults = false;
    instance.maxAlternatives = 1;

    return instance;
  }, []);

  useEffect(() => {
    setIsSupported(Boolean(recognition));
  }, [recognition]);

  useEffect(() => {
    if (!recognition) {
      return;
    }

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0]?.transcript;
      if (transcript) {
        onTranscript(transcript);
      }
    };

    return () => {
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
    };
  }, [onTranscript, recognition]);

  const startListening = useCallback(() => {
    if (!recognition || isListening) {
      return;
    }

    recognition.start();
  }, [isListening, recognition]);

  return {
    isListening,
    isSupported,
    startListening,
  };
}
