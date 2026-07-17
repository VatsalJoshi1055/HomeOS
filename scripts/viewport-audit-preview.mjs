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
          cls: String(el.className || "").slice(0, 120),
          left: Math.round(r.left),
          right: Math.round(r.right),
        })
      }
      if (offenders.length >= 15) break
    }

    const fixed = [...document.querySelectorAll("*")].filter((el) => {
      if (!(el instanceof HTMLElement)) return false
      const pos = getComputedStyle(el).position
      return pos === "fixed" || pos === "sticky"
    })

    return {
      clientWidth,
      scrollWidth,
      overflowX: scrollWidth > clientWidth + 1,
      delta: scrollWidth - clientWidth,
      offenders,
      fixedCount: fixed.length,
    }
  })
}

const browser = await chromium.launch({ headless: true })
const report = []
const route = "/dev/viewport-preview"

for (const device of DEVICES) {
  const ctx = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: 2,
    isMobile: device.width < 768,
    hasTouch: true,
  })
  const page = await ctx.newPage()
  const cerr = []
  page.on("pageerror", (e) => cerr.push(String(e)))
  page.on("console", (m) => {
    if (m.type() === "error") cerr.push(m.text())
  })

  try {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 60000 })
    await page.waitForTimeout(500)

    // Drawer
    if (device.width < 1024) {
      await page.getByLabel("Open menu").click()
      await page.waitForTimeout(250)
      let metrics = await measure(page)
      await page.screenshot({
        path: path.join(OUT, `${device.name}_preview_drawer.png`),
      })
      report.push({
        device: device.name,
        scenario: "drawer",
        status: metrics.overflowX || cerr.length ? "issue" : "ok",
        ...metrics,
        consoleErrors: [...cerr],
      })
      console.log(
        `${metrics.overflowX ? "ISSUE" : "OK"} ${device.name} drawer overflow=${metrics.overflowX} delta=${metrics.delta}`
      )
      if (metrics.offenders?.length) {
        console.log("  offenders", JSON.stringify(metrics.offenders.slice(0, 4)))
      }
      await page.getByLabel("Close navigation").click()
      await page.waitForTimeout(200)
      cerr.length = 0
    }

    // Modal
    await page.getByRole("button", { name: /New List|Create List/i }).first().click()
    await page.waitForTimeout(300)
    let metrics = await measure(page)
    await page.screenshot({
      path: path.join(OUT, `${device.name}_preview_modal.png`),
    })
    report.push({
      device: device.name,
      scenario: "modal",
      status: metrics.overflowX || cerr.length ? "issue" : "ok",
      ...metrics,
      consoleErrors: [...cerr],
    })
    console.log(
      `${metrics.overflowX ? "ISSUE" : "OK"} ${device.name} modal overflow=${metrics.overflowX} delta=${metrics.delta}`
    )
    if (metrics.offenders?.length) {
      console.log("  offenders", JSON.stringify(metrics.offenders.slice(0, 4)))
    }
    await page.keyboard.press("Escape")
    await page.waitForTimeout(200)
    cerr.length = 0

    // Full page scroll content
    metrics = await measure(page)
    await page.screenshot({
      path: path.join(OUT, `${device.name}_preview_full.png`),
      fullPage: true,
    })
    report.push({
      device: device.name,
      scenario: "full",
      status: metrics.overflowX || cerr.length ? "issue" : "ok",
      ...metrics,
      consoleErrors: [...cerr],
    })
    console.log(
      `${metrics.overflowX ? "ISSUE" : "OK"} ${device.name} full overflow=${metrics.overflowX} delta=${metrics.delta} errors=${cerr.length}`
    )
    if (metrics.offenders?.length) {
      console.log("  offenders", JSON.stringify(metrics.offenders.slice(0, 4)))
    }
    if (cerr.length) console.log("  errors", cerr.slice(0, 4))

    // Scroll to list detail sticky CTA area
    await page.locator("[data-testid=preview-list-detail]").scrollIntoViewIfNeeded()
    await page.waitForTimeout(200)
    metrics = await measure(page)
    await page.screenshot({
      path: path.join(OUT, `${device.name}_preview_list.png`),
    })
    report.push({
      device: device.name,
      scenario: "list-detail",
      status: metrics.overflowX || cerr.length ? "issue" : "ok",
      ...metrics,
      consoleErrors: [...cerr],
    })
    console.log(
      `${metrics.overflowX ? "ISSUE" : "OK"} ${device.name} list-detail overflow=${metrics.overflowX}`
    )
  } catch (e) {
    report.push({
      device: device.name,
      scenario: "fail",
      status: "fail",
      error: String(e),
    })
    console.log("FAIL", device.name, e)
  }

  await ctx.close()
}

await browser.close()
fs.writeFileSync(
  path.join(OUT, "preview-report.json"),
  JSON.stringify(report, null, 2)
)
const issues = report.filter((r) => r.status !== "ok")
console.log(`Issues ${issues.length}/${report.length}`)
if (issues.length) process.exit(1)
