export default function PortalLoading() {
  return (
    <main className="min-h-screen bg-[#090909] grid-bg" aria-busy="true">
      <div className="shell py-10">
        <div className="h-4 w-32 animate-pulse bg-[#262626]" />
        <div className="mt-4 h-12 max-w-xl animate-pulse bg-[#1c1c1c]" />
        <div className="mt-8 h-36 animate-pulse border border-[#333] bg-[#101010]" />
        <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div
              className="h-40 animate-pulse border border-[#292929] bg-[#111]"
              key={item}
            />
          ))}
        </div>
        <p className="sr-only">Loading your member workspace</p>
      </div>
    </main>
  );
}
