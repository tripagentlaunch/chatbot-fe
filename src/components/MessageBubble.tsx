import type { ReactNode } from "react";

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

export default function MessageBubble({ role, text, failed, streaming }: Props) {
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
