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
        display: ["'Fredoka Variable'", "Fredoka", "ui-rounded", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["'Nunito Variable'", "Nunito", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
      // Every colour is a CSS custom property declared once in index.css, so
      // a light theme swaps values there and nothing here changes.
      colors: {
        bg: "var(--bg)",
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
          sunken: "var(--surface-sunken)",
        },
        fg: "var(--text)",
        muted: "var(--text-muted)",
        label: "var(--label)",
        tab: "var(--tab-inactive)",
        accent: { DEFAULT: "var(--accent)", ink: "var(--accent-ink)" },
        success: { DEFAULT: "var(--success)", ink: "var(--success-ink)" },
        prestige: { DEFAULT: "var(--prestige)", ink: "var(--prestige-ink)" },
        danger: { DEFAULT: "var(--danger)", ink: "var(--danger-ink)", text: "var(--danger-text)" },
        hero: { DEFAULT: "var(--hero-bg)", sprite: "var(--hero-sprite)", accent: "var(--hero-accent)" },
        // Resolved per column through data-col (see index.css).
        col: {
          bg: "var(--col-bg)",
          card: "var(--col-card)",
          title: "var(--col-title)",
          icon: "var(--col-icon)",
          desc: "var(--col-desc)",
          back: "var(--col-back)",
          "back-ink": "var(--col-back-ink)",
        },
      },
      boxShadow: {
        hard: "0 2px 0 var(--shadow-hard)",
        "hard-lg": "0 6px 0 var(--shadow-hard)",
        card: "0 3px 0 var(--col-shadow)",
      },
      borderRadius: {
        panel: "28px",
        card: "20px",
        hero: "22px",
        chip: "999px",
      },
      keyframes: {
        "idle-bob": { "0%,100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-6px)" } },
        "capture-wobble": { "0%,100%": { transform: "rotate(0deg) translateY(0)" }, "25%": { transform: "rotate(-10deg) translateY(1px)" }, "50%": { transform: "rotate(10deg) translateY(-1px)" }, "75%": { transform: "rotate(-6deg) translateY(1px)" } },
        "ray-burst": { "0%": { transform: "scale(0.6) rotate(0deg)", opacity: "0" }, "40%": { opacity: "1" }, "100%": { transform: "scale(1.35) rotate(90deg)", opacity: "0" } },
        "typewriter-caret": { "0%,100%": { opacity: "1" }, "50%": { opacity: "0" } },
        "dialogue-arrow-blink": { "0%,100%": { opacity: "0.25", transform: "translateY(0)" }, "50%": { opacity: "1", transform: "translateY(-2px)" } },
        "float-up": { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-14px)" } },
        "pop-in": { "0%": { transform: "translateY(8px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
      },
      animation: {
        "idle-bob": "idle-bob 2.2s ease-in-out infinite",
        "capture-wobble": "capture-wobble 1.2s ease-in-out infinite",
        // `forwards` matters: the keyframes end at opacity 0, but with the
        // default fill mode the element snaps back to its base style when the
        // 1.2s is up — leaving the burst parked on screen instead of gone.
        "ray-burst": "ray-burst 1.2s ease-out forwards",
        "typewriter-caret": "typewriter-caret 700ms step-end infinite",
        "dialogue-arrow-blink": "dialogue-arrow-blink 650ms step-end infinite",
        "float-up": "float-up 6s ease-in-out infinite",
        "pop-in": "pop-in 220ms ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
