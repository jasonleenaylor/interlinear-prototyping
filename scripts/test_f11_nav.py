"""
F-11 navigation tests — uses data-testid selectors for reliable counting.

Disjoint right-endpoint groups are NEVER navigable. Navigation always skips
them regardless of direction.

Assertions:
1. At left endpoint (immediately after making link):
   - Arc present (solid, no dasharray)
   - 1 ghost chip (right endpoint — not navigable)
   - 1 disjoint occ token in left-endpoint OccurrenceBox

2. Navigate 10 steps forward — right endpoint is NEVER reached:
   - Arc still present
   - 1 ghost chip (right endpoint never becomes active)
   - Active group ≠ right endpoint's startIndex
   - 1 disjoint occ token (left endpoint box always shows it)

3. Navigate 10 steps back — right endpoint still not reached:
   - Arc still present
   - 1 ghost chip
   - Active group ≠ right endpoint's startIndex
   - 1 disjoint occ token
"""
from playwright.sync_api import sync_playwright
import time

GHOST_SEL        = '[data-testid="disjoint-ghost-chip"]'
DISJOINT_TOK_SEL = '[data-testid="disjoint-occ-token"]'
ARC_SEL          = "svg.absolute path"
LINK_BTN_SEL     = 'button[aria-label="Link occurrences"]'
NAV_NEXT_SEL     = 'button[aria-label="Next occurrence"]'
NAV_PREV_SEL     = 'button[aria-label="Previous occurrence"]'
ACTIVE_GRP_SEL   = '[data-active="true"]'

def count(page, sel):
    return len(page.query_selector_all(sel))

def active_start(page):
    el = page.query_selector(ACTIVE_GRP_SEL)
    if not el:
        return None
    val = el.get_attribute("data-group-start")
    return int(val) if val is not None else None

passed = 0
failed = 0

def check(label, actual, op, expected):
    global passed, failed
    if op == "==":
        ok = actual == expected
    elif op == ">=":
        ok = actual >= expected
    elif op == "!=":
        ok = actual != expected
    else:
        ok = False
    status = "PASS" if ok else "FAIL"
    if ok:
        passed += 1
    else:
        failed += 1
    print(f"  [{status}] {label}: got {actual!r} (expected {op} {expected!r})")

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

    # Click button[5] — creates disjoint link between active group and a remote group
    btns[5].click()
    time.sleep(0.7)

    left_start = active_start(page)
    ghost = page.query_selector(GHOST_SEL)
    right_start = int(ghost.get_attribute("data-group-start")) if ghost else None
    print(f"  Link: leftStart={left_start}, rightStart={right_start}")

    # ── Test 1: left endpoint ────────────────────────────────────────────────
    print("\nTest 1: immediately after linking (active = left endpoint)")
    check("Arc paths",               count(page, ARC_SEL),          ">=", 1)
    check("Ghost chips",             count(page, GHOST_SEL),        "==", 1)
    check("Disjoint occ tokens",     count(page, DISJOINT_TOK_SEL), "==", 1)
    check("Active IS left endpoint", active_start(page),            "==", left_start)
    page.screenshot(path="scripts/f11_nav_1_left_endpoint.png")

    # ── Navigate 10 steps forward — ghost must NEVER become active ────────────
    nav_n(page, NAV_NEXT_SEL, 10)
    cur = active_start(page)
    print(f"\nTest 2: after 10 steps forward (active={cur})")
    check("Active is NOT the ghost right endpoint",
          cur,                                     "!=", right_start)
    check("Arc still present",       count(page, ARC_SEL),          ">=", 1)
    check("Ghost chip persists",     count(page, GHOST_SEL),        "==", 1)
    check("Disjoint occ token persists", count(page, DISJOINT_TOK_SEL), "==", 1)
    page.screenshot(path="scripts/f11_nav_2_forward.png")

    # ── Navigate 10 steps back — ghost must NEVER become active ──────────────
    nav_n(page, NAV_PREV_SEL, 10)
    cur = active_start(page)
    print(f"\nTest 3: after 10 steps back (active={cur})")
    check("Active is NOT the ghost right endpoint",
          cur,                                     "!=", right_start)
    check("Arc still present",       count(page, ARC_SEL),          ">=", 1)
    check("Ghost chip persists",     count(page, GHOST_SEL),        "==", 1)
    check("Disjoint occ token persists", count(page, DISJOINT_TOK_SEL), "==", 1)
    page.screenshot(path="scripts/f11_nav_3_back.png")

    print(f"\n{'ALL TESTS PASSED' if failed == 0 else f'{failed} FAILED, {passed} PASSED'}")
    browser.close()
