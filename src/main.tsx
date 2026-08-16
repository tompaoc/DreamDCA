import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

// StrictMode double-invokes effects in dev, which would create and destroy a
// second Phaser.Game. The cleanup in PhaserGame handles it, so it stays on.
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
