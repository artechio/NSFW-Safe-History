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
