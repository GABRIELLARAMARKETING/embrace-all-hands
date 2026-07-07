import { useEffect } from "react";
import { THEME_LIST } from "@/game/config/themes";

const cache = new Map<string, HTMLImageElement>();

export function preloadThemeImage(url: string): Promise<void> {
  if (cache.has(url)) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      cache.set(url, img);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = url;
  });
}

/** Preload all theme background images once, cached in memory. */
export function useThemePreload() {
  useEffect(() => {
    THEME_LIST.forEach((t) => {
      void preloadThemeImage(t.bgImage);
    });
  }, []);
}
