# The records

Four files from the *Order Picking Dataset from a Warehouse of a Footwear Manufacturing
Company*, version 1, by de Assis, de Paula Ferreira and Ouhimmou (2025), published under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) at
[doi.org/10.17632/pf2w725pw3.1](https://doi.org/10.17632/pf2w725pw3.1).

They are kept byte for byte as published. The tests check these hashes on every run.

| File | What it holds | SHA-256 |
|---|---|---|
| `Customer_Order.csv` | Every order line picked, with its date, reference, size and pairs | `e28ae8ac9b368b9496b153fafb5af685bd94ba1530ffcb308dfcd5403601f325` |
| `Product.csv` | Each reference and its catalogue class | `416527e5260c17003177e1389fd48042d9790be9ef9cabe4c6c07e583e01eb2f` |
| `Storage_Location.csv` | Each rack location and its position, including its level | `2895d9da16b4d63e85a17bfe050cc77b72d5654298072d6fa3b1732b1c1d6cc3` |
| `Random_Storage.csv` | The box held in each slot of each location | `c9c2eb25ff24f3fdc7f47c02cb44de7702c0416b2a309b754a939c4ae100a0b0` |

How the agent reads each file is set out in [docs/DATA.md](../docs/DATA.md).

The dataset's creators do not endorse this project.
