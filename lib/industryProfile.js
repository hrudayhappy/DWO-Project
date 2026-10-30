// Industry profile for Indian automobile manufacturers.
// Industry-level indicators are taken from a published industry report and are the
// same for every company in the industry. To apply the tool to another industry,
// add a new profile with the same shape.

const SOURCE = "IBEF, Automobiles Industry Report, May 2026";

export const INDUSTRY_PROFILES = {
  "indian-automobiles": {
    name: "Indian automobile manufacturers",
    source: SOURCE,
    // U1 (industry component): pace of electric-vehicle adoption
    evGrowth: {
      value: 54.94,
      label: "Projected CAGR of the Indian EV market, 2026–34 (per cent)",
      evidence: [
        {
          doc: "IND",
          page: 9,
          quote:
            "The Indian EV market, valued at US$ 3.71 billion in 2025, is projected to grow to US$ 191.04 billion by 2034, registering a remarkable CAGR of 54.94%",
          type: "third_party",
        },
        {
          doc: "IND",
          page: 9,
          quote: "India accomplished a significant milestone, with the sale of 24.5 lakh Electric Vehicles in FY26.",
          type: "third_party",
        },
      ],
    },
    // U2: material policy and regulatory changes in the preceding two years
    regulatoryChanges: [
      {
        description: "PM E-DRIVE scheme for EV adoption, tenure extended to March 2028",
        evidence: {
          doc: "IND",
          page: 18,
          quote:
            "PM E-DRIVE, started in October 2024, is India's umbrella scheme to accelerate EV adoption and ecosystem support",
          type: "third_party",
        },
      },
      {
        description: "Consensus on CAFE-III fuel-efficiency norms (April 2026)",
        evidence: {
          doc: "IND",
          page: 18,
          quote:
            "In April 2026, the government and automobile industry reached broad consensus on proposed CAFE-III norms",
          type: "third_party",
        },
      },
      {
        description: "Proposed amendments for higher ethanol blends, E85 and E100 (April 2026)",
        evidence: {
          doc: "IND",
          page: 18,
          quote:
            "In April 2026, the government proposed regulatory amendments to enable vehicles using higher ethanol blends, including E85 and E100",
          type: "third_party",
        },
      },
      {
        description: "20 per cent ethanol blending achieved in 2025",
        evidence: {
          doc: "IND",
          page: 18,
          quote: "India achieved 20% ethanol blending in petrol in 2025, five years ahead of the original 2030 target",
          type: "third_party",
        },
      },
      {
        description: "GST reforms in 2025–26 supporting vehicle demand",
        evidence: {
          doc: "IND",
          page: 14,
          quote: "2025–26, supported by GST reforms",
          type: "third_party",
        },
      },
    ],
  },
};

export const DEFAULT_INDUSTRY = "indian-automobiles";
