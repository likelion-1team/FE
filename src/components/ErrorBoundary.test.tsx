import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
it('keeps a recovery screen visible after an unexpected render exception', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  function Broken(): never {
    throw new Error('unexpected render failure')
  }
  render(
    <ErrorBoundary>
      <Broken />
    </ErrorBoundary>,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('예상하지 못한 오류')
  expect(screen.getByRole('button', { name: '화면 다시 불러오기' })).toBeVisible()
  expect(screen.getByRole('link', { name: '내 팀 목록으로' })).toHaveAttribute('href', '/teams')
})
