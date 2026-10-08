import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Mic, Waveform } from "../design/icons";

// Upstream (chatbot-fe/dev): a textarea and a Send button, with its own text state.
// Ours adds: a text value the page can set (suggestions, links from other screens),
// dictation where the browser supports it, and the composer design.
interface Props {
  disabled?: boolean;
  onSend: (message: string) => void;
  /** When given, the page owns the text (controlled). Otherwise the box keeps its own. */
  value?: string;
  onChange?: (value: string) => void;
}

/* ---- dictation: the browser's speech recognition, where there is one ---- */
interface RecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: { length: number; [index: number]: RecognitionResult } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;
function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function ChatInput({ disabled, onSend, value: controlled, onChange }: Props) {
  const [inner, setInner] = useState("");
  const value = controlled ?? inner;
  const setValue = (v: string) => (onChange ? onChange(v) : setInner(v));

  const Ctor = useMemo(recognitionCtor, []);
  const recognition = useRef<Recognition | null>(null);
  const [listening, setListening] = useState(false);
  useEffect(() => () => recognition.current?.stop(), []);

  function toggleListening() {
    if (!Ctor) return;
    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }
    const r = new Ctor();
    r.lang = navigator.language || "en-GB";
    r.continuous = false;
    r.interimResults = true;
    let settled = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const result = e.results[i];
        if (result.isFinal) settled += result[0].transcript;
        else interim += result[0].transcript;
      }
      setValue((settled + interim).trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognition.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form className="tc-composer" onSubmit={onSubmit}>
      {Ctor && (
        <button
          type="button"
          className="tc-composer__btn"
          aria-label={listening ? "Stop dictation" : "Dictate your message"}
          aria-pressed={listening}
          onClick={toggleListening}
        >
          {listening ? <Waveform /> : <Mic />}
        </button>
      )}
      <textarea
        className="tc-composer__input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask Tara…"
        aria-label="Ask Tara"
        rows={1}
        disabled={disabled}
      />
      <button
        type="submit"
        className="tc-composer__btn"
        aria-label="Send"
        disabled={disabled || !value.trim()}
      >
        <ArrowUp />
      </button>
    </form>
  );
}
