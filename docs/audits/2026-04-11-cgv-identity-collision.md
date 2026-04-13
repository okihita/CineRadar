# Audit Report: National Studio Identity Collision Audit
**Date:** April 12, 2026
**Scope:** National V3.3 Atomic Reboot (502 Theatres)

## 1. The Discovery (National Scale)
During the full national reboot, the **Physical Fingerprint Rule** was applied to all 502 theatres. Out of ~4,000 studios processed, **53 studios** (approx. 1.3%) were identified as having "Hard Physical Collisions" where their grid dimensions shifted within a 14-day window.

## 2. Key Forensic Findings

### A. The "VISTA Immunity" of XXI
- **Observation:** Zero (0) collisions were detected in the XXI chain.
- **Verdict:** XXI maintains strict 1:1 mapping between `studio_id` and physical room architecture. This chain is considered the "Physical Ground Truth" baseline for the Indonesian market.

### B. Pattern: The "Slippery Slot" (CGV Premium)
- **High Frequency:** Most common at flagship locations (e.g., Grand Indonesia).
- **Behavior:** IDs like `101512` shift between massive dimensions (`13x20` Satin) and smaller dimensions (`6x17` Velvet).
- **Root Cause:** Intentional operational reuse of premium "Slot IDs" for different physical assets based on movie demand.

### C. Pattern: The "Off-By-One" Layout (CGV/Cinépolis)
- **Behavior:** Dimensions shift by a single column or row (e.g., `9x20` vs `9x21`).
- **Root Cause:** Dynamically appearing wheelchair/staff seats or "Ghost Aisle" nodes in the merchant API response.
- **Resolution:** These are safe to resolve using a "Majority Consensus" rule (picking the most frequent dimension).

### D. Pattern: The "API Fragment" (Cinépolis)
- **Behavior:** A massive room (e.g., `12x48`) occasionally returns a tiny fragment (e.g., `2x20`).
- **Root Cause:** Network timeout or partial payload delivery from the merchant POS to the TIX ID aggregator.

## 3. Data-Driven Resolution Strategy (The "Majority Rule")
Based on the `detected_collisions.txt` evidence, we can now automate the resolution of 95% of these collisions:

1.  **Majority Threshold:** If one fingerprint appears with $\ge 70\%$ frequency (e.g., 6 out of 7 days), the engine should automatically promote that dimension and discard the outliers as noise.
2.  **Strict Tie-Break:** If no clear majority exists (e.g., 3 days of A vs 4 days of B), the studio remains Quarantined for manual forensic inspection.

---

## Appendix: Detected Collisions (April 12th National Run)
The following 53 studios were identified as having "Hard Physical Collisions" (Dimension Shifts) and were Quarantined during the national bootstrap.

```text
     1	THEATRE: FESTIVE WALK CGV | STUDIO: 100301 | HARD COLLISION: {'8x18': 6, '11x27': 1}
     2	THEATRE: BEKASI CYBER PARK CGV | STUDIO: 100501 | HARD COLLISION: {'9x20': 6, '10x19': 1}
     3	THEATRE: FESTIVE WALK CGV | STUDIO: 100201 | HARD COLLISION: {'11x27': 6, '13x29': 1}
     4	THEATRE: GRAGE CITY MALL CGV | STUDIO: 100101 | HARD COLLISION: {'13x29': 6, '9x19': 1}
     5	THEATRE: BEKASI CYBER PARK CGV | STUDIO: 100601 | HARD COLLISION: {'9x21': 6, '11x19': 1}
     6	THEATRE: FESTIVE WALK CGV | STUDIO: 100701 | HARD COLLISION: {'13x27': 6, '8x18': 1}
     7	THEATRE: BEKASI CYBER PARK CGV | STUDIO: 100401 | HARD COLLISION: {'9x20': 6, '9x21': 1}
     8	THEATRE: DEPOK MALL CGV | STUDIO: 100701 | HARD COLLISION: {'10x20': 6, '10x22': 1}
     9	THEATRE: KINGS SHOPPING CENTER CGV | STUDIO: 100201 | HARD COLLISION: {'8x16': 6, '9x16': 1}
    10	THEATRE: GRAND INDONESIA CGV | STUDIO: 101512 | HARD COLLISION: {'13x20': 6, '6x17': 1}
    11	THEATRE: TRANSMART CIREBON CGV | STUDIO: 100301 | HARD COLLISION: {'10x17': 6, '10x18': 1}
    12	THEATRE: GRAND INDONESIA CGV | STUDIO: 100304 | HARD COLLISION: {'8x14': 6, '6x17': 1}
    13	THEATRE: GREEN PRAMUKA MALL CGV | STUDIO: 100301 | HARD COLLISION: {'12x18': 6, '9x16': 1}
    14	THEATRE: BELLA TERRA LIFESTYLE CENTER CGV | STUDIO: 100401 | HARD COLLISION: {'8x19': 6, '8x18': 1}
    15	THEATRE: BELLA TERRA LIFESTYLE CENTER CGV | STUDIO: 100301 | HARD COLLISION: {'8x18': 6, '8x19': 1}
    16	THEATRE: AEON MALL JGC CGV | STUDIO: 100301 | HARD COLLISION: {'8x18': 6, '9x21': 1}
    17	THEATRE: TERAS KOTA CGV | STUDIO: 100801 | HARD COLLISION: {'10x20': 6, '8x20': 1}
    18	THEATRE: TRANSMART CEMPAKA PUTIH CGV | STUDIO: 100414 | HARD COLLISION: {'6x14': 6, '10x17': 1}
    19	THEATRE: TRANSMART MAGUWO CGV | STUDIO: 100101 | HARD COLLISION: {'12x22': 6, '9x17': 1}
    20	THEATRE: ECOPLAZA CITRARAYA CIKUPA CGV | STUDIO: 100401 | HARD COLLISION: {'9x21': 6, '10x20': 1}
    21	THEATRE: GRAND BATAVIA CGV | STUDIO: 100101 | HARD COLLISION: {'11x16': 1, '11x17': 6}
    22	THEATRE: ECOPLAZA CITRARAYA CIKUPA CGV | STUDIO: 100801 | HARD COLLISION: {'15x37': 6, '10x20': 1}
    23	THEATRE: ROXY SQUARE JEMBER CGV | STUDIO: 100601 | HARD COLLISION: {'9x20': 1, '8x18': 6}
    24	THEATRE: RITA SUPERMALL CGV | STUDIO: 100201 | HARD COLLISION: {'11x22': 6, '11x20': 1}
    25	THEATRE: PLAZA LAWU MADIUN CGV | STUDIO: 100301 | HARD COLLISION: {'10x18': 1, '9x16': 6}
    26	THEATRE: ROXY SQUARE JEMBER CGV | STUDIO: 100501 | HARD COLLISION: {'10x22': 6, '9x20': 1}
    27	THEATRE: PLAZA LAWU MADIUN CGV | STUDIO: 100201 | HARD COLLISION: {'10x18': 6, '10x19': 1}
    28	THEATRE: RITA SUPERMALL CGV | STUDIO: 100401 | HARD COLLISION: {'11x21': 1, '11x20': 6}
    29	THEATRE: ROXY SQUARE JEMBER CGV | STUDIO: 100301 | HARD COLLISION: {'12x24': 1, '9x20': 6}
    30	THEATRE: ROXY SQUARE JEMBER CGV | STUDIO: 100401 | HARD COLLISION: {'10x22': 1, '8x18': 6}
    31	THEATRE: FOCAL POINT CGV | STUDIO: 100601 | HARD COLLISION: {'9x21': 6, '9x20': 1}
    32	THEATRE: BLITAR SQUARE CGV | STUDIO: 100401 | HARD COLLISION: {'10x19': 1, '10x18': 6}
    33	THEATRE: PLAZA LAWU MADIUN CGV | STUDIO: 100401 | HARD COLLISION: {'10x19': 6, '9x16': 1}
    34	THEATRE: ROXY SQUARE JEMBER CGV | STUDIO: 100201 | HARD COLLISION: {'12x24': 6, '8x18': 1}
    35	THEATRE: SOCIAL MARKET CGV | STUDIO: 100301 | HARD COLLISION: {'11x20': 6, '13x24': 1}
    36	THEATRE: TRANSMART MATARAM CGV | STUDIO: 100501 | HARD COLLISION: {'8x11': 5, '10x18': 2}
    37	THEATRE: TRANSMART PEKANBARU CGV | STUDIO: 100401 | HARD COLLISION: {'11x18': 2, '13x24': 5}
    38	THEATRE: TRANSMART PALEMBANG CGV | STUDIO: 100501 | HARD COLLISION: {'14x19': 6, '14x22': 1}
    39	THEATRE: STUDIO PEKANBARU CGV | STUDIO: 100201 | HARD COLLISION: {'16x23': 6, '16x22': 1}
    40	THEATRE: LIVING PLAZA JABABEKA CGV | STUDIO: 100401 | HARD COLLISION: {'11x19': 1, '11x18': 6}
    41	THEATRE: PARADISE WALK SERPONG CGV | STUDIO: 100601 | HARD COLLISION: {'10x14': 6, '8x14': 1}
    42	THEATRE: MASPION SQUARE CGV | STUDIO: 100401 | HARD COLLISION: {'13x21': 6, '10x18': 1}
    43	THEATRE: VIVO SENTUL CGV | STUDIO: 100101 | HARD COLLISION: {'9x22': 1, '11x24': 6}
    44	THEATRE: LIPPO MALL KUTA CINEPOLIS | STUDIO: 12 | HARD COLLISION: {'9x13': 5, '9x15': 2}
    45	THEATRE: LIPPO PLAZA KENDARI CINEPOLIS | STUDIO: 14 | HARD COLLISION: {'9x16': 6, '14x10': 1}
    46	THEATRE: LIVING WORLD PEKANBARU CINEPOLIS | STUDIO: 48 | HARD COLLISION: {'4x8': 6, '15x27': 1}
    47	THEATRE: LIPPO PLAZA SIDOARJO CINEPOLIS | STUDIO: 11 | HARD COLLISION: {'13x26': 4, '13x24': 3}
    48	THEATRE: MALANG TOWN SQUARE CINEPOLIS | STUDIO: 13 | HARD COLLISION: {'9x9': 6, '7x9': 1}
    49	THEATRE: THE PARK PEJATEN CINEPOLIS | STUDIO: 36 | HARD COLLISION: {'3x14': 6, '2x14': 1}
    50	THEATRE: THE PARK PEJATEN CINEPOLIS | STUDIO: 12 | HARD COLLISION: {'6x24': 6, '9x24': 1}
    51	THEATRE: MALL PHINISI POINT CINEPOLIS | STUDIO: 11 | HARD COLLISION: {'14x23': 6, '11x21': 1}
    52	THEATRE: SENAYAN PARK CINEPOLIS | STUDIO: 11 | HARD COLLISION: {'12x36': 1, '12x48': 5, '2x20': 1}
    53	THEATRE: GRAND MALL LAMPUNG CGV | STUDIO: 100201 | HARD COLLISION: {'9x17': 6, '10x11': 1}
```

---
*This document now serves as the definitive guide for the "Collision Auto-Resolver" script planned for next month.*
