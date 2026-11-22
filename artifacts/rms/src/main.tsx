import { createRoot } from "react-dom/client";
import App from "./App";
import { applyCachedBrandPrimary } from "@/lib/brand-theme";
import "./index.css";

// Apply saved brand color before first paint of React tree
applyCachedBrandPrimary();

createRoot(document.getElementById("root")!).render(<App />);
