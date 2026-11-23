"""Checks challenge.py part by part:  python3 check.py   (or: python3 check.py 3  for one part)."""
import sys
import traceback
from datetime import date

import challenge as C

D1, D2, D3, D4, D5 = (date(2026, 10, d) for d in range(1, 6))
FIELDS = ("day", "start_min", "user", "origin", "dest", "duration")
PARSED = [
    (D1, 485, "alice", "Central", "Harbor", 12.5), (D1, 500, "bob", "Central", "Park", 7.0),
    (D1, 520, "carol", "Harbor", "Central", 15.0), (D1, 550, "alice", "Harbor", "Museum", 22.25),
    (D1, 1065, "bob", "Park", "Central", 8.5), (D2, 475, "alice", "Central", "Harbor", 13.0),
    (D2, 480, "dave", "Museum", "Park", 30.5), (D2, 510, "bob", "Central", "Harbor", 11.0),
    (D2, 539, "carol", "Park", "Museum", 9.75), (D2, 1090, "alice", "Harbor", "Central", 14.0),
    (D3, 490, "alice", "Central", "Station", 6.0), (D4, 495, "bob", "Central", "Park", 7.5),
    (D5, 485, "alice", "Central", "Harbor", 12.0), (D5, 505, "carol", "Central", "Museum", 18.5),
]


def mk(*rows):
    return [C.Trip(**dict(zip(FIELDS, r))) for r in rows]


def as_tuple(t):
    return tuple(getattr(t, f) for f in FIELDS)


def trips():
    return mk(*PARSED)


def part0():
    t = C.Trip(day=D1, start_min=485, user="alice", origin="Central", dest="Harbor", duration=12.5)
    yield "fields", as_tuple(t), PARSED[0]
    yield "== compares values", t == mk(PARSED[0])[0], True


def part1():
    got = C.parse_trips(C.RAW)
    yield "number of trips", len(got), len(PARSED)
    yield "trips (as tuples)", [as_tuple(t) for t in got], PARSED
    yield "types", tuple(type(getattr(got[0], f)).__name__ for f in FIELDS), ("date", "int", "str", "str", "str", "float")


def part2():
    yield "top 3", C.top_stations(trips(), 3), [("Central", 8), ("Harbor", 3), ("Park", 2)]
    tie = mk((D1, 1, "a", "Zoo", "X", 1.0), (D1, 2, "a", "Bay", "X", 1.0), (D1, 3, "a", "Zoo", "X", 1.0), (D1, 4, "a", "Bay", "X", 1.0), (D1, 5, "a", "Ash", "X", 1.0))
    yield "ties alphabetical", C.top_stations(tie, 3), [("Bay", 2), ("Zoo", 2), ("Ash", 1)]
    yield "k larger than stations", C.top_stations(tie, 10), [("Bay", 2), ("Zoo", 2), ("Ash", 1)]


def part3():
    yield "report", C.user_report(trips()), (
        "alice: 6 trips, 79.8 min total, 13.29 avg\n"
        "bob: 4 trips, 34.0 min total, 8.50 avg\n"
        "carol: 3 trips, 43.2 min total, 14.42 avg\n"
        "dave: 1 trips, 30.5 min total, 30.50 avg"
    )


def part4():
    t = trips()
    yield "alice", C.longest_streak(t, "alice"), 3
    yield "bob", C.longest_streak(t, "bob"), 2
    yield "dave", C.longest_streak(t, "dave"), 1
    yield "unknown user", C.longest_streak(t, "zoe"), 0
    across = mk((date(2026, 10, 31), 1, "x", "A", "B", 1.0), (date(2026, 11, 1), 1, "x", "A", "B", 1.0), (date(2026, 11, 1), 9, "x", "A", "B", 1.0))
    yield "across a month boundary, 2 trips same day", C.longest_streak(across, "x"), 2


def part5():
    yield "busiest hour", C.busiest_hour(trips()), 8
    tie = mk((D1, 18 * 60, "a", "A", "B", 1.0), (D1, 7 * 60 + 5, "a", "A", "B", 1.0))
    yield "tie -> earliest", C.busiest_hour(tie), 7


def part6():
    yield "k=3", C.longest_trips(trips(), 3), [("dave", 30.5), ("alice", 22.25), ("carol", 18.5)]
    tie = mk((D1, 1, "first", "A", "B", 5.0), (D1, 2, "second", "A", "B", 9.0), (D2, 1, "third", "A", "B", 5.0))
    yield "ties keep chronological order", C.longest_trips(tie, 3), [("second", 9.0), ("first", 5.0), ("third", 5.0)]


def part7():
    t = trips()
    yield "Oct 1, 60 min", C.peak_window(t, D1), 3
    yield "Oct 1, 30 min", C.peak_window(t, D1, 30), 2
    yield "Oct 2, 60 min", C.peak_window(t, D2), 3
    yield "day without trips", C.peak_window(t, date(2026, 9, 30)), 0
    edge = mk((D1, 0, "a", "A", "B", 1.0), (D1, 60, "a", "A", "B", 1.0))
    yield "window end is exclusive", C.peak_window(edge, D1, 60), 1


def part7b():
    t = trips()
    yield "Oct 2, 08:00-09:00", C.count_between(t, D2, "08:00", "09:00"), 3
    yield "Oct 2, 07:00-08:00", C.count_between(t, D2, "07:00", "08:00"), 1
    yield "Oct 1, 08:20-08:40 (start incl., end excl.)", C.count_between(t, D1, "08:20", "08:40"), 1
    yield "empty range", C.count_between(t, D3, "10:00", "11:00"), 0


def part8():
    t = trips()
    yield "Central -> Museum", C.reachable(t, "Central", "Museum"), True
    yield "Museum -> Central", C.reachable(t, "Museum", "Central"), True
    yield "Station -> Central", C.reachable(t, "Station", "Central"), False
    yield "Park -> Park", C.reachable(t, "Park", "Park"), True
    yield "unknown station", C.reachable(t, "Nowhere", "Central"), False


PARTS = [("0", "Trip record", part0), ("1", "parse_trips", part1), ("2", "top_stations", part2),
         ("3", "user_report", part3), ("4", "longest_streak", part4), ("5", "busiest_hour", part5),
         ("6", "longest_trips", part6), ("7", "peak_window", part7), ("7b", "count_between", part7b),
         ("8", "reachable (bonus)", part8)]


def where(exc):
    """The last line of challenge.py involved in the error (that's the line to look at)."""
    frames = [f for f in traceback.extract_tb(exc.__traceback__) if f.filename.endswith("challenge.py")]
    loc = f"challenge.py line {frames[-1].lineno}: {frames[-1].line}\n      " if frames else ""
    return f"{loc}{type(exc).__name__}: {exc}"


def main(only):
    passed = 0
    try:
        mk(PARSED[0])
        trip_ok = True
    except Exception:  # noqa: BLE001
        trip_ok = False
    for pid, name, fn in PARTS:
        if only and pid not in only:
            continue
        if pid != "0" and not trip_ok:
            print(f"Part {pid:<2} {name:<18} ·  waiting for Part 0 (Trip)")
            continue
        try:
            fails = [(label, got, exp) for label, got, exp in fn() if got != exp]
        except NotImplementedError:
            print(f"Part {pid:<2} {name:<18} ·  not done yet")
            continue
        except Exception as e:  # noqa: BLE001 - show the learner's error
            print(f"Part {pid:<2} {name:<18} ✗  {where(e)}")
            continue
        if fails:
            print(f"Part {pid:<2} {name:<18} ✗")
            for label, got, exp in fails:
                print(f"    {label}:\n      expected {exp!r}\n      got      {got!r}")
        else:
            passed += 1
            print(f"Part {pid:<2} {name:<18} ✓")
    if not only:
        print(f"\n{passed}/{len(PARTS)} parts pass")


if __name__ == "__main__":
    main(set(sys.argv[1:]))
