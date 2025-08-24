import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { markHydrated } from './boot-monitor';

createRoot(document.getElementById("root")!).render(<App />);
// Defer mark to next tick to ensure initial React effect cycle starts
queueMicrotask(markHydrated);
