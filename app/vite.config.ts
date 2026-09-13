import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// Die App wird in das `public/`-Verzeichnis des Servers gebaut, neben die
// alte Seite (`alt.html`), die dort liegen bleibt — darum `emptyOutDir: false`.
// Feste Dateinamen statt Hashes, damit das Ergebnis im Repository nicht bei
// jedem Bau rauscht; der Server liefert es ohnehin mit `no-cache` aus.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Die veröffentlichten @real-life-stack-Pakete tragen in `exports` eine
    // `development`-Bedingung, die auf `./src/index.ts` zeigt; `src` liegt
    // aber nicht im Paket. Vite wählt im Dev-Modus genau diese Bedingung und
    // findet nichts („Failed to resolve entry“). Bis die Pakete das beim
    // Veröffentlichen entfernen (Lücke in docs/rls-kompatibel.md), lösen wir
    // ohne `development` auf, wie beim Build.
    conditions: ["module", "browser", "import", "default"],
  },
  build: {
    outDir: "../public",
    emptyOutDir: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/karabirrdt.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  server: {
    fs: { allow: [".", ".."] },
    proxy: {
      "/api": "http://127.0.0.1:8124",
      "/ws": { target: "ws://127.0.0.1:8124", ws: true },
    },
  },
})
