import { useEffect, useMemo, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Download01Icon,
  KeyboardIcon,
  Loading03Icon,
  RefreshIcon,
  Upload01Icon,
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
  exportSettings,
  getSettings,
  getShortcuts,
  importSettings,
  updateBlocklist,
  updateSettings,
  type ExtensionSettings,
  type Shortcut,
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
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([])
  const fileInput = useRef<HTMLInputElement>(null)
  const version = useMemo(() => chrome.runtime.getManifest().version, [])

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
    getShortcuts()
      .then(setShortcuts)
      .catch(() => {})
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

  async function onExport() {
    try {
      const response = await exportSettings()
      if (!response?.ok || !response.backup) throw new Error("export failed")
      const blob = new Blob([JSON.stringify(response.backup, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `nsfw-safe-history-settings-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success("Settings exported")
    } catch {
      toast.error("Could not export settings")
    }
  }

  async function onImportFile(file: File | undefined) {
    if (!file) return
    try {
      const response = await importSettings(await file.text())
      if (!response?.ok || !response.settings) {
        throw new Error(response?.error || "import failed")
      }
      applySettings(response.settings)
      toast.success("Settings imported")
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? `Could not import settings: ${error.message}`
          : "Could not import settings"
      )
    } finally {
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  if (loading || !settings) {
    return (
      <div className="bg-background text-foreground flex min-h-screen items-center justify-center p-8">
        <HugeiconsIcon icon={Loading03Icon} className="animate-spin" />
      </div>
    )
  }

  const blurControlsDisabled = !settings.blurEnabled

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-5 md:p-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src={chrome.runtime.getURL("assets/icon128.png")}
              alt=""
              className="size-9 rounded-lg"
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <h1 className="text-lg font-semibold tracking-tight">
                NSFW Safe History
              </h1>
              <p className="text-muted-foreground text-xs leading-snug">
                Control which sites appear in your history and when to blur adult
                content.
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

        <Card size="sm" className="gap-3 py-3">
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
                    Remove visits to sites on the adult-site list and sites you
                    add. Other visits stay in your history.
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

        <Card size="sm" className="gap-3 py-3">
          <CardHeader>
            <CardTitle>Blur adult images and videos</CardTitle>
            <CardDescription>
              Images and videos on listed adult sites are blurred immediately.
              Other sites are checked on your device. Includes media ads.
            </CardDescription>
            <CardAction>
              <Switch
                id="blurEnabled"
                checked={settings.blurEnabled}
                onCheckedChange={(checked) =>
                  persistToggle(
                    { blurEnabled: checked },
                    { ...settings, blurEnabled: checked }
                  )
                }
              />
            </CardAction>
          </CardHeader>
          <CardContent>
            <FieldGroup
              className={
                blurControlsDisabled ? "pointer-events-none" : undefined
              }
              aria-disabled={blurControlsDisabled || undefined}
            >
              <Field>
                <FieldLabel htmlFor="blurIntensity">Blur strength (px)</FieldLabel>
                <Input
                  id="blurIntensity"
                  type="number"
                  min={5}
                  max={40}
                  disabled={blurControlsDisabled}
                  className={blurControlsDisabled ? "opacity-60" : undefined}
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
                  disabled={blurControlsDisabled}
                  className={blurControlsDisabled ? "opacity-60" : undefined}
                  value={settings.nsfwThreshold}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      nsfwThreshold: Number(event.target.value),
                    })
                  }
                />
                <FieldDescription>
                  Higher values need more confidence before blurring. Range:
                  0.50–0.95.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card size="sm" className="gap-3 py-3">
          <CardHeader>
            <CardTitle>Additional sites to filter</CardTitle>
            <CardDescription>
              Apply filtering even if these sites aren’t on the adult-site list.
              Enter one domain per line.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={customDomains}
              onChange={(event) => setCustomDomains(event.target.value)}
              rows={5}
              spellCheck={false}
              placeholder="example.com"
            />
          </CardContent>
        </Card>

        <Card size="sm" className="gap-3 py-3">
          <CardHeader>
            <CardTitle>Exceptions to the adult-site list</CardTitle>
            <CardDescription>
              Skip filtering for these adult-list sites. Enter one hostname per
              line.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={excludedSites}
              onChange={(event) => setExcludedSites(event.target.value)}
              rows={5}
              spellCheck={false}
              placeholder="adult.example.com"
            />
          </CardContent>
        </Card>

        <Card size="sm" className="gap-3 py-3">
          <CardHeader>
            <CardTitle>Adult-site list</CardTitle>
            <CardDescription>
              {settings.lastBlocklistUpdate
                ? formatLastUpdated(settings.lastBlocklistUpdate)
                : "Updates weekly."}
            </CardDescription>
          </CardHeader>
          <CardFooter>
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
          </CardFooter>
        </Card>

        <Card size="sm" className="gap-3 py-3">
          <CardHeader>
            <CardTitle>Keyboard shortcuts</CardTitle>
            <CardDescription>
              Work from any tab without opening the popup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {shortcuts.map((shortcut) => (
                <li
                  key={shortcut.name}
                  className="flex items-center justify-between gap-4 text-xs"
                >
                  <span>{shortcut.description}</span>
                  <kbd className="bg-muted text-muted-foreground shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px]">
                    {shortcut.shortcut || "Not set"}
                  </kbd>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              onClick={() =>
                chrome.tabs.create({ url: "chrome://extensions/shortcuts" })
              }
            >
              <HugeiconsIcon icon={KeyboardIcon} data-icon="inline-start" />
              Change shortcuts
            </Button>
          </CardFooter>
        </Card>

        <Card size="sm" className="gap-3 py-3">
          <CardHeader>
            <CardTitle>Backup</CardTitle>
            <CardDescription>
              Save your switches and site lists to a file, or restore them on
              another browser. Your history is never included.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onExport}>
              <HugeiconsIcon icon={Download01Icon} data-icon="inline-start" />
              Export settings
            </Button>
            <Button variant="outline" onClick={() => fileInput.current?.click()}>
              <HugeiconsIcon icon={Upload01Icon} data-icon="inline-start" />
              Import settings
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => onImportFile(event.target.files?.[0])}
            />
          </CardFooter>
        </Card>

        <div className="flex justify-end">
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
        </div>

        <FooterLinks className="pb-1" />
      </div>
    </div>
  )
}
