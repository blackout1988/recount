import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import RecountApp from "./RecountApp.jsx";
import StoreCabinet from "./StoreCabinet.jsx";
import "./App.css";

// Simple path-based routing — no react-router needed
const path = window.location.pathname;
const isStoreCabinet = path.startsWith("/store") || path.startsWith("/cabinet");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {isStoreCabinet ? <StoreCabinet /> : <RecountApp />}
  </StrictMode>
);
