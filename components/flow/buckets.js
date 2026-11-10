// The four places extracted evidence goes, one per framework, and how sources are named.
export const BUCKETS = [
  { fw: "F1", name: "Environment", sub: "Markets, segments and risks", framework: "Environmental uncertainty", color: "#8fd0ff" },
  { fw: "F2", name: "Strategy", sub: "What management says it will do", framework: "Miles and Snow", color: "#f7c35c" },
  { fw: "F3", name: "Behaviour", sub: "What the company actually does", framework: "Exploration and exploitation", color: "#ff8a57" },
  { fw: "F4", name: "Structure", sub: "How the company is organised", framework: "Organisation design", color: "#c4b5fd" },
];
export const BUCKET = Object.fromEntries(BUCKETS.map((b) => [b.fw, b]));
export const DOC_LABEL = { AR: "Annual report", IP: "Investor presentation", EC: "Call transcript", WEB: "Web", USER: "You" };
export const domain = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "web"; } };
export const srcLabel = (e) => (e.doc === "WEB" ? domain(e.url) : e.doc === "USER" ? "Entered by you" : `${DOC_LABEL[e.doc] || e.doc} · p.${e.page}`);
export const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "");
