import { useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon, RefreshIcon, ShieldKeyIcon } from "@hugeicons/core-free-icons"
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
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
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

export function OptionsApp() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingList, setUpdatingList] = useState(false)
  const [settings, setSettings] = useState<ExtensionSettings | null>(null)
  const [customDomains, setCustomDomains] = useState("")
  const [excludedSites, setExcludedSites] = useState("")

  useEffect(() => {
    getSettings()
      .then((response) => {
        if (response.error) throw new Error(response.error)
        setSettings(response)
        setCustomDomains((response.customDomains || []).join("\n"))
        setExcludedSites((response.excludedSites || []).join("\n"))
      })
      .catch(() => toast.error("Could not load settings"))
      .finally(() => setLoading(false))
  }, [])

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
      setSettings(next)
      setCustomDomains((next.customDomains || []).join("\n"))
      setExcludedSites((next.excludedSites || []).join("\n"))
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
      toast.success(`Domain list updated (${response.count} domains)`)
      const next = await getSettings()
      setSettings(next)
    } catch {
      toast.error("Could not update the domain list")
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
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,oklch(0.45_0.04_250/0.28),transparent_72%)]"
      />

      <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 md:p-10">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl shadow-sm">
              <HugeiconsIcon icon={ShieldKeyIcon} />
            </div>
            <div className="flex flex-col gap-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">NSFW Safe History</h1>
              <p className="text-muted-foreground text-sm">
                Tune protection, blur strength, and the domain lists used for history cleaning.
              </p>
            </div>
          </div>
          <Badge variant="secondary">v{chrome.runtime.getManifest().version}</Badge>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Protection</CardTitle>
            <CardDescription>Core switches for cleaning and blurring.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field orientation="horizontal">
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="enabled">Enable protection</FieldLabel>
                  <FieldDescription>Master switch for the extension.</FieldDescription>
                </div>
                <Switch
                  id="enabled"
                  checked={settings.enabled}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, enabled: checked })
                  }
                />
              </Field>

              <Field orientation="horizontal">
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="autoDeleteHistory">
                    Delete matching history on visit
                  </FieldLabel>
                  <FieldDescription>
                    Remove listed or adult-titled pages as soon as they open.
                  </FieldDescription>
                </div>
                <Switch
                  id="autoDeleteHistory"
                  checked={settings.autoDeleteHistory}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, autoDeleteHistory: checked })
                  }
                />
              </Field>

              <Field orientation="horizontal">
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="blurEnabled">Blur adult media</FieldLabel>
                  <FieldDescription>
                    Includes images, videos, iframes, and ad backgrounds.
                  </FieldDescription>
                </div>
                <Switch
                  id="blurEnabled"
                  checked={settings.blurEnabled}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, blurEnabled: checked })
                  }
                />
              </Field>

              <Separator />

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
              </Field>

              <Field>
                <FieldLabel htmlFor="nsfwThreshold">
                  Detection threshold (0.50–0.95)
                </FieldLabel>
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
                  Higher values blur fewer borderline images.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Custom domains</CardTitle>
            <CardDescription>One domain per line. Visits are removed from history.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={customDomains}
              onChange={(event) => setCustomDomains(event.target.value)}
              rows={6}
              spellCheck={false}
              placeholder={"example.com\ncdn.example.com"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Excluded sites</CardTitle>
            <CardDescription>One hostname per line. These sites stay untouched.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={excludedSites}
              onChange={(event) => setExcludedSites(event.target.value)}
              rows={6}
              spellCheck={false}
              placeholder="news.example.com"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Domain list</CardTitle>
            <CardDescription>
              {settings.lastBlocklistUpdate
                ? `Last updated ${new Date(settings.lastBlocklistUpdate).toLocaleString()}.`
                : "The built-in adult-domain list updates weekly."}
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
              Update domain list now
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
