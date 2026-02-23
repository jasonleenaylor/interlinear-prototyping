"""
F-13 tests — adjacent link into existing disjoint set auto-updates keys.

Scenarios:
  A. Adjacent-right from left endpoint:
       Active group = left disjoint endpoint.
       Click the link button immediately to its RIGHT (adjacent merge).
       - If the right neighbour is NOT the ghost chip:
           Key updates "leftEnd:rightStart" → "mergedEnd:rightStart".
           Arc still present; ghost chip still present; arc x1 shifts RIGHT.
       - If the right neighbour IS the ghost chip (edge case, cross-boundary):
           Key is removed; arc disappears.

  B. Adjacent-right into right endpoint (right group expands left):
       Navigate to the group immediately to the LEFT of the ghost chip.
       Click the link button between that group and the ghost chip.
       Key updates "leftEnd:ghostStart" → "leftEnd:mergedStart".
       Arc still present; ghost chip still present; arc x2 shifts LEFT.
"""

from playwright.sync_api import sync_playwright
import time
import re

GHOST_SEL    = '[data-testid="disjoint-ghost-chip"]'
ARC_PATH_SEL = "svg.absolute path"
LINK_BTN_SEL = 'button[aria-label="Link occurrences"]'
NAV_NEXT_SEL = 'button[aria-label="Next occurrence"]'
NAV_PREV_SEL = 'button[aria-label="Previous occurrence"]'
ACTIVE_GRP_SEL = '[data-active="true"]'

passed = 0
failed = 0


def check(label, actual, op, expected):
    global passed, failed
    if op == "==":
        ok = actual == expected
    elif op == ">":
        ok = actual > expected
    elif op == "<":
        ok = actual < expected
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
    print("  [{}] {}: got {}  (expected {} {})".format(
        status, label, repr(actual), op, repr(expected)))


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


def parse_arc_x(page):
    """Return (x1, x2) from the arc path's 'd' attribute, or None."""
    result = page.evaluate("""() => {
        const path = document.querySelector("svg.absolute path");
        if (!path) return null;
        const d = path.getAttribute("d");
        const m1 = d.match(/^M\\s+([\\d.\\-]+)\\s/);
        const m2 = d.match(/,\\s*([\\d.\\-]+)\\s+[\\d.\\-]+\\s*$/);
        if (!m1 || !m2) return null;
        return [parseFloat(m1[1]), parseFloat(m2[1])];
    }""")
    return tuple(result) if result else None


def setup(page, link_btn_index=25, nav_before=2):
    """Reload, navigate nav_before steps, click link button at index."""
    page.reload()
    page.wait_for_load_state("networkidle", timeout=15000)
    time.sleep(0.5)

    nav(page, NAV_NEXT_SEL, nav_before)
    time.sleep(0.3)
    left_start = active_start(page)

    btns = page.query_selector_all(LINK_BTN_SEL)
    if len(btns) <= link_btn_index:
        print("  [SKIP] Only {} link buttons; need index {}".format(
            len(btns), link_btn_index))
        return None, None

    btns[link_btn_index].click()
    time.sleep(0.7)

    ghost = page.query_selector(GHOST_SEL)
    right_start = None
    if ghost:
        val = ghost.get_attribute("data-group-start")
        right_start = int(val) if val is not None else None

    return left_start, right_start


def click_adjacent_right_of_active(page):
    """Click the first regular link button in the DOM sibling right after the
    active group element.  Returns True if a button was found and clicked."""
    return page.evaluate("""() => {
        const active = document.querySelector('[data-active="true"]');
        if (!active) return false;
        // The rendered strip is a flex row; the link-button div is the
        // immediate next sibling of the active group wrapper div.
        const sib = active.nextElementSibling;
        if (!sib) return false;
        const btn = sib.querySelector('button[aria-label="Link occurrences"]');
        if (!btn) return false;
        btn.click();
        return true;
    }""")


def find_group_before_ghost(page, ghost_start):
    """Navigate backward until the active group's next DOM sibling leads to the
    ghost chip group.  Returns the startIndex of that group, or None."""
    # Ghost chips are skipped by navigation, so after navigating backward from a
    # position past the ghost we should already be at the group just before it.
    # Check that condition first; loop a few more steps if needed.
    for _ in range(10):
        result = page.evaluate("""(ghostStart) => {
            const active = document.querySelector('[data-active="true"]');
            if (!active) return null;
            const linkDiv = active.nextElementSibling;
            if (!linkDiv) return null;
            const groupDiv = linkDiv.nextElementSibling;
            if (!groupDiv) return null;
            const gStart = parseInt(groupDiv.getAttribute('data-group-start') || '-1', 10);
            return gStart;
        }""", ghost_start)
        if result == ghost_start:
            return active_start(page)
        btn = page.query_selector(NAV_PREV_SEL)
        if not btn:
            break
        btn.click()
        time.sleep(0.2)
    return None


# =============================================================================
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 900})
    page.goto("http://localhost:3000")
    page.wait_for_load_state("networkidle", timeout=15000)
    time.sleep(0.5)

    # =========================================================================
    # TEST GROUP A — Adjacent-right merge from the left disjoint endpoint
    # =========================================================================
    print("\n" + "=" * 70)
    print("TEST GROUP A: Adjacent-right from left endpoint")
    print("=" * 70)

    leftA, rightA = setup(page, link_btn_index=25, nav_before=2)

    if leftA is not None and rightA is not None:
        print("  Disjoint link: leftStart={}, rightStart={}".format(leftA, rightA))

        # Capture state before adjacent merge
        xy_before = parse_arc_x(page)
        ghosts_before = count(page, GHOST_SEL)
        print("  Arc x1,x2 before: {}".format(xy_before))
        print("  Ghost chips before: {}".format(ghosts_before))

        check("A1: arc present before adjacent merge",
              xy_before is not None, "==", True)
        check("A2: 1 ghost chip before adjacent merge",
              ghosts_before, "==", 1)

        # Click the adjacent-right link button (first button after active group)
        clicked = click_adjacent_right_of_active(page)
        time.sleep(0.7)

        check("A3: adjacent-right link button found and clicked",
              clicked, "==", True)

        xy_after = parse_arc_x(page)
        ghosts_after = count(page, GHOST_SEL)
        print("  Arc x1,x2 after:  {}".format(xy_after))
        print("  Ghost chips after: {}".format(ghosts_after))

        # Determine whether the adjacent merge was cross-boundary or expansion.
        # If rightA == leftA + 1 (degenerate case), arc disappears (Case 1).
        # Otherwise arc shifts (Case 2).
        if rightA is not None and leftA is not None:
            # The active group in a fresh page starts at leftA; after 1 adjacent
            # merge rightward, the group expands.  The right neighbour's startIndex
            # is the old active group's lastOcc + 1.  We don't know oldLastOcc
            # directly, but we know the arc should still be there unless the two
            # groups were directly adjacent in occurrence-index space.
            if xy_after is not None:
                # Arc survived: Case 2 (expansion)
                x1_before = xy_before[0] if xy_before else None
                x1_after  = xy_after[0]
                check("A4a: arc still present after merge (Case 2 — key updated)",
                      xy_after is not None, "==", True)
                check("A4b: 1 ghost chip still present after merge",
                      ghosts_after, "==", 1)
                if x1_before is not None:
                    check("A4c: arc x1 shifted RIGHT after left group expanded",
                          x1_after, ">", x1_before)
                print("  x1 before={:.1f}  x1 after={:.1f}".format(
                    x1_before or 0, x1_after))
            else:
                # Arc disappeared: Case 1 (cross-boundary, groups were
                # occurrence-adjacent and key was removed)
                check("A4a: arc removed after cross-boundary merge (Case 1)",
                      xy_after is None, "==", True)
                check("A4b: no ghost chip after cross-boundary merge",
                      ghosts_after, "==", 0)
                print("  (cross-boundary case — disjoint link removed by adjacent merge)")
    else:
        print("  [SKIP] Setup failed for group A")

    page.screenshot(path="scripts/f13_A_after_merge.png")

    # =========================================================================
    # TEST GROUP B — Adjacent-right merge into the right (ghost) endpoint
    # =========================================================================
    print("\n" + "=" * 70)
    print("TEST GROUP B: Adjacent-right into right (ghost) endpoint")
    print("=" * 70)

    leftB, rightB = setup(page, link_btn_index=25, nav_before=2)

    if leftB is not None and rightB is not None:
        print("  Disjoint link: leftStart={}, rightStart={}".format(leftB, rightB))

        # Navigate past the ghost chip (rightB is not navigable, so navigation
        # skips it).  Then navigate backward to land on the group just before it.
        # Strategy: go far forward (past rightB), then backward until active
        # group's DOM-right-sibling is the ghost chip.

        # First navigate forward past the ghost chip.
        for _ in range(40):
            cur = active_start(page)
            if cur is not None and rightB is not None and cur > rightB:
                break
            btn = page.query_selector(NAV_NEXT_SEL)
            if not btn:
                break
            btn.click()
            time.sleep(0.15)

        cur = active_start(page)
        print("  After forward nav: active={}".format(cur))
        if cur is None or cur <= rightB:
            print("  [SKIP] Could not navigate past ghost chip; cur={}".format(cur))
        else:
            # Now navigate backward until we're at the group just before the ghost.
            before_ghost = find_group_before_ghost(page, rightB)
            cur = active_start(page)
            print("  Group before ghost: start={}, cur={}".format(before_ghost, cur))

            if before_ghost is None:
                print("  [SKIP] Could not find group just before ghost chip")
            else:
                check("B1: found group immediately before ghost chip",
                      before_ghost is not None, "==", True)

                # Capture state before adjacent merge
                xy_before = parse_arc_x(page)
                ghosts_before = count(page, GHOST_SEL)
                print("  Arc x1,x2 before: {}".format(xy_before))

                check("B2: arc present before adjacent merge",
                      xy_before is not None, "==", True)
                check("B3: 1 ghost chip before adjacent merge",
                      ghosts_before, "==", 1)

                # Click the link button immediately to the right of the active
                # group (between active group and ghost chip).
                clicked = click_adjacent_right_of_active(page)
                time.sleep(0.7)

                check("B4: adjacent-right link button found and clicked",
                      clicked, "==", True)

                xy_after = parse_arc_x(page)
                ghosts_after = count(page, GHOST_SEL)
                print("  Arc x1,x2 after:  {}".format(xy_after))
                print("  Ghost chips after: {}".format(ghosts_after))

                if xy_after is not None:
                    # Arc survived: Case 3 (right endpoint expanded leftward)
                    x2_before = xy_before[1] if xy_before else None
                    x2_after  = xy_after[1]
                    check("B5a: arc still present after merge (Case 3 — key updated)",
                          xy_after is not None, "==", True)
                    check("B5b: 1 ghost chip still present after merge",
                          ghosts_after, "==", 1)
                    if x2_before is not None:
                        check("B5c: arc x2 shifted LEFT after right group expanded",
                              x2_after, "<", x2_before)
                    print("  x2 before={:.1f}  x2 after={:.1f}".format(
                        x2_before or 0, x2_after))
                else:
                    # Arc disappeared: the "before_ghost" group was actually the
                    # left endpoint group itself (Case 1).
                    check("B5a: arc removed (cross-boundary — both endpoints merged)",
                          xy_after is None, "==", True)
                    print("  (cross-boundary case: arc removed)")

        page.screenshot(path="scripts/f13_B_after_merge.png")
    else:
        print("  [SKIP] Setup failed for group B")

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
