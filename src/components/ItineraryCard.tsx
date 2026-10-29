import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { ArrowUpRight } from "../design/icons";
import type { Trip } from "../types";

/**
 * The rich card for an itinerary proposal link in a chat message: a photo with the trip's status,
 * the trip's name, its dates and nights, the places it covers, and an arrow ("View itinerary") that
 * opens the itinerary page (/trips/:key). The details come from the
 * member's trips (/api/trips) and the saved plan (/api/plan/:key, for the photo), each fetched once
 * per page load and shared by every card. If neither can be read (an itinerary of another member, the
 * server being away) the card still opens the link, with a plain heading.
 */

interface Photo {
  url: string;
}
interface HotelGroup {
  recommended?: { photo?: Photo; photos?: Photo[] };
  alternatives?: { photo?: Photo; photos?: Photo[] }[];
}
interface PlanLite {
  title?: string;
  hotelOptions?: HotelGroup[];
  options?: { hotelOptions?: HotelGroup[] }[];
}

const photoOf = (c?: { photo?: Photo; photos?: Photo[] }) => c?.photo?.url || c?.photos?.[0]?.url;

/** The same pick as the itinerary page's hero: the first hotel photo in the plan. */
function heroOf(plan: PlanLite): string | undefined {
  const groups = plan.options ? plan.options.flatMap((o) => o.hotelOptions ?? []) : plan.hotelOptions ?? [];
  for (const g of groups) {
    const url = photoOf(g.recommended) || (g.alternatives ?? []).map(photoOf).find(Boolean);
    if (url) return url;
  }
  return undefined;
}

let tripsOnce: Promise<Trip[]> | null = null;
const loadTrips = () => (tripsOnce ??= api.get<{ trips: Trip[] }>("/api/trips").then((r) => r.trips).catch(() => []));

const plansOnce = new Map<string, Promise<PlanLite | null>>();
const loadPlan = (key: string) => {
  let p = plansOnce.get(key);
  if (!p) {
    p = api.get<{ plan: PlanLite }>(`/api/plan/${key}`).then((r) => r.plan).catch(() => null);
    plansOnce.set(key, p);
  }
  return p;
};

interface Info {
  title: string;
  /** "4 – 7 Dec · 3 nights": whichever of the dates and the nights the trip has. */
  meta: string;
  /** The places, when they say more than the title does. */
  places: string;
  status?: Trip["status"];
  photo?: string;
}

const nightsText = (n: number) => `${n} night${n === 1 ? "" : "s"}`;

/** "4 – 7 Dec", "28 Nov – 3 Dec", or "4 Dec" for a one-day trip; the year only when the dates are not this year's. */
function datesText(start: string | null, end: string | null): string {
  if (!start) return "";
  const a = new Date(`${start}T00:00:00`);
  if (isNaN(a.getTime())) return "";
  const withYear = a.getFullYear() !== new Date().getFullYear();
  const d = (x: Date, o: Intl.DateTimeFormatOptions) => x.toLocaleDateString("en-GB", o);
  const full = (x: Date) => d(x, { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
  const b = end ? new Date(`${end}T00:00:00`) : null;
  if (!b || isNaN(b.getTime()) || b.getTime() === a.getTime()) return full(a);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${d(a, { day: "numeric" })} – ${full(b)}`;
  }
  return `${d(a, { day: "numeric", month: "short" })} – ${full(b)}`;
}

export default function ItineraryCard({ tripKey }: { tripKey: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([loadTrips(), loadPlan(tripKey)]).then(([trips, plan]) => {
      if (!live) return;
      const trip = trips.find((t) => t.key === tripKey);
      const title = trip?.title || plan?.title || "Your itinerary";
      const parts = [trip ? datesText(trip.start, trip.end) : "", trip?.nights ? nightsText(trip.nights) : ""].filter(Boolean);
      const meta = parts.join(" · ") || "Itinerary proposal";
      // Places are shown when there is more than one, or one the title does not already name.
      const placeList = trip?.places ?? [];
      const places =
        placeList.length > 1 || (placeList.length === 1 && !title.toLowerCase().includes(placeList[0].toLowerCase()))
          ? placeList.join(" · ")
          : "";
      setInfo({ title, meta, places, status: trip?.status, photo: plan ? heroOf(plan) : undefined });
    });
    return () => {
      live = false;
    };
  }, [tripKey]);

  const loading = info === null;
  return (
    <Link
      to={`/trips/${tripKey}`}
      className={`tc-rich${loading ? " tc-rich--loading" : ""}`}
      aria-label={info ? `Open the itinerary: ${info.title}, ${info.meta}` : "Open the itinerary"}
    >
      <div className="tc-rich__photo">
        {info?.photo && !photoFailed ? <img src={info.photo} alt="" onError={() => setPhotoFailed(true)} /> : null}
        {info?.status && <span className={`tc-rich__status tc-rich__status--${info.status}`}>{info.status}</span>}
      </div>
      <div className="tc-rich__body">
        <div className="tc-rich__text">
          <h3 className="tc-rich__title">{info?.title ?? " "}</h3>
          <p className="tc-rich__meta">{info?.meta ?? " "}</p>
          {info?.places ? <p className="tc-rich__places">{info.places}</p> : null}
        </div>
        <span className="tc-rich__go" aria-hidden="true">
          <span className="tc-rich__golabel">View itinerary</span>
          <ArrowUpRight size={22} />
        </span>
      </div>
    </Link>
  );
}
