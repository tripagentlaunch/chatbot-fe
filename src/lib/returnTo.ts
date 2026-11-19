// Where "Back to …" in Tara's header goes (2026-11-19, direct request: from the chat, the only way back to
// the website was the browser's Back button, many times over, or the other tab).
// The website opens Tara with #from=<the page the member was on> (beside #code / #handoff). It is read once
// at start-up, before the sign-in clears the fragment, and kept for this tab. Only TripAgent's own sites are
// accepted, so the link can never be pointed somewhere else.
const KEY = "tara.from";
const OURS = /^(www\.)?tripagent\.vip$|^customerfe[a-z0-9-]*\.vercel\.app$|^localhost$|^127\.0\.0\.1$/;
const HOME = "https://www.tripagent.vip/";

function allowed(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return (u.protocol === "https:" || u.hostname === "localhost" || u.hostname === "127.0.0.1") && OURS.test(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}

(function capture() {
  try {
    const from = allowed(new URLSearchParams(window.location.hash.slice(1)).get("from"));
    const ref = allowed(document.referrer);
    if (from) sessionStorage.setItem(KEY, from);
    else if (ref && !sessionStorage.getItem(KEY)) sessionStorage.setItem(KEY, ref);
  } catch {
    // no storage: the link falls back to the home page
  }
})();

export function returnTo(): { href: string; label: string } {
  let href: string | null = null;
  try {
    href = sessionStorage.getItem(KEY);
  } catch {
    href = null;
  }
  href = allowed(href) ?? HOME;
  const path = new URL(href).pathname;
  const city = path.match(/^\/city-([a-z0-9-]+)/)?.[1];
  const label = city
    ? city.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : path.startsWith("/trip")
      ? "your trip"
      : "TripAgent";
  return { href, label };
}
