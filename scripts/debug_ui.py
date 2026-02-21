"""Debug: inspect UI buttons and state."""
import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:3000")
    page.wait_for_load_state("networkidle", timeout=15000)
    time.sleep(0.5)

    btns = page.query_selector_all("button")
    print(f"Total buttons on load: {len(btns)}")
    for b in btns[:20]:
        label = b.get_attribute("aria-label") or b.inner_text()[:40]
        print(f"  {label!r}")

    # Click the first word in the strip to activate a group
    # Try clicking a surface-text span or div
    surface_spans = page.query_selector_all("[data-testid='surface-text']")
    print(f"\nSurface text elements: {len(surface_spans)}")

    # Try any clickable in the strip
    strip = page.query_selector("[data-testid='strip-container']")
    if strip:
        print("Strip container found")
        # Click first child button inside
        strip_btns = strip.query_selector_all("button")
        print(f"Buttons inside strip: {len(strip_btns)}")
        for b in strip_btns[:10]:
            label = b.get_attribute("aria-label") or b.inner_text()[:40]
            print(f"  strip btn: {label!r}")
    else:
        print("No strip container found")

    browser.close()
