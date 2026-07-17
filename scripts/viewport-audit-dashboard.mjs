import { chromium } from "playwright"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")
const BASE = process.env.HOMEOS_URL || "http://localhost:3000"
const OUT = path.join(ROOT, ".viewport-audit")
fs.mkdirSync(OUT, { recursive: true })

const DEVICES = [
  { name: "iphone-se", width: 375, height: 667 },
  { name: "iphone-15-pro", width: 393, height: 852 },
  { name: "pixel-8", width: 412, height: 915 },
  { name: "galaxy-s24-ultra", width: 412, height: 915 },
  { name: "ipad-mini", width: 768, height: 1024 },
  { name: "ipad-air", width: 820, height: 1180 },
]

async function measure(page) {
  return page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth
    const scrollWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth
    )
    const offenders = []
    for (const el of document.querySelectorAll("*")) {
      if (!(el instanceof HTMLElement)) continue
      const r = el.getBoundingClientRect()
      if (!r.width && !r.height) continue
      if (r.right > clientWidth + 2 || r.left < -2) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className || "").slice(0, 100),
          left: Math.round(r.left),
          right: Math.round(r.right),
        })
      }
      if (offenders.length >= 10) break
    }
    return {
      clientWidth,
      scrollWidth,
      overflowX: scrollWidth > clientWidth + 1,
      delta: scrollWidth - clientWidth,
      offenders,
    }
  })
}

const browser = await chromium.launch({ headless: true })
const email = `viewport.audit.${Date.now()}@example.com`
const password = "TestPass123!"

const boot = await browser.newContext({
  viewport: { width: 393, height: 852 },
  isMobile: true,
  hasTouch: true,
})
const page = await boot.newPage()
const bootErrors = []
page.on("pageerror", (e) => bootErrors.push(String(e)))
page.on("console", (m) => {
  if (m.type() === "error") bootErrors.push(m.text())
})

await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" })
await page.fill("#full_name", "Viewport Auditor")
await page.fill("#email", email)
await page.fill("#household_name", "Audit House")
await page.fill("#password", password)
await page.fill("#confirm_password", password)
await page.click('button[type="submit"]')
await page.waitForURL(/dashboard|onboarding|login/, { timeout: 45000 }).catch(() => {})
await page.waitForTimeout(1500)
console.log("after signup", page.url(), bootErrors.slice(0, 5))

if (page.url().includes("onboarding")) {
  await page.fill("#name", "Audit House")
  await page.click('button[type="submit"]')
  await page.waitForURL(/dashboard/, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1000)
  console.log("after onboarding", page.url())
}

if (!page.url().includes("dashboard")) {
  console.error("Could not reach dashboard. Aborting.")
  console.error("URL:", page.url())
  await page.screenshot({ path: path.join(OUT, "signup-fail.png"), fullPage: true })
  await browser.close()
  process.exit(1)
}

// Create a list for detail page testing
await page.goto(`${BASE}/dashboard/lists`, { waitUntil: "networkidle" })
const newListBtn = page.getByRole("button", { name: /New List|Create List/i }).first()
if (await newListBtn.count()) {
  await newListBtn.click()
  await page.fill("#name", "Audit Groceries")
  await page.getByRole("button", { name: /^Create$/i }).click()
  await page.waitForURL(/dashboard\/lists\//, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(800)
}
const listUrl = page.url()
console.log("list url", listUrl)

const storage = await boot.storageState()
fs.writeFileSync(path.join(OUT, "auth.json"), JSON.stringify(storage, null, 2))
await boot.close()

const routes = [
  "/dashboard",
  "/dashboard/lists",
  "/dashboard/activity",
  "/dashboard/settings",
]
if (listUrl.includes("/dashboard/lists/")) {
  routes.push(listUrl.replace(BASE, ""))
}

const report = []

for (const device of DEVICES) {
  for (const route of routes) {
    const ctx = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: 2,
      isMobile: device.width < 768,
      hasTouch: true,
      storageState: storage,
    })
    const p = await ctx.newPage()
    const cerr = []
    p.on("pageerror", (e) => cerr.push(String(e)))
    p.on("console", (m) => {
      if (m.type() === "error") cerr.push(m.text())
    })
    try {
      await p.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 45000 })
      await p.waitForTimeout(400)

      if (device.width < 1024) {
        const menu = p.getByLabel("Open menu")
        if (await menu.count()) {
          await menu.click()
          await p.waitForTimeout(200)
          await p.screenshot({
            path: path.join(OUT, `${device.name}_drawer.png`),
          })
          const close = p.getByLabel("Close navigation")
          if (await close.count()) await close.click()
          else await p.keyboard.press("Escape")
          await p.waitForTimeout(150)
        }
      }

      if (route === "/dashboard/lists") {
        const btn = p.getByRole("button", { name: /New List|Create List/i }).first()
        if (await btn.count()) {
          await btn.click()
          await p.waitForTimeout(250)
          await p.screenshot({
            path: path.join(OUT, `${device.name}_modal.png`),
          })
          const dialogMetrics = await measure(p)
          report.push({
            device: device.name,
            route: `${route}#modal`,
            status: dialogMetrics.overflowX || cerr.length ? "issue" : "ok",
            ...dialogMetrics,
            consoleErrors: cerr.slice(0, 6),
          })
          console.log(
            `${dialogMetrics.overflowX ? "ISSUE" : "OK"} ${device.name} modal overflow=${dialogMetrics.overflowX}`
          )
          await p.keyboard.press("Escape")
          await p.waitForTimeout(150)
        }
      }

      const metrics = await measure(p)
      const safeName = route.replace(/\//g, "_") || "_root"
      await p.screenshot({
        path: path.join(OUT, `${device.name}${safeName}.png`),
        fullPage: true,
      })
      const status = metrics.overflowX || cerr.length ? "issue" : "ok"
      report.push({
        device: device.name,
        route,
        status,
        ...metrics,
        consoleErrors: cerr.slice(0, 6),
      })
      console.log(
        `${status.toUpperCase()} ${device.name} ${route} overflow=${metrics.overflowX} delta=${metrics.delta} errors=${cerr.length}`
      )
      if (metrics.offenders?.length) {
        console.log("  offenders", JSON.stringify(metrics.offenders.slice(0, 3)))
      }
      if (cerr.length) console.log("  errors", cerr.slice(0, 3))
    } catch (e) {
      report.push({
        device: device.name,
        route,
        status: "fail",
        error: String(e),
      })
      console.log("FAIL", device.name, route, e)
    }
    await ctx.close()
  }
}

await browser.close()
fs.writeFileSync(
  path.join(OUT, "dashboard-report.json"),
  JSON.stringify(report, null, 2)
)
const issues = report.filter((r) => r.status !== "ok")
console.log(`Issues ${issues.length}/${report.length}`)
if (issues.length) process.exit(1)
