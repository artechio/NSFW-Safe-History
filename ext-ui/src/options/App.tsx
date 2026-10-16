import { useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon, RefreshIcon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  getSettings,
  updateBlocklist,
  updateSettings,
  type ExtensionSettings,
} from "@/lib/extension"

function lines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function formatLastUpdated(timestamp: number) {
  const date = new Date(timestamp)
  const datePart = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  const timePart = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
  return `Last updated: ${datePart} at ${timePart}`
}

export function OptionsApp() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingList, setUpdatingList] = useState(false)
  const [settings, setSettings] = useState<ExtensionSettings | null>(null)
  const [customDomains, setCustomDomains] = useState("")
  const [excludedSites, setExcludedSites] = useState("")

  function applySettings(response: ExtensionSettings & { error?: string }) {
    if (response.error) throw new Error(response.error)
    setSettings(response)
    setCustomDomains((response.customDomains || []).join("\n"))
    setExcludedSites((response.excludedSites || []).join("\n"))
  }

  useEffect(() => {
    getSettings()
      .then(applySettings)
      .catch(() => toast.error("Could not load settings"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function onStorageChanged(
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) {
      if (area !== "sync") return
      if (
        !changes.blurEnabled &&
        !changes.excludedSites &&
        !changes.enabled &&
        !changes.customDomains &&
        !changes.autoDeleteHistory &&
        !changes.blurIntensity &&
        !changes.nsfwThreshold &&
        !changes.lastBlocklistUpdate
      ) {
        return
      }
      getSettings()
        .then(applySettings)
        .catch(() => {})
    }
    chrome.storage.onChanged.addListener(onStorageChanged)
    return () => chrome.storage.onChanged.removeListener(onStorageChanged)
  }, [])

  async function persistToggle(
    patch: Partial<ExtensionSettings>,
    nextLocal: ExtensionSettings
  ) {
    setSettings(nextLocal)
    try {
      const saved = await updateSettings(patch)
      if (saved.error) throw new Error(saved.error)
      setSettings(saved)
    } catch {
      toast.error("Could not save setting")
      const latest = await getSettings().catch(() => null)
      if (latest && !latest.error) applySettings(latest)
    }
  }

  async function onSave() {
    if (!settings) return
    setSaving(true)
    try {
      const next = await updateSettings({
        enabled: settings.enabled,
        autoDeleteHistory: settings.autoDeleteHistory,
        blurEnabled: settings.blurEnabled,
        blurIntensity: Number(settings.blurIntensity),
        nsfwThreshold: Number(settings.nsfwThreshold),
        customDomains: lines(customDomains),
        excludedSites: lines(excludedSites),
      })
      if (next.error) throw new Error(next.error)
      applySettings(next)
      toast.success("Settings saved")
    } catch {
      toast.error("Could not save settings")
    } finally {
      setSaving(false)
    }
  }

  async function onUpdateBlocklist() {
    setUpdatingList(true)
    try {
      const response = await updateBlocklist()
      if (!response?.ok) throw new Error("update failed")
      toast.success(`Adult-site list updated (${response.count} domains)`)
      const next = await getSettings()
      applySettings(next)
    } catch {
      toast.error("Could not update the adult-site list")
    } finally {
      setUpdatingList(false)
    }
  }

  if (loading || !settings) {
    return (
      <div className="bg-background text-foreground flex min-h-screen items-center justify-center p-8">
        <HugeiconsIcon icon={Loading03Icon} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="bg-background text-foreground relative min-h-screen">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,oklch(0.85_0.16_128/0.35),transparent_72%)]"
      />

      <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 md:p-10">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <img
              src={chrome.runtime.getURL("assets/icon128.png")}
              alt=""
              className="size-11 rounded-xl"
            />
            <div className="flex flex-col gap-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
              <p className="text-muted-foreground text-sm">
                Control which sites appear in your history and when to blur adult
                content.
              </p>
            </div>
          </div>
          <Badge variant="secondary">v{chrome.runtime.getManifest().version}</Badge>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field orientation="horizontal" className="justify-between gap-4">
                <FieldContent className="min-w-0">
                  <FieldLabel htmlFor="enabled">Enable extension</FieldLabel>
                  <FieldDescription>
                    Turn off to pause automatic history removal and media blurring.
                  </FieldDescription>
                </FieldContent>
                <Switch
                  id="enabled"
                  className="shrink-0"
                  checked={settings.enabled}
                  onCheckedChange={(checked) =>
                    persistToggle({ enabled: checked }, { ...settings, enabled: checked })
                  }
                />
              </Field>

              <Field orientation="horizontal" className="justify-between gap-4">
                <FieldContent className="min-w-0">
                  <FieldLabel htmlFor="autoDeleteHistory">
                    Automatically remove matching visits
                  </FieldLabel>
                  <FieldDescription>
                    Remove visits to sites on the adult-site list and sites you add.
                    Other visits stay in your history.
                  </FieldDescription>
                </FieldContent>
                <Switch
                  id="autoDeleteHistory"
                  className="shrink-0"
                  checked={settings.autoDeleteHistory}
                  onCheckedChange={(checked) =>
                    persistToggle(
                      { autoDeleteHistory: checked },
                      { ...settings, autoDeleteHistory: checked }
                    )
                  }
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Adult content blurring</CardTitle>
            <CardDescription>
              Media on listed adult sites is blurred immediately. Media on other
              sites is checked on your device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field orientation="horizontal" className="justify-between gap-4">
                <FieldContent className="min-w-0">
                  <FieldLabel htmlFor="blurEnabled">
                    Blur adult images and videos
                  </FieldLabel>
                  <FieldDescription>
                    Includes media ads. Off by default.
                  </FieldDescription>
                </FieldContent>
                <Switch
                  id="blurEnabled"
                  className="shrink-0"
                  checked={settings.blurEnabled}
                  onCheckedChange={(checked) =>
                    persistToggle(
                      { blurEnabled: checked },
                      { ...settings, blurEnabled: checked }
                    )
                  }
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="blurIntensity">Blur strength (px)</FieldLabel>
                <Input
                  id="blurIntensity"
                  type="number"
                  min={5}
                  max={40}
                  value={settings.blurIntensity}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      blurIntensity: Number(event.target.value),
                    })
                  }
                />
                <FieldDescription>
                  Higher values create a stronger blur.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="nsfwThreshold">Detection threshold</FieldLabel>
                <Input
                  id="nsfwThreshold"
                  type="number"
                  min={0.5}
                  max={0.95}
                  step={0.05}
                  value={settings.nsfwThreshold}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      nsfwThreshold: Number(event.target.value),
                    })
                  }
                />
                <FieldDescription>
                  Higher values require more confidence before blurring an image.
                  Range: 0.50–0.95.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Additional sites to filter</CardTitle>
            <CardDescription>
              Apply filtering to these sites, even if they aren’t on the adult-site
              list. Enter one domain per line.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={customDomains}
              onChange={(event) => setCustomDomains(event.target.value)}
              rows={6}
              spellCheck={false}
              placeholder="example.com"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Exceptions to the adult-site list</CardTitle>
            <CardDescription>
              Skip filtering for these sites on the adult-site list. Enter one
              hostname per line.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={excludedSites}
              onChange={(event) => setExcludedSites(event.target.value)}
              rows={6}
              spellCheck={false}
              placeholder="adult.example.com"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Adult-site list</CardTitle>
            <CardDescription>
              {settings.lastBlocklistUpdate
                ? formatLastUpdated(settings.lastBlocklistUpdate)
                : "Updates weekly."}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex-wrap justify-between gap-3">
            <Button
              variant="outline"
              disabled={updatingList}
              onClick={onUpdateBlocklist}
            >
              {updatingList ? (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <HugeiconsIcon icon={RefreshIcon} data-icon="inline-start" />
              )}
              Update adult-site list
            </Button>
            <Button disabled={saving} onClick={onSave}>
              {saving ? (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : null}
              Save settings
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
