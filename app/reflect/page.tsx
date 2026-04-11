import Link from 'next/link'
import { ArticulateLogo } from '@/components/ArticulateLogo'

const ACTIVITIES = [
  {
    slug: 'anki',
    name: 'Anki',
    description: 'Flip through flashcard decks to test your recall on any topic.',
    icon: '🃏',
  },
  {
    slug: 'blueprint',
    name: 'Blueprint',
    description: 'Read a model argument and analyze what makes it effective.',
    icon: '📐',
  },
  {
    slug: 'blocks',
    name: 'Blocks',
    description: 'Assemble word blocks into a correct sentence. Difficulty increases as you improve.',
    icon: '🧩',
  },
  {
    slug: 'unscramble',
    name: 'Unscramble',
    description: 'Drag shuffled sentences into the correct logical order.',
    icon: '🔀',
  },
  {
    slug: 'logic',
    name: 'Logic',
    description: 'Tackle LSAT-style logical reasoning questions on topics you choose.',
    icon: '🧠',
  },
  {
    slug: 'wordmap',
    name: 'WordMap',
    description: 'Pick a classic work or author and map the argument structure of a public domain passage.',
    icon: '🗺️',
  },
]

export default function ReflectPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <ArticulateLogo href="/" size="sm" />
          <nav className="flex items-center gap-4">
            <Link
              href="/start"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              New session
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-10">
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">Reflect</h1>
          <p className="mt-2 text-muted-foreground">
            Six activities to deepen your understanding. No session required.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ACTIVITIES.map(activity => (
            <div
              key={activity.slug}
              className="flex flex-col rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
            >
              <div className="mb-3 text-3xl" aria-hidden>
                {activity.icon}
              </div>
              <h2 className="font-display text-lg font-semibold text-foreground">{activity.name}</h2>
              <p className="mt-1 flex-1 text-sm text-muted-foreground leading-relaxed">
                {activity.description}
              </p>
              <Link
                href={`/reflect/${activity.slug}`}
                className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Start
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
