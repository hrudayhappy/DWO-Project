"use client";
// Adapted from Watermelon UI "file-upload-1" (MIT, github.com/WatermelonCorp/watermelon-platform).
// One drop zone for all three PDFs. Each file is read in the browser as soon as it is added,
// its role (annual report, investor presentation, call transcript) is inferred from its text,
// and the parsed pages are kept so the analysis does not read the file twice.
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CloudUpload, FileText, CircleCheck, CircleAlert, X } from "lucide-react";
import { readPdf } from "@/lib/pipeline";

export const ROLES = [
  { id: "AR", label: "Annual report", note: "required" },
  { id: "IP", label: "Investor presentation", note: "optional" },
  { id: "EC", label: "Call transcript", note: "optional" },
];

const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 };

function formatBytes(b) {
  if (!b) return "0 B";
  const k = 1024, s = ["B", "KB", "MB", "GB"], i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / k ** i).toFixed(1))} ${s[i]}`;
}

// Score each role from the file name, the first pages and the length of the document.
function roleScores(name, pages) {
  const head = (name + " " + pages.slice(0, 3).map((p) => p.text).join(" ")).toLowerCase();
  const n = pages.length;
  return {
    EC: (/transcript|conference call|earnings call|concall|con-call/.test(head) ? 6 : 0) + (/moderator|operator:|participant/.test(head) ? 3 : 0),
    IP: (/investor presentation|earnings presentation|analyst presentation|results presentation|investor update|presentation/.test(head) ? 5 : 0) + (n <= 60 ? 1 : 0),
    AR: (/annual report|integrated report|integrated annual|annual accounts/.test(head) ? 6 : 0) + (n > 100 ? 4 : 0),
  };
}

function assignRoles(docs) {
  // Highest-confidence pairs first, each role used once.
  const pairs = [];
  for (const d of docs) if (d.scores) for (const r of ["AR", "IP", "EC"]) pairs.push({ id: d.id, r, s: d.scores[r] });
  pairs.sort((a, b) => b.s - a.s);
  const taken = new Set(), done = new Set(), out = {};
  for (const p of pairs) if (p.s > 0 && !taken.has(p.r) && !done.has(p.id)) { out[p.id] = p.r; taken.add(p.r); done.add(p.id); }
  return out;
}

export default function DocumentDrop({ docs, setDocs, disabled }) {
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const inputRef = useRef(null);
  const counter = useRef(0);
  const full = docs.length >= 3;

  const update = (id, patch) => setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...(typeof patch === "function" ? patch(d) : patch) } : d)));

  async function addFiles(list) {
    setNotice("");
    const incoming = Array.from(list);
    const pdfs = incoming.filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (pdfs.length < incoming.length) setNotice("Only PDF files can be read. Other files were skipped.");
    const room = 3 - docs.length;
    if (pdfs.length > room) setNotice(`Up to three documents. ${pdfs.length - room} file${pdfs.length - room > 1 ? "s were" : " was"} not added.`);
    const added = pdfs.slice(0, Math.max(room, 0)).map((file) => ({ id: Math.random().toString(36).slice(2, 9), file, status: "reading", progress: 0, pages: null, role: null, scores: null }));
    if (!added.length) return;
    setDocs((prev) => [...prev, ...added]);
    for (const d of added) {
      try {
        const pages = await readPdf(d.file, (i, n) => update(d.id, { progress: Math.round((i / n) * 100) }));
        const scores = roleScores(d.file.name, pages);
        setDocs((prev) => {
          const next = prev.map((x) => (x.id === d.id ? { ...x, status: "done", progress: 100, pages, scores } : x));
          const roles = assignRoles(next.filter((x) => x.scores && !x.manual));
          return next.map((x) => (x.manual || !roles[x.id] ? x : { ...x, role: roles[x.id] }));
        });
      } catch {
        update(d.id, { status: "error" });
      }
    }
  }

  function setRole(id, role) {
    setDocs((prev) => {
      const current = prev.find((d) => d.id === id)?.role || null;
      return prev.map((d) => {
        if (d.id === id) return { ...d, role, manual: true };
        if (d.role === role) return { ...d, role: current, manual: true }; // swap
        return d;
      });
    });
  }

  const remove = (id) => setDocs((prev) => prev.filter((d) => d.id !== id));

  const onDragEnter = (e) => { e.preventDefault(); counter.current += 1; setDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); counter.current -= 1; if (counter.current === 0) setDragging(false); };
  const onDrop = (e) => { e.preventDefault(); counter.current = 0; setDragging(false); if (!disabled && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); };

  const missingAR = docs.length > 0 && docs.every((d) => d.status !== "reading") && !docs.some((d) => d.role === "AR");

  return (
    <div className="dz-wrap">
      <AnimatePresence initial={false}>
        {!full && (
          <motion.button
            key="zone"
            type="button"
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98, height: 0, marginBottom: 0 }}
            transition={spring}
            className={`dz ${dragging ? "drag" : ""}`}
            aria-label="Add company documents: drag and drop PDFs or click to browse"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            <motion.span className="dz-icon" animate={{ y: dragging ? -4 : 0, scale: dragging ? 1.08 : 1 }} transition={spring}>
              <CloudUpload size={20} aria-hidden="true" />
            </motion.span>
            <span className="dz-title">{dragging ? "Release to add the documents" : docs.length ? "Add another document" : "Drop the company's PDFs here, or click to browse"}</span>
            <span className="dz-note">Annual report, investor presentation and call transcript. Up to three PDFs, read on this device.</span>
          </motion.button>
        )}
      </AnimatePresence>

      <motion.ul className="dz-list" layout>
        <AnimatePresence initial={false}>
          {docs.map((d) => (
            <motion.li
              key={d.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -12, transition: { duration: 0.15 } }}
              transition={spring}
              className={`dz-file ${d.status}`}
            >
              <div className="dz-row">
                <span className="dz-ficon" aria-hidden="true"><FileText size={17} /></span>
                <div className="dz-meta">
                  <span className="dz-name">{d.file.name}</span>
                  <span className="dz-sub">
                    {formatBytes(d.file.size)}
                    {d.status === "done" && ` · ${d.pages.length} pages read`}
                    {d.status === "reading" && ` · reading ${d.progress}%`}
                    {d.status === "error" && " · this PDF could not be read"}
                  </span>
                </div>
                <AnimatePresence mode="popLayout" initial={false}>
                  {d.status === "done" && (
                    <motion.span key="ok" className="dz-ok" initial={{ scale: 0.4, opacity: 0, filter: "blur(4px)" }} animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }} transition={spring}>
                      <CircleCheck size={17} aria-label="Read" />
                    </motion.span>
                  )}
                  {d.status === "error" && <CircleAlert key="err" size={17} className="dz-err" aria-label="Error" />}
                </AnimatePresence>
                <button type="button" className="dz-x" onClick={() => remove(d.id)} disabled={disabled} aria-label={`Remove ${d.file.name}`}>
                  <X size={15} />
                </button>
              </div>
              {d.status === "reading" && (
                <div className="dz-bar" aria-hidden="true"><motion.i initial={{ width: 0 }} animate={{ width: `${d.progress}%` }} transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.35 }} /></div>
              )}
              {d.status === "done" && !d.role && <span className="dz-ask">Which document is this?</span>}
              {d.status === "done" && (
                <div className="dz-roles" role="radiogroup" aria-label={`What is ${d.file.name}?`}>
                  {ROLES.map((r) => (
                    <button key={r.id} type="button" role="radio" aria-checked={d.role === r.id} disabled={disabled} className={d.role === r.id ? "on" : ""} onClick={() => setRole(d.id, r.id)}>
                      {d.role === r.id && <motion.span layoutId={`pill-${d.id}`} className="dz-pill" transition={spring} />}
                      <span className="dz-rl">{r.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>

      {(notice || missingAR) && <p className="dz-notice" role="status">{notice || "Mark one document as the annual report; it is the one source the analysis cannot do without."}</p>}

      <input ref={inputRef} type="file" accept="application/pdf" multiple className="sr" tabIndex={-1} aria-hidden="true" onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
