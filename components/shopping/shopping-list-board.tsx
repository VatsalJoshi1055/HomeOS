"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { toast } from "sonner"
import {
  ArrowDownAZ,
  Check,
  CheckCheck,
  Keyboard,
  Loader2,
  Mic,
  MicOff,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { reportClientError } from "@/lib/errors"
import { isStandalonePwa } from "@/lib/display-mode"
import {
  clientBulkComplete,
  clientBulkDelete,
  clientDeleteItem,
  clientDuplicateItem,
  clientInsertItem,
  clientInsertItemsBulk,
  clientToggleItem,
  clientUpdateItem,
} from "@/lib/shopping-client"
import type { ItemPriority, ShoppingItem } from "@/types/database"
import { ALL_CATEGORIES } from "@/lib/categories"
import {
  describeSpeechError,
  getSpeechRecognitionCtor,
  isRestrictedSpeechEnvironment,
  parseVoiceTranscript,
  speechRecognitionSupported,
} from "@/lib/voice-parser"
import { RelativeTime } from "@/components/relative-time"
import { useShoppingListSync } from "@/hooks/use-shopping-list-sync"
import type { ShoppingItemWithPeople } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

type FilterMode = "all" | "remaining" | "done"
type SortMode = "order" | "name" | "priority" | "category"

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 }

function sortLocal(items: ShoppingItemWithPeople[]) {
  return [...items].sort((a, b) => a.sort_order - b.sort_order)
}

function withPeople(
  item: ShoppingItem,
  currentUserId: string
): ShoppingItemWithPeople {
  const self =
    currentUserId && item.created_by === currentUserId ? "You" : null
  return {
    ...item,
    creator_name: self,
    completer_name:
      item.completed_by && item.completed_by === currentUserId ? "You" : null,
  }
}

export function ShoppingListBoard({
  listId,
  householdId,
  currentUserId,
  initialItems,
  onStatsChange,
}: {
  listId: string
  householdId: string
  currentUserId: string
  initialItems: ShoppingItemWithPeople[]
  onStatsChange?: (stats: {
    remaining: number
    estimatedCost: number
    total: number
  }) => void
}) {
  const { items, setItems, live, refreshItems, setPendingPatch, clearPending } =
    useShoppingListSync({
      listId,
      householdId,
      currentUserId,
      initialItems,
    })

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterMode>("all")
  const [sort, setSort] = useState<SortMode>("order")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [editing, setEditing] = useState<ShoppingItemWithPeople | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const [voicePreview, setVoicePreview] = useState("")
  const [typeOpen, setTypeOpen] = useState(false)
  const [typeText, setTypeText] = useState("")
  const [typePending, setTypePending] = useState(false)
  const voiceSupported = useSyncExternalStore(
    () => () => {},
    () => speechRecognitionSupported(),
    () => false
  )
  const titleRef = useRef<HTMLInputElement>(null)
  const undoRef = useRef<{ item: ShoppingItemWithPeople } | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const voiceFinalRef = useRef("")
  const voiceHadErrorRef = useRef(false)

  useEffect(() => {
    if (!onStatsChange) return
    const remainingItems = items.filter((i) => !i.completed)
    onStatsChange({
      remaining: remainingItems.length,
      estimatedCost: remainingItems.reduce(
        (sum, i) => sum + Number(i.estimated_price ?? 0),
        0
      ),
      total: items.length,
    })
  }, [items, onStatsChange])

  const visible = useMemo(() => {
    let list = [...items]
    if (filter === "remaining") list = list.filter((i) => !i.completed)
    if (filter === "done") list = list.filter((i) => i.completed)
    if (categoryFilter !== "all") {
      list = list.filter((i) => i.category === categoryFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          (i.notes ?? "").toLowerCase().includes(q) ||
          (i.category ?? "").toLowerCase().includes(q)
      )
    }
    if (sort === "name") list.sort((a, b) => a.title.localeCompare(b.title))
    if (sort === "priority") {
      list.sort(
        (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      )
    }
    if (sort === "category") {
      list.sort((a, b) =>
        (a.category ?? "").localeCompare(b.category ?? "")
      )
    }
    return list
  }, [items, filter, categoryFilter, search, sort])

  const nextSortOrder = useCallback(() => {
    return Math.max(0, ...items.map((item) => item.sort_order)) + 1
  }, [items])

  const toggle = useCallback(
    async (item: ShoppingItemWithPeople) => {
      const next = !item.completed
      const patch = {
        completed: next,
        completed_at: next ? new Date().toISOString() : null,
        completed_by: next ? currentUserId : null,
      }
      setPendingPatch(item.id, patch)
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, ...patch } : row))
      )
      const result = await clientToggleItem({
        itemId: item.id,
        householdId,
        userId: currentUserId,
        completed: next,
      })
      if (result.error) {
        clearPending(item.id)
        toast.error(result.error)
        void reportClientError("toggle_item", result.error, { itemId: item.id })
        await refreshItems()
        return
      }
      clearPending(item.id)
    },
    [
      currentUserId,
      householdId,
      refreshItems,
      setItems,
      setPendingPatch,
      clearPending,
    ]
  )

  async function handleDelete(item: ShoppingItemWithPeople) {
    undoRef.current = { item }
    setPendingPatch(item.id, { _deleted: true })
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    const result = await clientDeleteItem({
      itemId: item.id,
      householdId,
    })
    if (result.error) {
      clearPending(item.id)
      toast.error(result.error)
      void reportClientError("delete_item", result.error, { itemId: item.id })
      await refreshItems()
      return
    }
    clearPending(item.id)
    toast.success(`Removed ${item.title}`, {
      action: {
        label: "Undo",
        onClick: async () => {
          const undo = await clientInsertItem({
            listId,
            householdId,
            userId: currentUserId,
            title: item.title,
            quantity: item.quantity,
            unit: item.unit,
            category: item.category,
            notes: item.notes,
            estimated_price: item.estimated_price,
            priority: item.priority,
            sort_order: nextSortOrder(),
          })
          if (undo.error) {
            toast.error(undo.error)
            void reportClientError("undo_delete", undo.error)
            return
          }
          if (undo.data) {
            setItems((prev) =>
              sortLocal([
                ...prev.filter((row) => row.id !== undo.data!.id),
                withPeople(undo.data!, currentUserId),
              ])
            )
          }
        },
      },
    })
  }

  async function applyVoiceTranscript(transcript: string) {
    const parsed = parseVoiceTranscript(transcript)
    if (!parsed.length) {
      toast.error(`Could not parse: "${transcript}"`)
      return
    }
    const result = await clientInsertItemsBulk({
      listId,
      householdId,
      userId: currentUserId,
      sortStart: nextSortOrder(),
      items: parsed,
    })
    if (result.error) {
      toast.error(result.error)
      void reportClientError("voice_add", result.error)
      return
    }
    if (result.data?.length) {
      setItems((prev) => {
        const ids = new Set(prev.map((row) => row.id))
        const extra = result.data!.filter((row) => !ids.has(row.id)).map((row) =>
          withPeople(row, currentUserId)
        )
        return sortLocal([...prev, ...extra])
      })
    }
    toast.success(`Added ${parsed.length} items from voice`)
  }

  function stopVoice() {
    try {
      recognitionRef.current?.stop()
    } catch {
      /* ignore */
    }
    recognitionRef.current = null
    setListening(false)
  }

  async function ensureMicrophoneAccess(): Promise<boolean> {
    if (isStandalonePwa()) return true
    if (!navigator.mediaDevices?.getUserMedia) return true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      return true
    } catch {
      toast.error(
        "Microphone access is blocked. Allow mic permission for this site, then try again."
      )
      return false
    }
  }

  function openTypeFallback(prefill = "") {
    setTypeText(prefill)
    setTypeOpen(true)
  }

  async function startVoice() {
    if (listening) {
      stopVoice()
      return
    }

    if (isRestrictedSpeechEnvironment()) {
      openTypeFallback()
      return
    }

    const SR = getSpeechRecognitionCtor()
    if (!SR) {
      openTypeFallback()
      return
    }

    const micOk = await ensureMicrophoneAccess()
    if (!micOk) {
      openTypeFallback()
      return
    }

    voiceFinalRef.current = ""
    voiceHadErrorRef.current = false
    setVoicePreview("")

    const recognition = new SR()
    recognitionRef.current = recognition
    recognition.lang =
      typeof navigator !== "undefined" && navigator.language?.startsWith("en")
        ? navigator.language
        : "en-IN"
    recognition.interimResults = true
    recognition.continuous = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setListening(true)
      toast.message("Listening… say your grocery items, then tap Stop.")
    }

    recognition.onresult = (event) => {
      let interim = ""
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ""
        if (result.isFinal) {
          voiceFinalRef.current = `${voiceFinalRef.current} ${text}`.trim()
        } else {
          interim += text
        }
      }
      setVoicePreview(
        [voiceFinalRef.current, interim].filter(Boolean).join(" ").trim()
      )
    }

    recognition.onerror = (event) => {
      voiceHadErrorRef.current = true
      const code = event.error
      setListening(false)
      recognitionRef.current = null
      setVoicePreview("")
      if (code === "aborted") return
      if (
        (code === "network" ||
          code === "not-allowed" ||
          code === "service-not-allowed") &&
        isStandalonePwa()
      ) {
        toast.message(
          "Voice isn't available in the installed app on this device. Type the items instead."
        )
        openTypeFallback()
        return
      }
      const message = describeSpeechError(code)
      if (message) toast.error(message)
      if (code === "network" || code === "not-allowed") openTypeFallback()
    }

    recognition.onend = () => {
      const transcript = voiceFinalRef.current.trim()
      const hadError = voiceHadErrorRef.current
      recognitionRef.current = null
      setListening(false)
      setVoicePreview("")
      voiceFinalRef.current = ""
      voiceHadErrorRef.current = false

      if (hadError) return
      if (!transcript) {
        toast.message("No items captured. Tap Voice and try again, or type them.")
        return
      }
      void applyVoiceTranscript(transcript)
    }

    try {
      recognition.start()
    } catch {
      setListening(false)
      recognitionRef.current = null
      toast.error("Could not start voice recognition. Type the items instead.")
      openTypeFallback()
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

  return (
    <div className="space-y-1.5 sm:space-y-4">
      <div className="flex items-center justify-end gap-2 sm:justify-between">
        <p className="hidden min-w-0 flex-1 text-xs text-gray-500 sm:block">
          Live sync with your household
        </p>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[11px] ${
            live
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              live ? "animate-pulse bg-emerald-500" : "bg-amber-500"
            }`}
          />
          {live ? "Live" : "Reconnecting…"}
        </span>
      </div>

      <div className="space-y-1.5 sm:space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-gray-400 sm:left-3.5 sm:size-4" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="h-10 pl-9 sm:h-11 sm:pl-10"
            inputMode="search"
            enterKeyHint="search"
          />
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterMode)}
            className="h-9 min-w-0 rounded-lg border border-gray-200 bg-white px-1.5 text-[11px] sm:h-11 sm:rounded-xl sm:px-3 sm:text-sm"
            aria-label="Filter items"
          >
            <option value="all">All</option>
            <option value="remaining">Left</option>
            <option value="done">Done</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 min-w-0 rounded-lg border border-gray-200 bg-white px-1.5 text-[11px] sm:h-11 sm:rounded-xl sm:px-3 sm:text-sm"
            aria-label="Filter by category"
          >
            <option value="all">Category</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="h-9 min-w-0 rounded-lg border border-gray-200 bg-white px-1.5 text-[11px] sm:h-11 sm:rounded-xl sm:px-3 sm:text-sm"
            aria-label="Sort items"
          >
            <option value="order">Order</option>
            <option value="name">Name</option>
            <option value="priority">Priority</option>
            <option value="category">Category</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
          {voiceSupported ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void startVoice()}
              className="h-10 min-h-10 gap-1 touch-manipulation sm:h-11 sm:min-h-11"
              aria-pressed={listening}
            >
              {listening ? (
                <MicOff className="size-3.5 animate-pulse text-red-500 sm:size-4" />
              ) : (
                <Mic className="size-3.5 sm:size-4" />
              )}
              {listening ? "Stop" : "Voice"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openTypeFallback()}
              className="h-10 min-h-10 gap-1 touch-manipulation sm:h-11 sm:min-h-11"
            >
              <Keyboard className="size-3.5 sm:size-4" />
              Quick add
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 min-h-10 sm:h-11 sm:min-h-11"
            onClick={() => {
              if (selectMode) exitSelectMode()
              else setSelectMode(true)
            }}
          >
            {selectMode ? "Done" : "Select"}
          </Button>

          {/* Desktop/tablet only — mobile uses the sticky bottom Add Item */}
          <Button
            className="col-span-2 hidden bg-amber-500 text-white hover:bg-amber-600 lg:col-span-1 lg:ml-auto lg:inline-flex"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="mr-1 size-4" />
            Add Item
          </Button>
        </div>
      </div>

      {listening && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
          role="status"
          aria-live="polite"
        >
          <p className="font-medium">Listening…</p>
          <p className="mt-0.5 break-words text-amber-800/80">
            {voicePreview ||
              "Say something like “milk and chicken and rice”"}
          </p>
        </div>
      )}

      {voiceSupported && !listening && (
        <p className="hidden text-xs leading-relaxed text-gray-500 sm:block">
          Tip: say <span className="font-medium text-gray-700">“and”</span>{" "}
          between items — e.g. “milk and chicken and rice”.
        </p>
      )}

      {(selectMode || selected.size > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 sm:gap-2 sm:rounded-2xl sm:px-3 sm:py-2.5">
          <span className="text-xs font-medium text-amber-800 sm:text-sm">
            {selected.size > 0
              ? `${selected.size} selected`
              : "Tap items to select"}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0}
            onClick={async () => {
              const ids = [...selected]
              setItems((prev) =>
                prev.map((row) =>
                  ids.includes(row.id)
                    ? {
                        ...row,
                        completed: true,
                        completed_at: new Date().toISOString(),
                        completed_by: currentUserId,
                      }
                    : row
                )
              )
              ids.forEach((id) =>
                setPendingPatch(id, {
                  completed: true,
                  completed_by: currentUserId,
                })
              )
              exitSelectMode()
              const result = await clientBulkComplete({
                householdId,
                userId: currentUserId,
                itemIds: ids,
              })
              ids.forEach((id) => clearPending(id))
              if (result.error) {
                toast.error(result.error)
                void reportClientError("bulk_complete", result.error)
                await refreshItems()
              }
            }}
          >
            <CheckCheck className="mr-1 size-3.5" />
            Complete
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={selected.size === 0}
            onClick={async () => {
              const ids = [...selected]
              if (!confirm(`Delete ${ids.length} items?`)) return
              setItems((prev) => prev.filter((row) => !ids.includes(row.id)))
              ids.forEach((id) => setPendingPatch(id, { _deleted: true }))
              exitSelectMode()
              const result = await clientBulkDelete({
                householdId,
                itemIds: ids,
              })
              ids.forEach((id) => clearPending(id))
              if (result.error) {
                toast.error(result.error)
                void reportClientError("bulk_delete", result.error)
                await refreshItems()
              }
            }}
          >
            <Trash2 className="mr-1 size-3.5" />
            Delete
          </Button>
        </div>
      )}

      <div className="space-y-1 pb-[calc(var(--mobile-cta-height)+0.35rem)] sm:space-y-1.5 lg:space-y-2.5 lg:pb-4">
        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-white px-3 py-8 text-center sm:rounded-2xl sm:px-4 sm:py-10 lg:py-14">
            <p className="text-sm font-medium text-gray-700">No items yet</p>
            <p className="mt-0.5 text-xs text-gray-400 sm:text-sm">
              Add your first grocery item or try voice input.
            </p>
            {/* Desktop empty-state CTA; mobile uses sticky Add Item */}
            <Button
              className="mt-4 hidden bg-amber-500 text-white hover:bg-amber-600 lg:inline-flex"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="mr-1 size-4" />
              Add Item
            </Button>
          </div>
        ) : (
          visible.map((item) => (
            <div
              key={item.id}
              className={`flex min-h-11 items-center gap-1.5 rounded-lg border bg-white px-1.5 py-1 transition-colors sm:min-h-0 sm:gap-3 sm:rounded-2xl sm:p-4 sm:shadow-sm ${
                selectMode && selected.has(item.id)
                  ? "border-amber-400 bg-amber-50/50"
                  : "border-border/50"
              } ${item.completed && !selectMode ? "opacity-60" : ""}`}
            >
              <div className="flex size-11 shrink-0 items-center justify-center">
                <button
                  type="button"
                  className={`flex size-7 items-center justify-center rounded-md border shadow-xs transition-colors touch-manipulation sm:size-7 sm:rounded-lg ${
                    (selectMode ? selected.has(item.id) : item.completed)
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-gray-300 bg-white"
                  }`}
                  onClick={() => {
                    if (selectMode) toggleSelect(item.id)
                    else void toggle(item)
                  }}
                  aria-pressed={selectMode ? selected.has(item.id) : item.completed}
                  aria-label={
                    selectMode
                      ? `Select ${item.title}`
                      : item.completed
                        ? `Mark ${item.title} as needed`
                        : `Mark ${item.title} bought`
                  }
                >
                  {(selectMode ? selected.has(item.id) : item.completed) && (
                    <Check className="size-4" />
                  )}
                </button>
              </div>

              <button
                type="button"
                className="min-h-11 min-w-0 flex-1 py-1 text-left sm:min-h-0 sm:py-0.5"
                onClick={() => {
                  if (selectMode) toggleSelect(item.id)
                  else setEditing(item)
                }}
              >
                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span
                    className={`break-words text-[0.875rem] leading-tight font-medium sm:text-base sm:leading-snug ${
                      item.completed
                        ? "text-gray-400 line-through"
                        : "text-gray-900"
                    }`}
                  >
                    {item.title}
                  </span>
                  <span className="text-[11px] tabular-nums text-gray-500 sm:text-sm">
                    {item.quantity}
                    {item.unit ? ` ${item.unit}` : ""}
                    {item.estimated_price > 0
                      ? ` · ₹${Number(item.estimated_price).toFixed(0)}`
                      : ""}
                  </span>
                  {item.category && (
                    <Badge
                      variant="outline"
                      className="hidden h-4 px-1 text-[9px] sm:inline-flex sm:text-[10px]"
                    >
                      {item.category}
                    </Badge>
                  )}
                  {item.priority === "HIGH" && (
                    <Badge className="h-4 bg-red-100 px-1 text-[9px] text-red-700 sm:text-[10px]">
                      High
                    </Badge>
                  )}
                </div>
                {/* Attribution / notes — desktop & tablet only (saves ~2 lines/row on phones) */}
                <p className="mt-0.5 hidden text-xs leading-relaxed text-gray-400 sm:block">
                  {item.creator_name
                    ? `Added by ${item.creator_name}`
                    : "Added"}
                  {item.created_at ? (
                    <>
                      {" · "}
                      <RelativeTime value={item.created_at} />
                    </>
                  ) : null}
                  {item.completed && item.completer_name ? (
                    <>
                      {` · Bought by ${item.completer_name}`}
                      {item.completed_at ? (
                        <>
                          {" · "}
                          <RelativeTime value={item.completed_at} />
                        </>
                      ) : null}
                    </>
                  ) : null}
                </p>
                {item.notes && (
                  <p className="mt-0.5 line-clamp-1 break-words text-[11px] text-gray-400 sm:mt-1 sm:line-clamp-none sm:text-xs">
                    {item.notes}
                  </p>
                )}
              </button>

              <div className="flex shrink-0 items-center sm:flex-col sm:justify-center sm:gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Duplicate"
                  className="hidden sm:inline-flex"
                  aria-label={`Duplicate ${item.title}`}
                  onClick={async () => {
                    const result = await clientDuplicateItem({
                      item,
                      householdId,
                      userId: currentUserId,
                    })
                    if (result.error) {
                      toast.error(result.error)
                      void reportClientError("duplicate_item", result.error)
                      return
                    }
                    if (result.data) {
                      setItems((prev) =>
                        sortLocal([
                          ...prev.filter((row) => row.id !== result.data!.id),
                          withPeople(result.data!, currentUserId),
                        ])
                      )
                    }
                  }}
                >
                  <ArrowDownAZ className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Delete"
                  className="size-11 min-h-11 min-w-11 sm:size-10 sm:min-h-10 sm:min-w-10"
                  aria-label={`Delete ${item.title}`}
                  onClick={() => handleDelete(item)}
                >
                  <Trash2 className="size-3.5 text-red-400 sm:size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div
        className="fixed inset-x-0 z-30 border-t border-border/60 bg-white/95 px-2.5 py-1.5 backdrop-blur-md lg:hidden"
        style={{
          bottom: "calc(var(--mobile-nav-height) + var(--safe-bottom))",
        }}
      >
        <Button
          className="h-11 min-h-11 w-full bg-amber-500 text-sm text-white hover:bg-amber-600"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="mr-1 size-4" />
          Add Item
        </Button>
      </div>

      <AddItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        listId={listId}
        householdId={householdId}
        userId={currentUserId}
        sortOrder={nextSortOrder()}
        titleRef={titleRef}
        onCreated={(item) => {
          setItems((prev) =>
            sortLocal([
              ...prev.filter((row) => row.id !== item.id),
              withPeople(item, currentUserId),
            ])
          )
        }}
      />

      {editing && (
        <EditItemDialog
          item={editing}
          householdId={householdId}
          userId={currentUserId}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          onUpdated={(item) => {
            setItems((prev) =>
              prev.map((row) =>
                row.id === item.id ? { ...row, ...withPeople(item, currentUserId) } : row
              )
            )
          }}
        />
      )}

      <Dialog open={typeOpen} onOpenChange={setTypeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick add</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              const transcript = typeText.trim()
              if (!transcript) return
              setTypePending(true)
              try {
                await applyVoiceTranscript(transcript)
                setTypeText("")
                setTypeOpen(false)
              } finally {
                setTypePending(false)
              }
            }}
          >
            <p className="text-sm text-muted-foreground">
              Type items the same way you would say them — e.g. “milk and chicken and rice”.
            </p>
            <Textarea
              value={typeText}
              onChange={(e) => setTypeText(e.target.value)}
              rows={3}
              autoFocus
              placeholder="milk and eggs and two kilos rice"
            />
            <DialogFooter>
              <Button
                type="submit"
                disabled={typePending || !typeText.trim()}
                className="w-full bg-amber-500 text-white hover:bg-amber-600 sm:w-auto"
              >
                {typePending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Add items
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AddItemDialog({
  open,
  onOpenChange,
  listId,
  householdId,
  userId,
  sortOrder,
  titleRef,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  listId: string
  householdId: string
  userId: string
  sortOrder: number
  titleRef: React.RefObject<HTMLInputElement | null>
  onCreated: (item: ShoppingItem) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (open) setTimeout(() => titleRef.current?.focus(), 50)
  }, [open, titleRef])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add item</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            const form = e.currentTarget
            const fd = new FormData(form)
            const title = String(fd.get("title") ?? "").trim()
            if (!title) {
              setError("Item title is required.")
              return
            }
            setPending(true)
            setError(null)
            try {
              const result = await clientInsertItem({
                listId,
                householdId,
                userId,
                title,
                quantity: parseFloat(String(fd.get("quantity") ?? "1")) || 1,
                unit: String(fd.get("unit") ?? "").trim() || null,
                category: String(fd.get("category") ?? "").trim() || null,
                notes: String(fd.get("notes") ?? "").trim() || null,
                estimated_price:
                  parseFloat(String(fd.get("estimated_price") ?? "0")) || 0,
                priority: (String(fd.get("priority") ?? "MEDIUM") ||
                  "MEDIUM") as ItemPriority,
                sort_order: sortOrder,
              })
              if (result.error || !result.data) {
                const message = result.error ?? "Failed to add item."
                setError(message)
                toast.error(message)
                void reportClientError("add_item", message)
                return
              }
              onCreated(result.data)
              onOpenChange(false)
              form.reset()
              toast.success("Item added")
            } catch (err) {
              const message =
                err instanceof Error ? err.message : "Failed to add item."
              setError(message)
              toast.error(message)
              void reportClientError("add_item", message)
            } finally {
              setPending(false)
            }
          }}
        >
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required ref={titleRef} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" name="quantity" type="number" step="any" defaultValue="1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" name="unit" placeholder="kg, L, pcs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                name="category"
                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                defaultValue=""
              >
                <option value="">Auto-detect</option>
                {ALL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                name="priority"
                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                defaultValue="MEDIUM"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="estimated_price">Estimated price (₹)</Label>
            <Input id="estimated_price" name="estimated_price" type="number" step="any" defaultValue="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full bg-amber-500 text-white hover:bg-amber-600 sm:w-auto">
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditItemDialog({
  item,
  householdId,
  userId,
  open,
  onOpenChange,
  onUpdated,
}: {
  item: ShoppingItemWithPeople
  householdId: string
  userId: string
  open: boolean
  onOpenChange: (o: boolean) => void
  onUpdated: (item: ShoppingItem) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit item</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const title = String(fd.get("title") ?? "").trim()
            if (!title) {
              setError("Item title is required.")
              return
            }
            setPending(true)
            setError(null)
            try {
              const result = await clientUpdateItem({
                itemId: item.id,
                householdId,
                userId,
                title,
                quantity: parseFloat(String(fd.get("quantity") ?? "1")) || 1,
                unit: String(fd.get("unit") ?? "").trim() || null,
                category: String(fd.get("category") ?? "").trim() || null,
                notes: String(fd.get("notes") ?? "").trim() || null,
                estimated_price:
                  parseFloat(String(fd.get("estimated_price") ?? "0")) || 0,
                priority: (String(fd.get("priority") ?? "MEDIUM") ||
                  "MEDIUM") as ItemPriority,
              })
              if (result.error || !result.data) {
                const message = result.error ?? "Failed to update item."
                setError(message)
                toast.error(message)
                void reportClientError("update_item", message)
                return
              }
              onUpdated(result.data)
              onOpenChange(false)
              toast.success("Item updated")
            } catch (err) {
              const message =
                err instanceof Error ? err.message : "Failed to update item."
              setError(message)
              toast.error(message)
              void reportClientError("update_item", message)
            } finally {
              setPending(false)
            }
          }}
        >
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" name="title" required defaultValue={item.title} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-qty">Quantity</Label>
              <Input
                id="edit-qty"
                name="quantity"
                type="number"
                step="any"
                defaultValue={String(item.quantity)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-unit">Unit</Label>
              <Input id="edit-unit" name="unit" defaultValue={item.unit ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <select
                name="category"
                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                defaultValue={item.category ?? "Other"}
              >
                {ALL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <select
                name="priority"
                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                defaultValue={item.priority}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-price">Estimated price (₹)</Label>
            <Input
              id="edit-price"
              name="estimated_price"
              type="number"
              step="any"
              defaultValue={String(item.estimated_price)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea id="edit-notes" name="notes" rows={2} defaultValue={item.notes ?? ""} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full bg-amber-500 text-white hover:bg-amber-600 sm:w-auto">
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

