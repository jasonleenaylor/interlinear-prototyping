import { Interlinearizer } from "@/components/interlinearizer"

export default function Page() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Scripture Interlinearizer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Navigate through occurrences, add glosses, and define morpheme boundaries.
          </p>
        </header>
        <Interlinearizer />
      </div>
    </main>
  )
}
