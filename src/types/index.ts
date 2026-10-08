export interface Member {
  code: string;
  name: string;
  tier: "Private Tier Black" | "Private Tier Ash" | "Invited Guest";
}

export interface HistoryMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  id?: string;
  at?: number;
  parts?: string[];
}

export interface ChatSummary {
  id: string;
  title: string;
  channel: "web" | "whatsapp";
  startedAt: string;
  lastAt: string;
  turns: number;
}

export interface Trip {
  planId: string;
  key: string;
  title: string;
  kind: "trip" | "compare";
  status: "proposed" | "requested" | "booked" | "travelling" | "completed" | "cancelled";
  start: string | null;
  end: string | null;
  nights: number | null;
  places: string[];
  dateBasis: "structured" | "parsed" | "none";
  events: number;
}

export interface ApiError {
  error: string;
}
