# How it works

The agent plans one working day at a time, from the orders before that day only. It
runs the same loop every morning and writes everything it did into the plan, so each
step can be read on the dashboard.

## The loop

| Step | What happens | Tools |
|---|---|---|
| **Observe** | Read the orders up to the last working day, and grade the last plan against what shipped. | `read_orders`, `check_yesterday` |
| **Decide** | Score the forecasting methods on recent days and choose one. Choose whether to staff for the expected volume or for a high day. | `compare_forecast_methods` |
| **Act** | Forecast the next working days, find the SKUs in demand, plan the boxes to bring down and set the workers. | `forecast_demand`, `find_skus_in_demand`, `plan_replenishment`, `plan_workers` |
| **Check** | Check the plan: workers against the roster, demand the racks cannot cover, sudden spikes, missing and idle stock. | `check_plan` |
| **Report** | Write the brief, and raise anything a person must decide. | |

The agent escalates instead of acting when it has fewer than 40 working days of history,
when a plan needs more workers than the roster holds, or when the racks cannot cover more
than 5% of the pairs due over the cover window.

## The tools

Each tool is a plain Python function with a JSON schema. The tools hold all the
arithmetic; the agent only chooses which to call and reads what comes back.

| Tool | What it returns |
|---|---|
| `read_orders` | How much history there is, and the last working day's pairs, lines and orders |
| `check_yesterday` | The last plan's forecast against what shipped, and whether its workers were enough |
| `compare_forecast_methods` | Each method's miss over the last 30 working days |
| `forecast_demand` | Pairs, order lines and orders for each of the next 5 working days, with a likely range |
| `find_skus_in_demand` | The 15 SKUs expected to sell most, with trend, share and stock on each level |
| `plan_replenishment` | Every box to bring down from levels 3-4 to 1-2, and what it cannot cover |
| `plan_workers` | Hours of work and workers for each forecast day, expected and if the day runs high |
| `check_plan` | The issues found in the plan, and whether it is ready |

## The forecast

Three methods compete every morning:

- **Same weekday last week.** The pairs shipped on that weekday a week earlier.
- **Average of the last six same weekdays.** Smooths one odd week.
- **Last 20 days' average, shaped by weekday.** The recent level, scaled by how each
  weekday usually compares.

Each is scored on the last 30 working days, forecasting each day from the days before
it. The method with the smallest miss, measured as the sum of absolute errors over the
pairs shipped, makes the forecast. The likely range is the forecast scaled by the 10th
and 90th percentiles of how far that method's forecasts actually missed. Order lines,
orders and trolley runs follow from their recent ratio to pairs.

## The SKUs in demand

The forecast for the next 5 working days is shared across SKU sizes by their share of
pairs over the last 40 working days. The 15 SKUs with the most expected pairs are listed
with:

- **Trend.** The last 10 days' rate against the 40-day rate: rising at 25% above,
  falling at 25% below.
- **Stock.** Boxes on levels 1-2 and on levels 3-4, and how many days levels 1-2 last.
- **Sales class.** A for the SKUs behind 80% of pairs, B for the next 15%, C for the rest,
  measured on the same 40 days, beside the catalogue's own class.

A SKU selling at 3 or more times its usual rate over the last 10 days is flagged as a
spike, because one large order may be behind it.

## Replenishment from levels 3-4 to 1-2

Levels 1-2 should hold each SKU size's expected pairs for the next 2 working days. For
every SKU size that falls short:

1. **Need.** Expected pairs over the cover window, rounded, less the boxes already on
   levels 1-2. One box holds one pair.
2. **Source.** Boxes come down from levels 3-4, nearest first: the same bay as the pick
   face, then the same aisle, and level 3 before level 4.
3. **Destination.** The SKU size's own pick face, in the same bay where it has one.
4. **New pick faces.** A SKU size with no box on levels 1-2 gets one location. Its slots
   come from boxes that have not sold in 40 working days, which move up to levels 3-4.

The plan also reports what it cannot fix: pairs the racks do not hold at all, SKU sizes
expected to sell with no box in the racks, and boxes idle on levels 1-2.

## Workers

Each forecast day becomes hours of work, with the time standard from the original
project report:

- a walk of 166.4 m at 1 m/s and a 60 s setup for each trolley run,
- 10 s at each stop, one stop per order line,
- 6 s for each pair,
- 60 s for each box brought down (an assumption).

Hours become workers at 6.8 productive hours each: an 8-hour shift less a 15% allowance
for breaks, fatigue and delay. A working day always has at least 1 worker. If 4 or more
of the last 5 days ran above forecast, the agent staffs to the top of the likely range.

## Two brains

The loop can be run by either of two brains, through the same tools:

- **Built-in rules.** Run the steps in a fixed order. They planned every day in the
  replay, so anyone can reproduce the track record without a key.
- **Claude.** With `ANTHROPIC_API_KEY` set, Claude runs the morning with the Anthropic
  Messages API and tool use. It chooses the next tool, reads each result and decides what
  to do with it. If it stops before the plan is complete, the rules finish the missing
  steps and say so.

## The guard

A language model writing from memory can produce a plausible figure that is not real.
Every figure the brief may state came from a tool, so the tool results are the complete
list of numbers allowed. A brief that states any other number is rejected, and the agent
writes the brief from the tool results instead. The same check holds this documentation
and the README to the replay's output.

## The replay and the dashboard

`warehouse-planner site` plans every day from 3 March 2023, the first day with 40 working
days of history, to the first working day after the records end, then writes one file
per day and the scores into a static site. GitHub Actions builds and publishes it.

The site works out which day to show from the date: each calendar day moves the replay
on by one working day. The Python code and the page do the same sum, and the tests hold
them together. When an Anthropic key is set as a repository secret, a daily run lets
Claude re-plan that day's plan before publishing.

## The code

| Module | Role |
|---|---|
| `settings.py` | Every number the agent uses, and where it comes from |
| `data.py` | Reads the records into orders, slots and daily totals |
| `forecast.py` | The three methods, their scoring and the likely range |
| `demand.py` | The SKUs in demand |
| `replenishment.py` | The boxes to bring down |
| `workers.py` | Hours of work and workers |
| `tools.py` | The eight tools and their schemas |
| `llm.py` | The Claude connection |
| `guard.py` | The number guard |
| `agent.py` | The loop, the two brains and the brief |
| `replay.py` | Plans every day and scores the plans |
| `site.py` | Builds the dashboard |
| `cli.py` | The `warehouse-planner` command |
