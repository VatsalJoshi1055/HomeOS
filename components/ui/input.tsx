import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-base text-gray-900 shadow-xs transition-colors outline-none placeholder:text-gray-400 focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:h-11 md:rounded-xl md:px-3.5 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
