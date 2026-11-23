# Content schema

All knowledge lives in plain YAML files under `content/`. The app reads them
through `serve.py`; nothing is compiled. Add a file, refresh the browser.

```
content/
  domains/<domain-id>.yaml   # a whole field ("LeetCode", later "ML", "Systems"...)
  blobs/<blob-id>.yaml       # a group of knowledge, ordered fundamentals -> advanced
  atoms/<atom-id>.yaml       # one unit of actual knowledge, owned by nobody
```

The key rule: **atoms live once, blobs only point to them.** An atom can be
listed by any number of blobs (e.g. `py-cache` is in both *Python toolkit* and
*Dynamic programming*). Progress is tracked per atom, so refreshing it once
counts everywhere.

## Domain

```yaml
id: leetcode
title: LeetCode
summary: Coding-interview problem solving in Python.
blobs: [python-toolkit, graphs, dynamic-programming]   # suggested order
```

## Blob

```yaml
id: dynamic-programming
title: Dynamic programming
domain: leetcode
summary: The canonical DP problem families and how to reason about them.
requires: [python-toolkit]        # blobs to do first (optional)
sections:                         # ordered: fundamentals first
  - title: Thinking in DP
    atoms: [dp-framing, py-cache]
  - title: Canonical families
    atoms: [dp-1d, dp-grid]
```

## Atom

```yaml
id: py-heapq                      # must equal the file name
title: heapq — priority queue
summary: One line saying what this is for.
links:                            # explicit relations to other atoms
  - to: py-sorting
    kind: contrast                # prereq | uses | contrast | variant
    note: Why/how they relate, in one sentence.
lesson: |
  Markdown. Short course: what it is, the syntax you must remember,
  pitfalls, complexity. Code blocks in ```python fences.
drills:                           # tiny, 1-3 lines of code: pure recall
  - id: push-pop
    prompt: Markdown. What to write. Name the variable to produce.
    setup: |                      # optional, shown read-only, runs first
      nums = [5, 1, 4]
    starter: |                    # optional, prefilled in the editor
      import heapq
    solution: |                   # reference answer (hidden until asked)
      heapq.heapify(nums); res = heapq.heappop(nums)
    check: |                      # hidden asserts, run after the user's code
      assert res == 1, f"res = {res!r}"
classics:                         # canonical / intermediate problems
  - id: kth-largest
    title: Kth Largest Element in an Array
    url: https://leetcode.com/problems/kth-largest-element-in-an-array/
    difficulty: Medium
    prompt: Markdown problem statement (short).
    starter: |
      def findKthLargest(nums, k):
          pass
    hints:
      - First hint.
    solution: |
      ...
    check: |
      assert findKthLargest([3,2,1,5,6,4], 2) == 5
    takeaway: The one-line pattern to remember.
```

### Link kinds

| kind       | meaning                                              | example                        |
|------------|------------------------------------------------------|--------------------------------|
| `prereq`   | learn `to` before this one                           | `dp-1d` → `dp-framing`         |
| `uses`     | this atom's technique relies on `to`                 | `dp-lis` → `py-bisect`         |
| `contrast` | easily confused / worth comparing side by side       | `py-heapq` ↔ `py-sorting`      |
| `variant`  | same idea, different shape                           | `dp-unbounded` ↔ `dp-knapsack-01` |

Links are declared once, on either atom; the app shows them on both sides.

### Writing checks

- Checks run in a fresh namespace: `setup` + your code + `check`.
- Always give assert messages that show the value: `f"res = {res!r}"`.
- `tools/validate.py` runs every `solution` against its `check`; keep it green.
