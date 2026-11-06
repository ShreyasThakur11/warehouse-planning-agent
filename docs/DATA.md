# The data

The agent works from four files of the *Order Picking Dataset from a Warehouse of a
Footwear Manufacturing Company*, by de Assis, de Paula Ferreira and Ouhimmou (2025),
published under CC BY 4.0. The records come from the manufacturer's warehouse in
Sherbrooke, Canada. They are kept in `data/` exactly as published, and the tests check
each file's SHA-256 hash on every run. Source, licence and hashes are in
[data/README.md](../data/README.md).

## What the records hold

| | |
|---|---|
| Working days | 178, from 5 January 2023 to 19 October 2023 |
| Order lines | 122,370 |
| Pairs | 228,195 |
| SKUs | 208 references, each in several sizes |
| Rack locations | 2,292, each holding 18 boxes |
| Boxes | 41,256: 30,456 on levels 1-2 and 10,800 on levels 3-4 |

## How each file is read

Nothing is changed. The agent reads each value and, where needed, writes it the way
people do.

### `Customer_Order.csv`

One row per order line, separated by semicolons.

| Column | Read as |
|---|---|
| `creationDate` | The day and hour, written day first |
| `orderNumber` | The order |
| `Reference` | The SKU |
| `Size (US)` | The size, decoded as below |
| `quantity (units)` | Pairs |
| `waveNumber` | The trolley run |
| `operator` | The picker |

A SKU size is the reference and the size together, such as `8N10W9 10.5`. Daily totals
add up pairs, order lines, distinct orders and distinct trolley runs on each working day.

### `Storage_Location.csv`

One row per rack location, with its position. The `z` coordinate is the level. Levels 1
and 2 are within a picker's reach; levels 3 and 4 hold reserve stock.

### `Random_Storage.csv`

One row per location, with 18 columns, one for each box. Each cell holds the reference
and size, as `REF;SIZE`. A location code reads as aisle, bay and slot: `E-26-30` is aisle
`E`, bay `26`, on level 3.

### `Product.csv`

Each reference with its catalogue class, `ABCCOD`, shown beside the sales class the
agent measures.

## Decoding sizes

The records write half sizes without the point, so `105` is size 10.5 and `95` is 9.5.
Sizes from 215 up are Mondopoint, in millimetres, and stay as written.

## One disagreement in the records

A location's code repeats its level: `A-14-31` is on level 3. One location disagrees:
`K-23-40` is coded level 4 but stored at height 3. The agent goes by the recorded height,
and a test holds that this is the only exception.

## Assumptions the records force

- **One box holds one pair.** The storage records list boxes, not how many pairs each
  holds.
- **One storage snapshot.** The records hold one picture of what sat where, so every
  morning starts from it. A live warehouse system would feed the real position each day.
- **The day comes from the order.** An order line counts on the day it was created.
