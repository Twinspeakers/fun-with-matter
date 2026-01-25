import { createRoot } from "react-dom/client";
import App from "./App";
import "./tailwind.css";
import "../css/app.css";
import "../css/fwm-theme.css";

// Make CSS able to reference the correct base path in both dev ('/') and GitHub Pages ('/fun-with-matter/')
document.documentElement.style.setProperty("--fwm-base", import.meta.env.BASE_URL);

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(<App />);
