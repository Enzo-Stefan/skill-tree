import { JSDOM } from 'jsdom'

// Node 25+ exposes an experimental `localStorage` global. Without --localstorage-file it is not a
// working Storage (on Node 26 `clear` is undefined), and it shadows the jsdom Storage that vitest
// would otherwise install. Replace both web storage globals with jsdom's own Storage when the
// current global is not a working Storage. On Node versions without the global this is a no-op
// for the already-correct case and installs jsdom's Storage otherwise. Tests without a DOM
// environment have no `document` and are left alone.
const WEB_STORAGE_KEYS = ['localStorage', 'sessionStorage'] as const

function hasWorkingStorage(key: (typeof WEB_STORAGE_KEYS)[number]): boolean {
  const current: unknown = Reflect.get(globalThis, key)
  return typeof (current as Storage | undefined)?.clear === 'function'
}

if (typeof document !== 'undefined' && WEB_STORAGE_KEYS.some((key) => !hasWorkingStorage(key))) {
  const { window } = new JSDOM('', { url: globalThis.location?.href ?? 'http://localhost/' })
  for (const key of WEB_STORAGE_KEYS) {
    if (!hasWorkingStorage(key)) {
      Object.defineProperty(globalThis, key, { configurable: true, value: window[key] })
    }
  }
}
