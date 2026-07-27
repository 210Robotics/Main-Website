"use client";

import { useActionState, type ReactNode } from "react";

type State = { status: "idle" | "success" | "error"; message: string };
const initialState: State = { status: "idle", message: "" };

export function ActionForm({
  action,
  successMessage,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  successMessage: string;
  className?: string;
  children: ReactNode;
}) {
  const [state, submit, pending] = useActionState(async (_state: State, formData: FormData): Promise<State> => {
    try {
      await action(formData);
      return { status: "success", message: successMessage };
    } catch (error) {
      console.error(error);
      return { status: "error", message: "The change could not be saved. Check the fields and try again." };
    }
  }, initialState);
  return (
    <form action={submit} className={className} aria-busy={pending}>
      {children}
      <p className={state.status === "error" ? "text-sm text-red-400" : "text-sm text-emerald-400"} aria-live="polite">
        {pending ? "Saving…" : state.message}
      </p>
    </form>
  );
}
