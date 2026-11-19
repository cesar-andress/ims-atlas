/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  // Keep existing styles.css as source of layout truth; utilities only.
  corePlugins: {
    preflight: false,
  },
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ground: "var(--ground)",
        surface: "var(--surface)",
        border: "var(--border)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        primary: "var(--primary)",
        "primary-ink": "var(--primary-ink)",
        crit: {
          cost: "var(--crit-cost)",
          logi: "var(--crit-logi)",
          comm: "var(--crit-comm)",
          econ: "var(--crit-econ)",
          poli: "var(--crit-poli)",
          cult: "var(--crit-cult)",
        },
      },
      fontFamily: {
        sans: ["Inter", "IBM Plex Sans", "system-ui", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        card: "var(--radius-card)",
        btn: "var(--radius-btn)",
        chip: "var(--radius-chip)",
      },
      maxWidth: {
        content: "var(--max-content)",
      },
      spacing: {
        page: "var(--page-pad)",
        gap: "var(--gap)",
      },
      transitionDuration: {
        micro: "200ms",
      },
    },
  },
  plugins: [],
};
