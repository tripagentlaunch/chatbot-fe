import { useMemo, useState } from "react";

// The answers card under Tara's greeting when a trip is handed over from the website (2026-11-18).
// Only what the trip leaves open is asked (the backend says which: travellers, origin, when); the
// member taps or types, and the answers go to Tara as one ordinary message, so she builds the
// itinerary in that turn. They can always ignore the card and just type.

export type HandoffView = {
  trip: {
    name: string | null; totalDays: number; picks: number;
    legs: { city: string; name: string; days: number; picks: number; items?: string[] }[];
  };
  budget: string | null;
  missing: ("travellers" | "origin" | "when")[];
  questions: Record<string, string>;
  tooLong?: boolean;
  maxDays?: number;
};

const PARTY = [
  { label: "Just me", text: "just me" },
  { label: "Two of us", text: "two of us" },
  { label: "3 to 4", text: "three or four of us" },
  { label: "5 or more", text: "five or more of us" },
];
const FROM = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Kolkata", "Pune", "Dubai"];

function nextMonths(n = 12): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 1; i <= n; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() + i, 1);
    out.push(m.toLocaleString("en-GB", { month: "long", year: "numeric" }));
  }
  return out;
}

export default function TripHandoffCard({ view, onSend, disabled }: { view: HandoffView; onSend: (text: string) => void; disabled?: boolean }) {
  const months = useMemo(() => nextMonths(), []);
  const [party, setParty] = useState<string | null>(null);
  const [partyCount, setPartyCount] = useState("");
  const [origin, setOrigin] = useState("");
  const [when, setWhen] = useState<string | null>(null);
  const [budget, setBudget] = useState("");
  const [editBudget, setEditBudget] = useState(false);

  const asks = new Set(view.missing);
  const partyText = partyCount.trim() ? `${partyCount.trim()} of us` : party;
  const ready =
    (!asks.has("travellers") || !!partyText) && (!asks.has("origin") || !!origin.trim()) && (!asks.has("when") || !!when);

  function submit() {
    const bits: string[] = [];
    if (asks.has("travellers") && partyText) bits.push(partyText === "just me" ? "It's just me travelling" : `We're ${partyText} travelling`);
    if (asks.has("origin") && origin.trim()) bits.push(`from ${origin.trim()}`);
    if (asks.has("when") && when) bits.push(when === "Flexible" ? "and our dates are flexible" : `in ${when}`);
    let text = bits.join(", ").replace(/, and/, " and") + ".";
    if (editBudget && budget.trim()) text += ` Budget: ${budget.trim()}.`;
    else if (view.budget) text += " The budget you mentioned works.";
    text += " Please build the itinerary.";
    onSend(text.charAt(0).toUpperCase() + text.slice(1));
  }

  // Everything they picked on the website, so they see it arrived whole (2026-11-19). Nothing is built
  // until they press the button: no tokens are spent on a trip that's only being looked at.
  const summary = (
    <div className="tc-handoff__trip">
      <p className="tc-handoff__eyebrow">Your trip from TripAgent · {view.trip.totalDays} days</p>
      <ol className="tc-handoff__legs">
        {view.trip.legs.map((l) => (
          <li key={l.city}>
            <span className="tc-handoff__leg">{l.name}</span>
            <span className="tc-handoff__days">{l.days} {l.days === 1 ? "day" : "days"}</span>
            {l.items && l.items.length > 0 && <span className="tc-handoff__picks">{l.items.join(" · ")}</span>}
          </li>
        ))}
      </ol>
    </div>
  );

  if (view.tooLong) {
    return (
      <div className="tc-handoff" role="group" aria-label="Your trip">
        {summary}
        <p className="tc-handoff__note">
          Itineraries here go up to {view.maxDays ?? 15} days. Your TripAgent advisor plans longer trips with you directly: call or
          WhatsApp from the top of this chat, or shorten the trip on the website and send it again.
        </p>
      </div>
    );
  }

  return (
    <div className="tc-handoff" role="group" aria-label="Your trip details">
      {summary}
      {asks.has("travellers") && (
        <div className="tc-handoff__q">
          <p className="tc-handoff__label">{view.questions.travellers}</p>
          <div className="tc-handoff__opts">
            {PARTY.map((p) => (
              <button key={p.label} type="button" className={`tc-chip${party === p.text && !partyCount ? " is-on" : ""}`}
                onClick={() => { setParty(p.text); setPartyCount(""); }}>
                {p.label}
              </button>
            ))}
            <input className="tc-handoff__num" inputMode="numeric" placeholder="or a number" value={partyCount}
              onChange={(e) => setPartyCount(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))} aria-label="How many are travelling" />
          </div>
        </div>
      )}
      {asks.has("origin") && (
        <div className="tc-handoff__q">
          <p className="tc-handoff__label">{view.questions.origin}</p>
          <div className="tc-handoff__opts">
            {FROM.map((c) => (
              <button key={c} type="button" className={`tc-chip${origin === c ? " is-on" : ""}`} onClick={() => setOrigin(c)}>{c}</button>
            ))}
            <input className="tc-handoff__text" placeholder="Another city" value={FROM.includes(origin) ? "" : origin}
              onChange={(e) => setOrigin(e.target.value.slice(0, 60))} aria-label="City you start from" />
          </div>
        </div>
      )}
      {asks.has("when") && (
        <div className="tc-handoff__q">
          <p className="tc-handoff__label">{view.questions.when}</p>
          <div className="tc-handoff__opts tc-handoff__opts--scroll">
            {["Flexible", ...months].map((m) => (
              <button key={m} type="button" className={`tc-chip${when === m ? " is-on" : ""}`} onClick={() => setWhen(m)}>{m}</button>
            ))}
          </div>
        </div>
      )}
      {view.budget && (
        <div className="tc-handoff__q">
          <p className="tc-handoff__label">
            Budget: {view.budget}{" "}
            {!editBudget && <button type="button" className="tc-handoff__change" onClick={() => setEditBudget(true)}>Change</button>}
          </p>
          {editBudget && (
            <input className="tc-handoff__text tc-handoff__text--wide" placeholder="Your budget, e.g. ₹25 L per person" value={budget}
              onChange={(e) => setBudget(e.target.value.slice(0, 80))} autoFocus aria-label="Your budget" />
          )}
        </div>
      )}
      <div className="tc-handoff__act">
        <button type="button" className="tc-handoff__go" disabled={!ready || disabled} onClick={submit}>
          Build my itinerary
        </button>
        <span className="tc-handoff__hint">Starts when you tap it.</span>
      </div>
    </div>
  );
}
