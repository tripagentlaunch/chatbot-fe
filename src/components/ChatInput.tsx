import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Close, Mic, Paperclip, Waveform } from "../design/icons";
import type { ChatAttachment } from "../api/client";
import { useAssistantName } from "../context/AuthContext";

// Upstream (chatbot-fe/dev): a textarea and a Send button, with its own text state.
// Ours adds: a text value the page can set (suggestions, links from other screens),
// dictation where the browser supports it, and the composer design.
interface Props {
  disabled?: boolean;
  /** `files`: what the member attached (photos, PDFs, text) — Tara reads them with the message. */
  onSend: (message: string, files: ChatAttachment[]) => void;
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

/* ---- attachments: same limits as chatbot-be/app/services/uploads.py ---- */
const MAX_FILES = 4;
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/csv,.pdf,.txt,.csv";
const KINDS = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain", "text/csv"]);

function readFile(file: File): Promise<ChatAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? "");
      resolve({ name: file.name, mediaType: file.type || "application/octet-stream", data: url.slice(url.indexOf(",") + 1) });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function ChatInput({ disabled, onSend, value: controlled, onChange }: Props) {
  const assistant = useAssistantName();
  const [inner, setInner] = useState("");
  const value = controlled ?? inner;
  const setValue = (v: string) => (onChange ? onChange(v) : setInner(v));

  const [files, setFiles] = useState<ChatAttachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // the same file can be picked again after removing it
    setFileError(null);
    const room = MAX_FILES - files.length;
    if (picked.length > room) setFileError(`Attach up to ${MAX_FILES} files at a time.`);
    const added: ChatAttachment[] = [];
    for (const file of picked.slice(0, Math.max(0, room))) {
      if (!KINDS.has(file.type)) {
        setFileError(`${file.name}: ${assistant} can read photos, PDFs and text files.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setFileError(`${file.name} is larger than 8 MB.`);
        continue;
      }
      try {
        added.push(await readFile(file));
      } catch {
        setFileError(`${file.name} could not be read.`);
      }
    }
    if (added.length) setFiles((prev) => [...prev, ...added]);
  }

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
    if ((!trimmed && !files.length) || disabled) return;
    onSend(trimmed, files);
    setValue("");
    setFiles([]);
    setFileError(null);
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
    <div className="tc-composer-wrap">
    {(files.length > 0 || fileError) && (
      <div className="tc-files" aria-live="polite">
        {files.map((f, i) => (
          <span className="tc-file" key={`${f.name}-${i}`}>
            <span className="tc-file__name" title={f.name}>{f.name}</span>
            <button
              type="button"
              className="tc-file__remove"
              aria-label={`Remove ${f.name}`}
              onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
            >
              <Close size={14} />
            </button>
          </span>
        ))}
        {fileError && <span className="tc-file-error" role="alert">{fileError}</span>}
      </div>
    )}
    <form className="tc-composer" onSubmit={onSubmit}>
      <input ref={picker} type="file" accept={ACCEPT} multiple hidden onChange={onPick} />
      <button
        type="button"
        className="tc-composer__btn tc-composer__btn--ghost"
        aria-label="Attach photos or documents"
        title="Attach photos or documents"
        disabled={disabled || files.length >= MAX_FILES}
        onClick={() => picker.current?.click()}
      >
        <Paperclip />
      </button>
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
        placeholder={`Ask ${assistant}…`}
        aria-label={`Ask ${assistant}`}
        rows={1}
        disabled={disabled}
      />
      <button
        type="submit"
        className="tc-composer__btn"
        aria-label="Send"
        disabled={disabled || (!value.trim() && !files.length)}
      >
        <ArrowUp />
      </button>
    </form>
    </div>
  );
}
