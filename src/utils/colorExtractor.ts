/**
 * Utility to extract dominant color from a book cover image or compute a rich bookbinding palette.
 * Results are cached in memory and localStorage for instant, zero-lag rendering.
 */

const colorCache = new Map<string, string>();

/**
 * Parses hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

/**
 * Converts RGB to hex string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Calculates perceived relative luminance (0 to 1)
 */
export function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.2;
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
}

/**
 * Calculates hue in degrees (0 to 360) for rainbow/hue sorting
 */
export function getHueFromHex(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta === 0) return 0;

  let hue = 0;
  if (max === r) {
    hue = ((g - b) / delta) % 6;
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }

  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;
  return hue;
}

/**
 * Adjusts color to feel like authentic dyed cloth or bookbinding leather.
 * Prevents blinding neons or completely washed-out white spines.
 */
export function harmonizeForSpine(r: number, g: number, b: number): string {
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  let adjR = r;
  let adjG = g;
  let adjB = b;

  if (lum > 0.75) {
    // Too light: deepen slightly to give body and depth to the cloth binding
    const factor = 0.55;
    adjR = Math.round(r * factor);
    adjG = Math.round(g * factor);
    adjB = Math.round(b * factor);
  } else if (lum < 0.08) {
    // Too dark: lift slightly into rich charcoal/midnight leather
    adjR = Math.max(28, Math.round(r * 1.5 + 15));
    adjG = Math.max(28, Math.round(g * 1.5 + 15));
    adjB = Math.max(32, Math.round(b * 1.5 + 18));
  }

  return rgbToHex(adjR, adjG, adjB);
}

/**
 * Picks appropriate foil debossing style based on the spine background color
 */
export function getSpineFoil(hex: string): 'spine-gold-emboss' | 'spine-silver-emboss' | 'spine-dark-emboss' {
  const lum = getLuminance(hex);
  if (lum > 0.6) {
    // Light covers (yellow, cream, pastel) get crisp dark debossing
    return 'spine-dark-emboss';
  }
  const hue = getHueFromHex(hex);
  // Cool tones (blues, charcoals, slates) often look stellar with silver foil; warm tones with rich gold
  if ((hue >= 180 && hue <= 240) && lum < 0.35) {
    return 'spine-silver-emboss';
  }
  return 'spine-gold-emboss';
}

/**
 * Extracts dominant color from an image URL using offscreen canvas.
 * Focuses on the left side of the cover (near where the spine is attached) for realism.
 */
export async function extractCoverColor(imageUrl: string, fallbackKey: string): Promise<string> {
  if (!imageUrl) {
    return getFallbackSpineColor(fallbackKey);
  }

  // 1. Check in-memory cache
  if (colorCache.has(imageUrl)) {
    return colorCache.get(imageUrl)!;
  }

  // 2. Check localStorage cache
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(`spine_col_${encodeURIComponent(imageUrl)}`);
      if (cached) {
        colorCache.set(imageUrl, cached);
        return cached;
      }
    } catch {}
  }

  // 3. Extract using Canvas
  return new Promise<string>((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const timer = setTimeout(() => {
        // Fallback on timeout (e.g. slow image host)
        const fb = getFallbackSpineColor(fallbackKey);
        colorCache.set(imageUrl, fb);
        resolve(fb);
      }, 3000);

      img.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            const fb = getFallbackSpineColor(fallbackKey);
            resolve(fb);
            return;
          }

          // Sample down to a compact 16x24 grid
          canvas.width = 16;
          canvas.height = 24;
          ctx.drawImage(img, 0, 0, 16, 24);

          // Focus especially on the left third of the cover (the spine margin)
          const imgData = ctx.getImageData(0, 0, 8, 24).data;

          let totalR = 0;
          let totalG = 0;
          let totalB = 0;
          let count = 0;

          for (let i = 0; i < imgData.length; i += 4) {
            const a = imgData[i + 3];
            if (a < 128) continue; // Skip transparent
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];

            totalR += r;
            totalG += g;
            totalB += b;
            count++;
          }

          if (count === 0) {
            const fb = getFallbackSpineColor(fallbackKey);
            resolve(fb);
            return;
          }

          const avgR = totalR / count;
          const avgG = totalG / count;
          const avgB = totalB / count;

          const harmonized = harmonizeForSpine(avgR, avgG, avgB);
          colorCache.set(imageUrl, harmonized);
          try {
            localStorage.setItem(`spine_col_${encodeURIComponent(imageUrl)}`, harmonized);
          } catch {}

          resolve(harmonized);
        } catch {
          // Canvas tainted by CORS from external image host
          const fb = getFallbackSpineColor(fallbackKey);
          colorCache.set(imageUrl, fb);
          resolve(fb);
        }
      };

      img.onerror = () => {
        clearTimeout(timer);
        const fb = getFallbackSpineColor(fallbackKey);
        colorCache.set(imageUrl, fb);
        resolve(fb);
      };

      img.src = imageUrl;
    } catch {
      const fb = getFallbackSpineColor(fallbackKey);
      resolve(fb);
    }
  });
}

/**
 * Deterministic curated palette for books without image or when offline
 */
const CURATED_BINDINGS = [
  '#4A1D20', // Burgundy leather
  '#1B3526', // Hunter green
  '#1A2A3A', // Midnight navy
  '#5C341E', // Saddle tan
  '#2E1E18', // Deep chocolate
  '#3D2039', // Royal plum
  '#66301C', // Terracotta
  '#25282E', // Slate charcoal
  '#3E442D', // Olive drab
  '#694E27', // Amber mustard
  '#1F3A44', // Prussian teal
  '#581E29', // Carmine
  '#27392E', // Forest pine
  '#44291D', // Mocha
];

export function getFallbackSpineColor(seedStr: string): string {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % CURATED_BINDINGS.length;
  return CURATED_BINDINGS[idx];
}
