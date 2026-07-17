import Link from "next/link"
import { Home, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function OfflinePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
        <WifiOff className="size-7" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">You&apos;re offline</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          HomeOS needs a connection for live shopping updates. Reconnect and try
          again.
        </p>
      </div>
      <Button asChild className="bg-amber-500 text-white hover:bg-amber-600">
        <Link href="/dashboard">
          <Home className="mr-1 size-4" />
          Try again
        </Link>
      </Button>
    </div>
  )
}
