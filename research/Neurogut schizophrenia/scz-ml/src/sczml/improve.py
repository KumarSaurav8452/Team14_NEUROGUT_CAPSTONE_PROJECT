"""Search for a schizophrenia model that generalises better to unseen cohorts, without fooling ourselves.

Each candidate configuration is a feature recipe + model:
  ranks      taxonomic levels used: sgf (species+genus+family, as deployed), sgfoc (+order, class), gf (coarser only)
  floor      detection limit in %: 0.01 (as deployed) or 0.1 (ignores low-abundance taxa that depend on depth)
  transform  log10(% + floor) (as deployed), or that plus presence/absence of each taxon
  n_feat     taxa kept by cross-cohort consistent selection: 15, 30 (deployed) or 60
  zscale     model inputs centred and scaled within each cohort (label-free; needs a batch of samples, so it
             cannot score one patient on the website)
  model      Random Forest or L2 logistic regression (both fast, so 144 configurations can be screened)

Choosing the configuration with the best leave-one-study-out (LOSO) AUC and reporting that AUC would be
optimistic. So the honest number is nested LOSO: for every held-out cohort the configuration is chosen by LOSO
on the other three cohorts only, and only then scored on the held-out one.

python -m sczml.improve   -> results/improve/{screen.csv, nested.json, IMPROVE.md}
"""

from __future__ import annotations

import itertools
import json
import warnings

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from sczml import data, deploy, models

OUT = deploy.ROOT / "results" / "improve"
SEED = deploy.SEED
GRID = {"ranks": ["sgf", "sgfoc", "gf"], "floor": [0.01, 0.1], "transform": ["log", "log+pa"],
        "n_feat": [15, 30, 60], "zscale": [False, True], "model": ["rf", "lr"]}
DEPLOYED = {"ranks": "sgf", "floor": 0.01, "transform": "log", "n_feat": 30, "zscale": False, "model": "rf"}


def features(frac: pd.DataFrame, ranks: str, floor: float, transform: str) -> pd.DataFrame:
    pct = pd.concat([frac if r == "s" else data.to_level(frac, r) for r in ranks], axis=1) * 100.0
    pct = pct.where(pct >= floor, 0.0)
    out = np.log10(pct + floor)
    if transform == "log+pa":
        out = pd.concat([out, (pct > 0).astype(float).add_suffix("|pa")], axis=1)
    return out


def per_study_z(x: pd.DataFrame, study: pd.Series) -> pd.DataFrame:
    return x.groupby(study.values).transform(lambda c: (c - c.mean()) / (c.std() or 1.0)).fillna(0.0)


def choose(x, y, study, n_feat) -> list[str]:
    """Taxa present (>10 %) in at least half the training cohorts, then cross-cohort consistent selection."""
    present = (x > x.min()).groupby(study.values).mean() > 0.10
    cand = list(x.columns[present.sum() >= np.ceil(present.shape[0] / 2)])
    return models.select_consistent(per_study_z(x[cand], study), y, study, n_max=n_feat)


def fit_score(cfg, x, y, study, tr, te) -> float:
    return roc_auc_score(y.iloc[te], fit_predict(cfg, x, y, study, tr, te))


def fit_predict(cfg, x, y, study, tr, te) -> np.ndarray:
    xt = per_study_z(x, study) if cfg["zscale"] else x
    feats = choose(x.iloc[tr], y.iloc[tr], study.iloc[tr], cfg["n_feat"])
    w = models.balanced_weights(y.iloc[tr], study.iloc[tr])
    if cfg["model"] == "rf":
        m = RandomForestClassifier(n_estimators=300, max_depth=8, min_samples_leaf=3, random_state=SEED, n_jobs=-1)
        m.fit(xt.iloc[tr][feats], y.iloc[tr], sample_weight=w)
    else:
        m = make_pipeline(StandardScaler(), LogisticRegression(C=0.1, max_iter=2000))
        m.fit(xt.iloc[tr][feats], y.iloc[tr], logisticregression__sample_weight=w)
    return m.predict_proba(xt.iloc[te][feats])[:, 1]


def recipe_ensemble(configs, xs, y, study, cohorts) -> dict:
    """Average many recipes instead of picking one: for each held-out cohort, every configuration scores it and
    the within-cohort ranks of those scores are averaged (RF and logistic scores live on different scales).
    Nothing is chosen with the held-out labels, so the LOSO AUC is not optimistic."""
    per = {}
    for h in cohorts:
        tr, te = np.flatnonzero((study != h).values), np.flatnonzero((study == h).values)
        ranks = [pd.Series(fit_predict(c, xs(c), y, study, tr, te)).rank(pct=True).values for c in configs]
        per[h] = round(roc_auc_score(y.iloc[te], np.mean(ranks, axis=0)), 3)
        print(f"  recipe ensemble ({len(configs)} configs) {h}: {per[h]}", flush=True)
    return {"n_configs": len(configs), "per_cohort": per, "loso_mean": round(float(np.mean(list(per.values()))), 3)}


def loso(cfg, x, y, study, cohorts) -> float:
    """Mean LOSO AUC over the given cohorts (each held out in turn, trained on the rest of them)."""
    aucs = []
    for h in cohorts:
        tr = np.flatnonzero((study.isin(cohorts) & (study != h)).values)
        te = np.flatnonzero((study == h).values)
        aucs.append(fit_score(cfg, x, y, study, tr, te))
    return float(np.mean(aucs))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    meta, frac, _, _ = data.load()
    y, study = meta["y"], meta["study_id"]
    cohorts = sorted(study.unique())
    cache = {}
    configs = [dict(zip(GRID, v)) for v in itertools.product(*GRID.values())]
    xs = lambda c: cache.setdefault((c["ranks"], c["floor"], c["transform"]),
                                     features(frac, c["ranks"], c["floor"], c["transform"]))
    warnings.simplefilter("ignore")

    # 1. screen: plain LOSO of every configuration (optimistic if we just pick the max)
    rows = []
    for i, c in enumerate(configs, 1):
        per = {h: fit_score(c, xs(c), y, study, np.flatnonzero((study != h).values), np.flatnonzero((study == h).values))
               for h in cohorts}
        rows.append({**c, **{h: round(v, 3) for h, v in per.items()}, "loso_mean": round(float(np.mean(list(per.values()))), 3)})
        if i % 12 == 0:
            print(f"  screened {i}/{len(configs)}; best so far {max(r['loso_mean'] for r in rows)}", flush=True)
    screen = pd.DataFrame(rows).sort_values("loso_mean", ascending=False)
    screen.to_csv(OUT / "screen.csv", index=False)

    # 2. nested LOSO: choose the configuration on the 3 training cohorts only, then score the held-out one
    nested = []
    for h in cohorts:
        inner = [c for c in cohorts if c != h]
        scores = [(loso(c, xs(c), y, study, inner), c) for c in configs]
        best_inner, best = max(scores, key=lambda t: t[0])
        tr, te = np.flatnonzero((study != h).values), np.flatnonzero((study == h).values)
        nested.append({"held_out": h, "chosen": best, "inner_auc": round(best_inner, 3),
                       "held_out_auc": round(fit_score(best, xs(best), y, study, tr, te), 3)})
        print(f"  nested {h}: chose {best} -> {nested[-1]['held_out_auc']}", flush=True)
    deployed = screen[(screen[list(DEPLOYED)] == pd.Series(DEPLOYED)).all(axis=1)].iloc[0]
    res = {"n_configs": len(configs), "deployed_rf_loso": float(deployed.loso_mean),
           "best_screen": screen.iloc[0].to_dict(), "nested": nested,
           "nested_mean": round(float(np.mean([n["held_out_auc"] for n in nested])), 3)}
    (OUT / "nested.json").write_text(json.dumps(res, indent=1, default=str))

    top = screen.head(10)
    md = ["# Improving unseen-cohort AUC (schizophrenia)", "",
          f"{len(configs)} configurations screened with Random Forest / logistic regression. Deployed recipe "
          f"(Random Forest only): LOSO {res['deployed_rf_loso']}.", "",
          "## Top 10 by LOSO (optimistic: chosen on the test cohorts)", "",
          "| " + " | ".join(top.columns) + " |", "|" + "---|" * len(top.columns)]
    md += ["| " + " | ".join(str(v) for v in r) + " |" for r in top.itertuples(index=False)]
    md += ["", f"## Nested LOSO (honest): mean **{res['nested_mean']}**", "", "| held out | chosen | inner AUC | held-out AUC |", "|---|---|---|---|"]
    md += [f"| {n['held_out']} | {n['chosen']} | {n['inner_auc']} | {n['held_out_auc']} |" for n in nested]
    (OUT / "IMPROVE.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("done ->", OUT, flush=True)


if __name__ == "__main__":
    main()
