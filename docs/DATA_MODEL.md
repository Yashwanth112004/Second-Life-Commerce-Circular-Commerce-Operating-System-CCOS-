# CCOS — Data Model

Implemented in `backend/app/models.py` (SQLAlchemy). SQLite for the MVP; the schema is
Aurora/Postgres-ready (swap `CCOS_DATABASE_URL`).

## ER overview

```
User 1───* OwnedItem *───1 Product
 │              │
 │              ├──1 (current) ConditionAssessment *   (DDVA outputs, history)
 │              ├──* PassportEvent                     (append-only DPP)
 │              ├──* ResaleListing                     (marketplace)
 │              └──* ReturnRequest
 │
 ├──* CarbonRecord        (per-action CO₂/water/waste)
 └──* GreenCreditLedger   (earn/spend, running balance)
```

## Tables

### users
| column | type | notes |
|--------|------|-------|
| id | str(pk) | uuid |
| name, email, city, zip_code | str | email unique |
| is_prime | bool | |
| green_credits | float | denormalized running balance |
| carbon_saved_kg | float | denormalized lifetime total |

### products  (catalog SKU)
| id(pk), title, brand, category(idx), msrp, weight_kg | | |
| embedded_carbon_kg | float | manufacturing CO₂ of a new unit (drives CFCA) |
| eco_score | int | 0–100 |
| image_url | str | |

### owned_items  (a physical unit a user owns)
| id(pk), product_id(fk), owner_id(fk) | | |
| purchase_price, purchased_at, age_months | | |
| status | str | owned · return_initiated · listed · sold · donated · recycled |

### return_requests
| id(pk), item_id(fk), user_id(fk) | | |
| reason_code, reason_text, refund_amount | | |
| chosen_path | str | undecided · refund · resell · donate · exchange · keep |

### condition_assessments  (DDVA output, kept as history)
| id(pk), item_id(fk) | | |
| grade, grade_label, confidence | | A+/A/B/C/D |
| damage_notes | json | |
| recommended_disposition | str | |

### resale_listings
| id(pk), item_id(fk), seller_id(fk) | | |
| title, description, price, condition_grade | | |
| marketplace | str | certified_preloved · rental · p2p · exchange · donation · parts |
| status, keywords(json) | | |

### carbon_records
| id(pk), user_id(fk), item_id(fk), action | | resale · donation · repair · rental |
| carbon_saved_kg, water_saved_l, waste_diverted_kg | | |

### green_credit_ledger
| id(pk), user_id(fk) | | |
| delta | float | +earned / −spent |
| reason, balance_after | | running balance snapshot |

### passport_events  (append-only Digital Product Passport)
| id(pk), item_id(fk, idx) | | |
| event_type | str | manufactured · first_sale · inspection · repair · ownership_transfer · resale · end_of_life |
| detail(json), actor, created_at | | |

## Indexing & integrity
- `products.category`, `passport_events.item_id` indexed (hot read paths).
- All FKs enforced; balances (`users.green_credits`, `carbon_saved_kg`) are denormalized for
  fast dashboards and reconciled against `green_credit_ledger` / `carbon_records`.

## Production extensions (roadmap tables)
`buyers/wishlists`, `rentals`, `exchanges`, `donations`, `parts`, `fraud_signals`,
`seller_analytics`, `payments`, `wallets`, `refurbishment_centers`, `logistics_routes`,
`audit_logs` — all hang off the same `users`/`products`/`owned_items` spine.
