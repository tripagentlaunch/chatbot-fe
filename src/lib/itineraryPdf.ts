/* The itinerary as a real PDF file, downloaded straight away (2026-10-22),
 * instead of the browser's print dialog. The page renders every tab one
 * after another (TripDetail's printAll), every photo is swapped for a copy
 * the browser may read (the photo proxy, or /api/photo/remote for hotel
 * photos), then the hero, each section and the footnote are drawn to canvas
 * and laid onto A4 pages, cutting only between rows, cards and paragraphs.
 * Folded "Other options" are opened: the file is the complete itinerary. */
import { BASE_URL } from "../api/client";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
// Safari refuses canvases over ~16.7M pixels; stay under that per section.
const MAX_PIXELS = 16_000_000;
// Never cut through these; cut between them.
const WHOLE = ".pv-day-card, .pv-recflight, .pv-recstay, .pv-option, .pv-recstay-stacked, tr, img, p, li, h1, h2, h3, h4";
const HEADINGS = "h2, h3, .pv-section-title";

function readable(url: string): string {
  if (url.startsWith("data:") || url.startsWith(BASE_URL) || url.startsWith(window.location.origin)) return url;
  return `${BASE_URL}/api/photo/remote?url=${encodeURIComponent(url)}`;
}

async function dataUrl(url: string): Promise<string | null> {
  for (const u of [readable(url), url]) {
    try {
      const res = await fetch(u, { mode: "cors" });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) continue;
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      });
    } catch {
      /* try the next way, else leave the photo out */
    }
  }
  return null;
}

/** Swap every photo for a readable copy; returns a function that puts them back. */
async function inlinePhotos(root: HTMLElement): Promise<() => void> {
  const undo: (() => void)[] = [];
  const imgs = Array.from(root.querySelectorAll("img"));
  const backgrounds = [root, ...Array.from(root.querySelectorAll<HTMLElement>("[style*='background-image']"))];
  await Promise.all([
    ...imgs.map(async (img) => {
      const src = img.currentSrc || img.src;
      if (!src) return;
      const copy = await dataUrl(src);
      const { srcset } = img;
      if (copy) {
        img.removeAttribute("srcset");
        img.src = copy;
        await img.decode().catch(() => undefined);
        undo.push(() => { img.src = src; if (srcset) img.srcset = srcset; });
      } else {
        const v = img.style.visibility;
        img.style.visibility = "hidden";
        undo.push(() => { img.style.visibility = v; });
      }
    }),
    ...backgrounds.map(async (el) => {
      const m = /url\(["']?([^"')]+)["']?\)/.exec(el.style.backgroundImage || "");
      if (!m) return;
      const before = el.style.backgroundImage;
      const copy = await dataUrl(m[1]);
      el.style.backgroundImage = copy ? `url("${copy}")` : "none";
      undo.push(() => { el.style.backgroundImage = before; });
    }),
  ]);
  return () => undo.forEach((f) => f());
}

/** Where a section may be cut, in CSS px from its top: between whole blocks. */
function cutPoints(section: HTMLElement): { spans: [number, number][]; ends: number[] } {
  const top = section.getBoundingClientRect().top;
  const spans: [number, number][] = [];
  section.querySelectorAll<HTMLElement>(WHOLE).forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height <= 0) return;
    // A heading stays with what follows it.
    const keep = el.matches(HEADINGS) ? 60 : 0;
    spans.push([r.top - top, r.bottom - top + keep]);
  });
  return { spans, ends: spans.map(([, b]) => b).sort((a, b) => a - b) };
}

function bestCut(from: number, limit: number, cuts: ReturnType<typeof cutPoints>, pageH: number): number {
  const inside = (y: number, small: boolean) =>
    cuts.spans.some(([a, b]) => a < y - 1 && y + 1 < b && (!small || b - a < pageH));
  for (const small of [false, true]) {
    for (let i = cuts.ends.length - 1; i >= 0; i--) {
      const y = Math.ceil(cuts.ends[i]) + 2;
      if (y > limit) continue;
      if (y < from + pageH * 0.3) break;
      if (!inside(y, small)) return y;
    }
  }
  return limit;
}

export async function downloadItineraryPdf(card: HTMLElement, title: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  card.classList.add("pv-pdf");
  const folded = Array.from(card.querySelectorAll("details")).filter((d) => !d.open);
  folded.forEach((d) => { d.open = true; });
  const restore = await inlinePhotos(card);
  try {
    const background = getComputedStyle(card).backgroundColor || "#ffffff";
    const cardW = card.getBoundingClientRect().width;
    const mmPerPx = (PAGE_W - 2 * MARGIN) / cardW;
    const pageH = (PAGE_H - 2 * MARGIN) / mmPerPx;
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    let used = 0; // CSS px used on the current page
    let pageHasContent = false;
    const newPage = () => { pdf.addPage(); used = 0; pageHasContent = false; };

    const parts = [
      card.querySelector<HTMLElement>(".pv-hero"),
      ...Array.from(card.querySelectorAll<HTMLElement>(".pv-print-section")),
      card.querySelector<HTMLElement>(".pv-footnote"),
    ].filter((el): el is HTMLElement => !!el);

    for (const part of parts) {
      const rect = part.getBoundingClientRect();
      const scale = Math.min(2, Math.sqrt(MAX_PIXELS / Math.max(1, rect.width * rect.height)));
      const canvas = await html2canvas(part, { scale, useCORS: true, backgroundColor: background, logging: false });
      const pxScale = canvas.height / rect.height;
      const cuts = cutPoints(part);
      const left = (rect.left - card.getBoundingClientRect().left) * mmPerPx;
      const gap = pageHasContent ? 16 : 0;
      let offset = 0;
      // A section starts on a new page when under a quarter of this one is left.
      if (pageHasContent && used + gap + Math.min(rect.height, pageH * 0.25) > pageH) newPage();
      else used += gap;
      while (offset < rect.height - 1) {
        const limit = offset + (pageH - used);
        const cut = rect.height <= limit ? rect.height : bestCut(offset, limit, cuts, pageH);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = Math.max(1, Math.round((cut - offset) * pxScale));
        slice.getContext("2d")!.drawImage(canvas, 0, Math.round(offset * pxScale), canvas.width, slice.height, 0, 0, canvas.width, slice.height);
        pdf.addImage(slice.toDataURL("image/jpeg", 0.9), "JPEG", MARGIN + left, MARGIN + used * mmPerPx,
          rect.width * mmPerPx, (cut - offset) * mmPerPx, undefined, "FAST");
        used += cut - offset;
        pageHasContent = true;
        offset = cut;
        if (offset < rect.height - 1) newPage();
      }
    }
    const name = (title || "Itinerary").replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim() || "Itinerary";
    pdf.save(`${name}.pdf`);
  } finally {
    restore();
    folded.forEach((d) => { d.open = false; });
    card.classList.remove("pv-pdf");
  }
}
