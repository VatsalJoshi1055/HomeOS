import Link from "next/link"
import { Home } from "lucide-react"
import { LoginForm } from "@/components/auth/login-form"

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh min-h-svh">
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-amber-500 via-amber-400 to-orange-300 p-10 text-white lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Home className="size-6" />
          HomeOS
        </div>
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            Shop together.
            <br />
            Stay in sync.
          </h1>
          <p className="mt-4 max-w-md text-amber-50/90">
            The real-time family shopping companion. Everyone adds, edits and
            checks off — instantly.
          </p>
        </div>
        <p className="text-sm text-amber-50/70">Built for households.</p>
      </div>

      <div className="flex w-full min-w-0 flex-col justify-center px-4 py-10 sm:px-6 sm:py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link
              href="/"
              className="flex min-h-11 items-center gap-2 font-semibold text-amber-600"
            >
              <Home className="size-5" />
              HomeOS
            </Link>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900">Welcome back</h2>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to your household shopping space.
          </p>
          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  )
}
