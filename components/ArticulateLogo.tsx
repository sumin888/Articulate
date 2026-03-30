import Link from 'next/link'
import { Mic } from 'lucide-react'

export type ArticulateLogoProps = {
  /** Destination when the mark is clickable; omit for a non-link display. */
  href?: string
  /** `sm`: app shells / compact headers. `md`: marketing header and footer. */
  size?: 'sm' | 'md'
  className?: string
}

export function ArticulateLogo({ href = '/', size = 'md', className = '' }: ArticulateLogoProps) {
  const box = size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-xl'
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  const textSize = size === 'sm' ? 'text-sm font-bold' : 'text-xl font-bold'

  const mark = (
    <>
      <span
        className={`inline-flex ${box} shrink-0 items-center justify-center animated-gradient`}
        aria-hidden
      >
        <Mic className={`${icon} text-white`} />
      </span>
      <span className={`font-display ${textSize} text-foreground`}>Articulate</span>
    </>
  )

  const merged = `inline-flex items-center gap-2 ${className}`.trim()

  if (href) {
    return (
      <Link href={href} className={merged}>
        {mark}
      </Link>
    )
  }

  return <span className={merged}>{mark}</span>
}
