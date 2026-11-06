# Evaluation

Every figure here comes from [`docs/evidence/replay.json`](evidence/replay.json), which
`warehouse-planner replay` rebuilds, and from
[`docs/evidence/split.json`](evidence/split.json), which `scripts/measure_split.py`
rebuilds. CI checks this page against those files.

## How the plans were tested

The agent planned all 134 working days from 3 March 2023 to 19 October 2023. Each plan
used the orders before its day only, exactly as on the morning itself. Each plan was
then compared with what the records show happened that day.

## Forecast

| Measure | Result |
|---|---:|
| Miss, as a share of pairs shipped | 64.9% |
| Miss of the same weekday last week | 75.9% |
| Days inside the likely range | 76.1% |
| Bias over all days | +2.3% |

The miss is the sum of absolute daily errors over the sum of pairs shipped. The agent
beats the simplest rule, the same weekday last week, and its forecasts run close to the
total over the period. The miss is still large because daily volume in these records
swings hard: on 20 working days, the warehouse shipped at least ten times the pairs of
the working day before, or a tenth of them or less.

The method it chose each morning:

| Method | Days chosen |
|---|---:|
| Last 20 days' average, shaped by weekday | 78 |
| Average of the last six same weekdays | 50 |
| Same weekday last week | 6 |

## Workers

| Measure | Result |
|---|---:|
| Days with enough workers planned | 79.9% |
| Days with enough workers when staffed for a high day | 94.8% |
| Days planned exactly | 39.6% |
| Days short | 27 |
| Days over | 54 |
| Days the agent chose to staff high | 16 |
| Workers planned, average | 2.04 |
| Workers needed, average | 1.84 |

Workers needed is what the day's real pairs, order lines and trolley runs took at the
same time standard, plus the boxes the plan moved. The plan leans slightly over rather
than short, which suits a warehouse where an idle hour costs less than a late order.

## Replenishment

| Measure | Result |
|---|---:|
| Boxes brought down | 12,610 |
| Boxes that had to come down | 16,261 |
| Boxes brought down and needed in time | 3,514 |
| Share of boxes brought down that were needed | 27.9% |
| Share of the boxes that had to come down that the plan caught | 21.6% |
| Boxes brought down per day, average | 94.1 |

A box had to come down when its SKU size sold more over the 2-day cover window than
levels 1-2 held, up to what levels 3-4 held.

**This is the weak part, and the reason is measured.** The plan can only be as good as
its split of demand across SKU sizes. Even with the next 5 working days' total pairs
known exactly, sharing them out by each SKU size's recent sales misses:

| Recent days used | Error by SKU size | Error by SKU |
|---:|---:|---:|
| 10 | 97.2% | 76.1% |
| 20 | 93.5% | 73.2% |
| 40 | 92.9% | 73.3% |
| 60 | 92.6% | 73.2% |
| 90 | 92.6% | 73.0% |

The agent uses 40 days. A longer window gains less than half a point. Demand for one
SKU in one size is too lumpy to place a day or two ahead from sales history alone. A
box is cheap to move, so the agent still brings down what the forecast points to, and
the dashboard shows how few were needed.

## What it raised for the supervisor

| Check | Days raised |
|---|---:|
| More workers needed than the roster holds | 32 |
| Expected demand the racks cannot cover | 8 |
| A SKU selling at 3 times its usual rate | 76 |
| SKU sizes with no box in the racks, weekly | 33 |
| Idle boxes on levels 1-2, weekly | 33 |

Each threshold was set so that it fires on a minority of days. The two weekly reviews
run on the first plan day of each week, so a standing issue is not repeated daily.

## What this does not show

- **One storage snapshot.** Every morning starts from the same stock position, because
  the records hold one. Boxes moved on one day are not carried into the next.
- **The time standard.** Box moves at 60 s each and the 15% allowance are assumptions.
- **Claude's plans.** The track record is the built-in rules'. The Claude brain uses the
  same tools and passes the same guard, and is tested with a stand-in model in CI.
