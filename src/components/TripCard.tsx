import { Link } from "react-router-dom";
import type { Trip } from "../types";

const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString([], { day: "numeric", month: "short" });

export default function TripCard({ trip }: { trip: Trip }) {
  return (
    <Link to={`/trips/${trip.key}`} className="tc-trip">
      <span className={`tc-trip__status tc-trip__status--${trip.status}`}>{trip.status}</span>
      <h3>{trip.title}</h3>
      <p className="tc-trip__meta">
        {trip.start ? `${fmt(trip.start)}${trip.end ? ` – ${fmt(trip.end)}` : ""}` : "Dates not set"}
        {trip.nights ? ` · ${trip.nights} night${trip.nights === 1 ? "" : "s"}` : ""}
      </p>
      {trip.places.length > 0 && <p className="tc-trip__places">{trip.places.join(" · ")}</p>}
    </Link>
  );
}
