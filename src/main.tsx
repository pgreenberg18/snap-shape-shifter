import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Scale the desktop UI to fit smaller screens
function applyMobileScale() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw <= 1024) {
    // Scale to fit both width and height so the entire UI is visible
    const scaleX = vw / 1280;
    const scaleY = vh / (720); // target desktop height
    const scale = Math.min(scaleX, scaleY);
    document.documentElement.style.setProperty('--app-scale', String(scale));
  } else {
    document.documentElement.style.removeProperty('--app-scale');
  }
}
applyMobileScale();
window.addEventListener('resize', applyMobileScale);

createRoot(document.getElementById("root")!).render(<App />);
