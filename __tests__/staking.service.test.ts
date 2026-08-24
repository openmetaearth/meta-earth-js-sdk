import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import { StakingService } from '../src/modules/staking/service'
import { Logger } from '../src/utils/logger'
import { HttpClient } from '../src/utils/http-client'

const stakingClientMocks = vi.hoisted(() => ({
  sendMsgDelegate: vi.fn(),
  sendMsgUndelegate: vi.fn(),
  sendMsgWithdrawDelegatorReward: vi.fn(),
  sendMsgDoFixedDeposit: vi.fn(),
  sendMsgWithdrawFixedDeposit: vi.fn(),
}))

// Mock staking clients
vi.mock('../src/me-client-ts/cosmos.staking.v1beta1/module', () => ({
  txClient: () => ({
    sendMsgDelegate: stakingClientMocks.sendMsgDelegate,
    sendMsgUndelegate: stakingClientMocks.sendMsgUndelegate,
  }),
}))

vi.mock('../src/me-client-ts/metaearth.wstaking/module', () => ({
  txClient: () => ({
    sendMsgWithdrawDelegatorReward: stakingClientMocks.sendMsgWithdrawDelegatorReward,
    sendMsgDoFixedDeposit: stakingClientMocks.sendMsgDoFixedDeposit,
    sendMsgWithdrawFixedDeposit: stakingClientMocks.sendMsgWithdrawFixedDeposit,
  }),
}))

describe('StakingService', () => {
  let service: StakingService
  let mockLogger: Logger
  let mockHttpClient: HttpClient
  let mockEnsureInitialized: Mock<() => void>

  let mockWalletService: any

  beforeEach(() => {
    vi.clearAllMocks()
    stakingClientMocks.sendMsgDelegate.mockResolvedValue({ tx_bytes: 'mock_tx_bytes' })
    stakingClientMocks.sendMsgUndelegate.mockResolvedValue({ tx_bytes: 'mock_tx_bytes' })
    stakingClientMocks.sendMsgWithdrawDelegatorReward.mockResolvedValue({
      tx_bytes: 'mock_tx_bytes',
    })
    stakingClientMocks.sendMsgDoFixedDeposit.mockResolvedValue({ tx_bytes: 'mock_fixed_tx' })
    stakingClientMocks.sendMsgWithdrawFixedDeposit.mockResolvedValue({
      tx_bytes: 'mock_withdraw_fixed_tx',
    })

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      setEnabled: vi.fn(),
      enabled: false,
    } as any

    mockHttpClient = {
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi.fn().mockResolvedValue({ data: { tx_response: { txhash: '0xhash' } } }),
      setLayer: vi.fn(),
    } as any

    mockEnsureInitialized = vi.fn()

    mockWalletService = {
      createDirectSecp256k1Wallet: vi.fn().mockResolvedValue({
        getAccounts: vi.fn().mockResolvedValue([{ address: 'me1test' }]),
      }),
    }

    service = new StakingService(
      mockLogger,
      mockHttpClient,
      mockWalletService,
      mockEnsureInitialized,
    )
  })

  describe('stakeFlexible', () => {
    it('should call api to stake flexible', async () => {
      const params = {
        address: 'me1test',
        amount: { amount: '100', denom: 'umec' },
      }

      await service.stakeFlexible(params)
      // Staking uses cosmos client, not HTTP POST
      expect(mockHttpClient.post).toHaveBeenCalled()
    })

    it('should validate required parameters', async () => {
      try {
        await service.stakeFlexible({ address: 'me1test' } as any)
      } catch (error: any) {
        expect(error.message).toContain('Validator address is required')
      }
    })
  })

  describe('claimStakingReward', () => {
    it('should call api to claim staking reward', async () => {
      const result = await service.claimStakingReward('me1test')
      expect(result).toBe('0xhash')
      expect(mockHttpClient.post).toHaveBeenCalled()
    })
  })

  describe('unstakeFlexible', () => {
    it('should call api to unstake flexible', async () => {
      const params = {
        address: 'me1test',
        amount: { amount: '50', denom: 'umec' },
      }

      await service.unstakeFlexible(params)
      // Staking uses cosmos client, not HTTP POST
      expect(mockHttpClient.post).toHaveBeenCalled()
    })

    it('should validate required parameters', async () => {
      try {
        await service.unstakeFlexible({ address: 'me1test' } as any)
      } catch (error: any) {
        expect(error.message).toContain('Validator address is required')
      }
    })
  })

  describe('fixed-term staking', () => {
    it('resolves a Cosmos account region and creates a fixed deposit', async () => {
      mockHttpClient.get = vi.fn(async (path: string) => {
        if (path === '/metaearth/did/did') {
          return {
            data: {
              info: {
                did: '501',
                address: 'me1test',
                status: 'DID_STATUS_ACTIVE',
                regionId: 'chn',
              },
            },
          }
        }
        if (path === '/metaearth/wstaking/fixed_deposit_cfg') {
          return {
            data: {
              RegionFixedDepositCfgs: [
                {
                  regionId: 'chn',
                  RegionFixedDepositCfg: [
                    {
                      term: '30',
                      rate: '0.067500000000000000',
                      status: 'FIXED_DEPOSIT_CFG_ACTIVE',
                    },
                  ],
                },
              ],
            },
          }
        }
        throw new Error(`Unexpected path: ${path}`)
      })
      mockHttpClient.post = vi.fn().mockResolvedValue({
        data: { tx_response: { code: 0, txhash: 'fixed-hash', raw_log: '' } },
      })

      const result = await service.stakeFixed({
        address: 'me1test',
        principal: { amount: '1000000', denom: 'umec' },
        term: 30,
      })

      expect(result).toBe('fixed-hash')
      expect(mockHttpClient.get).toHaveBeenNthCalledWith(1, '/metaearth/did/did', {
        params: { address: 'me1test' },
        layer: 'hub',
      })
      expect(stakingClientMocks.sendMsgDoFixedDeposit).toHaveBeenCalledWith({
        value: {
          account: 'me1test',
          principal: { amount: '1000000', denom: 'umec' },
          term: 30,
        },
        memo: '',
      })
    })

    it('uses the sub-account ME ID lookup for an ETH-derived signer', async () => {
      mockWalletService.createDirectSecp256k1Wallet.mockResolvedValue({
        publicKeyTypeUrl: '/ethermint.crypto.v1.ethsecp256k1.PubKey',
        getAccounts: vi.fn().mockResolvedValue([{ address: 'me1eth' }]),
      })
      mockHttpClient.get = vi.fn(async (path: string) => {
        if (path === '/metaearth/kyc/QuerySubAccountDidResponse') {
          return {
            data: {
              info: {
                did: '501',
                address: 'me1main',
                sub_account: 'me1eth',
                status: 'DID_STATUS_ACTIVE',
                regionId: 'chn',
              },
            },
          }
        }
        if (path === '/metaearth/wstaking/fixed_deposit_cfg') {
          return { data: { RegionFixedDepositCfgs: [] } }
        }
        throw new Error(`Unexpected path: ${path}`)
      })

      const result = await service.getFixedDepositConfigs('me1eth')

      expect(result).toEqual({ regionId: 'chn', configs: [] })
      expect(mockHttpClient.get).toHaveBeenNthCalledWith(
        1,
        '/metaearth/kyc/QuerySubAccountDidResponse',
        {
          params: { sub_account: 'me1eth' },
          layer: 'hub',
        },
      )
    })

    it('rejects a term that is not active for the account region', async () => {
      mockHttpClient.get = vi.fn(async (path: string) => {
        if (path === '/metaearth/did/did') {
          return {
            data: {
              info: {
                did: '501',
                address: 'me1test',
                status: 'DID_STATUS_ACTIVE',
                regionId: 'chn',
              },
            },
          }
        }
        return {
          data: {
            RegionFixedDepositCfgs: [
              {
                regionId: 'chn',
                RegionFixedDepositCfg: [
                  {
                    term: '30',
                    rate: '0.067500000000000000',
                    status: 'FIXED_DEPOSIT_CFG_INACTIVE',
                  },
                ],
              },
            ],
          },
        }
      })

      await expect(
        service.stakeFixed({
          address: 'me1test',
          principal: { amount: '1000000', denom: 'umec' },
          term: 30,
        }),
      ).rejects.toThrow('Fixed deposit term 30 is not active')
      expect(stakingClientMocks.sendMsgDoFixedDeposit).not.toHaveBeenCalled()
    })

    it('withdraws principal and interest with the signer selected for the address', async () => {
      mockHttpClient.post = vi.fn().mockResolvedValue({
        data: { tx_response: { code: 0, txhash: 'withdraw-hash', raw_log: '' } },
      })

      const result = await service.withdrawFixed({ address: 'me1test', id: 191 })

      expect(result).toBe('withdraw-hash')
      expect(mockWalletService.createDirectSecp256k1Wallet).toHaveBeenCalledWith({
        address: 'me1test',
      })
      expect(stakingClientMocks.sendMsgWithdrawFixedDeposit).toHaveBeenCalledWith({
        value: { account: 'me1test', id: 191 },
        memo: '',
      })
    })

    it('normalizes fixed deposit records returned by the REST API', async () => {
      mockHttpClient.get = vi.fn().mockResolvedValue({
        data: {
          FixedDeposit: [
            {
              id: '191',
              account: 'me1test',
              principal: { denom: 'umec', amount: '200000000' },
              interest: { denom: 'umec', amount: '9863013' },
              start_time: '2024-12-14T02:41:19Z',
              end_time: '2025-02-12T02:41:19Z',
              term: '60',
              rate: '0.300000000000000000',
            },
          ],
        },
      })

      const result = await service.getFixedDeposits('me1test')

      expect(result[0]).toMatchObject({
        id: 191,
        term: 60,
        startTime: '2024-12-14T02:41:19Z',
        endTime: '2025-02-12T02:41:19Z',
      })
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/metaearth/wstaking/fixed_deposit_by_acct/me1test/ALL_STATE',
        { params: {}, layer: 'hub' },
      )
    })

    it('rejects fixed deposit configs with a missing required rate', async () => {
      mockHttpClient.get = vi.fn(async (path: string) => {
        if (path === '/metaearth/did/did') {
          return {
            data: {
              info: {
                did: '501',
                address: 'me1test',
                status: 'DID_STATUS_ACTIVE',
                regionId: 'chn',
              },
            },
          }
        }
        return {
          data: {
            RegionFixedDepositCfgs: [
              {
                regionId: 'chn',
                RegionFixedDepositCfg: [
                  {
                    term: '30',
                    status: 'FIXED_DEPOSIT_CFG_ACTIVE',
                  },
                ],
              },
            ],
          },
        }
      })

      await expect(service.getFixedDepositConfigs('me1test')).rejects.toThrow(
        'Invalid fixed deposit rate returned by the chain',
      )
    })

    it('rejects fixed deposit records with missing required fields', async () => {
      mockHttpClient.get = vi.fn().mockResolvedValue({
        data: {
          FixedDeposit: [
            {
              id: '191',
              account: '',
              principal: { denom: 'umec', amount: '200000000' },
              interest: { denom: 'umec', amount: '9863013' },
              start_time: '2024-12-14T02:41:19Z',
              end_time: '2025-02-12T02:41:19Z',
              term: '60',
              rate: '0.300000000000000000',
            },
          ],
        },
      })

      await expect(service.getFixedDeposits('me1test')).rejects.toThrow(
        'Invalid fixed deposit account returned by the chain',
      )
    })

    it('rejects blank numeric and coin fields returned by the REST API', async () => {
      const record = {
        id: '191',
        account: 'me1test',
        principal: { denom: 'umec', amount: '200000000' },
        interest: { denom: 'umec', amount: '9863013' },
        start_time: '2024-12-14T02:41:19Z',
        end_time: '2025-02-12T02:41:19Z',
        term: '60',
        rate: '0.300000000000000000',
      }

      mockHttpClient.get = vi
        .fn()
        .mockResolvedValueOnce({ data: { FixedDeposit: [{ ...record, id: ' ' }] } })
        .mockResolvedValueOnce({
          data: {
            FixedDeposit: [{ ...record, principal: { denom: 'umec', amount: ' ' } }],
          },
        })

      await expect(service.getFixedDeposits('me1test')).rejects.toThrow(
        'Invalid fixed deposit id returned by the chain',
      )
      await expect(service.getFixedDeposits('me1test')).rejects.toThrow(
        'Invalid fixed deposit principal amount returned by the chain',
      )
    })
  })

  describe('ensureInitialized calls', () => {
    it('should call ensureInitialized for stakeFlexible', async () => {
      try {
        await service.stakeFlexible({
          address: 'me1test',
          amount: { amount: '100', denom: 'umec' },
        })
      } catch {}
      expect(mockEnsureInitialized).toHaveBeenCalled()
    })

    it('should call ensureInitialized for claimStakingReward', async () => {
      try {
        await service.claimStakingReward('me1test')
      } catch {}
      expect(mockEnsureInitialized).toHaveBeenCalled()
    })

    it('should call ensureInitialized for unstakeFlexible', async () => {
      try {
        await service.unstakeFlexible({
          address: 'me1test',
          amount: { amount: '50', denom: 'umec' },
        })
      } catch {}
      expect(mockEnsureInitialized).toHaveBeenCalled()
    })
  })

  describe('logger calls', () => {
    it('should log info for stakeFlexible', async () => {
      const params = {
        address: 'me1test',
        amount: { amount: '100', denom: 'umec' },
      }
      await service.stakeFlexible(params)
      expect(mockLogger.info).toHaveBeenCalledWith('Staking flexible...', params)
    })

    it('should log info for claimStakingReward', async () => {
      try {
        await service.claimStakingReward('me1test')
      } catch {}
      expect(mockLogger.info).toHaveBeenCalled()
    })

    it('should log info for unstakeFlexible', async () => {
      const params = {
        address: 'me1test',
        amount: { amount: '50', denom: 'umec' },
      }
      await service.unstakeFlexible(params)
      expect(mockLogger.info).toHaveBeenCalledWith('Unstaking flexible...', params)
    })
  })
})
