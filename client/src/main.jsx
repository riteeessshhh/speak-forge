/**
 * main.jsx — Application entry point.
 *
 * This is the file that Vite's index.html points to.
 * It does two things:
 * 1. Imports global styles (index.css contains Tailwind + our design tokens)
 * 2. Mounts the React app to the DOM
 *
 * StrictMode wraps the app in development to:
 * - Warn about deprecated APIs
 * - Double-invoke effects to catch side-effect bugs
 * (It has zero impact in production builds)
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
