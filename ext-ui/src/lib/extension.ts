export type ExtensionSettings = {
  enabled: boolean
  autoDeleteHistory: boolean
  blurEnabled: boolean
  blurIntensity: number
  nsfwThreshold: number
  excludedSites: string[]
  customDomains: string[]
  lastBlocklistUpdate: number
  lastCleanRange: "today" | "week" | "month" | "all"
}

export type SiteStatus = ExtensionSettings & {
  listed?: boolean
  filterActive?: boolean
  inBlocklist?: boolean
  inIncluded?: boolean
  inExcluded?: boolean
  captchaFrame?: boolean
  hostname?: string
  tabHostname?: string
  error?: string
}

export type CleanRange = ExtensionSettings["lastCleanRange"]

function sendMessage<T>(message: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const err = chrome.runtime.lastError
      if (err) reject(new Error(err.message))
      else resolve(response as T)
    })
  })
}

export function getSettings() {
  return sendMessage<ExtensionSettings & { error?: string }>({ action: "GET_SETTINGS" })
}

export function getSiteStatus(hostname: string) {
  return sendMessage<SiteStatus>({ action: "GET_SITE_STATUS", hostname })
}

export function updateSettings(settings: Partial<ExtensionSettings>) {
  return sendMessage<ExtensionSettings & { error?: string }>({
    action: "UPDATE_SETTINGS",
    settings,
  })
}

export function clearHistory(range: CleanRange) {
  return sendMessage<{ ok: boolean; deleted?: number; error?: string }>({
    action: "CLEAR_HISTORY",
    range,
  })
}

export function setSiteFilter(hostname: string, enabled: boolean) {
  return sendMessage<SiteStatus & { deleted?: number }>({
    action: "SET_SITE_FILTER",
    hostname,
    enabled,
  })
}

export type Stats = {
  removedTotal: number
  removedToday: number
  since: number
  error?: string
}

export function getStats() {
  return sendMessage<Stats>({ action: "GET_STATS" })
}

export function exportSettings() {
  return sendMessage<{ ok: boolean; backup?: unknown; error?: string }>({
    action: "EXPORT_SETTINGS",
  })
}

export function importSettings(backup: string) {
  return sendMessage<{
    ok: boolean
    settings?: ExtensionSettings
    error?: string
  }>({ action: "IMPORT_SETTINGS", backup })
}

export type Shortcut = { name: string; description: string; shortcut: string }

export function getShortcuts(): Promise<Shortcut[]> {
  return new Promise((resolve) => {
    if (!chrome.commands?.getAll) {
      resolve([])
      return
    }
    chrome.commands.getAll((commands) => {
      resolve(
        commands
          .filter((command) => command.name && command.name !== "_execute_action")
          .map((command) => ({
            name: command.name || "",
            description: command.description || "",
            shortcut: command.shortcut || "",
          }))
      )
    })
  })
}

export function updateBlocklist() {
  return sendMessage<{ ok: boolean; count?: number; error?: string }>({
    action: "UPDATE_BLOCKLIST",
  })
}

export type ActivePage = {
  hostname: string
  supported: boolean
}

function isFilterableUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

export function getActivePage(): Promise<ActivePage> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0]
      if (!tab?.url || !isFilterableUrl(tab.url)) {
        resolve({ hostname: "", supported: false })
        return
      }
      try {
        resolve({ hostname: new URL(tab.url).hostname, supported: true })
      } catch {
        resolve({ hostname: "", supported: false })
      }
    })
  })
}

export function getActiveHostname(): Promise<string> {
  return getActivePage().then((page) => page.hostname)
}
