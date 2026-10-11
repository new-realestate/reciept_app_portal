import type { KeyboardEvent } from "react";

/**
 * Arrow-key navigation for a group of role="radio" buttons: moves focus to the
 * next/previous enabled radio and activates it, as native radio groups do.
 */
export function handleRadioGroupKeyDown(e: KeyboardEvent<HTMLElement>) {
  const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
  const backward = e.key === "ArrowLeft" || e.key === "ArrowUp";
  if (!forward && !backward) return;

  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not(:disabled)'));
  const current = radios.indexOf(document.activeElement as HTMLElement);
  if (radios.length === 0 || current === -1) return;

  e.preventDefault();
  const next = radios[(current + (forward ? 1 : -1) + radios.length) % radios.length];
  next.focus();
  next.click();
}
