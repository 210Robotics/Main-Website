export const clerkAppearance = {
  variables: {
    colorPrimary: "#fd7803",
    colorPrimaryForeground: "#111111",
    colorForeground: "#111827",
    colorMutedForeground: "#4b5563",
    colorMuted: "#f1f5f9",
    colorBackground: "#ffffff",
    colorInput: "#ffffff",
    colorInputForeground: "#111827",
    colorNeutral: "#64748b",
    colorBorder: "#cbd5e1",
    colorRing: "#c45d00",
    colorDanger: "#b91c1c",
    fontFamily: 'var(--font-lexend), "Lexend", sans-serif',
    borderRadius: "0.35rem",
  },
  elements: {
    rootBox: { colorScheme: "light" },
    cardBox: { colorScheme: "light" },
    card: { backgroundColor: "#ffffff", color: "#111827" },
  },
} as const;

export const clerkAuthAppearance = {
  ...clerkAppearance,
  elements: {
    ...clerkAppearance.elements,
    headerTitle: { display: "none" },
    headerSubtitle: { display: "none" },
  },
} as const;
