import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-base text-gray-900 shadow-xs outline-none placeholder:text-gray-400 focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
