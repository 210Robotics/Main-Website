export default function AdminLoading() {
  return (
    <main className="min-h-screen bg-[#090909] grid-bg" aria-busy="true">
      <div className="shell py-10">
        <div className="h-4 w-28 animate-pulse bg-[#262626]" />
        <div className="mt-4 h-12 max-w-2xl animate-pulse bg-[#1c1c1c]" />
        <div className="mt-8 flex gap-3 overflow-hidden">
          {[0, 1, 2, 3, 4].map((item) => (
            <div className="h-11 w-36 shrink-0 animate-pulse bg-[#171717]" key={item} />
          ))}
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div className="h-48 animate-pulse border border-[#292929] bg-[#111]" key={item} />
          ))}
        </div>
        <p className="sr-only">Loading the administration workspace</p>
      </div>
    </main>
  );
}
