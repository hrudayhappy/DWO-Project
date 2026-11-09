"use client";
// Adapted from Watermelon UI "run-action-button" (MIT, github.com/WatermelonCorp/watermelon-platform).
// The Analyse button becomes a live status pill that names the step the analysis is on.
import { createElement } from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { ScanSearch, BookOpen, Telescope, Globe, ShieldCheck, BadgeCheck, X, RotateCcw, ArrowRight } from "lucide-react";

const spring = { type: "spring", stiffness: 260, damping: 22, mass: 0.8 };

function AnimatedText({ text, className, delayStep = 0.012 }) {
  return (
    <span className={className} style={{ display: "inline-flex" }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={text} style={{ display: "inline-flex" }}>
          {text.split("").map((ch, i) => (
            <motion.span
              key={i}
              initial={{ y: 10, opacity: 0, scale: 0.5, filter: "blur(2px)" }}
              animate={{ y: 0, opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ y: -10, opacity: 0, scale: 0.5, filter: "blur(2px)" }}
              transition={{ type: "spring", stiffness: 240, damping: 16, mass: 1.2, delay: i * delayStep }}
              style={{ display: "inline-block", whiteSpace: ch === " " ? "pre" : undefined }}
            >
              {ch}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function iconFor(label) {
  if (/^Reading/.test(label)) return BookOpen;
  if (/^Extracting/.test(label)) return Telescope;
  if (/^Searching/.test(label)) return Globe;
  if (/^Checking/.test(label)) return ShieldCheck;
  return ScanSearch;
}

// status: idle | running | done
export default function RunButton({ status, step, detail, onRun, onCancel, disabled }) {
  const label = step || "Starting";
  return (
    <MotionConfig reducedMotion="user">
      <motion.div layout transition={spring} className={`runb ${status}`}>
        <AnimatePresence mode="popLayout" initial={false}>
          {status === "idle" && (
            <motion.button
              key="idle"
              type="submit"
              disabled={disabled}
              className="runb-idle"
              initial={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
              transition={spring}
            >
              <AnimatedText text="Analyse documents" />
              <span className="runb-go" aria-hidden="true"><ArrowRight size={17} strokeWidth={2.6} /></span>
            </motion.button>
          )}
          {status === "running" && (
            <motion.div
              key="running"
              className="runb-running"
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
              transition={spring}
            >
              <AnimatePresence mode="popLayout">
                <motion.span key={label} className="runb-ic" initial={{ opacity: 0, scale: 0, filter: "blur(4px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, scale: 0, filter: "blur(4px)" }} transition={spring}>
                  {createElement(iconFor(label), { size: 21, "aria-hidden": true })}
                </motion.span>
              </AnimatePresence>
              <AnimatedText text={label} className="runb-label" />
              {detail && <span className="runb-detail">{detail}</span>}
              <motion.button
                type="button"
                className="runb-x"
                aria-label="Stop the analysis"
                onClick={onCancel}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...spring, delay: 0.15 }}
              >
                <X size={15} />
              </motion.button>
            </motion.div>
          )}
          {status === "done" && (
            <motion.div
              key="done"
              className="runb-done"
              role="status"
              initial={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
              transition={spring}
            >
              <BadgeCheck size={21} aria-hidden="true" />
              <AnimatedText text="Evidence extracted" />
            </motion.div>
          )}
          {status === "failed" && (
            <motion.button
              key="failed"
              type="button"
              className="runb-failed"
              onClick={onRun}
              initial={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
              transition={spring}
            >
              <RotateCcw size={19} aria-hidden="true" />
              <AnimatedText text="Try again" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </MotionConfig>
  );
}
