"""Test F-11: disjoint linking — ghost rendering + disjoint occ in active box."""
from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 900})
    page.goto("http://localhost:3000")
    page.wait_for_load_state("networkidle", timeout=15000)
    time.sleep(0.5)

    # Verify initial load
    btns = page.query_selector_all('button[aria-label="Link occurrences"]')
    print(f"Initial link buttons: {len(btns)}")

    # Click button[5] — non-adjacent to active group 0
    if len(btns) > 5:
        btns[5].click()
        time.sleep(0.7)

        # 1. Arc should be present
        svg_paths = page.query_selector_all("svg.absolute path")
        print(f"SVG arc paths: {len(svg_paths)}")

        # 2. No new unlink buttons (no adjacent link created)
        unlink_btns = page.query_selector_all('button[aria-label="Unlink occurrences"]')
        print(f"Unlink buttons after click: {len(unlink_btns)} (expected 1)")

        # 3. Ghost: look for the dashed-border muted chip
        ghost_chips = page.query_selector_all("div.border-dashed.border-muted-foreground\\/25.rounded")
        print(f"Ghost chips in strip: {len(ghost_chips)}")

        # 4. Disjoint occ in active box: muted dashed border cell
        disjoint_cells = page.query_selector_all("div.border-dashed.border-muted-foreground\\/25.bg-muted\\/20")
        print(f"Disjoint occ cells in active box: {len(disjoint_cells)}")
        for cell in disjoint_cells[:3]:
            print(f"  cell text: {cell.inner_text()!r}")

        # Screenshot
        page.screenshot(path="scripts/test_f11_result.png")
        print("Screenshot saved: scripts/test_f11_result.png")

    browser.close()
