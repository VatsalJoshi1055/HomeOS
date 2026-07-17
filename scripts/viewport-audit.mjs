/**
 * Viewport overflow audit for HomeOS public pages.
 * Run: npx playwright test --config=viewport-audit.config.mjs
 * Or: node scripts/viewport-audit.mjs
 */
import { chromium } from "playwright"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")
const OUT = path.join(ROOT, ".viewport-audit")
const BASE = process.env.HOMEOS_URL || "http://localhost:3000"

const DEVICES = [
  { name: "iphone-se", width: 375, height: 667 },
  { name: "iphone-15-pro", width: 393, height: 852 },
  { name: "pixel-8", width: 412, height: 915 },
  { name: "galaxy-s24-ultra", width: 412, height: 915 },
  { name: "ipad-mini", width: 768, height: 1024 },
  { name: "ipad-air", width: 820, height: 1180 },
]

const PAGES = ["/login", "/signup", "/forgot-password", "/offline"]

async function measureOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const body = document.body
    const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth)
    const clientWidth = doc.clientWidth
    const offenders = []

    for (const el of document.querySelectorAll("*")) {
      if (!(el instanceof HTMLElement)) continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) continue
      if (rect.right > clientWidth + 1 || rect.left < -1) {
        const style = getComputedStyle(el)
        if (style.position === "fixed" || style.position === "sticky") {
          // fixed full-bleed bars can report edge-equal; only flag if clearly past
          if (rect.right <= clientWidth + 2 && rect.left >= -2) continue
        }
        offenders.push({
          tag: el.tagName.toLowerCase(),
          className: (el.className || "").toString().slice(0, 120),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        })
      }
      if (offenders.length >= 12) break
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

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const report = []

  for (const device of DEVICES) {
    for (const route of PAGES) {
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        deviceScaleFactor: 2,
        isMobile: device.width < 768,
        hasTouch: true,
      })
      const page = await context.newPage()
      const consoleErrors = []
      page.on("pageerror", (err) => consoleErrors.push(String(err)))
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text())
      })

      const url = `${BASE}${route}`
      let status = "ok"
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 })
        await page.waitForTimeout(250)
        const metrics = await measureOverflow(page)
        const shot = path.join(OUT, `${device.name}${route.replace(/\//g, "_") || "_home"}.png`)
        await page.screenshot({ path: shot, fullPage: true })

        const entry = {
          device: device.name,
          viewport: `${device.width}x${device.height}`,
          route,
          ...metrics,
          consoleErrors: consoleErrors.slice(0, 8),
          screenshot: path.relative(ROOT, shot),
        }
        if (metrics.overflowX || consoleErrors.length) status = "issue"
        entry.status = status
        report.push(entry)
        console.log(
          `${status.toUpperCase()} ${device.name} ${route} overflow=${metrics.overflowX} delta=${metrics.delta} errors=${consoleErrors.length}`
        )
      } catch (err) {
        report.push({
          device: device.name,
          route,
          status: "fail",
          error: String(err),
        })
        console.log(`FAIL ${device.name} ${route}: ${err}`)
      }
      await context.close()
    }
  }

  await browser.close()
  const outFile = path.join(OUT, "report.json")
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2))
  const issues = report.filter((r) => r.status !== "ok")
  console.log(`\nWrote ${outFile}`)
  console.log(`Issues: ${issues.length}/${report.length}`)
  if (issues.length) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
