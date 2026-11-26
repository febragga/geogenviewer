"use client";

import { useEffect } from "react";
import { copy } from "../copy";
import { MoonIcon, SunIcon } from "./icons";

import { applyThemePreference, THEME_KEY, useAppSettings } from "../state/settings-store";

function getSystemScheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getEffectiveScheme(): "light" | "dark" {
  const meta = document.querySelector('meta[name="color-scheme"]');
  const content = meta?.getAttribute("content");
  if (content === "light" || content === "dark") return content;
  return getSystemScheme();
}

export function applyColorScheme(value: "light" | "dark" | null) {
  applyThemePreference(value ?? "system");
}

export function toggleColorScheme() {
  const current = getEffectiveScheme();
  const target: "light" | "dark" = current === "dark" ? "light" : "dark";
  const system = getSystemScheme();

  useAppSettings.getState().hydrate();
  useAppSettings.getState().patchPreferences({ theme: target === system ? "system" : target });
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_KEY) return;
      const next =
        event.newValue === "light" || event.newValue === "dark"
          ? event.newValue
          : null;
      applyColorScheme(next);
      useAppSettings.setState({ theme: next ?? "system" });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <button
      type="button"
      className={`gg-btn gg-btn--ghost gg-btn--icon gg-theme-toggle ${className}`.trim()}
      onClick={toggleColorScheme}
    >
      <span
        className="gg-theme-option gg-theme-option--to-dark"
        title={copy.themeToggleDark}
      >
        <MoonIcon size={16} strokeWidth={1.75} />
        <span className="visually-hidden">{copy.themeToggleDark}</span>
      </span>
      <span
        className="gg-theme-option gg-theme-option--to-light"
        title={copy.themeToggleLight}
      >
        <SunIcon size={16} strokeWidth={1.75} />
        <span className="visually-hidden">{copy.themeToggleLight}</span>
      </span>
    </button>
  );
}
