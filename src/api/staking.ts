/**
 * Staking API Methods
 * Staking related API interface methods
 */

import { HttpClient } from '../utils/http-client'
import type {
  Layer,
  Coin,
  FlexibleStakingParams,
  FixedDepositConfig,
  FixedDepositConfigStatus,
  FixedDepositParams,
  FixedDepositRecord,
  FixedDepositState,
  WithdrawFixedDepositParams,
} from '../types'
import { txClient as stakingClient } from '../me-client-ts/cosmos.staking.v1beta1/module'
import { txClient as wstakingClient } from '../me-client-ts/metaearth.wstaking/module'
import { PREFIX } from '../config/define'
import { OfflineSigner } from '@cosmjs/proto-signing'
import { TransactionApi } from './transaction'

type RawFixedDepositConfig = {
  term?: string | number
  rate?: string
  status?: string
}

type RawRegionFixedDepositConfig = {
  regionId?: string
  RegionFixedDepositCfg?: RawFixedDepositConfig[]
}

type RawFixedDepositConfigResponse = {
  RegionFixedDepositCfgs?: RawRegionFixedDepositConfig[]
}

type RawCoin = Partial<Coin>

type RawFixedDepositRecord = {
  id?: string | number
  account?: string
  principal?: RawCoin
  interest?: RawCoin
  startTime?: string
  start_time?: string
  endTime?: string
  end_time?: string
  term?: string | number
  rate?: string
}

type RawFixedDepositResponse = {
  FixedDeposit?: RawFixedDepositRecord[]
}

const normalizeInteger = (value: string | number | undefined, field: string): number => {
  if (typeof value === 'string' && !value.trim()) {
    throw new Error(`Invalid ${field} returned by the chain`)
  }
  const normalized = Number(value)
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new Error(`Invalid ${field} returned by the chain`)
  }
  return normalized
}

// Fail on missing protocol-required strings instead of returning unusable normalized data.
const normalizeRequiredString = (value: string | undefined, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid ${field} returned by the chain`)
  }
  return value
}

const normalizeCoin = (value: RawCoin | undefined, field: string): Coin | undefined => {
  if (value === undefined) return undefined
  return {
    denom: normalizeRequiredString(value.denom, `${field} denom`),
    amount: normalizeRequiredString(value.amount, `${field} amount`),
  }
}

const normalizeConfigStatus = (status: string | undefined): FixedDepositConfigStatus => {
  const normalized = normalizeRequiredString(status, 'fixed deposit config status')
  if (normalized === 'FIXED_DEPOSIT_CFG_ACTIVE' || normalized === 'FIXED_DEPOSIT_CFG_INACTIVE') {
    return normalized
  }
  return 'UNRECOGNIZED'
}

const assertSuccessfulTransaction = (
  operation: string,
  response: Awaited<ReturnType<TransactionApi['sendTransaction']>>,
) => {
  if (Number(response.tx_response.code) !== 0) {
    throw new Error(
      `${operation} transaction failed: ${response.tx_response.raw_log || 'unknown chain error'}`,
    )
  }
}

export class StakingApi {
  constructor(private httpClient: HttpClient) {}
  /**
   * Create delegation transaction
   * @param params Delegation parameters
   * @param signer Signer
   * @returns Promise<string> Transaction hash
   */
  public async createDelegation(
    params: FlexibleStakingParams,
    signer: OfflineSigner,
  ): Promise<string> {
    try {
      const { layer = 'hub', amount } = params
      const [account] = await signer.getAccounts()
      const client = stakingClient({ signer, prefix: PREFIX })

      const value: any = {
        delegatorAddress: account.address,
        amount,
      }
      const { tx_bytes } = await client.sendMsgDelegate({
        value,
      })
      const response = await new TransactionApi(this.httpClient).sendTransaction(tx_bytes, layer)

      return response.tx_response.txhash
    } catch (error) {
      console.error('Failed to create delegation:', error)
      throw error
    }
  }

  /**
   * Create undelegation transaction
   * @param delegatorAddress Delegator address
   * @param validatorAddress Validator address
   * @param amount Undelegation amount
   * @param layer Target layer
   * @param signer Signer
   * @returns Promise<string> Transaction hash
   */
  public async createUndelegation(
    delegatorAddress: string,
    amount: Coin,
    layer: Layer = 'hub',
    signer: OfflineSigner,
  ): Promise<string> {
    try {
      const client = stakingClient({ signer, prefix: PREFIX })

      const value: any = {
        delegatorAddress,
        amount,
      }
      const { tx_bytes } = await client.sendMsgUndelegate({
        value,
      })
      const response = await new TransactionApi(this.httpClient).sendTransaction(tx_bytes, layer)

      return response.tx_response.txhash
    } catch (error) {
      console.error('Failed to create undelegation:', error)
      throw error
    }
  }

  /**
   * Withdraw delegator reward
   */
  public async createWithdrawDelegatorReward(
    delegatorAddress: string,
    layer: Layer = 'hub',
    signer: OfflineSigner,
  ): Promise<string> {
    try {
      const client = wstakingClient({ signer, prefix: PREFIX })

      const value: any = {
        delegatorAddress,
      }
      const { tx_bytes } = await client.sendMsgWithdrawDelegatorReward({
        value,
      })
      const response = await new TransactionApi(this.httpClient).sendTransaction(tx_bytes, layer)

      return response.tx_response.txhash
    } catch (error) {
      console.error('Failed to withdraw delegator reward:', error)
      throw error
    }
  }

  /** Create and broadcast a fixed-term staking transaction. */
  public async createFixedDeposit(
    params: FixedDepositParams,
    signer: OfflineSigner,
  ): Promise<string> {
    const { memo = '', address, principal, term } = params
    const [account] = await signer.getAccounts()
    if (account.address !== address) {
      throw new Error(
        `Signer address ${account.address} does not match fixed deposit account ${address}`,
      )
    }

    const client = wstakingClient({ signer, prefix: PREFIX })
    const { tx_bytes } = await client.sendMsgDoFixedDeposit({
      value: { account: address, principal, term },
      memo,
    })
    const response = await new TransactionApi(this.httpClient).sendTransaction(tx_bytes)
    assertSuccessfulTransaction('Fixed deposit', response)
    return response.tx_response.txhash
  }

  /** Create and broadcast a fixed-term staking withdrawal transaction. */
  public async withdrawFixedDeposit(
    params: WithdrawFixedDepositParams,
    signer: OfflineSigner,
  ): Promise<string> {
    const { memo = '', address, id } = params
    const [account] = await signer.getAccounts()
    if (account.address !== address) {
      throw new Error(
        `Signer address ${account.address} does not match fixed deposit account ${address}`,
      )
    }

    const client = wstakingClient({ signer, prefix: PREFIX })
    const { tx_bytes } = await client.sendMsgWithdrawFixedDeposit({
      value: { account: address, id },
      memo,
    })
    const response = await new TransactionApi(this.httpClient).sendTransaction(tx_bytes)
    assertSuccessfulTransaction('Fixed deposit withdrawal', response)
    return response.tx_response.txhash
  }

  /** Query fixed-term staking options configured for one ME ID region. */
  public async getFixedDepositConfigs(regionId: string): Promise<FixedDepositConfig[]> {
    const response = await this.httpClient.get<RawFixedDepositConfigResponse>(
      '/metaearth/wstaking/fixed_deposit_cfg',
      {
        params: { regionIds: regionId },
        layer: 'hub',
      },
    )
    const regionConfig = response.data.RegionFixedDepositCfgs?.find(
      (item) => item.regionId === regionId,
    )

    return (regionConfig?.RegionFixedDepositCfg ?? []).map((config) => ({
      term: normalizeInteger(config.term, 'fixed deposit term'),
      rate: normalizeRequiredString(config.rate, 'fixed deposit rate'),
      status: normalizeConfigStatus(config.status),
    }))
  }

  /** Query fixed-term staking positions for one account. */
  public async getFixedDeposits(
    address: string,
    state: FixedDepositState = 'ALL_STATE',
  ): Promise<FixedDepositRecord[]> {
    const response = await this.httpClient.get<RawFixedDepositResponse>(
      `/metaearth/wstaking/fixed_deposit_by_acct/${encodeURIComponent(address)}/${state}`,
      { params: {}, layer: 'hub' },
    )

    return (response.data.FixedDeposit ?? []).map((record) => ({
      id: normalizeInteger(record.id, 'fixed deposit id'),
      account: normalizeRequiredString(record.account, 'fixed deposit account'),
      principal: normalizeCoin(record.principal, 'fixed deposit principal'),
      interest: normalizeCoin(record.interest, 'fixed deposit interest'),
      startTime: normalizeRequiredString(
        record.startTime ?? record.start_time,
        'fixed deposit start time',
      ),
      endTime: normalizeRequiredString(
        record.endTime ?? record.end_time,
        'fixed deposit end time',
      ),
      term: normalizeInteger(record.term, 'fixed deposit term'),
      rate: normalizeRequiredString(record.rate, 'fixed deposit rate'),
    }))
  }

  /**
   * Query flexible delegation
   * @param delegatorAddr Delegator address
   * @param layer Target layer (default 'hub')
   * @returns Promise<any>
   */
  public async getFlexibleDelegation(delegatorAddr: string, layer: Layer = 'hub'): Promise<any> {
    try {
      const response = await this.httpClient.get(
        `/metaearth/wstaking/delegation/${delegatorAddr}`,
        {
          params: {},
          layer,
        },
      )
      return response.data
    } catch (error) {
      console.error('Failed to get flexible delegation:', error)
      throw error
    }
  }

  /**
   * Query flexible delegation rewards
   * @param delegatorAddr Delegator address
   * @param layer Target layer (default 'hub')
   * @returns Promise<any>
   */
  public async getFlexibleDelegationRewards(
    delegatorAddr: string,
    layer: Layer = 'hub',
  ): Promise<any> {
    try {
      const response = await this.httpClient.get(
        `/metaearth/wstaking/delegation-rewards/${delegatorAddr}`,
        {
          params: {},
          layer,
        },
      )
      return response.data
    } catch (error) {
      console.error('Failed to get flexible delegation rewards:', error)
      throw error
    }
  }
}
