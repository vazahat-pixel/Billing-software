# JSM Parity Certificate

**Date:** 2026-11-05
**Reference system:** JSM, SQL Server instance `.\JSMR2`, database `JsmSql2_DEMO2026`, company
SANCHAL CREATION (`SC27`) — the owner's own installation, read-only.
**Method of proof:** for each report, JSM's own SQL was recovered from the decompiled screen
(`backend/scripts/golden-master/jsm-blueprint/.spec-local/<form>.json`), run against JSM's live
database, and compared row-for-row with what this software produces from the same bills.

---

## 1. What this certificate does and does not say

It certifies **22 of JSM's 218 menu entries** as matching JSM's own output on real data, and a
further **16 as built and tested but not yet replayed against JSM**.

It does **not** certify the remaining **178 entries**: those screens do not exist in this software
yet. A complete, per-entry list is in `docs/jsm-parity-checklist.txt`.

| Status | Entries | Meaning |
|---|---:|---|
| **VERIFIED** | 22 | Replayed against JSM's own SQL output on SANCHAL CREATION's real books |
| **BUILT** | 16 | Implemented and tested, not yet replayed against JSM |
| **NOT WIRED** | 2 | The JSM form is implemented, but this entry's own behaviour is not (Ledger Interest; Cash/Bank Register) |
| **NOT BUILT** | 178 | No JSM-identical screen yet |
| **Total** | 218 | |

---

## 2. Verified against JSM (22 entries, 116 golden comparisons)

Each of these replays JSM's own query and asserts the same rows, in the same order, under the same
group headers, with the same figures.

| Report family | Entries | Golden comparisons | What is compared |
|---|---:|---:|---|
| Sales / Purchase / Sales Return / Purchase Return registers | 8 | 50 | All three JSM modes (Register, Summary, Detail) × every Category Wise option |
| Outstanding — Debitor, Creditor | 2 | 12 | Every Category Wise option: rows, order, grouping, window title |
| Item Wise Summary — Sales, Purchase | 2 | 14 | Every Category Wise option: group levels, totals, average rate |
| Process / JobWork Send, Receipt (Detail + Summary) | 6 | 27 | Rows, grouping, totals |
| Process Stock | 1 | 5 | Rows and totals |
| GSTR-1 | 3 | 8 | Figures against JSM's own GST view |

**Run them with:** `node --test backend/tests/golden/*.test.js` → 116 pass, 0 fail.

---

## 3. Mismatches found and corrected during this review

Every item below was a real difference from JSM, found by the replay and now fixed:

1. **Bill numbers sorted as text** — bill 1009 listed before bill 919. JSM sorts the number.
2. **The A-Date / B-Bill.No / C-Serial.No radio re-sorted the register.** On JSM it only chooses
   which range filters; the order never changes.
3. **MainGroup summary showed one row per main group.** JSM groups the *party* under a main-group
   header (`GROUP1=PARTY_MN_GROUP, GROUP2=PARTY`).
4. **"Summary Reports" did nothing** — ticked and unticked both produced the grouped summary.
   Unticked is JSM's plain Register: one row per bill, on the `_SMRY_FULL` layout.
5. **Item+Party detail grouped on a joined "item / party" label.** JSM groups on the item and
   breaks ties on the party.
6. **Outstanding 1-Normal was treated as a party grouping.** JSM selects `'' AS JS_GROUP` — a flat,
   ungrouped list.
7. **Item Wise Summary folded composite categories into one label.** JSM uses real levels, and in
   the other order (Party+Item = party, then item).
8. **Item Wise Summary category 9 (Broker)** is broker *and* party on JSM, not broker alone.
9. **Item Wise Summary average rate** divided by whichever quantity was non-zero. JSM picks the
   divisor from the unit (PCS → pieces, else quantity), works it out on the summed row, and treats
   a zero divisor as 1 rather than showing 0.
10. **Month Wise added a level to every category.** JSM only has a month form for some.
11. **Age Analysis ignored its own Day 1–4 boxes** and always bucketed at 30/60/90.
12. **Ledger printed accounts in the order ticked.** JSM prints them in account-name order.
13. **Window headings** now use JSM's own wording per category and per register (including the
    differences between the Sales screen and the other three).

Each fix is covered by a test that replays JSM's output, so none of them can silently come back.

---

## 4. Offline / desktop-mirror certification

`node backend/tests/hybrid-e2e/run-all.js` — run on isolated in-memory databases, never production.

| Module | Result |
|---|---|
| Sales | PASS |
| Purchase | PASS |
| Job work | PASS |
| Web ↔ desktop | PASS |
| Desktop mirror | PASS — 34 checks, 0 failed |

**Overall: PASS.** This includes, after working offline and syncing back:

- Trial balance, Profit & Loss, Balance Sheet, Outstanding, item stock, sales list and a party's
  ledger statement all **identical on desktop and cloud**.
- An entry made offline survives the app being killed before it could upload.
- A purchase deleted offline is cancelled on the cloud too.
- No ledger created twice under the same name.
- Security: another company cannot upload into this company; a bill-number counter cannot be
  deleted through sync; a desktop cannot upload billing or plan data; a salesman login cannot
  download or upload the company.

---

## 5. Known gaps — stated plainly

These are real and not covered by the certificate above.

**a. 179 menu entries are not built.** The largest blocks are GST Reports (42), Old Reports (20),
Sales (14), Purchase (10), Inv Stock Ledger (10), Fas Reports (9), Outstanding/Outstanding Zoom
(15), Brokreg Statement (7), Tds (7), Process (7), Monthly (6), Acc Stock (6). See the checklist.

**b. The accounting reports are not yet replayed against JSM.** Ledger, Ledger T-Format,
Confirmation, Trial Balance, Bank/Cash Book, Balance Sheet and Profit & Loss are built and tested
against a real database, and their logic was checked line by line against JSM's decompiled SQL —
but they read this software's own ledger engine, so proving the *figures* against JSM needs JSM's
books loaded into this software first. Until that is done they are "BUILT", not "VERIFIED".

**c. Real client data (`maheshnew`) was not used.** That company lives only in the production
database, and production reads are blocked in this environment. Everything above was proved against
SANCHAL CREATION, where JSM's own copy is available locally for comparison — which is the stronger
test, because both sides can be compared. Checking `maheshnew` needs either a read-only window onto
production or that customer's JSM backup.

**d. Smaller, named differences**

- *Cash/Bank Book sub-line:* JSM prints the cheque's drawee bank (`CHQ_DD_BK`). This software
  records no drawee bank, so the voucher's own bank ledger is shown instead.
- *Outstanding, same-date ties:* JSM breaks them on an internal `BILL_NO` sequence that is not the
  bill number anyone sees. Rows tied on group, type and date may sit in a different order.
- *Haste/Transport screen:* the `D - Lr Dispetch` option is refused rather than guessed — JSM's own
  code suggests it lists broker-wise, but nothing confirms it.
- *Trial Balance:* JSM excludes `tr_code = 8` rows. No such row exists in this company, so what it
  excludes could not be determined.
- *Age Analysis:* JSM's code carries a fifth bucket (`BAL_AMT5`). This company's captured layout
  shows four, so four are produced.
- *Trial Balance / Balance Sheet:* only JSM's **B-Single / C-Group Wise** and **Group Wise /
  Double** layouts are produced; the other print layouts are refused rather than approximated.
- *Cash/Bank Book:* **X-Detail** and **Z-Dtl+VNo** are produced; **Y-Summary** is refused.

---

## 6. How to re-prove all of this

```
# Replay every verified report against JSM's own output
node --test backend/tests/golden/*.test.js            # 116 pass

# Everything else
node --test backend/tests/unit/*.js                   # 351 pass
cd frontend/src/jsm/reports && node --test *.node.test.js   # 25 pass

# Offline / desktop mirror
node backend/tests/hybrid-e2e/run-all.js              # 5 modules PASS

# Refresh the JSM-side fixtures from the live JSM database (read-only)
node backend/scripts/golden-master/extractJsmBillRegisters.js
node backend/scripts/golden-master/extractJsmOutstanding.js
```
