"use client"

import { useActionState, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  Crown,
  Loader2,
  Pencil,
  Share2,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import {
  deleteHouseholdAction,
  inviteMemberAction,
  leaveHouseholdAction,
  updateHouseholdAction,
} from "@/actions/shopping"
import type { ActionState, Household, Profile } from "@/types/database"
import { RelativeTime } from "@/components/relative-time"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const initial: ActionState = {}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

async function shareInviteLink(url: string, householdName: string) {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: `Join ${householdName} on HomeOS`,
        text: `You're invited to join ${householdName} on HomeOS.`,
        url,
      })
      return
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      // Fall through to clipboard for any other share failure
    }
  }

  try {
    await navigator.clipboard.writeText(url)
    toast.success("Invite link copied to clipboard")
  } catch {
    toast.error("Could not share or copy the invite link")
  }
}

export function HouseholdPanel({
  profile,
  household,
  members,
}: {
  profile: Profile
  household: Household
  members: Profile[]
}) {
  const router = useRouter()
  // Prefer role; fall back to household creator so UI stays correct during repairs
  const isOwner =
    profile.role === "OWNER" || profile.id === household.created_by
  const owner =
    members.find((m) => m.role === "OWNER") ??
    members.find((m) => m.id === household.created_by) ??
    null

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [inviteState, inviteAction, invitePending] = useActionState(
    inviteMemberAction,
    initial
  )
  const [renaming, startRename] = useTransition()
  const [leaving, startLeave] = useTransition()
  const [deleting, startDelete] = useTransition()

  const inviteUrl = inviteState.inviteUrl ?? null

  return (
    <div className="page-stack">
      <div>
        <h1 className="page-title">Household</h1>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
          Family details, members, and invites — all in one place.
        </p>
      </div>

      {/* Household Information */}
      <Card>
        <CardHeader className="pb-3 lg:pb-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base lg:text-lg">
                Household information
              </CardTitle>
              <CardDescription>
                Core details for {household.name}
              </CardDescription>
            </div>
            {isOwner && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 shrink-0 gap-1.5"
                onClick={() => setRenameOpen(true)}
              >
                <Pencil className="size-3.5" />
                Rename
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <InfoRow label="Household name" value={household.name} />
            <InfoRow
              label="Owner"
              value={owner?.full_name ?? "—"}
            />
            <InfoRow
              label="Members"
              value={`${members.length} ${members.length === 1 ? "member" : "members"}`}
            />
            <InfoRow
              label="Date created"
              value={formatCreatedDate(household.created_at)}
            />
          </dl>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader className="pb-3 lg:pb-6">
          <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
            <Users className="size-4 text-amber-600" />
            Members
          </CardTitle>
          <CardDescription>
            Everyone here can edit shared shopping lists in real time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5 sm:space-y-2.5">
          {members.map((m) => {
            const ownerCard =
              m.role === "OWNER" || m.id === household.created_by
            return (
              <div
                key={m.id}
                className={
                  ownerCard
                    ? "flex items-center gap-2.5 rounded-lg border border-amber-300 bg-amber-50/60 px-2.5 py-2 sm:gap-3 sm:rounded-xl sm:px-3 sm:py-3"
                    : "flex items-center gap-2.5 rounded-lg border border-border/60 bg-white px-2.5 py-2 sm:gap-3 sm:rounded-xl sm:px-3 sm:py-3"
                }
              >
                <Avatar className="size-9 shrink-0 sm:size-11">
                  <AvatarFallback
                    className={
                      ownerCard
                        ? "bg-amber-500 text-white"
                        : "bg-gray-100 text-gray-700"
                    }
                  >
                    {initials(m.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{m.full_name}</p>
                    <Badge
                      className={
                        ownerCard
                          ? "bg-amber-500 text-white"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }
                      variant={ownerCard ? "default" : "outline"}
                    >
                      {ownerCard ? (
                        <span className="inline-flex items-center gap-1">
                          <Crown className="size-3" />
                          Owner
                        </span>
                      ) : (
                        "Member"
                      )}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.email}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    Joined <RelativeTime value={m.created_at} />
                  </p>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Invite — always available to owner */}
      {isOwner && (
        <Card>
          <CardHeader className="pb-3 lg:pb-6">
            <CardTitle className="text-base lg:text-lg">Invite members</CardTitle>
            <CardDescription>
              Generate a new invite link anytime — it stays available after people
              join.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={inviteAction} className="max-w-md space-y-3">
              {inviteState.error && <ErrorMsg msg={inviteState.error} />}
              <div className="space-y-2">
                <Label htmlFor="invite_email">Their email</Label>
                <Input
                  id="invite_email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  placeholder="family@example.com"
                />
              </div>
              <Button
                type="submit"
                disabled={invitePending}
                className="min-h-11 w-full bg-amber-500 text-white hover:bg-amber-600 sm:w-auto"
              >
                {invitePending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Create invite link
              </Button>
            </form>

            {inviteUrl && (
              <div className="max-w-md space-y-2 rounded-xl border border-green-200 bg-green-50 px-3 py-3">
                <div className="flex items-start gap-2 text-sm text-green-800">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <p>Invite ready. Share it with your family.</p>
                </div>
                <Button
                  type="button"
                  className="min-h-11 w-full bg-amber-500 text-white hover:bg-amber-600"
                  onClick={() => void shareInviteLink(inviteUrl, household.name)}
                >
                  <Share2 className="mr-2 size-4" />
                  Share
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Danger zone */}
      <Card className="border-red-200">
        <CardHeader className="pb-3 lg:pb-6">
          <CardTitle className="text-base text-red-700 lg:text-lg">
            Danger zone
          </CardTitle>
          <CardDescription>
            These actions affect your access to this household.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          {!isOwner && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full border-red-200 text-red-700 sm:w-auto"
              onClick={() => setLeaveOpen(true)}
            >
              Leave household
            </Button>
          )}
          {isOwner && (
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => setDeleteOpen(true)}
            >
              Delete household
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Rename dialog */}
      <Dialog
        open={renameOpen}
        onOpenChange={(open) => {
          setRenameOpen(open)
          if (!open) setRenameError(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename household</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              setRenameError(null)
              startRename(async () => {
                const result = await updateHouseholdAction(initial, formData)
                if (result.error) {
                  setRenameError(result.error)
                  return
                }
                toast.success(result.message ?? "Household updated")
                setRenameOpen(false)
                router.refresh()
              })
            }}
          >
            {renameError && <ErrorMsg msg={renameError} />}
            <div className="space-y-2">
              <Label htmlFor="household_name">Name</Label>
              <Input
                id="household_name"
                name="name"
                defaultValue={household.name}
                required
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={renaming}
                className="bg-amber-500 text-white hover:bg-amber-600"
              >
                {renaming && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Leave confirm */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave household?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You will lose access to shared lists until you are invited again.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLeaveOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={leaving}
              onClick={() => {
                startLeave(async () => {
                  const r = await leaveHouseholdAction()
                  if (r.error) toast.error(r.error)
                  else {
                    toast.success("You left the household")
                    router.push("/onboarding")
                    router.refresh()
                  }
                })
              }}
            >
              {leaving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete household?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes {household.name} and all shopping data.
            This cannot be undone.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => {
                startDelete(async () => {
                  const r = await deleteHouseholdAction()
                  if (r.error) toast.error(r.error)
                  else {
                    toast.success("Household deleted")
                    router.push("/onboarding")
                    router.refresh()
                  }
                })
              }}
            >
              {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}

function formatCreatedDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {msg}
    </div>
  )
}
