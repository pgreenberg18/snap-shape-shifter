import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Scale the desktop UI to fit smaller screens
function applyMobileScale() {
  const vw = window.innerWidth;
  if (vw <= 1024) {
    const scale = vw / 1280;
    document.documentElement.style.setProperty('--app-scale', String(scale));
  } else {
    document.documentElement.style.removeProperty('--app-scale');
  }
}
applyMobileScale();
window.addEventListener('resize', applyMobileScale);

createRoot(document.getElementById("root")!).render(<App />);
