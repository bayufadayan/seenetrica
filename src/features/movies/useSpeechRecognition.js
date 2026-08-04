import { useEffect, useRef, useState } from "react";

const messages = {
  "audio-capture": "No microphone was detected.",
  "language-not-supported": "The selected speech language is not supported.",
  network:
    "Speech recognition could not connect. Try Google Chrome or type the review manually.",
  "no-speech":
    "No speech was detected. Try speaking a little closer to the microphone.",
  "not-allowed":
    "Microphone access was denied. Allow microphone access in the browser.",
  "service-not-allowed": "Speech recognition is blocked by the browser.",
};

export function useSpeechRecognition(value, onChange, onError) {
  const recognitionRef = useRef(null);
  const baseRef = useRef("");
  const errorRef = useRef("");
  const [listening, setListening] = useState(false);
  const supported =
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition) &&
    window.isSecureContext;
  const [status, setStatus] = useState(
    supported
      ? "Press the microphone and start speaking."
      : window.isSecureContext
        ? "Voice input is not supported by this browser. You can still type your review."
        : "Voice input needs HTTPS or localhost before the browser can use the microphone.",
  );

  useEffect(() => {
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition || !window.isSecureContext) return undefined;
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      errorRef.current = "";
      setListening(true);
      setStatus("Listening… Speak naturally. Your words will appear below.");
    };
    recognition.onresult = (event) => {
      let final = "";
      let interim = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript || "";
        if (event.results[index].isFinal) final += `${transcript} `;
        else interim += `${transcript} `;
      }
      onChange(
        [baseRef.current, final, interim]
          .map((part) => part.trim())
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " "),
      );
    };
    recognition.onerror = (event) => {
      const message =
        messages[event.error] || "Speech recognition stopped unexpectedly.";
      errorRef.current = message;
      setStatus(message);
      if (event.error !== "no-speech") onError(message);
    };
    recognition.onend = () => {
      setListening(false);
      setStatus(
        errorRef.current ||
          "Transcription added. You can edit the text or record more.",
      );
    };
    recognitionRef.current = recognition;
    return () => {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        /* Already stopped. */
      }
      recognitionRef.current = null;
    };
  }, [onChange, onError]);

  function toggle(language) {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      return;
    }
    baseRef.current = value.trim();
    recognition.lang = language;
    try {
      recognition.start();
    } catch {
      onError("The microphone is already starting. Try again.");
    }
  }
  function stop() {
    return new Promise((resolve) => {
      const recognition = recognitionRef.current;
      if (!recognition || !listening) {
        resolve();
        return;
      }
      const timer = window.setTimeout(resolve, 1500);
      recognition.addEventListener(
        "end",
        () => {
          window.clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      recognition.stop();
    });
  }
  return { supported, listening, status, toggle, stop };
}
