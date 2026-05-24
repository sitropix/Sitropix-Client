import { createRoot } from "react-dom/client";
import App from "./App";
import "@/lib/themeInit";
import "./index.css";

/* StrictMode intentionally disabled to avoid duplicate side effects in local API mocks. */
createRoot(document.getElementById("root")!).render(<App />);
