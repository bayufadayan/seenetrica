import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { localApiPlugin } from "./tooling/local-api-plugin.mjs";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, environment);

  return {
    plugins: [react(), localApiPlugin()],
  };
});
