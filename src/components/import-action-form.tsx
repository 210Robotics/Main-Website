"use client";

import { useActionState, type ReactNode } from "react";

type ImportResult = { message: string };
type State = {
  status: "idle" | "success" | "error";
  message: string;
};

const initialState: State = { status: "idle", message: "" };

export function ImportActionForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<ImportResult>;
  className?: string;
  children: ReactNode;
}) {
  const [state, submit, pending] = useActionState(
    async (_state: State, formData: FormData): Promise<State> => {
      try {
        const result = await action(formData);
        return { status: "success", message: result.message };
      } catch (error) {
        return {
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "The spreadsheet could not be imported.",
        };
      }
    },
    initialState,
  );

  return (
    <form action={submit} className={className} aria-busy={pending}>
      <fieldset className="contents" disabled={pending}>
        {children}
      </fieldset>
      <p
        className={
          state.status === "error"
            ? "text-sm text-red-400"
            : "text-sm text-emerald-400"
        }
        aria-live="polite"
      >
        {pending
          ? "Reading the file, matching columns, and assigning budget rows…"
          : state.message}
      </p>
    </form>
  );
}
