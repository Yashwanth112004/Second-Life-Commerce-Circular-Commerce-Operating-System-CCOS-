"""Carbon Footprint Calculator AI (CFCA) — Module 10.

Computes the verifiable carbon saved by keeping a product in circulation instead of
the counterfactual (buying a new unit + landfilling the returned one).

Methodology (simplified LCA, Section 9/10 of the blueprint):

    carbon_saved = avoided_manufacturing + avoided_double_shipping - circular_logistics

  * avoided_manufacturing  = embedded_carbon_of_new_unit * remaining_useful_life_fraction
  * avoided_double_shipping = carbon of the "return then re-buy a replacement" loop
  * circular_logistics      = transport carbon of the chosen circular route
                              (zero-warehouse routing is dramatically lower)

The remaining-useful-life fraction is derived from the AI condition grade.
"""
from __future__ import annotations

from dataclasses import dataclass, field

# Fraction of useful life remaining, by condition grade. Drives how much of the
# new unit's manufacturing carbon is genuinely avoided by reselling this one.
REMAINING_LIFE_BY_GRADE: dict[str, float] = {
    "A+": 0.95,
    "A": 0.85,
    "B": 0.65,
    "C": 0.40,
    "D": 0.15,
}

# Transport carbon (kg CO2e) of each circular route. Zero-warehouse routing sends the
# item straight from returner to next buyer (1 truck movement instead of 3).
ROUTE_LOGISTICS_KG: dict[str, float] = {
    "zero_warehouse": 1.1,
    "local_hub": 2.0,
    "regional_warehouse": 4.5,
    "donation_local": 1.4,
}

# Liters of water and kg of solid waste, per kg of product, avoided by not manufacturing
# a replacement (rough category-agnostic LCA proxy).
WATER_PER_KG = 90.0
WASTE_PER_PRODUCT_MULTIPLIER = 1.0


@dataclass
class CarbonResult:
    carbon_saved_kg: float
    water_saved_l: float
    waste_diverted_kg: float
    avoided_manufacturing_kg: float
    avoided_double_shipping_kg: float
    circular_logistics_kg: float
    equivalents: dict[str, str] = field(default_factory=dict)


def _equivalents(carbon_kg: float) -> dict[str, str]:
    """Human-friendly comparisons. ~0.404 kg CO2e per mile driven (EPA passenger car)."""
    miles = carbon_kg / 0.404
    trees = carbon_kg / 21.77  # kg CO2 sequestered by one tree-year
    phone_charges = carbon_kg / 0.0083
    return {
        "driving": f"like not driving {miles:.1f} miles",
        "trees": f"equal to {trees:.2f} tree-years of CO\u2082 absorption",
        "phone_charges": f"{phone_charges:.0f} smartphone charges avoided",
    }


def calculate_carbon(
    *,
    embedded_carbon_kg: float,
    weight_kg: float,
    grade: str = "A",
    route: str = "zero_warehouse",
    action: str = "resale",
) -> CarbonResult:
    remaining = REMAINING_LIFE_BY_GRADE.get(grade, 0.6)
    avoided_manufacturing = embedded_carbon_kg * remaining

    # The "return then re-buy the same product" loop the blueprint calls out (carbon doubles).
    # Reselling instead avoids the inbound-return leg plus the replacement's outbound leg.
    avoided_double_shipping = 0.0 if action == "donation" else 2.6

    logistics = ROUTE_LOGISTICS_KG.get(route, 2.0)

    carbon_saved = round(max(avoided_manufacturing + avoided_double_shipping - logistics, 0.1), 2)
    water_saved = round(weight_kg * WATER_PER_KG * remaining, 1)
    waste_diverted = round(weight_kg * WASTE_PER_PRODUCT_MULTIPLIER, 2)

    return CarbonResult(
        carbon_saved_kg=carbon_saved,
        water_saved_l=water_saved,
        waste_diverted_kg=waste_diverted,
        avoided_manufacturing_kg=round(avoided_manufacturing, 2),
        avoided_double_shipping_kg=avoided_double_shipping,
        circular_logistics_kg=logistics,
        equivalents=_equivalents(carbon_saved),
    )
