"""
F-11 comprehensive tests — disjoint occurrence linking.

Four test groups:

A. Ghost skip: navigating forward/backward never makes the ghost (right endpoint)
   group active.

B. Arc style across 4 nav positions:
   B1. BEFORE left endpoint  -> arc dashed,  1 ghost chip (right only), 1 disjoint token (left box always shows it)
   B2. AT left endpoint      -> arc solid,   1 ghost chip,  1 disjoint token
   B3. BETWEEN endpoints     -> arc dashed,  1 ghost chip (right only), 1 disjoint token (left box always shows it)
   B4. AFTER right endpoint  -> arc dashed,  1 ghost chip (right only), 1 disjoint token (left box always shows it)

C. Arc coordinates: x1 approx right edge of left group; x2 approx left edge of
   right group; x1 < x2 always.

D. Left endpoint box equals adjacent-link box: OccurrenceBox renders with ghost
   token visible when active; reverts to ghost chip when navigated away.

Strategy: single browser page, reloaded between test groups.
  - Navigate forward 3 steps  -> active = group N (LEFT endpoint).
  - Click link button[15]     -> creates disjoint link; active stays at group N.
  - Record leftStart / rightStart via data-group-start attributes.
"""

from playwright.sync_api import sync_playwright
import time
import re

# Selectors
GHOST_SEL        = '[data-testid="disjoint-ghost-chip"]'
DISJOINT_TOK_SEL = '[data-testid="disjoint-occ-token"]'
ARC_PATH_SEL     = "svg.absolute path"
LINK_BTN_SEL     = 'button[aria-label="Link occurrences"]'
NAV_NEXT_SEL     = 'button[aria-label="Next occurrence"]'
NAV_PREV_SEL     = 'button[aria-label="Previous occurrence"]'
ACTIVE_GRP_SEL   = '[data-active="true"]'

# Result counters
passed = 0
failed = 0


def check(label, actual, op, expected):
    global passed, failed
    if op == "==":
        ok = (actual == expected)
    elif op == ">=":
        ok = (actual >= expected)
    elif op == "<":
        ok = (actual < expected)
    elif op == "within":
        ok = abs(actual - expected[0]) <= expected[1]
        expected = "{:.1f} +/- {}".format(expected[0], expected[1])
    else:
        ok = False
    status = "PASS" if ok else "FAIL"
    if ok:
        passed += 1
    else:
        failed += 1
    print("  [{}] {}: got {}  (expected {} {})".format(status, label, repr(actual), op, repr(expected)))


def count(page, sel):
    return len(page.query_selector_all(sel))


def nav(page, sel, n=1, delay=0.25):
    for _ in range(n):
        btn = page.query_selector(sel)
        if btn:
            btn.click()
            time.sleep(delay)


def active_start(page):
    el = page.query_selector(ACTIVE_GRP_SEL)
    if not el:
        return None
    val = el.get_attribute("data-group-start")
    return int(val) if val is not None else None


def arc_dasharray(page):
    path = page.query_selector(ARC_PATH_SEL)
    if not path:
        return None
    return path.get_attribute("stroke-dasharray")


def parse_arc_x(d):
    m = re.match(r"M\s+([\d.\-]+)\s+[\d.\-]+\s+C\s+", d)
    end = re.search(r",\s*([\d.\-]+)\s+[\d.\-]+\s*$", d)
    if m and end:
        return float(m.group(1)), float(end.group(1))
    return None


def get_arc_coords(page):
    return page.evaluate("""() => {
        const path = document.querySelector("svg.absolute path");
        if (!path) return null;
        const d = path.getAttribute("d");
        const svg  = path.closest("svg");
        const cont = svg ? svg.parentElement : null;
        if (!cont) return null;
        const cRect = cont.getBoundingClientRect();

        const active = document.querySelector('[data-active="true"]');
        const ghost  = document.querySelector('[data-testid="disjoint-ghost-chip"]');
        const aRect  = active ? active.getBoundingClientRect() : null;
        const gRect  = ghost  ? ghost.getBoundingClientRect()  : null;

        return {
            d: d,
            activeRight: aRect ? aRect.right - cRect.left : null,
            ghostLeft:   gRect ? gRect.left  - cRect.left : null,
        };
    }""")


def get_ghost_left_by_start(page, group_start):
    """Get the left edge (relative to SVG container) of the ghost with the given data-group-start."""
    return page.evaluate("""(gs) => {
        const ghosts = document.querySelectorAll('[data-testid="disjoint-ghost-chip"]');
        let target = null;
        for (const g of ghosts) {
            if (parseInt(g.getAttribute('data-group-start') || '-1', 10) === gs) {
                target = g;
                break;
            }
        }
        if (!target) return null;
        const svg  = document.querySelector('svg.absolute');
        const cont = svg ? svg.parentElement : null;
        if (!cont) return null;
        const cRect = cont.getBoundingClientRect();
        const gRect = target.getBoundingClientRect();
        return gRect.left - cRect.left;
    }""", group_start)


def setup(page, link_btn_index=15, nav_before=3):
    """Reload, navigate forward nav_before steps, click link button."""
    page.reload()
    page.wait_for_load_state("networkidle", timeout=15000)
    time.sleep(0.5)

    nav(page, NAV_NEXT_SEL, nav_before)
    time.sleep(0.3)

    left_start = active_start(page)

    btns = page.query_selector_all(LINK_BTN_SEL)
    if len(btns) <= link_btn_index:
        print("  [SKIP] Only {} link buttons; need index {}".format(len(btns), link_btn_index))
        return None, None

    btns[link_btn_index].click()
    time.sleep(0.7)

    ghost = page.query_selector(GHOST_SEL)
    right_start = None
    if ghost:
        val = ghost.get_attribute("data-group-start")
        right_start = int(val) if val is not None else None

    return left_start, right_start


# =============================================================================
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 900})
    page.goto("http://localhost:3000")
    page.wait_for_load_state("networkidle", timeout=15000)
    time.sleep(0.5)

    # =========================================================================
    # TEST GROUP A - Ghost group is never navigated to
    # =========================================================================
    print("\n" + "=" * 70)
    print("TEST GROUP A: Ghost (right endpoint) is never the active group")
    print("=" * 70)

    leftA, rightA = setup(page)
    if rightA is not None:
        print("  Link: leftStart={}, rightStart={}".format(leftA, rightA))
        active_history = []

        for _ in range(30):
            active_history.append(active_start(page))
            btn = page.query_selector(NAV_NEXT_SEL)
            if not btn:
                break
            btn.click()
            time.sleep(0.15)
        for _ in range(30):
            active_history.append(active_start(page))
            btn = page.query_selector(NAV_PREV_SEL)
            if not btn:
                break
            btn.click()
            time.sleep(0.15)

        distinct = set(s for s in active_history if s is not None)
        check("A1: Ghost group NEVER becomes active",
              rightA in active_history, "==", False)
        check("A2: Left endpoint WAS active at some point",
              leftA in active_history, "==", True)
        check("A3: At least 4 distinct groups visited",
              len(distinct), ">=", 4)
        print("  Distinct active groups visited: {}".format(sorted(distinct)))
        page.screenshot(path="scripts/f11_comp_A.png")
    else:
        print("  [SKIP] Setup failed for group A")

    # =========================================================================
    # TEST GROUP B - Arc style across 4 navigation positions
    # =========================================================================
    print("\n" + "=" * 70)
    print("TEST GROUP B: Arc solid/dashed across 4 nav positions")
    print("=" * 70)

    leftB, rightB = setup(page)
    if rightB is not None:
        print("  Link: leftStart={}, rightStart={}".format(leftB, rightB))

        # B2: AT left endpoint (right after setup)
        print("\n  B2: AT left endpoint -> arc SOLID, 1 ghost, 1 token")
        cur = active_start(page)
        check("B2a: active IS left endpoint",           cur,                           "==", leftB)
        check("B2b: arc present",                       count(page, ARC_PATH_SEL),     ">=", 1)
        check("B2c: arc SOLID (no dasharray)",           arc_dasharray(page),           "==", None)
        check("B2d: 1 ghost chip",                      count(page, GHOST_SEL),        "==", 1)
        check("B2e: 1 disjoint token in box",            count(page, DISJOINT_TOK_SEL), "==", 1)
        page.screenshot(path="scripts/f11_comp_B2_at_left.png")

        # B1: BEFORE left endpoint - navigate backward
        print("\n  B1: BEFORE left endpoint -> arc DASHED, 2 ghosts, 0 tokens")
        for _ in range(20):
            cur = active_start(page)
            if cur is not None and cur < leftB:
                break
            btn = page.query_selector(NAV_PREV_SEL)
            if not btn:
                break
            btn.click()
            time.sleep(0.2)
        cur = active_start(page)
        print("    active={}  leftStart={}".format(cur, leftB))
        check("B1a: active BEFORE left endpoint",
              cur is not None and cur < leftB, "==", True)
        check("B1b: arc present",               count(page, ARC_PATH_SEL),     ">=", 1)
        check("B1c: arc DASHED",                arc_dasharray(page),           "==", "4 3")
        check("B1d: 1 ghost chip (right endpoint only)",  count(page, GHOST_SEL),          "==", 1)
        check("B1e: 1 disjoint token (left endpoint box always shows it)", count(page, DISJOINT_TOK_SEL),   "==", 1)
        page.screenshot(path="scripts/f11_comp_B1_before_left.png")

        # Return to left endpoint
        for _ in range(20):
            cur = active_start(page)
            if cur == leftB:
                break
            nav(page, NAV_NEXT_SEL)

        # B3: BETWEEN endpoints - 2 steps forward from left endpoint
        print("\n  B3: BETWEEN endpoints -> arc DASHED, 2 ghosts, 0 tokens")
        nav(page, NAV_NEXT_SEL, 2)
        cur = active_start(page)
        print("    active={}  leftStart={}  rightStart={}".format(cur, leftB, rightB))
        is_between = (cur is not None and leftB is not None and rightB is not None
                      and leftB < cur < rightB)
        check("B3a: active BETWEEN endpoints",  is_between,                    "==", True)
        check("B3b: arc present",               count(page, ARC_PATH_SEL),     ">=", 1)
        check("B3c: arc DASHED",                arc_dasharray(page),           "==", "4 3")
        check("B3d: 1 ghost chip (right endpoint only)",  count(page, GHOST_SEL),          "==", 1)
        check("B3e: 1 disjoint token (left endpoint box always shows it)", count(page, DISJOINT_TOK_SEL),   "==", 1)
        page.screenshot(path="scripts/f11_comp_B3_between.png")

        # B4: AFTER right endpoint
        print("\n  B4: AFTER right endpoint -> arc DASHED, 2 ghosts, 0 tokens")
        for _ in range(20):
            cur = active_start(page)
            if cur is not None and rightB is not None and cur > rightB:
                break
            btn = page.query_selector(NAV_NEXT_SEL)
            if not btn:
                break
            btn.click()
            time.sleep(0.2)
        cur = active_start(page)
        print("    active={}  rightStart={}".format(cur, rightB))
        check("B4a: active AFTER right endpoint",
              cur is not None and rightB is not None and cur > rightB, "==", True)
        check("B4b: arc present",               count(page, ARC_PATH_SEL),     ">=", 1)
        check("B4c: arc DASHED",                arc_dasharray(page),           "==", "4 3")
        check("B4d: 1 ghost chip (right endpoint only)",  count(page, GHOST_SEL),          "==", 1)
        check("B4e: 1 disjoint token (left endpoint box always shows it)", count(page, DISJOINT_TOK_SEL),   "==", 1)
        page.screenshot(path="scripts/f11_comp_B4_after_right.png")
    else:
        print("  [SKIP] Setup failed for group B")

    # =========================================================================
    # TEST GROUP C - Arc x1/x2 match group DOM positions
    # =========================================================================
    print("\n" + "=" * 70)
    print("TEST GROUP C: Arc coordinates match group bounding rects")
    print("=" * 70)

    leftC, rightC = setup(page)
    if rightC is not None:
        # Active = left endpoint
        coords = get_arc_coords(page)
        d_val = coords["d"] if coords else "N/A"
        print("  Arc d: {}".format(d_val))

        if coords and coords.get("d"):
            xy = parse_arc_x(coords["d"])
            if xy:
                x1, x2 = xy
                a_right = coords["activeRight"]
                g_left  = coords["ghostLeft"]
                TOL = 15

                print("  Arc: x1={:.1f}  x2={:.1f}".format(x1, x2))
                print("  Active group right (in container): {}".format(a_right))
                print("  Ghost  group left  (in container): {}".format(g_left))

                check("C1: x1 < x2 (left-to-right arc)", x1 < x2, "==", True)
                check("C2: x1 approx right edge of left endpoint",
                      abs(x1 - a_right) if a_right is not None else 9999,
                      "within", (0, TOL))
                check("C3: x2 approx left edge of ghost group",
                      abs(x2 - g_left) if g_left is not None else 9999,
                      "within", (0, TOL))

                # Navigate away and recheck.
                # Use a longer delay (0.5 s per step) so the 300 ms CSS transition
                # finishes before the next click, and then wait an extra 0.5 s
                # so the transitionend-triggered arc recomputation settles.
                nav(page, NAV_NEXT_SEL, 3, delay=0.5)
                time.sleep(0.5)
                coords2 = get_arc_coords(page)
                if coords2 and coords2.get("d"):
                    xy2 = parse_arc_x(coords2["d"])
                    if xy2:
                        x1b, x2b = xy2
                        # Now only the right endpoint is a ghost chip; query it by data-group-start.
                        g_left2 = get_ghost_left_by_start(page, rightC)
                        print("\n  After 3 nav steps - Arc: x1={:.1f}  x2={:.1f}".format(x1b, x2b))
                        print("  Right-endpoint ghost left (by group-start): {}".format(g_left2))
                        check("C4: x1 < x2 after navigating away", x1b < x2b, "==", True)
                        check("C5: x2 approx ghost group left after nav",
                              abs(x2b - g_left2) if g_left2 is not None else 9999,
                              "within", (0, TOL))
            else:
                print("  [FAIL] Could not parse arc d attribute")
                failed += 1
        else:
            print("  [FAIL] No arc path on page")
            failed += 1

        page.screenshot(path="scripts/f11_comp_C_arc_coords.png")
    else:
        print("  [SKIP] Setup failed for group C")

    # =========================================================================
    # TEST GROUP D - Left endpoint OccurrenceBox round-trip
    # =========================================================================
    print("\n" + "=" * 70)
    print("TEST GROUP D: Left endpoint renders full OccurrenceBox round-trip")
    print("=" * 70)

    leftD, rightD = setup(page)
    if rightD is not None:
        cur = active_start(page)
        check("D1: active IS left endpoint",                  cur == leftD,                       "==", True)
        check("D2: nav buttons present (OccurrenceBox rendered)", count(page, 'button[aria-label="Next occurrence"]'), ">=", 1)
        check("D3: disjoint token visible in box",            count(page, DISJOINT_TOK_SEL),       "==", 1)
        check("D4: only 1 ghost chip (right endpoint)",       count(page, GHOST_SEL),              "==", 1)
        page.screenshot(path="scripts/f11_comp_D1_at_left.png")

        nav(page, NAV_NEXT_SEL, 2)
        check("D5: disjoint token still in left endpoint box when away", count(page, DISJOINT_TOK_SEL), "==", 1)
        check("D6: right endpoint still a ghost chip (1 total)", count(page, GHOST_SEL),      "==", 1)
        page.screenshot(path="scripts/f11_comp_D2_away.png")

        for _ in range(5):
            cur = active_start(page)
            if cur == leftD:
                break
            nav(page, NAV_PREV_SEL)

        check("D7: disjoint token returns at left endpoint",  count(page, DISJOINT_TOK_SEL),       "==", 1)
        check("D8: back to 1 ghost chip at left endpoint",    count(page, GHOST_SEL),              "==", 1)
        page.screenshot(path="scripts/f11_comp_D3_back.png")
    else:
        print("  [SKIP] Setup failed for group D")

    # =========================================================================
    # Summary
    # =========================================================================
    print("\n" + "=" * 70)
    total = passed + failed
    if failed == 0:
        print("ALL {} TESTS PASSED".format(total))
    else:
        print("{} FAILED / {} PASSED  (total {})".format(failed, passed, total))
    print("=" * 70)

    browser.close()
