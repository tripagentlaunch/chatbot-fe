import { useMemo, useState } from "react";

// The trip handed over from the website, under Tara's message (2026-11-18; 2026-11-19: no pickers).
// A quiet record of what the member chose: each city, its days and the places picked, with a short reply
// card beneath for what the trip leaves open. Nothing is planned, and no model is called, until they send.

export type HandoffView = {
  trip: {
    name: string | null; totalDays: number; picks: number;
    legs: { city: string; name: string; days: number; picks: number; items?: string[] }[];
  };
  budget: string | null;
  origin?: string | null;
  missing: ("travellers" | "origin" | "when" | "budget")[];
  questions: Record<string, string>;
  tooLong?: boolean;
  maxDays?: number;
};

// The reply card (2026-11-19, direct request: answering must take seconds, and look like a private
// reservation card, never a form of buttons). Each open question is one labelled line with a short list
// to choose from; the starting city is filled in. Sending composes one plain sentence for Tara, the same
// as if they had typed it, so they can always just write instead.
const PARTY = ["Just me", "Two of us", "Three", "Four", "Five", "Six or more"];
const BUDGETS = ["Under ₹3 L", "₹3 L to ₹6 L", "₹6 L to ₹10 L", "₹10 L to ₹20 L", "Above ₹20 L", "No fixed budget"];

function nextMonths(n = 12): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 1; i <= n; i++) out.push(new Date(d.getFullYear(), d.getMonth() + i, 1).toLocaleString("en-GB", { month: "long", year: "numeric" }));
  return out;
}

function ReplyCard({ view, onSend, sendLabel }: { view: HandoffView; onSend: (text: string) => void; sendLabel: string }) {
  const months = useMemo(() => nextMonths(), []);
  const asks = new Set(view.missing);
  const [party, setParty] = useState("");
  const [when, setWhen] = useState("");
  const [budget, setBudget] = useState("");
  const [origin, setOrigin] = useState(view.origin ?? "");
  const ready = (!asks.has("travellers") || !!party) && (!asks.has("when") || !!when) && (!asks.has("budget") || !!budget) && !!origin.trim();

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    const who = !asks.has("travellers") ? "" : party === "Just me" ? "Just me" : party === "Two of us" ? "Two of us" : `${party} of us`;
    const bits = [who, asks.has("when") ? (when === "Flexible" ? "with flexible dates" : `in ${when}`) : "", `from ${origin.trim()}`].filter(Boolean);
    let text = bits.join(", ");
    if (asks.has("budget")) text += budget === "No fixed budget" ? ", with no fixed budget" : `, with a budget of ${budget} per person`;
    onSend(`${text.charAt(0).toUpperCase()}${text.slice(1)}. Please build the itinerary.`);
  }

  return (
    <form className="tc-reply" onSubmit={send} aria-label="Your answers">
      {asks.has("travellers") && (
        <label className="tc-reply__row">
          <span className="tc-reply__k">Travelling</span>
          <select className="tc-reply__v" value={party} onChange={(e) => setParty(e.target.value)} required>
            <option value="" disabled>Who's coming</option>
            {PARTY.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
      )}
      {asks.has("when") && (
        <label className="tc-reply__row">
          <span className="tc-reply__k">When</span>
          <select className="tc-reply__v" value={when} onChange={(e) => setWhen(e.target.value)} required>
            <option value="" disabled>Choose a month</option>
            <option>Flexible</option>
            {months.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
      )}
      {asks.has("budget") && (
        <label className="tc-reply__row">
          <span className="tc-reply__k">Budget <em>per person</em></span>
          <select className="tc-reply__v" value={budget} onChange={(e) => setBudget(e.target.value)} required>
            <option value="" disabled>Choose a range</option>
            {BUDGETS.map((b) => <option key={b}>{b}</option>)}
          </select>
          {view.budget && <span className="tc-reply__hint">The website's estimate for this trip: {view.budget}</span>}
        </label>
      )}
      <label className="tc-reply__row">
        <span className="tc-reply__k">From</span>
        <input className="tc-reply__v" value={origin} placeholder="Your city" onChange={(e) => setOrigin(e.target.value.slice(0, 60))} />
      </label>
      <button type="submit" className="tc-reply__send" disabled={!ready}>
        {sendLabel} <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}

export default function TripHandoffCard({ view, onSend, sendLabel = "Send" }: { view: HandoffView; onSend?: (text: string) => void; sendLabel?: string }) {
  const { trip } = view;
  return (
    <section className="tc-dossier" aria-label="Your trip">
      <header className="tc-dossier__head">
        <span className="tc-dossier__eyebrow">Your trip</span>
        <span className="tc-dossier__total">
          {trip.totalDays} {trip.totalDays === 1 ? "day" : "days"}
          {trip.legs.length > 1 ? ` · ${trip.legs.length} cities` : ""}
        </span>
      </header>
      <ol className="tc-dossier__legs">
        {trip.legs.map((l) => (
          <li key={l.city}>
            <div className="tc-dossier__line">
              <span className="tc-dossier__city">{l.name}</span>
              <span className="tc-dossier__days">{l.days} {l.days === 1 ? "day" : "days"}</span>
            </div>
            {l.items && l.items.length > 0 && <p className="tc-dossier__picks">{l.items.join(" · ")}</p>}
          </li>
        ))}
      </ol>
      {!view.tooLong && onSend && <ReplyCard view={view} onSend={onSend} sendLabel={sendLabel} />}
    </section>
  );
}
