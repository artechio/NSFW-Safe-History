import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Toaster } from "@/components/ui/sonner"
import { OptionsApp } from "@/options/App"
import "@/index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OptionsApp />
    <Toaster position="top-center" richColors />
  </StrictMode>
)
