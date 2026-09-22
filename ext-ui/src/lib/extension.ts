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

export function getActiveHostname(): Promise<string> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0]
      if (!tab?.url) {
        resolve("")
        return
      }
      try {
        resolve(new URL(tab.url).hostname)
      } catch {
        resolve("")
      }
    })
  })
}
