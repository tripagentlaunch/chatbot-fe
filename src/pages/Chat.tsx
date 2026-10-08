import { useEffect, useRef, useState } from "react";
import ChatInput from "../components/ChatInput";
import MessageBubble from "../components/MessageBubble";
import { api, ApiError, streamChat } from "../api/client";
import type { HistoryMessage } from "../types";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [pending, setPending] = useState("");
  const [activity, setActivity] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chatId, setChatId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get<{ messages: HistoryMessage[] }>("/api/history")
      .then((res) =>
        setMessages(
          res.messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m, i) => ({ id: m.id ?? `h-${i}`, role: m.role as "user" | "assistant", text: m.content })),
        ),
      )
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  async function send(text: string) {
    setError(null);
    setBusy(true);
    setPending("");
    setActivity(null);
    const userMsg: DisplayMessage = { id: `u-${Date.now()}`, role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    try {
      await streamChat(text, chatId, (event) => {
        if (event.type === "text") {
          setPending((prev) => prev + (event.delta as string));
        } else if (event.type === "tool") {
          setActivity(`Using ${event.name as string}...`);
        } else if (event.type === "done") {
          const replies = (event.messages as string[]) ?? [];
          setMessages((prev) => [
            ...prev,
            ...replies.map((r, i) => ({ id: `a-${Date.now()}-${i}`, role: "assistant" as const, text: r })),
          ]);
          if (typeof event.chatId === "string") setChatId(event.chatId);
          setPending("");
          setActivity(null);
        } else if (event.type === "error") {
          setError((event.message as string) ?? "Something went wrong.");
        }
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
      setPending("");
      setActivity(null);
    }
  }

  return (
    <div className="chat-screen">
      <div className="chat-history">
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} text={m.text} />
        ))}
        {pending && <MessageBubble role="assistant" text={pending} />}
        {activity && <p className="activity">{activity}</p>}
        {error && <p className="error">{error}</p>}
        <div ref={bottomRef} />
      </div>
      <ChatInput disabled={busy} onSend={send} />
    </div>
  );
}
