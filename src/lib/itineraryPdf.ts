/* The itinerary as a real PDF file, downloaded straight away (2026-10-22),
 * instead of the browser's print dialog. The page renders every tab one
 * after another (TripDetail's printAll), every photo is swapped for a copy
 * the browser may read (the photo proxy, or /api/photo/remote for hotel
 * photos), then the hero, each section and the footnote are drawn to canvas
 * and laid onto A4 pages, cutting only between rows, cards and paragraphs.
 * Folded "Other options" are opened: the file is the complete itinerary.
 *
 * html2canvas draws a copy of the page in a hidden frame, and that frame used
 * to download the stylesheets again: on a slow connection it was drawn before
 * they arrived, and the PDF came out as unstyled, squashed text (2026-10-27).
 * The copy now gets the page's styles inline (already loaded here) and waits
 * for its fonts. Every page carries a TripAgent header (from page 2) and footer.
 */
import { BASE_URL } from "../api/client";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
// Page 1 opens with the hero (which has the wordmark); later pages start below the header.
const TOP_FIRST = 12;
const TOP_REST = 22;
const BOTTOM = 20; // room for the footer
// Safari refuses canvases over ~16.7M pixels; stay under that per section.
const MAX_PIXELS = 16_000_000;
// Never cut through these; cut between them.
const WHOLE = ".pv-day-card, .pv-recflight, .pv-recstay, .pv-option, .pv-recstay-stacked, tr, img, p, li, h1, h2, h3, h4";
const HEADINGS = "h2, h3, .pv-section-title";

// The page's palette (design/itinerary.css).
const INK = "#3a352e";
const MUTED = "#8a8275";
const GOLD = "#c0982a";
const RULE = "#e4ddcf";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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

/** url(...) in a stylesheet made absolute, so it resolves the same inside the copy. */
function absoluteUrls(css: string, base: string): string {
  return css.replace(/url\((['"]?)([^'")]+)\1\)/g, (m, _q, u: string) => {
    if (u.startsWith("data:")) return m;
    try { return `url("${new URL(u, base).href}")`; } catch { return m; }
  });
}

/** Every stylesheet of the page as text, and the <link>s it replaces. A sheet
 *  the page may not read (Google Fonts) is fetched; one that can't be is kept as a link. */
async function pageCss(): Promise<{ css: string; replaced: Set<string> }> {
  const parts: string[] = [];
  const replaced = new Set<string>();
  for (const sheet of Array.from(document.styleSheets)) {
    const base = sheet.href || window.location.href;
    let text: string | null = null;
    try {
      text = Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
    } catch {
      if (sheet.href) text = await fetch(sheet.href).then((r) => (r.ok ? r.text() : null)).catch(() => null);
    }
    if (text == null) continue;
    parts.push(absoluteUrls(text, base));
    if (sheet.href) replaced.add(sheet.href);
  }
  return { css: parts.join("\n"), replaced };
}

/** html2canvas's copy of the page: styles inline (nothing to download again), fonts loaded. */
function prepareCopy(css: string, replaced: Set<string>) {
  return async (doc: Document) => {
    doc.querySelectorAll<HTMLLinkElement>("link[rel~='stylesheet']").forEach((l) => {
      if (replaced.has(l.href)) l.remove();
    });
    // <style> tags stay (html2canvas adds its own for ::before/::after); a rule twice is harmless.
    const style = doc.createElement("style");
    style.textContent = css;
    doc.head.appendChild(style);
    await Promise.race([doc.fonts ? doc.fonts.ready : Promise.resolve(), sleep(4000)]);
  };
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

async function fontBase64(file: string): Promise<string | null> {
  try {
    const res = await fetch(`/chat-assets/fonts/${file}`);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  } catch {
    return null;
  }
}

type Pdf = InstanceType<typeof import("jspdf").jsPDF>;

/** The site's own type in the header and footer; Times / Helvetica if a font can't load. */
async function brandFonts(pdf: Pdf): Promise<{ serif: string; sans: string }> {
  const [serif, sans] = await Promise.all([fontBase64("Fraunces-400.ttf"), fontBase64("Inter-500.ttf")]);
  const out = { serif: "times", sans: "helvetica" };
  try {
    if (serif) { pdf.addFileToVFS("Fraunces-400.ttf", serif); pdf.addFont("Fraunces-400.ttf", "Fraunces", "normal"); out.serif = "Fraunces"; }
    if (sans) { pdf.addFileToVFS("Inter-500.ttf", sans); pdf.addFont("Inter-500.ttf", "Inter", "normal"); out.sans = "Inter"; }
  } catch {
    /* keep the built-in fonts */
  }
  return out;
}

function fit(pdf: Pdf, text: string, maxW: number): string {
  if (pdf.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && pdf.getTextWidth(t + "…") > maxW) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}

/** TripAgent header (from page 2) and footer (every page), drawn as real text. */
function brandPages(pdf: Pdf, fonts: { serif: string; sans: string }, title: string, madeFor: string) {
  const n = pdf.getNumberOfPages();
  const right = PAGE_W - MARGIN;
  for (let i = 1; i <= n; i++) {
    pdf.setPage(i);
    if (i > 1) {
      pdf.setFont(fonts.serif, "normal");
      pdf.setFontSize(12);
      pdf.setTextColor(INK);
      pdf.text("TripAgent", MARGIN, 13);
      pdf.setFont(fonts.sans, "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(MUTED);
      pdf.text(fit(pdf, title, 120), right, 13, { align: "right" });
      pdf.setDrawColor(GOLD);
      pdf.setLineWidth(0.3);
      pdf.line(MARGIN, 16, right, 16);
    }
    const y = PAGE_H - 9;
    pdf.setDrawColor(RULE);
    pdf.setLineWidth(0.25);
    pdf.line(MARGIN, y - 5, right, y - 5);
    pdf.setFont(fonts.serif, "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(INK);
    pdf.text("TripAgent", MARGIN, y);
    const word = pdf.getTextWidth("TripAgent");
    pdf.setFont(fonts.sans, "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(MUTED);
    pdf.text("  ·  tripagent.vip" + (madeFor ? "  ·  " + madeFor : ""), MARGIN + word, y);
    pdf.text(`Page ${i} of ${n}`, right, y, { align: "right" });
  }
}

export async function downloadItineraryPdf(card: HTMLElement, title: string, madeFor = ""): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  card.classList.add("pv-pdf");
  const folded = Array.from(card.querySelectorAll("details")).filter((d) => !d.open);
  folded.forEach((d) => { d.open = true; });
  const restore = await inlinePhotos(card);
  try {
    await Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), sleep(4000)]);
    const { css, replaced } = await pageCss();
    const onclone = prepareCopy(css, replaced);
    const background = getComputedStyle(card).backgroundColor || "#ffffff";
    const cardW = card.getBoundingClientRect().width;
    const mmPerPx = (PAGE_W - 2 * MARGIN) / cardW;
    // Usable height of a page, in CSS px.
    const pageHeight = (page: number) => (PAGE_H - BOTTOM - (page === 1 ? TOP_FIRST : TOP_REST)) / mmPerPx;
    const topOf = (page: number) => (page === 1 ? TOP_FIRST : TOP_REST);
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    let page = 1;
    let used = 0; // CSS px used on the current page
    let pageHasContent = false;
    const newPage = () => { pdf.addPage(); page += 1; used = 0; pageHasContent = false; };

    const parts = [
      card.querySelector<HTMLElement>(".pv-hero"),
      ...Array.from(card.querySelectorAll<HTMLElement>(".pv-print-section")),
      card.querySelector<HTMLElement>(".pv-footnote"),
    ].filter((el): el is HTMLElement => !!el);

    for (const part of parts) {
      const rect = part.getBoundingClientRect();
      const scale = Math.min(2, Math.sqrt(MAX_PIXELS / Math.max(1, rect.width * rect.height)));
      const canvas = await html2canvas(part, { scale, useCORS: true, backgroundColor: background, logging: false, onclone });
      const pxScale = canvas.height / rect.height;
      const cuts = cutPoints(part);
      const left = (rect.left - card.getBoundingClientRect().left) * mmPerPx;
      const gap = pageHasContent ? 16 : 0;
      let offset = 0;
      // A section starts on a new page when under a quarter of this one is left.
      if (pageHasContent && used + gap + Math.min(rect.height, pageHeight(page) * 0.25) > pageHeight(page)) newPage();
      else used += gap;
      while (offset < rect.height - 1) {
        const pageH = pageHeight(page);
        const limit = offset + (pageH - used);
        const cut = rect.height <= limit ? rect.height : bestCut(offset, limit, cuts, pageH);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = Math.max(1, Math.round((cut - offset) * pxScale));
        slice.getContext("2d")!.drawImage(canvas, 0, Math.round(offset * pxScale), canvas.width, slice.height, 0, 0, canvas.width, slice.height);
        pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN + left, topOf(page) + used * mmPerPx,
          rect.width * mmPerPx, (cut - offset) * mmPerPx, undefined, "FAST");
        used += cut - offset;
        pageHasContent = true;
        offset = cut;
        if (offset < rect.height - 1) newPage();
      }
    }
    brandPages(pdf, await brandFonts(pdf), title || "Your itinerary", madeFor);
    const name = (title || "Itinerary").replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim() || "Itinerary";
    pdf.save(`${name}.pdf`);
  } finally {
    restore();
    folded.forEach((d) => { d.open = false; });
    card.classList.remove("pv-pdf");
  }
}
