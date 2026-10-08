import { Link } from "react-router-dom";
import type { Trip } from "../types";

export default function TripCard({ trip }: { trip: Trip }) {
  return (
    <Link to={`/trips/${trip.key}`} className="trip-card">
      <h3>{trip.title}</h3>
      <p className="trip-meta">
        {trip.start ? `${trip.start} - ${trip.end}` : "Dates not set"}
        {trip.nights ? ` · ${trip.nights} nights` : ""}
      </p>
      <span className={`status-pill status-${trip.status}`}>{trip.status}</span>
    </Link>
  );
}
