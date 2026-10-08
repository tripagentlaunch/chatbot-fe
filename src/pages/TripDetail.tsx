import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";

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
interface PlanResponse {
  plan: {
    title: string;
    sub: string;
    lede: string;
    destinationIntro?: string;
    shape: KV[];
    stay: Row[];
    move: Row[];
    allowance: KV[];
    days: Row[];
    decisions: Row[];
    gate: { t: string; b: string };
  };
  status: string;
}

export default function TripDetail() {
  const { key } = useParams<{ key: string }>();
  const [data, setData] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    api
      .get<PlanResponse>(`/api/plan/${key}`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this trip."));
  }, [key]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading...</p>;

  const { plan } = data;
  return (
    <article className="trip-detail">
      <h1>{plan.title}</h1>
      <p className="trip-sub">{plan.sub}</p>
      <p>{plan.lede}</p>
      {plan.destinationIntro && <p className="muted">{plan.destinationIntro}</p>}

      <section>
        <h2>Shape</h2>
        <dl className="kv-list">
          {plan.shape.map((row) => (
            <div key={row.k}>
              <dt>{row.k}</dt>
              <dd>{row.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2>Stay</h2>
        {plan.stay.map((row, i) => (
          <div className="row" key={i}>
            <strong>{row.t}</strong> {row.m && <span className="muted">{row.m}</span>}
            {row.highlights && (
              <ul>
                {row.highlights.map((h, j) => (
                  <li key={j}>{h}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      <section>
        <h2>Getting there</h2>
        {plan.move.map((row, i) => (
          <div className="row" key={i}>
            <strong>{row.t}</strong> {row.m && <span className="muted">{row.m}</span>}
          </div>
        ))}
      </section>

      <section>
        <h2>Allowance</h2>
        <dl className="kv-list">
          {plan.allowance.map((row) => (
            <div key={row.k}>
              <dt>{row.k}</dt>
              <dd>{row.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2>Days</h2>
        {plan.days.map((row, i) => (
          <div className="row" key={i}>
            <strong>{row.t}</strong>
            {row.d && <p className="muted">{row.d}</p>}
          </div>
        ))}
      </section>

      <section>
        <h2>Gate</h2>
        <p>
          <strong>{plan.gate.t}</strong> — {plan.gate.b}
        </p>
      </section>

      <section>
        <h2>Decisions</h2>
        {plan.decisions.map((row, i) => (
          <div className="row" key={i}>
            <strong>{row.t}</strong>
            {row.d && <p className="muted">{row.d}</p>}
          </div>
        ))}
      </section>
    </article>
  );
}
