import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { returnTo } from "../lib/returnTo";

// The app's navigation, drawn inside the Tara header (same glass, same type) so
// the chat and trips screens read as one surface rather than a page with a box
// in it. The member's name and sign-out sit behind the initial on the right, so
// a long name never squeezes the tabs on a phone.
export default function TopNav() {
  const { member, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const name = member && member.name !== "Traveller" ? member.name : null;
  const initial = (name || member?.code || "T").trim().charAt(0).toUpperCase();

  const back = returnTo();

  return (
    <div className="tc-nav">
      <span className="tc-wordmark">TripAgent</span>
      {/* Back to the page on the website they came from (lib/returnTo.ts). */}
      <a className="tc-back" href={back.href} title={`Back to ${back.label} on tripagent.vip`}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="tc-back__long">Back to {back.label}</span>
        <span className="tc-back__short">Website</span>
      </a>
      <nav className="tc-tabs" aria-label="Main">
        <NavLink to="/chat" className="tc-tab">
          Chat
        </NavLink>
        <NavLink to="/trips" className="tc-tab">
          Trips
        </NavLink>
      </nav>
      {member && (
        <div className="tc-account" ref={menuRef}>
          <button
            type="button"
            className="tc-avatar"
            aria-label="Account"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {initial}
          </button>
          {open && (
            <div className="tc-menu" role="menu">
              <p className="tc-menu__who">
                {name ?? "Signed in"}
                <span>{member.code}</span>
              </p>
              <button type="button" role="menuitem" className="tc-menu__item" onClick={() => signOut({ forget: true })}>
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
