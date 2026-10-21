export const Theme = {
  Light: 'light',
  Dark: 'dark',
  System: 'system',
} as const;

export type Theme = (typeof Theme)[keyof typeof Theme];

/** The page background for a theme. */
export function background(theme: Theme): string {
  switch (theme) {
    case Theme.Light:
      return 'white';
    case Theme.Dark:
      return 'black';
    case Theme.System:
      return 'canvas';
  }
}

// From the saved settings, where the theme is a plain string.
export const saved: Theme = 'dark';
