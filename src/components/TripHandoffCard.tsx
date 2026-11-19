import { useMemo, useState } from "react";

// The trip handed over from the website, under Tara's greeting (2026-11-18; compact rows 2026-11-19).
// It shows everything the member picked, confirms what we already know (where they travel from, the
// budget) and asks only what the trip leaves open, one short row each. Nothing is built, and no model
// is called, until they tap Build my itinerary; their answers then go to Tara as one ordinary message.

export type HandoffView = {
  trip: {
    name: string | null; totalDays: number; picks: number;
    legs: { city: string; name: string; days: number; picks: number; items?: string[] }[];
  };
  budget: string | null;
  origin?: string | null;
  missing: ("travellers" | "origin" | "when")[];
  questions: Record<string, string>;
  tooLong?: boolean;
  maxDays?: number;
};

const PARTY = [
  { label: "1", text: "just me" },
  { label: "2", text: "two of us" },
  { label: "3–4", text: "three or four of us" },
  { label: "5+", text: "five or more of us" },
];

function nextMonths(n = 12): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 1; i <= n; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() + i, 1);
    out.push(m.toLocaleString("en-GB", { month: "long", year: "numeric" }));
  }
  return out;
}

export default function TripHandoffCard({ view, onSend, disabled }: { view: HandoffView; onSend: (text: string) => void; disabled?: boolean }) {
  const months = useMemo(() => nextMonths(), []);
  const asks = new Set(view.missing);
  const [party, setParty] = useState<string | null>(null);
  const [origin, setOrigin] = useState(view.origin ?? "");
  const [editOrigin, setEditOrigin] = useState(!view.origin);
  const [when, setWhen] = useState("");
  const [budget, setBudget] = useState("");
  const [editBudget, setEditBudget] = useState(false);

  const ready = (!asks.has("travellers") || !!party) && !!origin.trim() && (!asks.has("when") || !!when);

  function submit() {
    const bits: string[] = [];
    if (asks.has("travellers") && party) bits.push(party === "just me" ? "It's just me travelling" : `We're ${party} travelling`);
    if (origin.trim()) bits.push(`from ${origin.trim()}`);
    if (asks.has("when") && when) bits.push(when === "Flexible" ? "and our dates are flexible" : `in ${when}`);
    let text = bits.join(", ").replace(/, and/, " and") + ".";
    if (editBudget && budget.trim()) text += ` Budget: ${budget.trim()}.`;
    else if (view.budget) text += " The budget you mentioned works.";
    text += " Please build the itinerary.";
    onSend(text.charAt(0).toUpperCase() + text.slice(1));
  }

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
      <div className="tc-handoff__rows">
        {asks.has("travellers") && (
          <div className="tc-handoff__row">
            <span className="tc-handoff__k" id="hk-party">Travellers</span>
            <div className="tc-handoff__seg" role="radiogroup" aria-labelledby="hk-party">
              {PARTY.map((p) => (
                <button key={p.label} type="button" role="radio" aria-checked={party === p.text}
                  className={party === p.text ? "is-on" : ""} onClick={() => setParty(p.text)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="tc-handoff__row">
          <span className="tc-handoff__k">From</span>
          {editOrigin ? (
            <input className="tc-handoff__text" placeholder="Your city" value={origin} autoFocus={!!view.origin}
              onChange={(e) => setOrigin(e.target.value.slice(0, 60))} aria-label="City you travel from" />
          ) : (
            <span className="tc-handoff__v">
              {origin}
              <button type="button" className="tc-handoff__change" onClick={() => setEditOrigin(true)}>Change</button>
            </span>
          )}
        </div>
        {asks.has("when") && (
          <div className="tc-handoff__row">
            <label className="tc-handoff__k" htmlFor="hk-when">When</label>
            <select id="hk-when" className="tc-handoff__select" value={when} onChange={(e) => setWhen(e.target.value)}>
              <option value="" disabled>Choose a month</option>
              <option value="Flexible">Flexible</option>
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}
        {view.budget && (
          <div className="tc-handoff__row">
            <span className="tc-handoff__k">Budget</span>
            {editBudget ? (
              <input className="tc-handoff__text" placeholder="e.g. ₹25 L per person" value={budget} autoFocus
                onChange={(e) => setBudget(e.target.value.slice(0, 80))} aria-label="Your budget" />
            ) : (
              <span className="tc-handoff__v">
                {view.budget}
                <button type="button" className="tc-handoff__change" onClick={() => setEditBudget(true)}>Change</button>
              </span>
            )}
          </div>
        )}
      </div>
      <div className="tc-handoff__act">
        <button type="button" className="tc-handoff__go" disabled={!ready || disabled} onClick={submit}>
          Build my itinerary
        </button>
        <span className="tc-handoff__hint">Starts when you tap it.</span>
      </div>
    </div>
  );
}
