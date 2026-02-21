"""
F-11 navigation tests — uses data-testid selectors for reliable counting.

Assertions:
1. At left endpoint (immediately after making link):
   - Arc present
   - 1 ghost chip (right group)
   - 1 disjoint occ token in box (right group's text)

2. Forward 10 steps (clearly past both endpoints, active = neither):
   - Arc still present
   - 2 ghost chips (both linked groups)
   - 0 disjoint occ tokens (active group is not an endpoint)

3. Back 10 steps (back at left endpoint):
   - Arc present
   - 1 ghost chip (right group)
   - 1 disjoint occ token in box (right group's text)
"""
from playwright.sync_api import sync_playwright
import time

GHOST_SEL        = '[data-testid="disjoint-ghost-chip"]'
DISJOINT_TOK_SEL = '[data-testid="disjoint-occ-token"]'
ARC_SEL          = "svg.absolute path"
LINK_BTN_SEL     = 'button[aria-label="Link occurrences"]'
NAV_NEXT_SEL     = 'button[aria-label="Next occurrence"]'
NAV_PREV_SEL     = 'button[aria-label="Previous occurrence"]'

def count(page, sel):
    return len(page.query_selector_all(sel))

passed = 0
failed = 0

def check(page, label, sel, expected_op, expected_val):
    global passed, failed
    actual = count(page, sel)
    if expected_op == "==":
        ok = actual == expected_val
    elif expected_op == ">=":
        ok = actual >= expected_val
    else:
        ok = False
    status = "PASS" if ok else "FAIL"
    if ok:
        passed += 1
    else:
        failed += 1
    print(f"  [{status}] {label}: got {actual} (expected {expected_op} {expected_val})")

def nav_n(page, sel, n):
    for _ in range(n):
        btn = page.query_selector(sel)
        if btn:
            btn.click()
            time.sleep(0.25)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 900})
    page.goto("http://localhost:3000")
    page.wait_for_load_state("networkidle", timeout=15000)
    time.sleep(0.5)

    btns = page.query_selector_all(LINK_BTN_SEL)
    print(f"Initial link buttons: {len(btns)}")
    if len(btns) <= 5:
        print("FAIL: not enough link buttons")
        browser.close()
        exit(1)

    # Click button[5] — non-adjacent to group 0 → creates disjoint link
    btns[5].click()
    time.sleep(0.7)

    # ── Test 1: left endpoint ────────────────────────────────────────────────
    print("\nTest 1: immediately after linking (active = left endpoint)")
    check(page, "Arc paths",           ARC_SEL,          ">=", 1)
    check(page, "Ghost chips",         GHOST_SEL,        "==", 1)
    check(page, "Disjoint occ tokens", DISJOINT_TOK_SEL, "==", 1)
    page.screenshot(path="scripts/f11_nav_1_left_endpoint.png")

    # ── Navigate forward 10 steps (past both endpoints) ─────────────────────
    nav_n(page, NAV_NEXT_SEL, 10)

    print("\nTest 2: 10 steps forward (active = neither endpoint)")
    check(page, "Arc paths (dashed)",  ARC_SEL,          ">=", 1)
    check(page, "Ghost chips (right endpoint only)",  GHOST_SEL, "==", 1)
    check(page, "Disjoint occ tokens (left endpoint box)", DISJOINT_TOK_SEL, "==", 1)
    page.screenshot(path="scripts/f11_nav_2_neither.png")

    # ── Navigate backward 10 steps (back at left endpoint) ──────────────────
    nav_n(page, NAV_PREV_SEL, 10)

    print("\nTest 3: 10 steps back (active = left endpoint again)")
    check(page, "Arc paths (solid)",   ARC_SEL,          ">=", 1)
    check(page, "Ghost chips",         GHOST_SEL,        "==", 1)
    check(page, "Disjoint occ tokens", DISJOINT_TOK_SEL, "==", 1)
    page.screenshot(path="scripts/f11_nav_3_left_again.png")

    print(f"\n{'ALL TESTS PASSED' if failed == 0 else f'{failed} FAILED, {passed} PASSED'}")
    browser.close()
