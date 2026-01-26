import { createRoot } from "react-dom/client";
import App from "./App";
import "./tailwind.css";
import "../css/app.css";
import "../css/fwm-theme.css";


// Expose the Vite base URL to CSS so assets in /public work in dev + GitHub Pages
const __fwmBase = import.meta.env.BASE_URL;
document.documentElement.style.setProperty("--fwm-base", __fwmBase);
document.documentElement.style.setProperty(
  "--fwm-junkyard-bg",
  `url(${__fwmBase}assets/sprites/bg/junkyard_bg.webp)`
);

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(<App />);