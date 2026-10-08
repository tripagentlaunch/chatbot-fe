import { useEffect, useState } from "react";
import TripCard from "../components/TripCard";
import { api } from "../api/client";
import type { Trip } from "../types";

export default function Trips() {
  const [trips, setTrips] = useState<Trip[] | null>(null);

  useEffect(() => {
    api.get<{ trips: Trip[] }>("/api/trips").then((res) => setTrips(res.trips));
  }, []);

  if (trips === null) return <p className="muted">Loading your trips...</p>;
  if (trips.length === 0) return <p className="muted">No trips yet. Ask Tara to build one in chat.</p>;

  return (
    <div className="trips-grid">
      {trips.map((t) => (
        <TripCard key={t.planId} trip={t} />
      ))}
    </div>
  );
}
