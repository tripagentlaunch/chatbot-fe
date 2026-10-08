import { Fragment, useEffect, useRef, useState } from "react";
import ChatInput from "../components/ChatInput";
import MessageBubble from "../components/MessageBubble";
import { api, ApiError, streamChat } from "../api/client";
import type { HistoryMessage } from "../types";
import MeshBackdrop from "../design/MeshBackdrop";
import { ArrowUpRight, ChevronLeft, Horizon, Phone, WhatsApp } from "../design/icons";
import "../design/chat.css";

/** Human desk contact. Copied to clipboard + dialled from the header. */
const HUMAN_AGENT_NUMBER = "8451871851";
/** Same line in international form for the WhatsApp deep link (India +91). */
const WHATSAPP_INTL = "918451871851";

/*
 * chatbot-fe's chat page (chatbot-fe/dev), with the Tara design and a few extras on top.
 *
 * Kept from upstream: loading the member's history, streaming a reply from /api/chat/stream
 * (text, tool and done events), and keeping the chat id between turns.
 *
 * Added here: the screen design (mesh background, frosted header, bubbles, composer), a retry
 * for a reply that failed, the name "Tara" once above a run of replies, day dividers, a row of
 * suggestions, and a way for the host to open the chat with a line sent or typed for the member.
 * Everything that is specific to a host app comes in through props, so this page still works
 * on its own with no props at all.
 */

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: number;
  failed?: boolean;
}

/** Drafts stay in this member's conversation and invite comparison, not booking. */
const SUGGESTIONS = [
  { label: "Compare stays", prompt: "Help me compare places to stay for the trip we are discussing. Suggest a few options and explain which suits me best." },
  { label: "Flights & routes", prompt: "Help me compare flight and route options for this trip, including travel time and convenience. Ask me for any missing dates or departure details." },
  { label: "Experiences", prompt: "Suggest a few experiences for this trip that fit my interests and pace. Help me choose between them." },
  { label: "Budget & dates", prompt: "Help me weigh the dates and budget for this trip. Compare the trade-offs and tell me what details you need from me." },
] as const;

const FAILED_TEXT = "Tara could not finish a reply. Your message is kept here; try again.";

interface Props {
  /** First name, for the greeting. */
  memberName?: string;
  /** Shows a back button in the header. */
  onBack?: () => void;
  /** Shows a call button in the header. */
  onCall?: () => void;
  /** Called when the server says the sign-in is over (401). */
  onAuthError?: () => void;
  /** A line to send, or to leave in the box for the member, when the chat opens. */
  seed?: { send?: string; draft?: string } | null;
}

const startOfDay = (at: number) => new Date(at).setHours(0, 0, 0, 0);
function dayLabel(at: number): string {
  const days = Math.round((startOfDay(Date.now()) - startOfDay(at)) / 86_400_000);
  const clock = new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  if (days === 0) return `Today, ${clock}`;
  if (days === 1) return `Yesterday, ${clock}`;
  return `${new Date(at).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}, ${clock}`;
}
const toMs = (at?: number) => (at ? (at < 1e12 ? at * 1000 : at) : Date.now());
function timeOfDay(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Chat({ memberName, onBack, onCall, onAuthError, seed }: Props = {}) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [pending, setPending] = useState("");
  const [activity, setActivity] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chatId, setChatId] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [capped, setCapped] = useState<string | null>(null);
  const [agentNote, setAgentNote] = useState<string | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const lastSent = useRef("");
  const seeded = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get<{ messages: HistoryMessage[] }>("/api/history")
      .then((res) =>
        setMessages(
          res.messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m, i) => ({
              id: m.id ?? `h-${i}`,
              role: m.role as "user" | "assistant",
              text: m.content,
              at: toMs(m.at),
            })),
        ),
      )
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) onAuthError?.();
      })
      .finally(() => setHistoryReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending, activity]);

  /** `resend`: the member's line is already in the thread, so repeat the turn, not the bubble. */
  async function send(text: string, resend = false) {
    setBusy(true);
    setPending("");
    setActivity(null);
    lastSent.current = text;
    if (resend) {
      setMessages((prev) => prev.filter((m) => !m.failed));
    } else {
      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text, at: Date.now() }]);
    }
    const fail = (message?: string) =>
      setMessages((prev) => [
        ...prev.filter((m) => !m.failed),
        { id: `f-${Date.now()}`, role: "assistant", text: message || FAILED_TEXT, at: Date.now(), failed: true },
      ]);
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
            ...replies.map((r, i) => ({ id: `a-${Date.now()}-${i}`, role: "assistant" as const, text: r, at: Date.now() })),
          ]);
          if (typeof event.chatId === "string") setChatId(event.chatId);
          setPending("");
          setActivity(null);
        } else if (event.type === "error") {
          fail();
        }
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onAuthError?.();
        fail();
      } else if (err instanceof ApiError && err.status === 402) {
        // Spend cap reached: close the chat. Show the server's message as a
        // final reply (not a retryable failure) and lock the composer.
        setCapped(err.message);
        setMessages((prev) => [
          ...prev.filter((m) => !m.failed),
          { id: `cap-${Date.now()}`, role: "assistant", text: err.message, at: Date.now() },
        ]);
      } else if (err instanceof ApiError && err.status === 429) {
        // Rate limit / daily cap: show the server's own message, still retryable.
        fail(err.message);
      } else {
        fail();
      }
    } finally {
      setBusy(false);
      setPending("");
      setActivity(null);
    }
  }

  // The host can open the chat with a line to send, or one left in the box. Once, after history.
  useEffect(() => {
    if (!historyReady || seeded.current || !seed) return;
    if (seed.send) {
      seeded.current = true;
      void send(seed.send);
    } else if (seed.draft) {
      seeded.current = true;
      setDraft(seed.draft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyReady, seed]);

  function talkToHuman() {
    navigator.clipboard?.writeText(HUMAN_AGENT_NUMBER).catch(() => {});
    setAgentNote(`${HUMAN_AGENT_NUMBER} copied — connecting you to a human agent…`);
    window.setTimeout(() => setAgentNote(null), 3500);
    window.location.href = `tel:${HUMAN_AGENT_NUMBER}`;
  }

  const hasReply = messages.some((m) => m.role === "assistant" && !m.failed);
  const lastIsFailed = messages.length > 0 && messages[messages.length - 1].failed === true;
  const empty = historyReady && messages.length === 0 && !busy;
  let lastDay = 0;

  return (
    <div className="tc-root">
      <MeshBackdrop />

      <header className="tc-header">
        <span className="tc-header__glass" aria-hidden="true" />
        {onBack ? (
          <button type="button" className="tc-iconbtn" aria-label="Back" onClick={onBack}>
            <ChevronLeft />
          </button>
        ) : (
          <a
            className="tc-iconbtn"
            href={`https://wa.me/${WHATSAPP_INTL}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat on WhatsApp"
            title="Chat on WhatsApp"
          >
            <WhatsApp />
          </a>
        )}
        <div className="tc-header__title">
          <span className="tc-title">
            Tara <span className="tc-badge">AI</span>
          </span>
          <div className="tc-status">
            <i aria-hidden="true" />
            Here
          </div>
        </div>
        {onCall ? (
          <button type="button" className="tc-iconbtn" aria-label="Speak to the Desk" onClick={onCall}>
            <Phone />
          </button>
        ) : (
          <button
            type="button"
            className="tc-iconbtn"
            aria-label="Talk to a human agent"
            title="Talk to a human agent"
            onClick={talkToHuman}
          >
            <Phone />
          </button>
        )}
      </header>

      {agentNote && (
        <p className="tc-toast" role="status">{agentNote}</p>
      )}

      <div className="tc-scroll">
        {empty && (
          <section className="tc-hello" aria-label="Greeting">
            <h1>
              {timeOfDay()}
              {memberName ? (
                <>
                  ,
                  <br />
                  <em>{memberName}.</em>
                </>
              ) : (
                "."
              )}
            </h1>
            <p>Where shall we begin?</p>
          </section>
        )}

        {messages.map((m, i) => {
          const day = startOfDay(m.at);
          const divider = day !== lastDay;
          lastDay = day;
          // Tara is named once, above the first bubble of a run of replies.
          const firstOfRun = m.role === "assistant" && (divider || messages[i - 1]?.role !== "assistant");
          return (
            <Fragment key={m.id}>
              {divider && <p className="tc-divider">{dayLabel(m.at)}</p>}
              <div className={`tc-row ${m.role === "user" ? "tc-row--member" : ""}`}>
                {firstOfRun && (
                  <p className="tc-label">
                    <Horizon />
                    Tara
                  </p>
                )}
                <MessageBubble role={m.role} text={m.text} failed={m.failed} />
                {m.failed && lastIsFailed && !busy && (
                  <button type="button" className="tc-link" onClick={() => send(lastSent.current, true)}>
                    Try that again
                  </button>
                )}
              </div>
            </Fragment>
          );
        })}

        {(pending || busy) && (
          <div className="tc-row">
            {messages[messages.length - 1]?.role !== "assistant" && (
              <p className="tc-label">
                <Horizon />
                Tara
              </p>
            )}
            {pending && <MessageBubble role="assistant" text={pending} streaming />}
            {activity && <p className="tc-activity">{activity}</p>}
          </div>
        )}

        {!busy && !capped && (hasReply || empty) && (
          <div className="tc-chips-wrap">
            <p className="tc-chips-label">Explore with Tara</p>
            <div className="tc-chips">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="tc-chip"
                  onClick={() => setDraft((d) => (d.trim() ? `${d.trim()} ${s.prompt}` : s.prompt))}
                >
                  {s.label}
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="tc-dock">
        {capped ? (
          <p className="tc-capped" role="status">{capped}</p>
        ) : (
          <ChatInput disabled={busy} onSend={(t) => send(t)} value={draft} onChange={setDraft} />
        )}
      </div>
    </div>
  );
}
