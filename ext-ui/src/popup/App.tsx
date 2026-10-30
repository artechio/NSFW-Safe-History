import { useEffect, useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Delete02Icon,
  Loading03Icon,
  Settings02Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { FooterLinks } from "@/components/footer-links"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  clearHistory,
  getActivePage,
  getSiteStatus,
  getSettings,
  getStats,
  setSiteFilter,
  updateSettings,
  type CleanRange,
  type Stats,
} from "@/lib/extension"

function formatCount(value: number) {
  return new Intl.NumberFormat().format(value)
}

export function PopupApp() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [host, setHost] = useState("")
  const [pageSupported, setPageSupported] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [filterSite, setFilterSite] = useState(false)
  const [blurEnabled, setBlurEnabled] = useState(false)
  const [range, setRange] = useState<CleanRange>("week")
  const [stats, setStats] = useState<Stats | null>(null)
  const version = useMemo(() => chrome.runtime.getManifest().version, [])

  useEffect(() => {
    Promise.all([getSettings(), getActivePage()])
      .then(async ([settings, page]) => {
        if (settings.error) throw new Error(settings.error)
        setHost(page.hostname)
        setPageSupported(page.supported)
        setEnabled(Boolean(settings.enabled))
        setBlurEnabled(Boolean(settings.blurEnabled))
        setRange(settings.lastCleanRange || "week")
        if (!page.supported || !page.hostname) {
          setFilterSite(false)
          return
        }
        const status = await getSiteStatus(page.hostname)
        if (status.error) throw new Error(status.error)
        setFilterSite(Boolean(status.filterActive))
      })
      .catch(() => toast.error("Could not load settings"))
      .finally(() => setLoading(false))
    getStats()
      .then((response) => {
        if (!response.error) setStats(response)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    function onStorageChanged(
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) {
      if (area === "local" && changes.stats) {
        getStats()
          .then((response) => {
            if (!response.error) setStats(response)
          })
          .catch(() => {})
        return
      }
      if (area !== "sync") return
      if (changes.enabled && typeof changes.enabled.newValue === "boolean") {
        setEnabled(changes.enabled.newValue)
      }
      if (changes.blurEnabled && typeof changes.blurEnabled.newValue === "boolean") {
        setBlurEnabled(changes.blurEnabled.newValue)
      }
      if (host && (changes.customDomains || changes.excludedSites)) {
        getSiteStatus(host)
          .then((status) => {
            if (status.error) return
            setFilterSite(Boolean(status.filterActive))
          })
          .catch(() => {})
      }
    }
    chrome.storage.onChanged.addListener(onStorageChanged)
    return () => chrome.storage.onChanged.removeListener(onStorageChanged)
  }, [host])

  async function onFilterChange(checked: boolean) {
    if (!host || !pageSupported) return
    setFilterSite(checked)
    try {
      const status = await setSiteFilter(host, checked)
      if (status.error) throw new Error(status.error)
      setFilterSite(Boolean(status.filterActive))
      const deleted = Number(status.deleted) || 0
      if (deleted > 0) {
        toast.success(
          `Removed ${formatCount(deleted)} earlier ${deleted === 1 ? "visit" : "visits"} to this site.`
        )
      }
    } catch {
      toast.error("Could not update this site")
      try {
        const status = await getSiteStatus(host)
        setFilterSite(Boolean(status.filterActive))
      } catch {
        // ignore
      }
    }
  }

  async function onBlurChange(checked: boolean) {
    setBlurEnabled(checked)
    try {
      await updateSettings({ blurEnabled: checked })
    } catch {
      toast.error("Could not update blur")
    }
  }

  function reportClearResult(deleted: number) {
    if (deleted > 0)
      toast.success(
        `Removed ${formatCount(deleted)} matching ${deleted === 1 ? "visit" : "visits"}.`
      )
    else toast.message("No matching visits found for this period.")
  }

  async function onClear() {
    if (range === "all") {
      const ok = window.confirm(
        "Remove matching visits from all time? This cannot be undone."
      )
      if (!ok) return
    }

    setBusy(true)
    try {
      const response = await clearHistory(range)
      if (!response?.ok) {
        toast.error("Couldn’t remove matching visits. Try again.")
        return
      }
      reportClearResult(Number(response.deleted) || 0)
    } catch {
      try {
        const data = await chrome.storage.session.get(["lastClearDeleted", "lastClearAt"])
        if (data.lastClearAt && Date.now() - Number(data.lastClearAt) < 15000) {
          reportClearResult(Number(data.lastClearDeleted) || 0)
          return
        }
      } catch {
        // ignore
      }
      toast.error("Couldn’t remove matching visits. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const siteLabel = pageSupported
    ? host
    : "Filtering isn’t available on this page."

  const filterDescription = !pageSupported
    ? "Open a website to change its filtering settings."
    : filterSite
      ? "Included in filtering. History and blur settings apply."
      : "Excluded from filtering. Visits stay in your history."

  return (
    <div className="bg-background text-foreground w-[360px]">
      <div className="flex flex-col gap-3 p-3">
        <header className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src={chrome.runtime.getURL("assets/icon128.png")}
              alt=""
              className="size-8 rounded-lg"
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <h1 className="truncate text-sm font-semibold tracking-tight">
                NSFW Safe History
              </h1>
              <p
                className="text-muted-foreground truncate text-[11px] leading-snug"
                title={pageSupported ? host : undefined}
              >
                {loading ? "…" : siteLabel}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-transparent bg-transparent px-1.5 text-[10px] font-normal text-muted-foreground"
          >
            v{version}
          </Badge>
        </header>

        {!enabled && !loading ? (
          <p className="text-muted-foreground text-[11px] leading-snug">
            Extension is off. Automatic history removal and media blurring are
            paused.
          </p>
        ) : null}

        <Card size="sm" className="gap-0 py-2.5">
          <CardHeader className="gap-0.5">
            <CardTitle>Filter this site</CardTitle>
            <CardDescription>{filterDescription}</CardDescription>
            <CardAction>
              <Switch
                checked={pageSupported ? filterSite : false}
                disabled={loading || !pageSupported || !enabled}
                onCheckedChange={onFilterChange}
              />
            </CardAction>
          </CardHeader>
        </Card>

        <Card size="sm" className="gap-0 py-2.5">
          <CardHeader className="gap-0.5">
            <CardTitle>Blur adult images and videos</CardTitle>
            <CardDescription>
              Blurs detected adult media, including ads, on your device.
            </CardDescription>
            <CardAction>
              <Switch
                checked={blurEnabled}
                disabled={loading || !enabled}
                onCheckedChange={onBlurChange}
              />
            </CardAction>
          </CardHeader>
        </Card>

        <Card size="sm" className="gap-2 py-2.5">
          <CardHeader className="gap-0.5">
            <CardTitle>Remove matching visits</CardTitle>
            <CardDescription>
              Remove visits to filtered sites from the selected period. Other
              visits stay in your history.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={2}
              value={range}
              onValueChange={(value) => {
                if (value) setRange(value as CleanRange)
              }}
              className="grid w-full grid-cols-2"
              disabled={busy || loading || !enabled}
            >
              <ToggleGroupItem value="today" className="w-full">
                Today
              </ToggleGroupItem>
              <ToggleGroupItem value="week" className="w-full">
                This week
              </ToggleGroupItem>
              <ToggleGroupItem value="month" className="w-full">
                This month
              </ToggleGroupItem>
              <ToggleGroupItem value="all" className="w-full">
                All time
              </ToggleGroupItem>
            </ToggleGroup>

            <Button
              variant="destructive"
              className="w-full"
              disabled={busy || loading || !enabled}
              onClick={onClear}
            >
              {busy ? (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" />
              )}
              {busy ? "Removing matching visits…" : "Remove matching visits"}
            </Button>
          </CardContent>
        </Card>

        {stats ? (
          <div className="grid grid-cols-2 gap-2" aria-label="Cleanup stats">
            <div className="bg-muted/50 flex flex-col gap-0.5 rounded-lg px-3 py-2">
              <span className="text-sm font-semibold tabular-nums">
                {formatCount(stats.removedToday)}
              </span>
              <span className="text-muted-foreground text-[11px] leading-snug">
                Removed today
              </span>
            </div>
            <div className="bg-muted/50 flex flex-col gap-0.5 rounded-lg px-3 py-2">
              <span className="text-sm font-semibold tabular-nums">
                {formatCount(stats.removedTotal)}
              </span>
              <span className="text-muted-foreground text-[11px] leading-snug">
                Removed in total
              </span>
            </div>
          </div>
        ) : null}

        <Separator />

        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => chrome.runtime.openOptionsPage()}
          >
            <HugeiconsIcon icon={Settings02Icon} data-icon="inline-start" />
            Settings
          </Button>
          <FooterLinks className="px-1" />
        </div>
      </div>
    </div>
  )
}
