# Improving unseen-cohort AUC (schizophrenia)

144 configurations screened with Random Forest / logistic regression. Deployed recipe (Random Forest only): LOSO 0.614.

## Top 10 by LOSO (optimistic: chosen on the test cohorts)

| ranks | floor | transform | n_feat | zscale | model | Li_2023_SCZ | Thirion_2023A_SCZ | Zhu_2020A_SCZ | Zhu_2020B_SCZ | loso_mean |
|---|---|---|---|---|---|---|---|---|---|---|
| sgf | 0.01 | log+pa | 60 | True | rf | 0.582 | 0.659 | 0.658 | 0.753 | 0.663 |
| sgfoc | 0.01 | log+pa | 60 | True | rf | 0.567 | 0.642 | 0.657 | 0.747 | 0.653 |
| gf | 0.1 | log | 15 | True | lr | 0.523 | 0.656 | 0.559 | 0.817 | 0.639 |
| sgf | 0.01 | log+pa | 30 | True | rf | 0.56 | 0.652 | 0.614 | 0.729 | 0.639 |
| gf | 0.1 | log | 30 | True | lr | 0.523 | 0.656 | 0.559 | 0.817 | 0.639 |
| gf | 0.1 | log | 60 | True | lr | 0.523 | 0.656 | 0.559 | 0.817 | 0.639 |
| gf | 0.1 | log+pa | 15 | True | lr | 0.535 | 0.635 | 0.564 | 0.817 | 0.638 |
| sgf | 0.01 | log | 30 | True | rf | 0.554 | 0.64 | 0.618 | 0.728 | 0.635 |
| gf | 0.1 | log+pa | 60 | True | lr | 0.493 | 0.645 | 0.583 | 0.817 | 0.635 |
| gf | 0.1 | log+pa | 30 | True | lr | 0.493 | 0.645 | 0.583 | 0.817 | 0.635 |

## Nested LOSO (honest): mean **0.598**

| held out | chosen | inner AUC | held-out AUC |
|---|---|---|---|
| Li_2023_SCZ | {'ranks': 'gf', 'floor': 0.01, 'transform': 'log', 'n_feat': 15, 'zscale': True, 'model': 'lr'} | 0.701 | 0.493 |
| Thirion_2023A_SCZ | {'ranks': 'sgfoc', 'floor': 0.01, 'transform': 'log+pa', 'n_feat': 60, 'zscale': True, 'model': 'rf'} | 0.621 | 0.642 |
| Zhu_2020A_SCZ | {'ranks': 'sgf', 'floor': 0.1, 'transform': 'log+pa', 'n_feat': 15, 'zscale': False, 'model': 'rf'} | 0.661 | 0.563 |
| Zhu_2020B_SCZ | {'ranks': 'sgf', 'floor': 0.1, 'transform': 'log+pa', 'n_feat': 60, 'zscale': False, 'model': 'rf'} | 0.561 | 0.695 |
