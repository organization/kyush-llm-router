export const densityOptions = ['dense', 'regular'] as const;
export type Density = (typeof densityOptions)[number];

export const themeOptions = ['system', 'light', 'dark'] as const;
export type ThemeMode = (typeof themeOptions)[number];
