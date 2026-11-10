"use client";
// Top bar for the dark working screens: brand, where you are in the four steps, and an action.
import { useEffect } from "react";
import { Check } from "lucide-react";

const STEPS = ["Upload", "Read", "Review", "Diagnosis"];

export function useDarkPage() {
  useEffect(() => {
    document.documentElement.classList.add("lx-html");
    return () => document.documentElement.classList.remove("lx-html");
  }, []);
}

export default function FlowTop({ step, children }) {
  return (
    <header className="fx-top">
      <span className="lx-brand"><span className="lx-mark" aria-hidden="true" /><b>Ambidexterity</b> Analyzer</span>
      <ol className="fx-steps" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className={i < step ? "past" : i === step ? "now" : ""} aria-current={i === step ? "step" : undefined}>
            <span aria-hidden="true">{i < step ? <Check size={12} strokeWidth={3} /> : i + 1}</span>{s}
          </li>
        ))}
      </ol>
      <div className="fx-top-right">{children}</div>
    </header>
  );
}
