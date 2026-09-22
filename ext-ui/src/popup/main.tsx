import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Toaster } from "@/components/ui/sonner"
import { PopupApp } from "@/popup/App"
import "@/index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PopupApp />
    <Toaster position="top-center" richColors />
  </StrictMode>
)
