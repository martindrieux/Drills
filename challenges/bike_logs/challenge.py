"""
Bike-share trip log: a 15-minute autonomy challenge.

You work for a small bike-sharing company. Below is a raw export of trips. Implement the
functions in order. Check your work at any point with:

    python3 check.py

Rules: standard library only, no notes, no web search. Aim for 15 minutes; Part 8 is a bonus.
Each part is checked on its own (later parts are fed correct trips even if Part 1 is broken).
"""

RAW = """
# when, user, from, to, minutes
2026-10-01 08:05, Alice, Central, Harbor, 12.5
2026-10-01 08:20, bob, Central, Park, 7
2026-10-01 08:40, carol , Harbor, Central, 15.0
2026-10-01 09:10, alice, Harbor, Museum, 22.25

2026-10-02 07:55, ALICE, Central, Harbor, 13
2026-10-02 08:00, dave, Museum, Park, 30.5
2026-10-02 08:30, bob, Central, Harbor, 11
2026-10-01 17:45, Bob, Park, Central, 8.5
2026-10-02 08:59, carol, Park, Museum, 9.75
2026-10-02 09:30, dave, Park, Central
2026-10-02 18:10, alice, Harbor, Central, 14
2026-10-03 08:10, alice, Central, Station, 6.0
2026-10-03 12:00, carol, Museum, Harbor, abc
2026-10-04 08:15, bob, Central, Park, 7.5
2026-10-05 08:05,   alice, Central, Harbor, 12
2026-10-05 08:25, carol, Central, Museum, 18.5
"""


# Part 0: define the record.
# A `Trip` with these fields (keyword-constructible, comparable with ==):
#   day: datetime.date        start_min: int (minutes since midnight)
#   user: str (lowercase)     origin: str      dest: str      duration: float (minutes)
class Trip:
    pass


# Part 1: parse.
# One trip per valid line. Skip blank lines and lines starting with "#".
# Skip malformed lines (wrong number of fields, or a duration that is not a number).
# Strip spaces around fields; lowercase the user. Return the trips sorted by (day, start_min).
def parse_trips(raw: str) -> list[Trip]:
    raise NotImplementedError


# Part 2: the k stations with the most departures, as (station, count) pairs.
# Most departures first; ties in alphabetical order.
def top_stations(trips: list[Trip], k: int) -> list[tuple[str, int]]:
    raise NotImplementedError


# Part 3: a text report, one line per user in alphabetical order, joined with newlines:
#   "alice: 6 trips, 79.8 min total, 13.29 avg"
# Total with 1 decimal, average with 2 decimals.
def user_report(trips: list[Trip]) -> str:
    raise NotImplementedError


# Part 4: the longest run of consecutive calendar days on which `user` made at least one trip
# (0 if the user never rode).
def longest_streak(trips: list[Trip], user: str) -> int:
    raise NotImplementedError


# Part 5: the hour of the day (0-23) with the most departures; on a tie, the earliest hour.
def busiest_hour(trips: list[Trip]) -> int:
    raise NotImplementedError


# Part 6: the k longest trips as (user, duration) pairs, longest first.
# Equal durations keep their chronological order.
def longest_trips(trips: list[Trip], k: int) -> list[tuple[str, float]]:
    raise NotImplementedError


# Part 7: on `day`, the largest number of departures falling in any window
# [s, s + width) minutes long.
def peak_window(trips: list[Trip], day, width: int = 60) -> int:
    raise NotImplementedError


# Part 7b: on `day`, how many departures happened with t1 <= time < t2 ("HH:MM" strings)?
# Assume this is called many times: sort once per call is fine, but find the range in O(log n).
def count_between(trips: list[Trip], day, t1: str, t2: str) -> int:
    raise NotImplementedError


# Part 8 (bonus): can a rider get from station `a` to station `b` by chaining trips that were
# actually taken (each trip is a one-way edge origin -> dest)? A station reaches itself.
def reachable(trips: list[Trip], a: str, b: str) -> bool:
    raise NotImplementedError
