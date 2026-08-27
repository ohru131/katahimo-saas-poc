import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { FontSize } from "../types";
import { loadJSON, saveJSON } from "../data/store";

const FONT_SIZE_KEY = "settings:fontSize";

interface SettingsContextValue {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>(() => loadJSON<FontSize>(FONT_SIZE_KEY, "medium"));

  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize;
  }, [fontSize]);

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    saveJSON(FONT_SIZE_KEY, size);
  };

  return <SettingsContext.Provider value={{ fontSize, setFontSize }}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
