"use client";

import { CalendarDays } from "lucide-react";
import { useRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CalendarInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  type?: "date" | "datetime-local";
};

/** Native, keyboard-friendly date input with an explicit picker affordance. */
export function CalendarInput({
  className,
  type = "date",
  ...props
}: CalendarInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  function openPicker() {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    try {
      input.showPicker();
    } catch {
      input.click();
    }
  }
  return (
    <span className="calendar-input-wrap">
      <input
        ref={inputRef}
        className={cn("input calendar-input", className)}
        type={type}
        {...props}
      />
      <button
        aria-label={
          type === "date" ? "Open calendar" : "Open date and time picker"
        }
        className="calendar-input-button"
        onClick={openPicker}
        type="button"
      >
        <CalendarDays aria-hidden="true" className="h-4 w-4" />
      </button>
    </span>
  );
}
