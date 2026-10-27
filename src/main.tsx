import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/layout.css";
import "./styles/documents.css";
import "./styles/property.css";
import App from "./App.tsx";
import { applyTheme, getStoredTheme } from "./lib/theme";
import { restoreBusinessTheme } from "./lib/brandTheme";
import { getStoredToken } from "./lib/apiClient";

// Apply the saved theme before first paint to avoid a light/dark flash.
applyTheme(getStoredTheme());
restoreBusinessTheme(Boolean(getStoredToken()));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
