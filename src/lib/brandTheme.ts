/**
 * Business accent colour. One hex colour chosen by the owner/admin becomes the
 * portal's --brand* variables (see styles/tokens.css) for light and dark themes,
 * adjusted so text and links in that colour stay readable (≥ 4.5:1 contrast).
 */

const STYLE_ID = "business-theme";
const CACHE_KEY = "receipt_portal_brand";

const LIGHT_SURFACE = "#ffffff";
const DARK_SURFACE = "#161933";
const LIGHT_TEXT = "#151827";
const DARK_TEXT = "#0e1020";
const MIN_CONTRAST = 4.5;

type Rgb = [number, number, number];

export interface BrandPalette {
  brand: string;
  hover: string;
  soft: string;
  contrast: string;
  focus: string;
}

export interface BusinessTheme {
  light: BrandPalette;
  dark: BrandPalette;
  /** True when the chosen colour had to be darkened/lightened for readability. */
  adjusted: boolean;
}

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function parse(hex: string): Rgb {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

/** Mixes `a` toward `b`; t = 0 is `a`, t = 1 is `b`. */
export function mix(a: string, b: string, t: number): string {
  const [x, y] = [parse(a), parse(b)];
  return toHex(x.map((v, i) => v + (y[i] - v) * t) as Rgb);
}

function luminance(hex: string): number {
  const [r, g, b] = parse(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Moves `color` toward black or white in small steps until it reaches the target contrast with `bg`. */
function ensureContrast(color: string, bg: string, toward: "#000000" | "#ffffff"): string {
  let t = 0;
  let current = color;
  while (contrastRatio(current, bg) < MIN_CONTRAST && t < 1) {
    t = Math.min(1, t + 0.04);
    current = mix(color, toward, t);
  }
  return current;
}

function readableOn(bg: string, darkText: string): string {
  return contrastRatio(bg, "#ffffff") >= contrastRatio(bg, darkText) ? "#ffffff" : darkText;
}

export function buildBusinessTheme(hex: string): BusinessTheme {
  const color = hex.toLowerCase();
  const lightBrand = ensureContrast(color, LIGHT_SURFACE, "#000000");
  const darkBrand = ensureContrast(color, DARK_SURFACE, "#ffffff");
  return {
    light: {
      brand: lightBrand,
      hover: mix(lightBrand, "#000000", 0.15),
      soft: mix(color, "#ffffff", 0.88),
      contrast: readableOn(lightBrand, LIGHT_TEXT),
      focus: lightBrand,
    },
    dark: {
      brand: darkBrand,
      hover: mix(darkBrand, "#ffffff", 0.15),
      soft: mix(color, DARK_SURFACE, 0.78),
      contrast: readableOn(darkBrand, DARK_TEXT),
      focus: mix(darkBrand, "#ffffff", 0.15),
    },
    adjusted: lightBrand !== color,
  };
}

function vars(p: BrandPalette): string {
  return `--brand: ${p.brand}; --brand-hover: ${p.hover}; --brand-soft: ${p.soft}; --brand-contrast: ${p.contrast}; --focus-ring: ${p.focus};`;
}

export function businessThemeCss(theme: BusinessTheme): string {
  // Mirrors tokens.css: light by default, dark for the manual setting and for the OS preference.
  return [
    `:root { ${vars(theme.light)} }`,
    `:root[data-theme="dark"] { ${vars(theme.dark)} }`,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${vars(theme.dark)} } }`,
  ].join("\n");
}

function writeCache(color: string | null) {
  try {
    if (color) window.localStorage.setItem(CACHE_KEY, color);
    else window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // Storage unavailable: the colour is simply re-applied after the account loads.
  }
}

/** Applies the business colour to the whole portal; null restores the default look. */
export function applyBusinessTheme(color: string | null | undefined): void {
  const existing = document.getElementById(STYLE_ID);
  if (!color || !HEX_COLOR.test(color)) {
    existing?.remove();
    writeCache(null);
    return;
  }
  const style = existing ?? Object.assign(document.createElement("style"), { id: STYLE_ID });
  style.textContent = businessThemeCss(buildBusinessTheme(color));
  if (!existing) document.head.appendChild(style);
  writeCache(color.toLowerCase());
}

/** Before first paint: reuse the last business colour so a reload doesn't flash the default theme. */
export function restoreBusinessTheme(hasSession: boolean): void {
  if (!hasSession) {
    applyBusinessTheme(null);
    return;
  }
  try {
    const cached = window.localStorage.getItem(CACHE_KEY);
    if (cached) applyBusinessTheme(cached);
  } catch {
    // Ignore; AccessContext applies the colour once the account loads.
  }
}
