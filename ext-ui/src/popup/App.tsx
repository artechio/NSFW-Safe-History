import { useEffect, useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Delete02Icon,
  Loading03Icon,
  Settings02Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"

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
  getActiveHostname,
  getSiteStatus,
  getSettings,
  updateSettings,
  type CleanRange,
} from "@/lib/extension"

export function PopupApp() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [host, setHost] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [filterSite, setFilterSite] = useState(false)
  const [inBlocklist, setInBlocklist] = useState(false)
  const [blurEnabled, setBlurEnabled] = useState(false)
  const [range, setRange] = useState<CleanRange>("week")
  const version = useMemo(() => chrome.runtime.getManifest().version, [])

  useEffect(() => {
    Promise.all([getSettings(), getActiveHostname()])
      .then(async ([settings, hostname]) => {
        if (settings.error) throw new Error(settings.error)
        setHost(hostname)
        setEnabled(Boolean(settings.enabled))
        setBlurEnabled(Boolean(settings.blurEnabled))
        setRange(settings.lastCleanRange || "week")
        if (!hostname) {
          setFilterSite(false)
          setInBlocklist(false)
          return
        }
        const status = await getSiteStatus(hostname)
        if (status.error) throw new Error(status.error)
        setFilterSite(Boolean(status.filterActive))
        setInBlocklist(Boolean(status.inBlocklist))
      })
      .catch(() => toast.error("Could not load settings"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function onStorageChanged(
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) {
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
            setInBlocklist(Boolean(status.inBlocklist))
          })
          .catch(() => {})
      }
    }
    chrome.storage.onChanged.addListener(onStorageChanged)
    return () => chrome.storage.onChanged.removeListener(onStorageChanged)
  }, [host])

  async function onFilterChange(checked: boolean) {
    if (!host) return
    setFilterSite(checked)
    try {
      const settings = await getSettings()
      const included = new Set(settings.customDomains || [])
      const excluded = new Set(settings.excludedSites || [])
      if (checked) {
        excluded.delete(host)
        if (!inBlocklist) included.add(host)
      } else {
        included.delete(host)
        if (inBlocklist) excluded.add(host)
      }
      await updateSettings({
        customDomains: [...included],
        excludedSites: [...excluded],
      })
    } catch {
      toast.error("Could not update this site")
      try {
        const status = await getSiteStatus(host)
        setFilterSite(Boolean(status.filterActive))
        setInBlocklist(Boolean(status.inBlocklist))
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
    if (deleted > 0) toast.success("Matching visits removed.")
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

  return (
    <div className="bg-background text-foreground relative w-[360px] overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(ellipse_at_top,oklch(0.85_0.16_128/0.4),transparent_70%)]"
      />

      <div className="relative flex flex-col gap-4 p-4">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={chrome.runtime.getURL("assets/icon128.png")}
              alt=""
              className="size-10 rounded-xl"
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <h1 className="text-sm font-semibold tracking-tight">NSFW Safe History</h1>
              <p className="text-muted-foreground truncate text-xs">
                {host || "No active site"}
              </p>
            </div>
          </div>
          <Badge variant="secondary">v{version}</Badge>
        </header>

        {!enabled && !loading ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            Extension is off. Automatic history removal and media blurring are
            paused.
          </p>
        ) : null}

        <Card size="sm">
          <CardHeader>
            <CardTitle>Filter this site</CardTitle>
            <CardDescription>
              {filterSite
                ? "This site is included in filtering. Your history and blur settings apply."
                : "This site is excluded from filtering. Its visits stay in your history."}
            </CardDescription>
            <CardAction>
              <Switch
                checked={filterSite}
                disabled={loading || !host || !enabled}
                onCheckedChange={onFilterChange}
              />
            </CardAction>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Blur adult images and videos</CardTitle>
            <CardDescription>
              Blur detected adult media, including ads. Detection runs on your
              device.
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

        <Card size="sm">
          <CardHeader>
            <CardTitle>Remove matching visits</CardTitle>
            <CardDescription>
              Remove visits to filtered sites from the selected period. Other
              visits stay in your history.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
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

        <Separator />

        <Button
          variant="ghost"
          className="w-full"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          <HugeiconsIcon icon={Settings02Icon} data-icon="inline-start" />
          Settings
        </Button>
      </div>
    </div>
  )
}
