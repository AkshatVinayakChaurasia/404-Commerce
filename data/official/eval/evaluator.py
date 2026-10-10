#!/usr/bin/env python3
"""
Lightweight evaluator for Decisioned Offer System submissions.

Usage:
  python eval/evaluator.py --submission path/to/outputs.jsonl --scenarios eval/scenarios_holdout.csv

Submission format: JSONL, one object per scenario_id matching the schema in PARTICIPANT_GUIDE.md
"""

import argparse
import json
import math
import sys
from pathlib import Path
import pandas as pd

def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def load_jsonl(path):
    rows = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line: continue
            obj = json.loads(line)
            rows[obj['scenario_id']] = obj
    return rows

def evaluate(submission, scenarios, merchants, customers):
    results = []
    scores = {
        'groundedness': [],
        'constraint': [],
        'decision_match': [],
        'localization': [],
        'has_profit': [],
    }

    merch_idx = merchants.set_index('id')
    cust_idx = customers.set_index('id')

    for _, sc in scenarios.iterrows():
        sid = sc['id']
        pred = submission.get(sid)
        if not pred:
            results.append({'scenario_id': sid, 'error': 'missing'})
            scores['groundedness'].append(0)
            scores['constraint'].append(0)
            scores['decision_match'].append(0)
            continue

        action = pred.get('action', '').lower()
        expected = str(sc.get('expected_action', '')).lower()
        decision_ok = 1.0 if action == expected else (0.5 if action in ('send','skip') else 0.0)
        scores['decision_match'].append(decision_ok)

        grounded = 1.0
        constraint = 1.0
        loc_score = 0.5
        profit_score = 0.0

        mid = None
        if action == 'send':
            offer = pred.get('offer') or {}
            mid = offer.get('merchant_id')
            if not mid or mid not in merch_idx.index:
                grounded = 0.0
            else:
                m = merch_idx.loc[mid]
                disc = float(offer.get('discount_pct', 0) or 0)
                if disc > float(m['max_discount_pct']) + 0.5:
                    constraint = 0.0
                # margin rough check
                price = float(m.get('base_price_inr', 200))
                cost = float(m.get('unit_cost_inr', 80))
                if disc > 0 and (price * (1 - disc/100) < cost * (1 + float(m['min_margin_pct'])/100)):
                    # soft penalty
                    constraint = min(constraint, 0.6)

            # consent hard block
            cid = sc['customer_id']
            if cid in cust_idx.index:
                if not bool(cust_idx.loc[cid].get('marketing_consent', True)):
                    if action == 'send':
                        constraint = 0.0

            notif = pred.get('notification') or {}
            body = (notif.get('body') or '') + (notif.get('title') or '')
            if mid and mid in merch_idx.index:
                mname = str(merch_idx.loc[mid]['name'])
                if mname.lower() not in body.lower() and mname.split()[0].lower() not in body.lower():
                    grounded = min(grounded, 0.7)

            lang = (notif.get('language') or '').lower()
            if cid in cust_idx.index:
                pref = str(cust_idx.loc[cid].get('language', 'en')).lower()
                if lang and (lang == pref or lang.split('-')[0] == pref.split('-')[0]):
                    loc_score = 1.0
                elif lang:
                    loc_score = 0.6

            if pred.get('profit_estimate_inr') is not None:
                profit_score = 1.0

        # skip should not invent offers
        if action == 'skip' and pred.get('offer'):
            grounded = min(grounded, 0.5)

        scores['groundedness'].append(grounded)
        scores['constraint'].append(constraint)
        scores['localization'].append(loc_score)
        scores['has_profit'].append(profit_score)

        results.append({
            'scenario_id': sid,
            'action': action,
            'expected': expected,
            'decision_ok': decision_ok,
            'groundedness': grounded,
            'constraint': constraint,
            'localization': loc_score,
        })

    summary = {k: round(sum(v)/len(v), 3) if v else 0.0 for k, v in scores.items()}
    summary['n_scenarios'] = len(scenarios)
    summary['n_submitted'] = len(submission)
    summary['overall'] = round(
        0.30 * summary['decision_match'] +
        0.25 * summary['groundedness'] +
        0.25 * summary['constraint'] +
        0.10 * summary['localization'] +
        0.10 * summary['has_profit']
    , 3)
    return summary, results

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--submission', required=True)
    ap.add_argument('--scenarios', default='eval/scenarios_holdout.csv')
    ap.add_argument('--merchants', default='data/merchants.csv')
    ap.add_argument('--customers', default='data/customers.csv')
    ap.add_argument('--out', default='eval/report.json')
    args = ap.parse_args()

    sub = load_jsonl(args.submission)
    sc = pd.read_csv(args.scenarios)
    m = pd.read_csv(args.merchants)
    c = pd.read_csv(args.customers)
    summary, details = evaluate(sub, sc, m, c)
    report = {'summary': summary, 'details': details}
    Path(args.out).write_text(json.dumps(report, indent=2))
    print(json.dumps(summary, indent=2))
    print(f'Full report written to {args.out}')

if __name__ == '__main__':
    main()
