import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Everything the build emits (JS, CSS) and the public fonts live under /chat-assets/
// instead of /assets and /fonts, so the customer site can serve this app at
// tripagent.vip/chat and proxy /chat-assets/* here without clashing with its own files.
export default defineConfig({
  plugins: [react()],
  build: { assetsDir: "chat-assets" },
  server: { port: 5173 },
});
