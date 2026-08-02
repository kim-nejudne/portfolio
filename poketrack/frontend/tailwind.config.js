/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ["'Press Start 2P'", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        body: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "Noto Sans", "sans-serif"],
      },
      colors: {
        type: {
          normal:   { DEFAULT: "#A8A77A", dark: "#6D6B45", light: "#D7D6B2", ink: "#0B0D10" },
          fire:     { DEFAULT: "#EE8130", dark: "#A84A12", light: "#FFC08A", ink: "#0B0D10" },
          water:    { DEFAULT: "#6390F0", dark: "#1F4FB8", light: "#A9C4FF", ink: "#070A12" },
          electric: { DEFAULT: "#F7D02C", dark: "#B08A00", light: "#FFF1A6", ink: "#0B0D10" },
          grass:    { DEFAULT: "#7AC74C", dark: "#2F7A2A", light: "#B9F29A", ink: "#07110A" },
          ice:      { DEFAULT: "#96D9D6", dark: "#2E8F8A", light: "#CFF7F5", ink: "#071012" },
          fighting: { DEFAULT: "#C22E28", dark: "#7A1410", light: "#F08A86", ink: "#0B0D10" },
          poison:   { DEFAULT: "#A33EA1", dark: "#5E1B5D", light: "#E0A0DF", ink: "#0B0D10" },
          ground:   { DEFAULT: "#E2BF65", dark: "#9B7A2A", light: "#FFE2A8", ink: "#0B0D10" },
          flying:   { DEFAULT: "#A98FF3", dark: "#5B3FD6", light: "#D9CCFF", ink: "#0B0D10" },
          psychic:  { DEFAULT: "#F95587", dark: "#B3123F", light: "#FFB0C6", ink: "#0B0D10" },
          bug:      { DEFAULT: "#A6B91A", dark: "#5E6E00", light: "#DDEB7A", ink: "#0B0D10" },
          rock:     { DEFAULT: "#B6A136", dark: "#6E5F12", light: "#E9D98A", ink: "#0B0D10" },
          ghost:    { DEFAULT: "#735797", dark: "#3A245A", light: "#B9A7D6", ink: "#0B0D10" },
          dragon:   { DEFAULT: "#6F35FC", dark: "#2E0FB8", light: "#B9A2FF", ink: "#0B0D10" },
          dark:     { DEFAULT: "#705746", dark: "#2F241C", light: "#B59A86", ink: "#F7F7FB" },
          steel:    { DEFAULT: "#B7B7CE", dark: "#6E6E86", light: "#E7E7F2", ink: "#0B0D10" },
          fairy:    { DEFAULT: "#D685AD", dark: "#8A3E63", light: "#F6C7DD", ink: "#0B0D10" },
        },
        game: {
          bg: "#070A12",
          bg2: "#0B1020",
          panel: "#0E1630",
          panel2: "#101B3A",
          ink: "#EAF0FF",
          inkDim: "#B9C6E6",
          outline: "#05070D",
        },
      },
      boxShadow: {
        frame: "0 10px 0 rgba(0,0,0,0.65), 0 18px 28px rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,255,255,0.22), inset 0 -10px 18px rgba(0,0,0,0.45)",
        frameSm: "0 6px 0 rgba(0,0,0,0.65), 0 12px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -8px 14px rgba(0,0,0,0.45)",
        buttonHard: "0 6px 0 rgba(0,0,0,0.75), 0 10px 18px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.25)",
        buttonPressed: "0 2px 0 rgba(0,0,0,0.75), 0 6px 10px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
      },
      borderRadius: {
        frame: "18px",
        frameInner: "14px",
        chip: "999px",
      },
      keyframes: {
        "idle-bob": { "0%,100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-6px)" } },
        "shine-sweep": { "0%": { transform: "translateX(-120%) skewX(-18deg)" }, "100%": { transform: "translateX(220%) skewX(-18deg)" } },
        "tick-fill": { "0%": { transform: "scaleX(0)" }, "100%": { transform: "scaleX(1)" } },
        "level-up-slam": { "0%": { transform: "translateY(-18px) scale(0.92)", opacity: "0" }, "60%": { transform: "translateY(0px) scale(1.06)", opacity: "1" }, "100%": { transform: "translateY(0px) scale(1)" } },
        "screen-shake": { "0%,100%": { transform: "translate(0,0)" }, "20%": { transform: "translate(-6px, 2px)" }, "40%": { transform: "translate(5px, -3px)" }, "60%": { transform: "translate(-3px, -2px)" }, "80%": { transform: "translate(4px, 3px)" } },
        "capture-wobble": { "0%,100%": { transform: "rotate(0deg) translateY(0)" }, "25%": { transform: "rotate(-10deg) translateY(1px)" }, "50%": { transform: "rotate(10deg) translateY(-1px)" }, "75%": { transform: "rotate(-6deg) translateY(1px)" } },
        "ray-burst": { "0%": { transform: "scale(0.6) rotate(0deg)", opacity: "0" }, "40%": { opacity: "1" }, "100%": { transform: "scale(1.35) rotate(90deg)", opacity: "0" } },
        "typewriter-caret": { "0%,100%": { opacity: "1" }, "50%": { opacity: "0" } },
        "dialogue-arrow-blink": { "0%,100%": { opacity: "0.25", transform: "translateY(0)" }, "50%": { opacity: "1", transform: "translateY(-2px)" } },
        "aurora-drift": { "0%": { transform: "translate3d(0,0,0)" }, "50%": { transform: "translate3d(-4%, 3%, 0)" }, "100%": { transform: "translate3d(0,0,0)" } },
        "float-up": { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-14px)" } },
        "pokeball-open": { "0%": { transform: "scale(1) rotate(0)" }, "50%": { transform: "scale(1.06) rotate(-3deg)" }, "100%": { transform: "scale(1) rotate(0)" } },
      },
      animation: {
        "idle-bob": "idle-bob 2.2s ease-in-out infinite",
        "shine-sweep": "shine-sweep 1.6s ease-in-out infinite",
        "tick-fill": "tick-fill 0.18s steps(6) forwards",
        "level-up-slam": "level-up-slam 520ms cubic-bezier(0.2, 1.2, 0.2, 1)",
        "screen-shake": "screen-shake 420ms linear",
        "capture-wobble": "capture-wobble 1.2s ease-in-out infinite",
        // `forwards` matters: the keyframes end at opacity 0, but with the
        // default fill mode the element snaps back to its base style when the
        // 1.2s is up — leaving the burst parked on screen instead of gone.
        "ray-burst": "ray-burst 1.2s ease-out forwards",
        "typewriter-caret": "typewriter-caret 700ms step-end infinite",
        "dialogue-arrow-blink": "dialogue-arrow-blink 650ms step-end infinite",
        "aurora-drift": "aurora-drift 14s ease-in-out infinite",
        "float-up": "float-up 6s ease-in-out infinite",
      },
      backgroundImage: {
        scanlines: "repeating-linear-gradient(to bottom, rgba(255,255,255,0) 0px, rgba(255,255,255,0) 3px, rgba(0,0,0,0.22) 4px)",
        speedstripes: "repeating-linear-gradient(135deg, rgba(255,255,255,0.10) 0 10px, rgba(255,255,255,0) 10px 22px)",
        hexgrid: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.14) 1px, transparent 1.4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
