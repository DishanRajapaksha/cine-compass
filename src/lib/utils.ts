import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility to merge Tailwind and conditional class names safely
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCurrentDateInAmsterdam(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    const localNow = new Date();
    const localYear = localNow.getFullYear();
    const localMonth = String(localNow.getMonth() + 1).padStart(2, '0');
    const localDay = String(localNow.getDate()).padStart(2, '0');
    return `${localYear}-${localMonth}-${localDay}`;
  }

  return `${year}-${month}-${day}`;
}

export function hasEnglishSubtitles(subtitles: string | null | undefined): boolean {
  if (!subtitles) return false;

  const value = subtitles.toLowerCase();
  if (value.includes('english') || value.includes('engels')) {
    return true;
  }

  const tokens = value.split(/[^a-z]+/).filter(Boolean);
  return tokens.includes('en') || tokens.includes('eng');
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

const posterDominantColorCache = new Map<string, RgbColor | null>();

export async function getPosterDominantColor(imageUrl: string | null | undefined): Promise<RgbColor | null> {
  if (!imageUrl || typeof window === 'undefined') return null;
  if (posterDominantColorCache.has(imageUrl)) {
    return posterDominantColorCache.get(imageUrl) ?? null;
  }

  const result = await new Promise<RgbColor | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';

    image.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(null);
          return;
        }

        context.drawImage(image, 0, 0, size, size);
        const { data } = context.getImageData(0, 0, size, size);
        const buckets = new Map<string, { count: number; weight: number; r: number; g: number; b: number }>();
        const center = (size - 1) / 2;
        const maxDistance = Math.hypot(center, center);
        let totalWeight = 0;

        for (let index = 0; index < data.length; index += 4) {
          const alpha = data[index + 3];
          if (alpha < 160) continue;

          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];

          if (r > 245 && g > 245 && b > 245) continue;
          if (r < 12 && g < 12 && b < 12) continue;

          const keyR = Math.round(r / 24) * 24;
          const keyG = Math.round(g / 24) * 24;
          const keyB = Math.round(b / 24) * 24;
          const key = `${keyR}-${keyG}-${keyB}`;
          const pixelIndex = index / 4;
          const x = pixelIndex % size;
          const y = Math.floor(pixelIndex / size);
          const distance = Math.hypot(x - center, y - center);
          const spatialWeight = 1 - Math.min(1, distance / maxDistance) * 0.35;
          const pixelWeight = Math.max(0.65, spatialWeight);

          const existing = buckets.get(key);
          if (existing) {
            existing.count += 1;
            existing.weight += pixelWeight;
            existing.r += r * pixelWeight;
            existing.g += g * pixelWeight;
            existing.b += b * pixelWeight;
          } else {
            buckets.set(key, {
              count: 1,
              weight: pixelWeight,
              r: r * pixelWeight,
              g: g * pixelWeight,
              b: b * pixelWeight
            });
          }
          totalWeight += pixelWeight;
        }

        if (buckets.size === 0 || totalWeight <= 0) {
          resolve(null);
          return;
        }

        const bucketValues = Array.from(buckets.values());
        let bestBucket = bucketValues[0];
        let bestScore = -Infinity;

        bucketValues.forEach((bucket) => {
          const avgR = bucket.r / bucket.weight;
          const avgG = bucket.g / bucket.weight;
          const avgB = bucket.b / bucket.weight;
          const maxChannel = Math.max(avgR, avgG, avgB);
          const minChannel = Math.min(avgR, avgG, avgB);
          const diff = maxChannel - minChannel;
          const saturation = maxChannel === 0 ? 0 : diff / maxChannel;
          const lightness = (maxChannel + minChannel) / (2 * 255);
          const rg = avgR - avgG;
          const yb = (avgR + avgG) / 2 - avgB;
          const colorfulness = Math.min(1, Math.sqrt(rg * rg + yb * yb) / 180);
          const balancedLightness = 1 - Math.min(1, Math.abs(lightness - 0.55) / 0.55);
          const presence = bucket.weight / totalWeight;

          // Prefer colors that are vivid and pleasant to highlight, but still visible in the poster.
          let score =
            saturation * 2.4 +
            colorfulness * 1.6 +
            balancedLightness * 0.9 +
            Math.sqrt(presence) * 0.7;

          if (saturation < 0.08 || diff < 14) {
            score *= 0.3;
          }
          if (lightness < 0.12 || lightness > 0.9) {
            score *= 0.5;
          }

          if (score > bestScore) {
            bestScore = score;
            bestBucket = bucket;
          }
        });

        const normalized: RgbColor = {
          r: Math.round(Math.min(225, Math.max(40, bestBucket.r / bestBucket.weight))),
          g: Math.round(Math.min(225, Math.max(40, bestBucket.g / bestBucket.weight))),
          b: Math.round(Math.min(225, Math.max(40, bestBucket.b / bestBucket.weight)))
        };

        resolve(normalized);
      } catch {
        resolve(null);
      }
    };

    image.onerror = () => resolve(null);
    image.src = imageUrl;
  });

  posterDominantColorCache.set(imageUrl, result);
  return result;
}
