const colors = {
  light: {
    text: "#1A1A18",
    tint: "#3A5C26",

    background: "#F2EFE6",
    foreground: "#1A1A18",

    card: "#E8E4D9",
    cardForeground: "#1A1A18",

    primary: "#2D4A1E",
    primaryForeground: "#F2EFE6",

    secondary: "#E8E4D9",
    secondaryForeground: "#1A1A18",

    muted: "#D8D4CA",
    mutedForeground: "#8A8780",

    accent: "#7AAD52",
    accentForeground: "#1A1A18",

    destructive: "#3A1A00",
    destructiveForeground: "#F2EFE6",

    border: "#D8D4CA",
    input: "#D8D4CA",

    success: "#3A5C26",
    warning: "#E8A040",
  },

  dark: {
    // Keep dark identical to light so the app always matches
    // the same home-style palette regardless of device theme.
    text: "#1A1A18",
    tint: "#3A5C26",

    background: "#F2EFE6",
    foreground: "#1A1A18",

    card: "#E8E4D9",
    cardForeground: "#1A1A18",

    primary: "#2D4A1E",
    primaryForeground: "#F2EFE6",

    secondary: "#E8E4D9",
    secondaryForeground: "#1A1A18",

    muted: "#D8D4CA",
    mutedForeground: "#8A8780",

    accent: "#7AAD52",
    accentForeground: "#1A1A18",

    destructive: "#3A1A00",
    destructiveForeground: "#F2EFE6",

    border: "#D8D4CA",
    input: "#D8D4CA",

    success: "#3A5C26",
    warning: "#E8A040",
  },

  radius: 14,
};

export default colors;

// Bold typographic / dark-forest design tokens
// Shared by login.tsx and onboarding.tsx
export const boldTheme = {
  greenDark:   "#1C2E0A",
  greenMid:    "#2D4A1E",
  greenLight:  "#C5DCA8",
  cream:       "#F2EFE6",
  creamDark:   "#E8E4D9",
  creamBorder: "#D8D4CA",
  inkBlack:    "#1A1A18",
  inkMid:      "#5A5750",
  inkLight:    "#8A8780",
  amber:       "#E8A040",
  amberBg:     "#3A1A00",
};
