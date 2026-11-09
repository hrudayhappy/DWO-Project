"use client";
// Adapted from Watermelon UI "switch-disclosure" (MIT, github.com/WatermelonCorp/watermelon-platform).
// A toggle that grows to explain what it changes once it is switched on.
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { Building2 } from "lucide-react";

const spring = { type: "spring", stiffness: 800, damping: 80, mass: 5 };

export default function ParentSwitch({ on, onChange, disabled }) {
  return (
    <MotionConfig transition={spring} reducedMotion="user">
      <motion.div layout initial={false} className={`psw ${on ? "on" : ""}`} style={{ borderRadius: 22 }}>
        <motion.button
          layout
          type="button"
          role="switch"
          aria-checked={on}
          disabled={disabled}
          className="psw-head"
          onClick={() => onChange(!on)}
        >
          <span className="psw-icon" aria-hidden="true"><Building2 size={20} /></span>
          <span className="psw-text">
            <span className="psw-title">A parent company supplies much of its technology</span>
            <span className="psw-sub">For subsidiaries such as Maruti Suzuki or Hyundai India</span>
          </span>
          <span className="psw-track" aria-hidden="true">
            <motion.span className="psw-knob" animate={{ x: on ? 20 : 0 }} />
          </span>
        </motion.button>
        <AnimatePresence mode="popLayout" initial={false}>
          {on && (
            <motion.p
              key="note"
              layout
              className="psw-note"
              initial={{ y: 10, opacity: 0, scale: 1.04 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 6, opacity: 0, transition: { duration: 0.12 } }}
            >
              Royalty and technology fees paid to the parent are read as exploration bought in. The firm's own research and development spend is left out of its exploration score, so a low figure is not mistaken for a lack of exploration.
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </MotionConfig>
  );
}
