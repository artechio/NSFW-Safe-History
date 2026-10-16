import { cn } from "@/lib/utils"

const ISSUE_URL = "https://github.com/artechio/NSFW-Safe-History/issues"
const RATE_URL =
  "https://microsoftedge.microsoft.com/addons/detail/nsfw-safe-history/ajhlgoaigfcfjlhmkghchilnponmdfoa"

const linkClass =
  "inline-flex min-h-8 items-center rounded-sm px-0.5 text-[11px] leading-none text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

export function FooterLinks({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Support links"
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-none text-muted-foreground",
        className
      )}
    >
      <a
        href={ISSUE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        Report an issue
      </a>
      <span aria-hidden className="select-none text-muted-foreground/50">
        ·
      </span>
      <a
        href={RATE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        Rate extension
      </a>
    </nav>
  )
}
