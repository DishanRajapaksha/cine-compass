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
        const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();

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

          const existing = buckets.get(key);
          if (existing) {
            existing.count += 1;
            existing.r += r;
            existing.g += g;
            existing.b += b;
          } else {
            buckets.set(key, { count: 1, r, g, b });
          }
        }

        if (buckets.size === 0) {
          resolve(null);
          return;
        }

        const bucketValues = Array.from(buckets.values());
        let bestBucket = bucketValues[0];
        let bestScore = -1;

        bucketValues.forEach((bucket) => {
          const avgR = bucket.r / bucket.count;
          const avgG = bucket.g / bucket.count;
          const avgB = bucket.b / bucket.count;
          const saturation = Math.max(avgR, avgG, avgB) - Math.min(avgR, avgG, avgB);
          const score = bucket.count * (1 + saturation / 255);
          if (score > bestScore) {
            bestScore = score;
            bestBucket = bucket;
          }
        });

        const normalized: RgbColor = {
          r: Math.round(Math.min(220, Math.max(50, bestBucket.r / bestBucket.count))),
          g: Math.round(Math.min(220, Math.max(50, bestBucket.g / bestBucket.count))),
          b: Math.round(Math.min(220, Math.max(50, bestBucket.b / bestBucket.count)))
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
