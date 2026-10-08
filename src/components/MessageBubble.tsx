interface Props {
  role: "user" | "assistant";
  text: string;
}

export default function MessageBubble({ role, text }: Props) {
  const isUrl = /^https?:\/\/\S+$/.test(text.trim());
  return (
    <div className={`bubble bubble-${role}`}>
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
