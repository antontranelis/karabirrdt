import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

// Tests der App-Schicht (Register, Connector, Flächen) unter jsdom. Modell,
// Server und Skripte prüft `npm test` im Wurzelverzeichnis mit `node --test`.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test-setup.ts"],
  },
})
