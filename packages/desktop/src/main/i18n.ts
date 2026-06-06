import * as i18n from "@solid-primitives/i18n"

import { DESKTOP_STORAGE, LEGACY_DESKTOP_STORAGE } from "@opencode-ai/ui/brand"
import { dict as desktopEn } from "../renderer/i18n/en"
import { dict as desktopZh } from "../renderer/i18n/zh"
import { dict as desktopZht } from "../renderer/i18n/zht"
import { dict as desktopKo } from "../renderer/i18n/ko"
import { dict as desktopDe } from "../renderer/i18n/de"
import { dict as desktopEs } from "../renderer/i18n/es"
import { dict as desktopFr } from "../renderer/i18n/fr"
import { dict as desktopDa } from "../renderer/i18n/da"
import { dict as desktopJa } from "../renderer/i18n/ja"
import { dict as desktopPl } from "../renderer/i18n/pl"
import { dict as desktopRu } from "../renderer/i18n/ru"
import { dict as desktopUk } from "../renderer/i18n/uk"
import { dict as desktopAr } from "../renderer/i18n/ar"
import { dict as desktopNo } from "../renderer/i18n/no"
import { dict as desktopBr } from "../renderer/i18n/br"
import { dict as desktopBs } from "../renderer/i18n/bs"
import { getStore } from "./store"

type Locale =
  | "en"
  | "zh"
  | "zht"
  | "ko"
  | "de"
  | "es"
  | "fr"
  | "da"
  | "ja"
  | "pl"
  | "ru"
  | "uk"
  | "ar"
  | "no"
  | "br"
  | "bs"

type Dictionary = i18n.Flatten<typeof desktopEn>

const base = i18n.flatten(desktopEn)

function build(locale: Locale): Dictionary {
  if (locale === "en") return base
  if (locale === "zh") return { ...base, ...i18n.flatten(desktopZh) }
  if (locale === "zht") return { ...base, ...i18n.flatten(desktopZht) }
  if (locale === "de") return { ...base, ...i18n.flatten(desktopDe) }
  if (locale === "es") return { ...base, ...i18n.flatten(desktopEs) }
  if (locale === "fr") return { ...base, ...i18n.flatten(desktopFr) }
  if (locale === "da") return { ...base, ...i18n.flatten(desktopDa) }
  if (locale === "ja") return { ...base, ...i18n.flatten(desktopJa) }
  if (locale === "pl") return { ...base, ...i18n.flatten(desktopPl) }
  if (locale === "ru") return { ...base, ...i18n.flatten(desktopRu) }
  if (locale === "uk") return { ...base, ...i18n.flatten(desktopUk) }
  if (locale === "ar") return { ...base, ...i18n.flatten(desktopAr) }
  if (locale === "no") return { ...base, ...i18n.flatten(desktopNo) }
  if (locale === "br") return { ...base, ...i18n.flatten(desktopBr) }
  if (locale === "bs") return { ...base, ...i18n.flatten(desktopBs) }
  return { ...base, ...i18n.flatten(desktopKo) }
}

function parseLocale(value: unknown): Locale | null {
  if (typeof value === "string" && value.length > 0) {
    if (value === "en" || value.startsWith("en-")) return "en"
    if (value === "zh" || value.startsWith("zh-Hans")) return "zh"
    if (value === "zht" || value.startsWith("zh-Hant")) return "zht"
    if (value === "ko" || value.startsWith("ko")) return "ko"
    if (value === "de" || value.startsWith("de")) return "de"
    if (value === "es" || value.startsWith("es")) return "es"
    if (value === "fr" || value.startsWith("fr")) return "fr"
    if (value === "da" || value.startsWith("da")) return "da"
    if (value === "ja" || value.startsWith("ja")) return "ja"
    if (value === "pl" || value.startsWith("pl")) return "pl"
    if (value === "ru" || value.startsWith("ru")) return "ru"
    if (value === "uk" || value.startsWith("uk")) return "uk"
    if (value === "ar" || value.startsWith("ar")) return "ar"
    if (value === "no" || value.startsWith("no") || value.startsWith("nb") || value.startsWith("nn")) return "no"
    if (value === "br" || value.startsWith("pt")) return "br"
    if (value === "bs" || value.startsWith("bs")) return "bs"
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    return parseLocale(record.locale)
  }

  if (typeof value === "string") {
    try {
      return parseLocale(JSON.parse(value))
    } catch {
      return null
    }
  }

  return null
}

function readLocale(): Locale {
  const store = getStore(DESKTOP_STORAGE.globalDat)
  const legacy = getStore(LEGACY_DESKTOP_STORAGE.globalDat)
  const raw = store.get("language") ?? legacy.get("language")
  return parseLocale(raw) ?? "en"
}

export function tDesktop(key: keyof Dictionary, params?: Record<string, string | number>): string {
  const dict = build(readLocale())
  const translate = i18n.translator(() => dict, i18n.resolveTemplate)
  return translate(key, params)
}
