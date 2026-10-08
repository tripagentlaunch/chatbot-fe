// Upstream (chatbot-fe/dev): a div with role classes, and a link when the whole message is a URL.
// Ours: the same, wearing the Tara design (white for the member, frosted glass for Tara).
interface Props {
  role: "user" | "assistant";
  text: string;
  /** A reply that did not complete: shown in amber. */
  failed?: boolean;
  /** A reply still arriving: shows a caret. */
  streaming?: boolean;
}

export default function MessageBubble({ role, text, failed, streaming }: Props) {
  const isUrl = /^https?:\/\/\S+$/.test(text.trim());
  const cls = [
    "tc-msg",
    role === "user" ? "tc-msg--member" : "tc-msg--tara",
    failed ? "tc-msg--failed" : "",
    streaming ? "tc-caret" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls}>
      {isUrl ? (
        <a href={text} target="_blank" rel="noreferrer">
          {text}
        </a>
      ) : (
        text
      )}
    </div>
  );
}
