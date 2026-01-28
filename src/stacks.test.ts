import { describe, it, expect } from 'vitest'
import {
  STACKS_NETWORKS,
  STACKS_TOKENS,
  STACKS_DECIMALS,
  getStacksNetworkId,
  toBaseUnits,
  fromBaseUnits,
  createPaymentRequirements,
  isValidStacksAddress,
  isAddressForNetwork,
  getExplorerUrl,
} from './stacks'

describe('Stacks constants', () => {
  it('has correct network IDs', () => {
    expect(STACKS_NETWORKS.MAINNET).toBe('stacks:1')
    expect(STACKS_NETWORKS.TESTNET).toBe('stacks:2147483648')
  })

  it('has token contracts for both networks', () => {
    expect(STACKS_TOKENS.mainnet.STX).toBe('STX')
    expect(STACKS_TOKENS.mainnet.sBTC).toMatch(/^SM.*\.sbtc-token$/)
    expect(STACKS_TOKENS.mainnet.USDCx).toMatch(/^SP.*\.usdcx$/)

    expect(STACKS_TOKENS.testnet.STX).toBe('STX')
    expect(STACKS_TOKENS.testnet.sBTC).toMatch(/^ST.*\.sbtc-token$/)
  })

  it('has correct decimals', () => {
    expect(STACKS_DECIMALS.STX).toBe(6)
    expect(STACKS_DECIMALS.sBTC).toBe(8)
    expect(STACKS_DECIMALS.USDCx).toBe(6)
  })
})

describe('getStacksNetworkId', () => {
  it('returns mainnet CAIP-2 ID', () => {
    expect(getStacksNetworkId('mainnet')).toBe('stacks:1')
  })

  it('returns testnet CAIP-2 ID', () => {
    expect(getStacksNetworkId('testnet')).toBe('stacks:2147483648')
  })
})

describe('toBaseUnits', () => {
  it('converts STX amounts (6 decimals)', () => {
    expect(toBaseUnits('1', 'STX')).toBe('1000000')
    expect(toBaseUnits('0.001', 'STX')).toBe('1000')
    expect(toBaseUnits('1.5', 'STX')).toBe('1500000')
    expect(toBaseUnits(2, 'STX')).toBe('2000000')
  })

  it('converts sBTC amounts (8 decimals)', () => {
    expect(toBaseUnits('1', 'sBTC')).toBe('100000000')
    expect(toBaseUnits('0.001', 'sBTC')).toBe('100000')
    expect(toBaseUnits('0.00000001', 'sBTC')).toBe('1')
  })

  it('converts USDCx amounts (6 decimals)', () => {
    expect(toBaseUnits('1', 'USDCx')).toBe('1000000')
    expect(toBaseUnits('10.50', 'USDCx')).toBe('10500000')
  })

  it('handles whole numbers without decimals', () => {
    expect(toBaseUnits('100', 'STX')).toBe('100000000')
  })

  it('handles edge cases', () => {
    expect(toBaseUnits('.5', 'STX')).toBe('500000') // Leading decimal
    expect(toBaseUnits('0', 'STX')).toBe('0')
  })
})

describe('fromBaseUnits', () => {
  it('converts STX base units to human-readable', () => {
    expect(fromBaseUnits('1000000', 'STX')).toBe('1.0')
    expect(fromBaseUnits('1500000', 'STX')).toBe('1.5')
    expect(fromBaseUnits('1000', 'STX')).toBe('0.001')
  })

  it('converts sBTC base units to human-readable', () => {
    expect(fromBaseUnits('100000000', 'sBTC')).toBe('1.0')
    expect(fromBaseUnits('1', 'sBTC')).toBe('0.00000001')
  })

  it('accepts bigint input', () => {
    expect(fromBaseUnits(BigInt('1000000'), 'STX')).toBe('1.0')
  })
})

describe('createPaymentRequirements', () => {
  it('creates mainnet STX payment requirements', () => {
    const req = createPaymentRequirements({
      payTo: 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9',
      amount: '0.001',
      token: 'STX',
      network: 'mainnet',
    })

    expect(req.scheme).toBe('exact')
    expect(req.network).toBe('stacks:1')
    expect(req.asset).toBe('STX')
    expect(req.amount).toBe('1000') // 0.001 STX = 1000 microSTX
    expect(req.payTo).toBe('SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9')
    expect(req.maxTimeoutSeconds).toBe(300)
    expect(req.extra.facilitator).toBe('https://pay.openfacilitator.io')
    expect(req.extra.tokenType).toBe('STX')
  })

  it('creates testnet sBTC payment requirements', () => {
    const req = createPaymentRequirements({
      payTo: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      amount: '0.0001',
      token: 'sBTC',
      network: 'testnet',
      maxTimeoutSeconds: 600,
      facilitatorUrl: 'https://custom.facilitator.io',
    })

    expect(req.network).toBe('stacks:2147483648')
    expect(req.asset).toBe('ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token')
    expect(req.amount).toBe('10000') // 0.0001 sBTC = 10000 sats
    expect(req.maxTimeoutSeconds).toBe(600)
    expect(req.extra.facilitator).toBe('https://custom.facilitator.io')
    expect(req.extra.tokenType).toBe('sBTC')
  })
})

describe('isValidStacksAddress', () => {
  it('validates mainnet addresses', () => {
    expect(isValidStacksAddress('SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9')).toBe(true)
    expect(isValidStacksAddress('SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4')).toBe(true)
  })

  it('validates testnet addresses', () => {
    expect(isValidStacksAddress('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM')).toBe(true)
    // SN prefix for multi-sig testnet
    expect(isValidStacksAddress('SN1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM')).toBe(true)
  })

  it('validates contract addresses', () => {
    expect(isValidStacksAddress('SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token')).toBe(true)
  })

  it('rejects invalid addresses', () => {
    expect(isValidStacksAddress('invalid')).toBe(false)
    expect(isValidStacksAddress('0x1234')).toBe(false)
    expect(isValidStacksAddress('')).toBe(false)
  })
})

describe('isAddressForNetwork', () => {
  it('identifies mainnet addresses', () => {
    expect(isAddressForNetwork('SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9', 'mainnet')).toBe(true)
    expect(isAddressForNetwork('SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4', 'mainnet')).toBe(true)
    expect(isAddressForNetwork('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM', 'mainnet')).toBe(false)
  })

  it('identifies testnet addresses', () => {
    expect(isAddressForNetwork('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM', 'testnet')).toBe(true)
    expect(isAddressForNetwork('SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9', 'testnet')).toBe(false)
  })
})

describe('getExplorerUrl', () => {
  it('returns mainnet explorer URL', () => {
    const url = getExplorerUrl('abc123', 'mainnet')
    expect(url).toBe('https://explorer.hiro.so/txid/0xabc123')
  })

  it('returns testnet explorer URL', () => {
    const url = getExplorerUrl('0xdef456', 'testnet')
    expect(url).toBe('https://explorer.hiro.so/txid/0xdef456?chain=testnet')
  })

  it('handles txid with 0x prefix', () => {
    const url = getExplorerUrl('0xabc123', 'mainnet')
    expect(url).toBe('https://explorer.hiro.so/txid/0xabc123')
  })
})
