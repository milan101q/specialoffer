import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Import RemixIcon library
const remixIconLink = document.createElement("link");
remixIconLink.href = "https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css";
remixIconLink.rel = "stylesheet";
document.head.appendChild(remixIconLink);

// Add Inter font from Google Fonts
const interFontLink = document.createElement("link");
interFontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
interFontLink.rel = "stylesheet";
document.head.appendChild(interFontLink);

// Add page title
const titleElement = document.querySelector("title") || document.createElement("title");
titleElement.textContent = "Cars for Sale | SpecialOffer.Autos";
if (!document.querySelector("title")) {
  document.head.appendChild(titleElement);
}

createRoot(document.getElementById("root")!).render(<App />);
