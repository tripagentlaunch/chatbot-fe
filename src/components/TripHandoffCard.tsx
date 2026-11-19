// The trip handed over from the website, under Tara's message (2026-11-18; 2026-11-19: no pickers).
// A quiet record of what the member chose: each city, its days and the places picked. Tara asks what
// the trip leaves open in her message above, and the member replies in their own words; nothing is
// planned, and no model is called, until they do.

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

export default function TripHandoffCard({ view }: { view: HandoffView }) {
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
      {(view.origin || view.budget) && !view.tooLong && (
        <p className="tc-dossier__foot">
          {[view.origin ? `From ${view.origin}` : null, view.budget ? `Around ${view.budget}` : null].filter(Boolean).join(" · ")}
        </p>
      )}
    </section>
  );
}
