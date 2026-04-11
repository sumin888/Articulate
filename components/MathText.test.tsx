import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { MathText } from './MathText'

describe('MathText', () => {
  it('renders inline math with katex', () => {
    const { container } = render(<MathText>Energy $E=mc^2$.</MathText>)
    expect(container.querySelectorAll('.katex').length).toBeGreaterThan(0)
  })

  it('renders display math', () => {
    const { container } = render(
      <MathText>{'$$\\int_0^1 x\\,dx$$'}</MathText>
    )
    expect(container.querySelector('.katex-display, .katex')).toBeTruthy()
  })

  it('applies onPrimary variant without throwing', () => {
    const { container } = render(
      <MathText variant="onPrimary">{'$x$'}</MathText>
    )
    expect(container.querySelector('.math-on-primary')).toBeTruthy()
  })
})
