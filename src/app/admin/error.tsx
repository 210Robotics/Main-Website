"use client";

export default function AdminError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main className="min-h-[70vh] bg-[#090909] grid-bg">
      <div className="shell grid min-h-[70vh] place-items-center py-16">
        <section className="card max-w-xl p-7 text-center md:p-10">
          <p className="eyebrow">Administration</p>
          <h1 className="mt-4 text-3xl font-bold">This workspace could not load.</h1>
          <p className="mt-4 text-sm leading-7 text-[#999]">
            No changes were made. Retry the current section when you are ready.
          </p>
          <button className="button mt-6" type="button" onClick={unstable_retry}>
            Try again
          </button>
        </section>
      </div>
    </main>
  );
}
