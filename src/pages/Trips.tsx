import { useEffect, useState } from "react";
import TripCard from "../components/TripCard";
import { api } from "../api/client";
import type { Trip } from "../types";
import MeshBackdrop from "../design/MeshBackdrop";
import TopNav from "../design/TopNav";
import { useAssistantName } from "../context/AuthContext";
import "../design/chat.css";

// The member's trips, on the same full-screen surface as the chat (backdrop,
// frosted header with the app's tabs), so moving between Chat and Trips stays
// inside one design.
export default function Trips() {
  const assistant = useAssistantName();
  const [trips, setTrips] = useState<Trip[] | null>(null);

  useEffect(() => {
    api.get<{ trips: Trip[] }>("/api/trips").then((res) => setTrips(res.trips));
  }, []);

  return (
    <div className="tc-root">
      <MeshBackdrop />

      <header className="tc-header">
        <span className="tc-header__glass" aria-hidden="true" />
        <TopNav />
      </header>

      <div className="tc-scroll tc-scroll--page">
        <h1 className="tc-page-title">Your trips</h1>
        {trips === null ? (
          <p className="tc-empty">Loading your trips…</p>
        ) : trips.length === 0 ? (
          <p className="tc-empty">No trips yet. Ask {assistant} to build one in chat.</p>
        ) : (
          <div className="tc-trips">
            {trips.map((t) => (
              <TripCard key={t.planId} trip={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
