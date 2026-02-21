"""Test F-11: disjoint linking with curved connector."""
import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:3000")
    page.wait_for_load_state("networkidle", timeout=15000)
    time.sleep(0.5)

    # Count link / unlink buttons before any clicks
    link_btns = page.query_selector_all('button[aria-label="Link occurrences"]')
    unlink_btns = page.query_selector_all('button[aria-label="Unlink occurrences"]')
    print(f"Initial state — Link buttons: {len(link_btns)}, Unlink buttons: {len(unlink_btns)}")

    if len(link_btns) > 5:
        # Button[5] should be non-adjacent to the active group (group 0)
        link_btns[5].click()
        time.sleep(0.6)

        # SVG arc overlay check
        svg = page.query_selector("svg.absolute")
        svg_paths = page.query_selector_all("svg.absolute path")
        print(f"SVG overlay present: {svg is not None}")
        print(f"SVG path count: {len(svg_paths)}")

        # Regular link state check — a disjoint link should NOT change unlink count
        unlink_btns_after = page.query_selector_all('button[aria-label="Unlink occurrences"]')
        link_btns_after = page.query_selector_all('button[aria-label="Link occurrences"]')
        print(f"After click — Unlink: {len(unlink_btns_after)}, Link: {len(link_btns_after)}")

        if svg is not None and len(svg_paths) > 0:
            print("SUCCESS: disjoint link arc rendered correctly")
        else:
            print("FAIL: no SVG arc — disjoint link was not created")
            if len(unlink_btns_after) > len(unlink_btns):
                print("  (A regular adjacency link was created instead)")

        page.screenshot(path="scripts/test_disjoint_result.png")
    else:
        print(f"SKIP: not enough link buttons ({len(link_btns)})")

    browser.close()
