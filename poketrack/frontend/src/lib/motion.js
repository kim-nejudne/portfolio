// Small helpers used across the app.
import { useEffect, useState } from "react";

export function useReducedMotionMedia() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduce(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduce;
}

export function fmtNumber(n) {
  if (n === null || n === undefined) return "0";
  return new Intl.NumberFormat().format(n);
}

export function classNames(...arr) {
  return arr.filter(Boolean).join(" ");
}
