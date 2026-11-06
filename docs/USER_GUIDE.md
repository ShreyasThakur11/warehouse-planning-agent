# User guide

This guide is for anyone: a warehouse supervisor, a student, or someone who has never
seen the code.

## What an AI agent is

An ordinary program does the same steps in the same order every time. An agent is given
a goal and a set of tools, and decides for itself which tool to use next, looks at the
answer, and decides what to do with it. It keeps going until the goal is met, and it
knows when to stop and ask a person.

Here the goal is a plan for the warehouse's day. The tools are small calculators: one
reads the orders, one forecasts, one picks the boxes to bring down, one counts workers,
one checks the plan. The agent never does the arithmetic itself, so every number it
shows came from a tool.

## Reading the dashboard

Open the [dashboard](https://shreyasthakur11.github.io/warehouse-planning-agent/). It
opens on today's plan.

### The top of the page

- **Day picker.** Previous, Next, a list of every day, and Today to come back.
- **The agent's brief.** The plan in three sentences, written for the supervisor. The
  label beside it says which brain made it: the built-in rules or Claude.

### Four numbers

- **Pairs expected.** The forecast for the day, with the likely range under it.
- **Order lines expected.** How many lines the pickers will pick, and in about how many
  orders.
- **Workers needed.** The plan, with the number to bring in if the day runs high.
- **Boxes to bring down.** How many boxes to move from levels 3-4 to levels 1-2 before
  picking starts.

### What the agent did this morning

Every step, in order. Each line is marked:

| Mark | Meaning |
|---|---|
| TOOL | The agent called a tool. The tool's name is shown above its answer. |
| DECIDE | The agent made a choice, and says why. |
| CHECK | Something the supervisor should know. |
| ASK | Something a person must decide before the plan is settled. |
| BRIEF | The final brief. |

The pills above the list count the steps in each stage of the loop: observe, decide,
act, check and report.

### Demand forecast

The grey line is pairs shipped on recent working days. The blue line is the forecast for
the next working days, and the shaded band is the likely range. Hover over the chart, or
focus it and use the arrow keys, to read any day.

### Workers each day

One bar per forecast day. The solid bar is the plan; the light part above it is the
extra workers if the day runs high. The dashed line is the crew on the roster.

### SKUs in demand

The SKUs expected to sell most over the next working days. For each: expected pairs,
share of the total, whether it is rising or falling lately, the boxes it has on levels
1-2 and on levels 3-4, how many days levels 1-2 last, and its sales class.

### Bring down from levels 3-4 to 1-2

The work list for the morning. Each row is one SKU size: how many boxes, the locations
they come from, the location they go to, and why. **New pick face** means the SKU size
had no box on levels 1-2. Under the list, the agent notes what it could not fix: stock
that will run short, SKU sizes with no box in the racks, and boxes idle on levels 1-2.

### For the supervisor

What the agent's own check found. Items marked **Needs a decision** are the ones it will
not settle alone.

### How this plan did

For a day in the records, what actually happened: pairs shipped, order lines, workers
the day needed and boxes that had to come down. On today's plan this is hidden behind a
button, so the plan can be read first, as on the morning itself.

## The track record

The Track record page checks every plan against what happened. It shows the forecast
miss, the days with enough workers, and how many boxes brought down were needed, over
the whole replay, with every day listed. Open any day from the table.

## Why the dates are in 2023

The records end on 19 October 2023. The dashboard replays them: each calendar day it
moves on by one working day, and each plan is made only from the orders before its day.
After the last day it starts again from the first.

## Using it from the command line

Install it as the [README](../README.md#run-it) shows, then:

| Command | What it does |
|---|---|
| `warehouse-planner plan` | Plans the next working day after the records and prints every step |
| `warehouse-planner plan --date 2023-06-16` | Plans any day in the records |
| `warehouse-planner plan --json plan.json` | Also saves the whole plan as JSON |
| `warehouse-planner plan --brain claude` | Lets Claude run the morning (needs a key) |
| `warehouse-planner replay` | Plans every day and writes the scores |
| `warehouse-planner site` | Builds the dashboard into `_site/` |

To let Claude run the morning, install `pip install -e ".[claude]"`, then set
`ANTHROPIC_API_KEY` in your environment. Without a key, the built-in rules run it.

## Changing the numbers

Every number the agent uses is in
[`src/warehouse_planner/settings.py`](../src/warehouse_planner/settings.py), with where it
comes from. Change the crew on the roster, the days of cover, or the time to bring a box
down, then run the replay again to see what changes.

## Questions

**Does it control the warehouse?** No. It plans and explains. A person carries out the
plan.

**Can Claude make up a number?** A brief that states a number no tool produced is
rejected, and the brief is written from the tools' answers instead.

**Why bring down boxes that are not needed?** Demand for one SKU in one size is very hard
to place a day or two ahead, and a box is cheap to move. The track record shows how many
were needed, and the [evaluation](EVALUATION.md) explains why.
