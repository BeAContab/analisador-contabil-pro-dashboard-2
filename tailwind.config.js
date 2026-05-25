/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
          hover: "var(--primary-hover)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          foreground: "var(--surface-foreground)",
          border: "var(--surface-border)",
          80: "var(--surface-80)",
          50: "var(--surface-50)",
          30: "var(--surface-30)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--success-foreground)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          foreground: "var(--warning-foreground)",
        },
        error: {
          DEFAULT: "var(--error)",
          foreground: "var(--error-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        // Old colors kept for backward compatibility during refactoring
        "surface-container-lowest": "var(--surface)",
        "surface-container-low": "var(--surface)",
        "surface-container": "var(--muted)",
        "surface-container-high": "var(--muted)",
        "surface-container-highest": "var(--muted)",
        "on-surface": "var(--foreground)",
        "on-surface-variant": "var(--muted-foreground)",
        "inverse-surface": "var(--foreground)",
        "inverse-on-surface": "var(--background)",
        "outline": "var(--surface-border)",
        "outline-variant": "var(--surface-border)",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.1)',
        'glass-sm': '0 2px 10px rgba(0, 0, 0, 0.05)',
        'glass-lg': '0 8px 32px rgba(0, 0, 0, 0.15)',
      },
      backdropBlur: {
        'glass': '12px',
      },
      borderRadius: {
        "sm": "0.25rem",
        "DEFAULT": "0.5rem",
        "md": "0.75rem",
        "lg": "1rem",
        "xl": "1.5rem",
        "full": "9999px",
      },
      spacing: {
        "base": "8px",
        "xs": "0.25rem",
        "sm": "0.5rem",
        "md": "1rem",
        "lg": "1.5rem",
        "xl": "2.5rem",
        "container-max": "1440px",
        "gutter": "1.5rem",
      },
      fontFamily: {
        "sans": ["Outfit", "Inter", "sans-serif"],
        "mono": ["JetBrains Mono", "monospace"],
        // Old fonts for compatibility
        "display-lg": ["Outfit", "sans-serif"],
        "headline-md": ["Outfit", "sans-serif"],
        "title-sm": ["Outfit", "sans-serif"],
        "body-md": ["Outfit", "sans-serif"],
        "body-sm": ["Outfit", "sans-serif"],
        "data-table": ["Outfit", "sans-serif"],
        "label-caps": ["Outfit", "sans-serif"],
      },
      fontSize: {
        "display-lg": ["36px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-md": ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        "title-sm": ["18px", { lineHeight: "1.4", fontWeight: "600" }],
        "body-md": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        "data-table": ["13px", { lineHeight: "1.2", fontWeight: "400" }],
        "label-caps": ["12px", { lineHeight: "1.0", letterSpacing: "0.05em", fontWeight: "600" }],
      }
    },
  },
  plugins: [],
}
