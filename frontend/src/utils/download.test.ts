import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OPEN_BLOB_REVOKE_MS, openBlobInNewTab } from './download'

describe('openBlobInNewTab', () => {
  const createObjectURL = vi.fn(() => 'blob:http://localhost/abc')
  const revokeObjectURL = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('abre o blob em nova aba com noopener e revoga o object URL só depois de 60 s', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    openBlobInNewTab(new Blob(['x'], { type: 'application/pdf' }))

    expect(open).toHaveBeenCalledWith('blob:http://localhost/abc', '_blank', 'noopener')
    expect(OPEN_BLOB_REVOKE_MS).toBe(60_000)

    vi.advanceTimersByTime(59_999)
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/abc')
  })
})
