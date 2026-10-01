export const PRICING_TIERS = [
  {
    id: "growth" as const,
    name: "Growth",
    price: 499,
    description: "For early-stage teams closing 2–3 enterprise deals/mo",
    features: [
      "Up to 5 questionnaires / month",
      "3 team seats",
      ".xlsx & .csv auto-fill",
      "Exact source citations",
    ],
    priceEnv: "STRIPE_PRICE_GROWTH",
  },
  {
    id: "scale" as const,
    name: "Scale",
    price: 999,
    description: "For scaling SaaS closing consistent mid-market volume",
    features: [
      "Up to 15 questionnaires / month",
      "10 team seats",
      "Portal web auto-fill (OneTrust, Whistic)",
      "Continuous document sync",
      "Priority turnaround SLA",
    ],
    featured: true,
    priceEnv: "STRIPE_PRICE_SCALE",
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    price: 1999,
    description: "For multi-product companies with custom InfoSec workflows",
    features: [
      "Unlimited questionnaires",
      "Custom audit log streams",
      "SAML SSO & SCIM provisioning",
      "Dedicated security engineer review",
    ],
    priceEnv: "STRIPE_PRICE_ENTERPRISE",
  },
] as const;

export type PricingTier = (typeof PRICING_TIERS)[number]["id"];
