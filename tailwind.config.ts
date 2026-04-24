import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "#d7ddd6",
        input: "#d7ddd6",
        ring: "#264653",
        background: "#f4f5f0",
        foreground: "#14213d",
        primary: {
          DEFAULT: "#264653",
          foreground: "#f8fafc",
        },
        secondary: {
          DEFAULT: "#dde5dc",
          foreground: "#20323f",
        },
        muted: {
          DEFAULT: "#ebefe8",
          foreground: "#5b6470",
        },
        accent: {
          DEFAULT: "#f4a261",
          foreground: "#1f2937",
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "#14213d",
        },
        destructive: {
          DEFAULT: "#c2410c",
          foreground: "#fff7ed",
        },
        success: {
          DEFAULT: "#0f766e",
          foreground: "#f0fdfa",
        },
      },
      borderRadius: {
        lg: "1rem",
        md: "0.75rem",
        sm: "0.5rem",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 24px 48px -24px rgba(20, 33, 61, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;

