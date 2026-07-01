export interface Theme {
  bg: string;
  card: string;
  border: string;
  text: string;
  sub: string;
  muted: string;
  input: string;
  inputBorder: string;
  barBg: string;
  accent: string;
  accentGrad: string;
  greenGrad: string;
  green: string;
  toggleBg: string;
  tooltipBg: string;
  tooltipBorder: string;
  danger: string;
  tag: string;
  /** Per-source accent colors. */
  sc: Record<string, string>;
}

export const LIGHT: Theme = {
  bg: "linear-gradient(180deg,#FFFCF7 0%,#F7F2EA 50%,#FFF9F0 100%)",
  card: "#FFFCF7", border: "#EDE6DA", text: "#3D3225", sub: "#8B7355", muted: "#BDB298",
  input: "#FAF6EF", inputBorder: "#E8E0D4", barBg: "#F0E9DD", accent: "#C4956A",
  accentGrad: "linear-gradient(90deg,#D4C5B0 0%,#C4956A 100%)",
  greenGrad: "linear-gradient(90deg,#C4956A 0%,#6B8E5A 100%)", green: "#6B8E5A",
  toggleBg: "#F0E9DD", tooltipBg: "#FFFCF7", tooltipBorder: "#E8E0D4", danger: "#C0524D", tag: "#F0E9DD",
  sc: {
    Bounties: "#C4956A", Ambassadorships: "#8B7355", Content: "#D4A574", Dev: "#A0522D",
    "Web3 Jobs": "#9C7E5C", NFTs: "#C2A67E", Predictions: "#7A6245",
    "X Monetization": "#B08D6A", Other: "#BDB298",
  },
};

export const DARK: Theme = {
  bg: "linear-gradient(180deg,#1A1714 0%,#201D18 50%,#1A1714 100%)",
  card: "#252219", border: "#3A3530", text: "#F0E9DD", sub: "#A89880", muted: "#6B6256",
  input: "#2C2820", inputBorder: "#3A3530", barBg: "#2C2820", accent: "#C4956A",
  accentGrad: "linear-gradient(90deg,#5C4D3C 0%,#C4956A 100%)",
  greenGrad: "linear-gradient(90deg,#C4956A 0%,#6B8E5A 100%)", green: "#7DA86B",
  toggleBg: "#3A3530", tooltipBg: "#252219", tooltipBorder: "#3A3530", danger: "#D4645F", tag: "#3A3530",
  sc: {
    Bounties: "#D4A87A", Ambassadorships: "#A89880", Content: "#DEB88A", Dev: "#C0724D",
    "Web3 Jobs": "#B09878", NFTs: "#D4BA90", Predictions: "#9A8260",
    "X Monetization": "#C4A07A", Other: "#8A7D6E",
  },
};
