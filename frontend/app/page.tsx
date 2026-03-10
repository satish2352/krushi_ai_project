import { ChatWindow } from "../components/ChatWindow";

export default function HomePage() {
  return (
    // Full viewport height — nothing overflows the screen
    <main className="fixed inset-0 flex items-stretch justify-center px-3 py-4 md:px-6 lg:px-8 overflow-hidden">
      <div className="flex w-full max-w-5xl gap-4 h-full">

        {/* Sidebar */}
        <aside className="hidden w-56 flex-col flex-shrink-0 rounded-3xl bg-white/70 p-4 shadow-lg ring-1 ring-slate-100 backdrop-blur md:flex overflow-y-auto">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-100 text-lg">🌿</div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Krishi AI</div>
              <div className="text-[11px] text-slate-500">Farm insight workspace</div>
            </div>
          </div>
          <button className="mb-3 flex items-center justify-between rounded-2xl bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-slate-800">
            <span>New chat</span>
          </button>
          <div className="mt-1 space-y-2 text-xs">
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="font-medium">Soil report</div>
              <div className="text-[11px] text-slate-500">Upload NPK and pH file to get crop advice.</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="font-medium">Use my location</div>
              <div className="text-[11px] text-slate-500">Get local weather and mandi prices.</div>
            </div>
          </div>
        </aside>

        {/* Chat — fills all remaining height */}
        <section className="flex-1 min-w-0 h-full">
          <ChatWindow />
        </section>

      </div>
    </main>
  );
}
