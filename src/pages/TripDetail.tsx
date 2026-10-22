import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import "../design/itinerary.css";

// The itinerary page, in the design of london-itinerary-preview.html (the
// admin panel's Proposal Preview): a photo hero, then Plan / Days /
// Decisions tabs. Everything shown comes from the saved plan; a section
// with no data behind it is left out rather than filled in.

interface KV {
  k: string;
  v: string;
}
interface Row {
  t: string;
  m?: string;
  d?: string;
  highlights?: string[];
}
interface DayRow extends Row {
  date?: string;
  place?: string;
}
interface BookRow extends Row {
  due?: string;
}
interface Note {
  t: string;
  b: string;
}
interface FlightLeg {
  depTime?: string;
  depCity: string;
  arrTime?: string;
  arrCity: string;
  flightNos?: string;
  duration?: string;
  cabin?: string;
}
interface Photo {
  url: string;
}
interface Choice {
  name: string;
  details: string;
  price: string;
  source?: string;
  photo?: Photo;
  photos?: Photo[];
  flight?: FlightLeg;
}
interface ChoiceGroup {
  label: string;
  rateSearch?: { checkIn: string; checkOut: string };
  recommended: Choice;
  alternatives: Choice[];
}
interface TripPlan {
  kind?: "trip";
  title: string;
  sub: string;
  lede: string;
  asof?: string;
  visa?: { status: string; note: string };
  shape: KV[];
  shapeNote?: Note;
  stay: Row[];
  hotelOptions?: ChoiceGroup[];
  move: Row[];
  flightOptions?: ChoiceGroup[];
  allowance: KV[];
  days: DayRow[];
  daysNote?: Note;
  bookOrder?: BookRow[];
  gate: Note;
  decisions: Row[];
  bookingActions?: { title: string; points: string[] }[];
  why?: string[];
}
interface Option {
  name: string;
  price: string;
  oneLine: string;
  summary: string;
  lede: string;
  catch: string;
  facts: KV[];
  tradeoffs?: string[];
  allin: string;
  flightOptions?: ChoiceGroup[];
  hotelOptions?: ChoiceGroup[];
}
interface Comparison {
  kind: "compare";
  title: string;
  sub: string;
  lede: string;
  options: Option[];
  method: string;
  asof?: string;
}
interface PlanResponse {
  plan: TripPlan | Comparison;
  status: string;
}

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 640px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setMobile(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}

function photoOf(c: Choice): string | undefined {
  return c.photo?.url || c.photos?.[0]?.url;
}

function hideBrokenImage(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = "none";
}

function fmtDate(iso: string | undefined, opts: Intl.DateTimeFormatOptions): string | null {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString("en-GB", opts);
}

function nightsBetween(a: string, b: string): number | null {
  const n = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
  return n > 0 ? n : null;
}

/** Tabs with the sliding pill behind the active one. */
function Tabs({ tabs, active, onPick, sub }: { tabs: string[]; active: string; onPick: (t: string) => void; sub?: boolean }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const place = () => {
      const el = refs.current[active];
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [active, tabs.length]);
  return (
    <>
      <span className="pv-tab-indicator" style={{ transform: `translateX(${pill.left}px)`, width: pill.width }} />
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          ref={(el) => {
            refs.current[t] = el;
          }}
          className={"pv-tab" + (active === t ? " is-active" : "")}
          onClick={() => onPick(t)}
          aria-pressed={sub ? active === t : undefined}
        >
          {t}
        </button>
      ))}
    </>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="pv-chip pv-chip--choice">
      {label === "Our choice" ? (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8L6 21l1.6-7L2.2 9.2l7.1-.6z" />
        </svg>
      ) : null}
      {label}
    </span>
  );
}

function OptionName({ c, block }: { c: Choice; block?: boolean }) {
  const cls = "pv-option-name" + (block ? " pv-option-name--block" : "");
  return c.source ? (
    <a className={cls} href={c.source} target="_blank" rel="noreferrer">
      {c.name}
    </a>
  ) : (
    <span className={cls}>{c.name}</span>
  );
}

function FlightRow({ c, badge }: { c: Choice; badge: string }) {
  const f = c.flight;
  return (
    <div className="pv-recflight">
      <div className="pv-recflight-head">
        <OptionName c={c} />
        <Chip label={badge} />
      </div>
      {f ? (
        <div className="pv-recflight-row">
          <div>
            <div className="pv-recflight-time">{f.depTime || "TBC"}</div>
            <div className="pv-recflight-city">{f.depCity}</div>
          </div>
          <div className="pv-recflight-mid">
            {f.flightNos ? <div className="pv-recflight-nos">{f.flightNos}</div> : null}
            <div className="pv-recflight-line" />
            <div className="pv-recflight-sub">{[f.duration, f.cabin].filter(Boolean).join(" · ")}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="pv-recflight-time">{f.arrTime || "TBC"}</div>
            <div className="pv-recflight-city">{f.arrCity}</div>
          </div>
        </div>
      ) : null}
      <div className="pv-recflight-foot">
        <span>{c.details}</span>
        <span className="pv-option-price">{c.price}</span>
      </div>
    </div>
  );
}

function StayCard({ c, badge }: { c: Choice; badge: string }) {
  const img = photoOf(c);
  return (
    <div className="pv-recstay-stacked">
      <div className="pv-recstay-stacked-media">
        {img ? <img className="pv-recstay-stacked-photo" src={img} alt="" onError={hideBrokenImage} /> : null}
        <div className={img ? "pv-recstay-chip-overlay" : ""} style={img ? undefined : { padding: "16px 16px 0" }}>
          <Chip label={badge} />
        </div>
      </div>
      <div className="pv-recstay-stacked-body">
        <OptionName c={c} block />
        <div className="pv-option-detail" style={{ marginTop: 8 }}>
          {c.details}
        </div>
        <div className="pv-option-price pv-option-price--hotel" style={{ marginTop: 10 }}>
          {c.price}
        </div>
      </div>
    </div>
  );
}

function AltOption({ c, hotel, onSwap }: { c: Choice; hotel: boolean; onSwap: () => void }) {
  const img = hotel ? photoOf(c) : undefined;
  return (
    <div className="pv-option">
      {img ? <img className="pv-option-thumb" src={img} alt="" onError={hideBrokenImage} /> : null}
      <div className="pv-option-body">
        <OptionName c={c} block />
        {c.flight ? (
          <div className="pv-option-timing">
            {c.flight.depTime || "TBC"} – {c.flight.arrTime || "TBC"}
          </div>
        ) : null}
        <div className="pv-option-detail">{c.details}</div>
      </div>
      <div className="pv-option-side">
        <div className="pv-option-price">{c.price}</div>
        <button type="button" className="pv-swap-btn" onClick={onSwap}>
          Swap
        </button>
      </div>
    </div>
  );
}

/** "Our choice" plus its alternatives, with Swap — the template's recommendation group. */
function ChoiceGroupView({ group, hotel }: { group: ChoiceGroup; hotel: boolean }) {
  const mobile = useIsMobile();
  const [selected, setSelected] = useState(0);
  const options = [group.recommended, ...(group.alternatives || [])];
  const chosen = options[selected] || group.recommended;
  const badge = selected === 0 ? "Our choice" : "Selected";
  const alts = options.map((c, i) =>
    i === selected ? null : <AltOption key={i} c={c} hotel={hotel} onSwap={() => setSelected(i)} />
  );
  const hasAlts = options.length > 1;

  let head: ReactNode;
  if (hotel) {
    const r = group.rateSearch;
    const nights = r ? nightsBetween(r.checkIn, r.checkOut) : null;
    head = (
      <div className="pv-recgroup-head">
        <span className="pv-recgroup-title">{group.label}</span>
        {nights ? <span className="pv-recgroup-sub">{`${nights} night${nights === 1 ? "" : "s"}`}</span> : null}
      </div>
    );
  } else {
    const f = group.recommended.flight;
    head = (
      <div className="pv-recgroup-head pv-recgroup-head--flight">
        <span className="pv-recgroup-title">{f ? `${f.depCity} → ${f.arrCity}` : group.label}</span>
        {f ? <span className="pv-recgroup-eyebrow">{group.label}</span> : null}
      </div>
    );
  }

  const card = hotel ? <StayCard c={chosen} badge={badge} /> : <FlightRow c={chosen} badge={badge} />;
  let body: ReactNode;
  if (hotel && hasAlts && !mobile) {
    body = (
      <div className="pv-recgroup-split">
        <div className="pv-recgroup-split-col">{card}</div>
        <div className="pv-recgroup-split-col">
          <div className="pv-recgroup-eyebrow" style={{ marginBottom: 10 }}>
            Alternatives
          </div>
          <div className="pv-alt-stack">{alts}</div>
        </div>
      </div>
    );
  } else {
    body = (
      <>
        {card}
        {hasAlts ? (
          <details className="pv-otheroptions">
            <summary>Other options</summary>
            <div className="pv-alt-grid">{alts}</div>
          </details>
        ) : null}
      </>
    );
  }
  return (
    <div className="pv-recgroup">
      {head}
      {body}
    </div>
  );
}

/** Plain rows (no live options) in the template's numbered-list style. */
function RowList({ rows }: { rows: Row[] }) {
  return (
    <div className="pv-days">
      {rows.map((r, i) => (
        <div className="pv-day" key={i}>
          <div className="pv-day-num">{i + 1}</div>
          <div>
            <div className="pv-day-head">{r.t}</div>
            {r.m ? <div className="pv-day-body">{r.m}</div> : null}
            {r.d ? <div className="pv-day-body">{r.d}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function DefList({ rows }: { rows: KV[] }) {
  return (
    <div className="pv-deflist">
      {rows.map((r, i) => (
        <div className="pv-defrow" key={i}>
          <span className="pv-deflabel">{r.k}</span>
          <span className="pv-defvalue">{r.v}</span>
        </div>
      ))}
    </div>
  );
}

function CostTable({ rows }: { rows: KV[] }) {
  return (
    <div className="pv-costtable">
      {rows.map((r, i) => (
        <div className={"pv-costrow" + (/total/i.test(r.k) ? " pv-costrow--total" : "")} key={i}>
          <span>{r.k}</span>
          <span>{r.v}</span>
        </div>
      ))}
    </div>
  );
}

function Callout({ note }: { note: Note }) {
  return (
    <div className="pv-callout">
      <strong>{note.t}</strong>
      {note.b}
    </div>
  );
}

function PlanTab({ plan, onDays }: { plan: TripPlan; onDays: () => void }) {
  const flights = plan.flightOptions || [];
  const hotels = plan.hotelOptions || [];
  return (
    <>
      <h2 className="pv-section-title">The shape</h2>
      <DefList rows={plan.shape} />
      {plan.shapeNote ? (
        <div style={{ marginTop: 16 }}>
          <Callout note={plan.shapeNote} />
        </div>
      ) : null}

      {flights.length || plan.move.length ? <h2 className="pv-section-title">Getting there</h2> : null}
      {flights.length ? flights.map((g, i) => <ChoiceGroupView key={i} group={g} hotel={false} />) : <RowList rows={plan.move} />}

      {hotels.length || plan.stay.length ? <h2 className="pv-section-title">Where you stay</h2> : null}
      {hotels.length ? hotels.map((g, i) => <ChoiceGroupView key={i} group={g} hotel />) : <RowList rows={plan.stay} />}

      {plan.allowance.length ? (
        <>
          <h2 className="pv-section-title">What it costs</h2>
          <CostTable rows={plan.allowance} />
        </>
      ) : null}

      {plan.days.length ? (
        <button type="button" className="pv-cta" onClick={onDays}>
          See the day-by-day plan
        </button>
      ) : null}
    </>
  );
}

function DaysTab({ plan }: { plan: TripPlan }) {
  const [sub, setSub] = useState("All days");
  const trackRef = useRef<HTMLDivElement | null>(null);
  const subTabs = ["All days", ...plan.days.map((_, i) => `Day ${i + 1}`)];
  const shown = sub === "All days" ? plan.days.map((d, i) => [d, i] as const) : [[plan.days[subTabs.indexOf(sub) - 1], subTabs.indexOf(sub) - 1] as const];
  const bookOrder = plan.bookOrder || [];
  return (
    <>
      <h2 className="pv-section-title">{plan.days.length === 1 ? "One day, paced" : `${plan.days.length} days, paced`}</h2>
      {plan.days.length > 1 ? (
        <div className="pv-subtabs-row">
          <button type="button" className="pv-subtabs-chevron" aria-label="Scroll days left" onClick={() => trackRef.current?.scrollBy({ left: -160, behavior: "smooth" })}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="pv-tabs pv-tabs--sub" ref={trackRef}>
            <Tabs tabs={subTabs} active={sub} onPick={setSub} sub />
          </div>
          <button type="button" className="pv-subtabs-chevron" aria-label="Scroll days right" onClick={() => trackRef.current?.scrollBy({ left: 160, behavior: "smooth" })}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      ) : null}
      <div key={sub} className="pv-days pv-tabcontent">
        {shown.map(([day, i]) => {
          const date = fmtDate(day.date, { weekday: "short", day: "numeric", month: "short" });
          return (
            <div className="pv-day-card" key={i}>
              <div className="pv-day-card-body">
                <div className="pv-recgroup-eyebrow">Day {i + 1}</div>
                <div className="pv-day-head">{date ? `${date} · ${day.t}` : day.t}</div>
                {day.place || day.m ? <div className="pv-day-place">{day.place || day.m}</div> : null}
                {day.d ? <div className="pv-day-body">{day.d}</div> : null}
                {day.highlights?.length ? (
                  <ul className="pv-bullets" style={{ marginTop: 8 }}>
                    {day.highlights.map((h, j) => (
                      <li key={j}>{h}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {plan.daysNote ? <Callout note={plan.daysNote} /> : null}

      {bookOrder.length ? (
        <>
          <h2 className="pv-section-title">Reservations that matter</h2>
          <div className="pv-days">
            {bookOrder.map((r, i) => (
              <div className="pv-day" key={i}>
                <div className="pv-day-num">{i + 1}</div>
                <div>
                  <div className="pv-day-head">{r.due ? `${r.due} · ${r.t}` : r.t}</div>
                  {r.d || r.m ? <div className="pv-day-body">{r.d || r.m}</div> : null}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

function DecisionsTab({ plan }: { plan: TripPlan }) {
  return (
    <>
      <h2 className="pv-section-title">Before money moves</h2>
      <Callout note={plan.gate} />
      {plan.visa ? (
        <div style={{ marginTop: 12 }}>
          <Callout note={{ t: "Visa", b: plan.visa.note }} />
        </div>
      ) : null}

      {plan.decisions.length ? (
        <>
          <h2 className="pv-section-title">Decisions for you</h2>
          <ul className="pv-bullets">
            {plan.decisions.map((r, i) => (
              <li key={i}>
                <strong>{r.t}</strong>
                {r.d ? `: ${r.d}` : ""}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {plan.bookingActions?.length ? (
        <>
          <h2 className="pv-section-title">Next steps</h2>
          {plan.bookingActions.map((a, i) => (
            <div key={i} style={{ marginTop: i ? 16 : 0 }}>
              <div className="pv-day-head" style={{ marginBottom: 6 }}>
                {a.title}
              </div>
              <ul className="pv-bullets">
                {a.points.map((p, j) => (
                  <li key={j}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </>
      ) : null}

      {plan.why?.length ? (
        <>
          <h2 className="pv-section-title">Why this route</h2>
          <ul className="pv-bullets">
            {plan.why.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

/** One option of a comparison, laid out like the Plan tab. */
function OptionTab({ o }: { o: Option }) {
  return (
    <>
      <h2 className="pv-section-title">{o.name}</h2>
      <div className="pv-callout">
        <strong>{o.oneLine}</strong>
        {o.summary}
      </div>
      {o.facts.length ? (
        <>
          <h2 className="pv-section-title">The shape</h2>
          <DefList rows={o.facts} />
        </>
      ) : null}
      {o.flightOptions?.length ? (
        <>
          <h2 className="pv-section-title">Getting there</h2>
          {o.flightOptions.map((g, i) => (
            <ChoiceGroupView key={i} group={g} hotel={false} />
          ))}
        </>
      ) : null}
      {o.hotelOptions?.length ? (
        <>
          <h2 className="pv-section-title">Where you stay</h2>
          {o.hotelOptions.map((g, i) => (
            <ChoiceGroupView key={i} group={g} hotel />
          ))}
        </>
      ) : null}
      <h2 className="pv-section-title">What it costs</h2>
      <CostTable rows={[{ k: "Trip total", v: o.allin || o.price }]} />
      {o.tradeoffs?.length || o.catch ? (
        <>
          <h2 className="pv-section-title">Worth knowing</h2>
          <ul className="pv-bullets">
            {o.catch ? <li>{o.catch}</li> : null}
            {(o.tradeoffs || []).map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

/** Every photo on the page has loaded (or failed), hero included, or the wait ran out. */
function photosReady(root: HTMLElement | null, hero: string | undefined, maxMs = 8000): Promise<void> {
  const imgs = root ? Array.from(root.querySelectorAll("img")) : [];
  const waits = imgs.map((img) => {
    img.loading = "eager";
    return img.complete ? Promise.resolve() : new Promise<void>((res) => { img.onload = img.onerror = () => res(); });
  });
  if (hero) waits.push(new Promise<void>((res) => { const i = new Image(); i.onload = i.onerror = () => res(); i.src = hero; }));
  return Promise.race([Promise.all(waits).then(() => undefined), new Promise<void>((res) => setTimeout(res, maxMs))]);
}

function heroPhoto(plan: TripPlan | Comparison): string | undefined {
  const groups = plan.kind === "compare" ? plan.options.flatMap((o) => o.hotelOptions || []) : plan.hotelOptions || [];
  for (const g of groups) {
    const url = photoOf(g.recommended) || g.alternatives.map(photoOf).find(Boolean);
    if (url) return url;
  }
  return undefined;
}

export default function TripDetail() {
  const { key } = useParams<{ key: string }>();
  const { member, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<{ message: string; otherMember: boolean } | null>(null);
  const [tab, setTab] = useState("");
  // The PDF is the whole itinerary (2026-10-22): every tab one after another,
  // every day, every photo, not just the tab on screen.
  const [printAll, setPrintAll] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const before = () => flushSync(() => setPrintAll(true));   // also for ⌘P / Ctrl+P
    const after = () => setPrintAll(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  useEffect(() => {
    if (!key) return;
    api
      .get<PlanResponse>(`/api/plan/${key}`)
      .then(setData)
      .catch((err) =>
        setError({
          message: err instanceof ApiError ? err.message : "Could not load this trip.",
          otherMember: err instanceof ApiError && err.status === 403,
        })
      );
  }, [key]);

  if (error) {
    // Signed in with someone else's code: sign out and come straight back
    // here after signing in with the right one.
    const switchAccount = () => {
      signOut();
      navigate("/login", { replace: true, state: { from: location.pathname } });
    };
    return (
      <div className="pv-page">
        <div className="pv-shell">
          <div className="pv-card" style={{ padding: "40px 48px" }}>
            <span className="pv-wordmark" style={{ color: "var(--ink)" }}>
              <Link to="/chat">TripAgent</Link>
            </span>
            <h1 className="pv-section-title" style={{ marginTop: 28 }}>
              {error.otherMember ? "This itinerary is for another account" : "We couldn't open this itinerary"}
            </h1>
            <p className="pv-day-body" style={{ fontSize: 14 }}>
              {error.otherMember
                ? `You're signed in${member && member.name !== "Traveller" ? ` as ${member.name}` : ""}. Sign in with the access code of the person this itinerary was made for.`
                : error.message}
            </p>
            {error.otherMember ? (
              <button type="button" className="pv-cta" style={{ marginLeft: 0 }} onClick={switchAccount}>
                Sign in with a different code
              </button>
            ) : (
              <Link to="/chat" className="pv-cta" style={{ marginLeft: 0, textDecoration: "none" }}>
                Back to chat
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="pv-page">
        <div className="pv-shell">
          <p className="muted">Loading...</p>
        </div>
      </div>
    );
  }

  const { plan } = data;
  const compare = plan.kind === "compare";
  const tabs = compare ? plan.options.map((o) => o.name) : ["Plan", ...(plan.days.length ? ["Days"] : []), "Decisions"];
  const active = tabs.includes(tab) ? tab : tabs[0];
  const hero = heroPhoto(plan);
  const asof = fmtDate(plan.asof, { day: "numeric", month: "short" });
  const prepared = fmtDate(plan.asof, { day: "numeric", month: "long", year: "numeric" });
  const name = member && member.name !== "Traveller" ? member.name : null;
  const madeFor = [name ? `Made for ${name}` : null, asof].filter(Boolean).join(" · ");

  const downloadPdf = async () => {
    flushSync(() => setPrintAll(true));
    await photosReady(cardRef.current, hero);
    window.print();
  };

  let content: ReactNode;
  if (printAll) {
    content = plan.kind === "compare" ? (
      plan.options.map((o, i) => (
        <section key={o.name} className={"pv-print-section" + (i ? " pv-print-break" : "")}>
          <h2 className="pv-section-title">{o.name}</h2>
          <OptionTab o={o} />
        </section>
      ))
    ) : (
      <>
        <section className="pv-print-section">
          <PlanTab plan={plan} onDays={() => setTab("Days")} />
        </section>
        {plan.days.length ? (
          <section className="pv-print-section pv-print-break">
            <DaysTab plan={plan} />
          </section>
        ) : null}
        <section className="pv-print-section pv-print-break">
          <DecisionsTab plan={plan} />
        </section>
      </>
    );
  } else if (plan.kind === "compare") {
    const o = plan.options.find((x) => x.name === active) || plan.options[0];
    content = o ? <OptionTab o={o} /> : null;
  } else if (active === "Days") {
    content = <DaysTab plan={plan} />;
  } else if (active === "Decisions") {
    content = <DecisionsTab plan={plan} />;
  } else {
    content = <PlanTab plan={plan} onDays={() => setTab("Days")} />;
  }

  return (
    <div className="pv-page">
      <div className="pv-shell">
        <div className="pv-card" ref={cardRef}>
          <div className="pv-hero" style={hero ? { backgroundImage: `url("${hero}")` } : undefined}>
            <div className="pv-hero-scrim" />
            <div className="pv-hero-content">
              <div className="pv-header">
                <div className="pv-header-left">
                  <span className="pv-wordmark">
                    <Link to="/chat">TripAgent</Link>
                  </span>
                  {madeFor ? <span className="pv-madefor">{madeFor}</span> : null}
                </div>
                <button type="button" className="pv-dlbtn" onClick={downloadPdf}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Download PDF
                </button>
              </div>
              <h1 className="pv-title">{plan.title}</h1>
              {plan.sub ? <div className="pv-subtitle">{plan.sub}</div> : null}
              {plan.lede ? <p className="pv-summary">{plan.lede}</p> : null}
            </div>
          </div>
          <div className="pv-body">
            <div className="pv-tabs">
              <Tabs tabs={tabs} active={active} onPick={setTab} />
            </div>
            <div key={printAll ? "print" : active} className="pv-tabcontent">
              {content}
            </div>
            <div className="pv-footnote">
              {prepared ? `Prepared ${prepared}. ` : ""}
              {compare && plan.method ? `${plan.method} ` : ""}
              Fares and room rates are indicative, from a live search: nothing is booked, held or paid.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
