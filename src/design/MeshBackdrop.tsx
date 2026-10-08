import { useEffect, useState } from "react";
import MeshGradientCanvas from "./mesh/MeshGradientCanvas";
import { TARA_COLORS, TARA_TUNING } from "./mesh/presets";

// A fine film grain over the gradient, so the soft colour reads as light rather than flat blur.
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
)}")`;

// What shows with reduced motion, before WebGL starts, or where it is unavailable.
const FALLBACK =
  "radial-gradient(80% 45% at 88% 22%, rgba(126,74,39,.55) 0%, rgba(126,74,39,0) 70%), radial-gradient(90% 45% at 8% 80%, rgba(83,102,122,.6) 0%, rgba(83,102,122,0) 70%), #080605";

/** The chat's animated mesh gradient, filling its (positioned) parent, behind everything. */
export default function MeshBackdrop() {
  const [still, setStill] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setStill(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);

  return (
    <div className="tc-bg" aria-hidden="true" style={{ background: FALLBACK }}>
      {!still && <MeshGradientCanvas id="tara-mesh" colors={TARA_COLORS} tuning={TARA_TUNING} />}
      <div className="tc-bg__grain" style={{ backgroundImage: GRAIN }} />
    </div>
  );
}
