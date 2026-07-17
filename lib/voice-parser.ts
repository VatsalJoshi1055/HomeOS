import { getGroceryTerms } from "@/lib/categories"

export type SpeechRecognitionErrorCode =
  | "aborted"
  | "audio-capture"
  | "bad-grammar"
  | "language-not-supported"
  | "network"
  | "no-speech"
  | "not-allowed"
  | "service-not-allowed"

export function getSpeechRecognitionCtor():
  | (new () => SpeechRecognition)
  | null {
  if (typeof window === "undefined") return null
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function speechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null
}

export function describeSpeechError(code: string): string | null {
  switch (code) {
    case "aborted":
      return null
    case "no-speech":
      return "No speech detected. Tap Voice and speak your items clearly."
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow mic permission for this site in your browser settings, then try again."
    case "audio-capture":
      return "No microphone found. Check that a mic is connected and not used by another app."
    case "network":
      return "Voice needs Chrome or Edge opened outside Cursor. The Cursor browser cannot reach the speech service — copy http://localhost:3000 into Chrome/Edge and try Voice there."
    case "language-not-supported":
      return "Speech language is not supported. Trying again with English…"
    default:
      return `Voice recognition failed (${code}).`
  }
}

/** Embedded / restricted browsers often expose SpeechRecognition but cannot use Google's speech service. */
export function isRestrictedSpeechEnvironment(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  if (/Electron|Cursor|VSCode|Code[/ ]/i.test(ua)) return true
  return false
}

/**
 * Parse spoken grocery phrases into structured items.
 * Example: "Need two litres milk, five kilo rice and cooking oil"
 * Also handles pause-style lists without "and": "milk chicken rice"
 */

export interface ParsedVoiceItem {
  title: string
  quantity: number
  unit: string | null
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  half: 0.5,
  dozen: 12,
}

const UNIT_MAP: Record<string, string> = {
  litre: "L",
  litres: "L",
  liter: "L",
  liters: "L",
  l: "L",
  kilo: "kg",
  kilos: "kg",
  kilogram: "kg",
  kilograms: "kg",
  kg: "kg",
  gram: "g",
  grams: "g",
  g: "g",
  pack: "pack",
  packs: "pack",
  packet: "packet",
  packets: "packet",
  bottle: "bottle",
  bottles: "bottle",
  piece: "pcs",
  pieces: "pcs",
  pcs: "pcs",
  dozen: "dozen",
}

const FILLER = new Set([
  "of",
  "the",
  "a",
  "an",
  "some",
  "please",
  "also",
  "plus",
  "with",
])

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function matchGroceryAt(
  tokens: string[],
  index: number,
  terms: string[]
): { title: string; length: number } | null {
  for (const term of terms) {
    const parts = term.split(" ")
    if (index + parts.length > tokens.length) continue
    const matches = parts.every((part, offset) => tokens[index + offset] === part)
    if (matches) return { title: titleCase(term), length: parts.length }
  }
  return null
}

function isQuantityToken(token: string): boolean {
  return /^\d+(\.\d+)?$/.test(token) || NUMBER_WORDS[token] !== undefined
}

function readQuantity(token: string): number {
  if (/^\d+(\.\d+)?$/.test(token)) return parseFloat(token)
  return NUMBER_WORDS[token] ?? 1
}

function parseTokenStream(tokens: string[]): ParsedVoiceItem[] {
  const terms = getGroceryTerms()
  const items: ParsedVoiceItem[] = []
  let i = 0

  while (i < tokens.length) {
    while (i < tokens.length && FILLER.has(tokens[i])) i += 1
    if (i >= tokens.length) break

    let quantity = 1
    let unit: string | null = null

    if (isQuantityToken(tokens[i])) {
      quantity = readQuantity(tokens[i])
      i += 1
      if (i < tokens.length && UNIT_MAP[tokens[i]]) {
        unit = UNIT_MAP[tokens[i]]
        i += 1
      }
      while (i < tokens.length && FILLER.has(tokens[i])) i += 1
    } else if (UNIT_MAP[tokens[i]]) {
      // "litres milk" style
      unit = UNIT_MAP[tokens[i]]
      i += 1
      while (i < tokens.length && FILLER.has(tokens[i])) i += 1
    }

    if (i >= tokens.length) break

    const grocery = matchGroceryAt(tokens, i, terms)
    if (grocery) {
      items.push({ title: grocery.title, quantity, unit })
      i += grocery.length
      continue
    }

    // Unknown product: take words until the next quantity or known grocery
    const start = i
    i += 1
    while (i < tokens.length) {
      if (FILLER.has(tokens[i])) {
        i += 1
        continue
      }
      if (isQuantityToken(tokens[i])) break
      if (UNIT_MAP[tokens[i]] && matchGroceryAt(tokens, i + 1, terms)) break
      if (matchGroceryAt(tokens, i, terms)) break
      i += 1
    }

    const title = tokens
      .slice(start, i)
      .filter((token) => !FILLER.has(token))
      .join(" ")
      .trim()

    if (title) {
      items.push({ title: titleCase(title), quantity, unit })
    }
  }

  return items
}

export function parseVoiceTranscript(transcript: string): ParsedVoiceItem[] {
  const cleaned = transcript
    .toLowerCase()
    .replace(/[./]/g, " ")
    .replace(/\b(need|please|get|buy|add|i want|i need|we need|we want)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!cleaned) return []

  // Split explicit separators first, then vocabulary-split each chunk
  const chunks = cleaned
    .split(/,|\band\b|\bthen\b|\bplus\b|\balso\b/i)
    .map((chunk) => chunk.trim())
    .filter(Boolean)

  const items: ParsedVoiceItem[] = []
  for (const chunk of chunks) {
    const tokens = chunk.split(" ").filter(Boolean)
    items.push(...parseTokenStream(tokens))
  }

  return items
}
