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

const RANGE_LABELS: Record<CleanRange, string> = {
  today: "Clear today",
  week: "Clear this week",
  month: "Clear this month",
  all: "Clear all history",
}

export function PopupApp() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [host, setHost] = useState("")
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
      if (changes.blurEnabled && typeof changes.blurEnabled.newValue === "boolean") {
        setBlurEnabled(changes.blurEnabled.newValue)
      }
      if (
        host &&
        (changes.customDomains || changes.excludedSites)
      ) {
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

  async function onClear() {
    if (range === "all") {
      const ok = window.confirm("Clear all matching history? This cannot be undone.")
      if (!ok) return
    }

    setBusy(true)
    try {
      const response = await clearHistory(range)
      if (!response?.ok) {
        toast.error("Could not clean history")
        return
      }
      const deleted = Number(response.deleted) || 0
      if (deleted > 0) toast.success(`Removed ${deleted} history entries`)
      else toast.message("No matching history left in that range")
    } catch {
      try {
        const data = await chrome.storage.session.get(["lastClearDeleted", "lastClearAt"])
        if (data.lastClearAt && Date.now() - Number(data.lastClearAt) < 15000) {
          const deleted = Number(data.lastClearDeleted) || 0
          if (deleted > 0) toast.success(`Removed ${deleted} history entries`)
          else toast.message("No matching history left in that range")
          return
        }
      } catch {
        // ignore
      }
      toast.error("Could not clean history")
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

        <Card size="sm">
          <CardHeader>
            <CardTitle>Filter this site</CardTitle>
            <CardDescription>
              {filterSite
                ? "Visits to this site are removed from history."
                : "This site is left alone. History is not cleared."}
            </CardDescription>
            <CardAction>
              <Switch
                checked={filterSite}
                disabled={loading || !host}
                onCheckedChange={onFilterChange}
              />
            </CardAction>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Blur NSFW media</CardTitle>
            <CardDescription>
              When on, NSFW images, video, and media ads are blurred on this
              device. Off by default.
            </CardDescription>
            <CardAction>
              <Switch
                checked={blurEnabled}
                disabled={loading}
                onCheckedChange={onBlurChange}
              />
            </CardAction>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Clear matching history</CardTitle>
            <CardDescription>Choose a period, then clear.</CardDescription>
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
              disabled={busy || loading}
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
                All history
              </ToggleGroupItem>
            </ToggleGroup>

            <Button
              variant="destructive"
              className="w-full"
              disabled={busy || loading}
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
              {busy ? "Clearing…" : RANGE_LABELS[range]}
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
          Advanced settings
        </Button>
      </div>
    </div>
  )
}
