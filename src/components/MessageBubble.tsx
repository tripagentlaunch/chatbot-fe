import type { ReactNode } from "react";
import ItineraryCard from "./ItineraryCard";

// Upstream (chatbot-fe/dev): a div with role classes, and a link when the whole message is a URL.
// Ours: the same, wearing the Tara design (white for the member, frosted glass for Tara).
// Links inside a message are clickable too — Tara sends the itinerary link inside a
// sentence ("Here is your London itinerary: https://…/trips/…"), sometimes as a
// markdown [label](url).
interface Props {
  role: "user" | "assistant";
  text: string;
  /** A reply that did not complete: shown in amber. */
  failed?: boolean;
  /** A reply still arriving: shows a caret. */
  streaming?: boolean;
}

const LINK_RE = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"]+)/g;
// Punctuation that ends a sentence, not the URL ("…/trips/abc." or "(…/trips/abc)").
const TRAILING_RE = /[.,;:!?'")\]*_]+$/;

function linkify(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const start = m.index ?? 0;
    let href = m[2] ?? m[3];
    let label = m[1] ?? href;
    let tail = "";
    if (!m[2]) {
      tail = href.match(TRAILING_RE)?.[0] ?? "";
      href = href.slice(0, href.length - tail.length);
      label = href;
    }
    if (start > last) out.push(text.slice(last, start));
    out.push(
      <a key={start} href={href} target="_blank" rel="noreferrer">
        {label}
      </a>,
    );
    if (tail) out.push(tail);
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// An itinerary proposal link: .../trips/<key>. In a finished reply from Tara it becomes a rich card
// (ItineraryCard), shown under the sentence it came in, instead of a bare URL.
const TRIP_PATH_RE = /^\/trips\/([A-Za-z0-9_-]+)\/?$/;

function tripKeyOf(href: string): string | null {
  try {
    return TRIP_PATH_RE.exec(new URL(href).pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** The message without its itinerary links, and the trip keys those links pointed at (in order, once each). */
function pullItineraryLinks(text: string): { rest: string; keys: string[] } {
  const keys: string[] = [];
  let rest = "";
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const start = m.index ?? 0;
    let href = m[2] ?? m[3];
    let tail = "";
    if (!m[2]) {
      tail = href.match(TRAILING_RE)?.[0] ?? "";
      href = href.slice(0, href.length - tail.length);
    }
    const key = tripKeyOf(href);
    if (!key) continue;
    if (!keys.includes(key)) keys.push(key);
    rest += text.slice(last, start) + tail;
    last = start + m[0].length;
  }
  rest += text.slice(last);
  return { rest: rest.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(), keys };
}

export default function MessageBubble({ role, text, failed, streaming }: Props) {
  if (role === "assistant" && !streaming && !failed) {
    const { rest, keys } = pullItineraryLinks(text);
    if (keys.length) {
      return (
        <>
          {rest && <div className="tc-msg tc-msg--tara">{linkify(rest)}</div>}
          {keys.map((k) => (
            <ItineraryCard key={k} tripKey={k} />
          ))}
        </>
      );
    }
  }
  const cls = [
    "tc-msg",
    role === "user" ? "tc-msg--member" : "tc-msg--tara",
    failed ? "tc-msg--failed" : "",
    streaming ? "tc-caret" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return <div className={cls}>{linkify(text)}</div>;
}
