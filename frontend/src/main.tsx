
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import "./index.css";
  import "./styles/languages.css";

  try {
    const rootElement = document.getElementById("root");
    if (!rootElement) {
      throw new Error("Root element not found");
    }
    const root = createRoot(rootElement);
    root.render(<App />);
  } catch (error) {
    console.error("Failed to render app:", error);
    document.body.innerHTML = `<div style="padding: 20px; color: red;">
      <h1>Error loading app</h1>
      <p>${error instanceof Error ? error.message : String(error)}</p>
      <p>Check console for details.</p>
    </div>`;
  }
  