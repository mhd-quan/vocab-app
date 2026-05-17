import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Lingvist-inspired neutral surface stack — dark by default, wide screen friendly
        app: "rgb(var(--color-fg) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        "muted-2": "rgb(var(--color-muted-2) / <alpha-value>)",
        "surface-0": "rgb(var(--color-surface-0) / <alpha-value>)",
        "surface-1": "rgb(var(--color-surface-1) / <alpha-value>)",
        "surface-2": "rgb(var(--color-surface-2) / <alpha-value>)",
        "surface-3": "rgb(var(--color-surface-3) / <alpha-value>)",
        "border-subtle": "rgb(var(--color-border-subtle) / <alpha-value>)",
        "border-strong": "rgb(var(--color-border-strong) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        "accent-fg": "rgb(var(--color-accent-fg) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        xp: "rgb(var(--color-xp) / <alpha-value>)",
        rare: "rgb(var(--color-rare) / <alpha-value>)",
        epic: "rgb(var(--color-epic) / <alpha-value>)",
        mastery: "rgb(var(--color-mastery) / <alpha-value>)",
        focus: "rgb(var(--color-focus) / <alpha-value>)",
        sky: "rgb(var(--color-sky) / <alpha-value>)",
        coral: "rgb(var(--color-coral) / <alpha-value>)",
        lime: "rgb(var(--color-lime) / <alpha-value>)",
        pink: "rgb(var(--color-pink) / <alpha-value>)",
        ember: "rgb(var(--color-ember) / <alpha-value>)",
      },
      backgroundColor: {
        app: "rgb(var(--color-surface-0) / <alpha-value>)",
      },
      textColor: {
        app: "rgb(var(--color-fg) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "Atkinson Hyperlegible",
          "Lexend",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "Menlo", "monospace"],
      },
      borderRadius: {
        bento: "var(--radius-bento)",
        pill: "var(--radius-pill)",
        chip: "var(--radius-chip)",
        button: "var(--radius-button)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-dark": "0 18px 45px rgb(0 0 0 / 0.24)",
        lift: "var(--shadow-lift)",
        press: "var(--shadow-press)",
        "press-active": "var(--shadow-press-active)",
      },
      maxWidth: {
        "screen-3xl": "1920px",
      },
    },
  },
  plugins: [],
};

export default config;
