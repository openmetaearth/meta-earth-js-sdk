import { afterEach, describe, expect, it, vi } from 'vitest'
import { getFinalGas, getFinalGasLimit } from '../src/me-client-utils/config'

describe('gas runtime', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('applies the wallet gas-limit multiplier and rounds up', () => {
    expect(getFinalGasLimit('100001')).toBe('150002')
  })

  it('derives an integer fee from the final gas limit', () => {
    expect(getFinalGas('400000', 0)).toBe('12000')
  })

  it('uses the randomized minimum fee and ignores custom gas overrides', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42)

    expect(getFinalGas('100000', 999999)).toBe('10420')
  })
})
