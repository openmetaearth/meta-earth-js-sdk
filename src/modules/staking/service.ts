/**
 * Staking Module Service
 * Staking module service - Handles all staking related operations
 */

import { Logger } from '../../utils/logger'
import { HttpClient } from '../../utils/http-client'
import { StakingApi } from '../../api/staking'
import { IdentityApi } from '../../api/identity'
import type {
  Coin,
  FixedDepositConfigResult,
  FixedDepositParams,
  FixedDepositRecord,
  FixedDepositState,
  FlexibleStakingParams,
  Layer,
  WithdrawFixedDepositParams,
} from '../../types'
import { WalletService } from '../wallet/service'
import { isEthSecp256k1DirectSigner } from '../../me-client-utils/eth-secp256k1'

const requireAddress = (address: string) => {
  if (!address.trim()) {
    throw new Error('Wallet address is required')
  }
}

const requirePositiveInteger = (value: number, field: string) => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`)
  }
}

const requirePositiveCoin = (coin: Coin) => {
  if (!coin?.denom.trim()) {
    throw new Error('Fixed deposit denom is required')
  }
  if (!/^[1-9]\d*$/.test(coin.amount)) {
    throw new Error('Fixed deposit amount must be a positive integer')
  }
}

/**
 * Staking Service Class
 * Encapsulates all staking related operations
 */
export class StakingService {
  private logger: Logger
  private httpClient: HttpClient
  private api: StakingApi
  private identityApi: IdentityApi
  private walletService: WalletService
  private ensureInitialized: () => void

  constructor(
    logger: Logger,
    httpClient: HttpClient,
    walletService: WalletService,
    ensureInitialized: () => void,
  ) {
    this.logger = logger
    this.httpClient = httpClient
    this.walletService = walletService
    this.ensureInitialized = ensureInitialized
    this.api = new StakingApi(this.httpClient)
    this.identityApi = new IdentityApi(this.httpClient)
  }

  /**
   * Flexible Staking
   * @param params - Staking parameters (address, amount, denom, layer)
   * @returns Promise<string> Transaction hash
   * @throws Error if validator address is missing
   */
  public async stakeFlexible(params: FlexibleStakingParams): Promise<string> {
    this.ensureInitialized()
    try {
      this.logger.info('Staking flexible...', params)
      // Get signer
      const signer = await this.walletService.createDirectSecp256k1Wallet({
        address: params.address,
      })

      return await this.api.createDelegation(params, signer)
    } catch (error: any) {
      this.logger.error('Failed to stake flexible:', error)
      throw error
    }
  }

  /**
   * Claim flexible staking rewards
   * sendMsgWithdrawFixedDeposit
   * @param address - Wallet address
   * @returns Promise<string> Transaction hash
   */
  public async claimStakingReward(address: string): Promise<string> {
    this.ensureInitialized()
    try {
      this.logger.info('Unstaking flexible...', address)

      // Get signer
      const signer = await this.walletService.createDirectSecp256k1Wallet({
        address,
      })

      return await this.api.createWithdrawDelegatorReward(address, 'hub', signer)
    } catch (error: any) {
      this.logger.error('Failed to unstake flexible:', error)
      throw error
    }
  }

  /**
   * Create a fixed-term staking position after resolving the account's ME ID region.
   * The cached wallet type selects either Cosmos secp256k1 or Ethermint ethsecp256k1 signing.
   */
  public async stakeFixed(params: FixedDepositParams): Promise<string> {
    this.ensureInitialized()
    requireAddress(params.address)
    requirePositiveCoin(params.principal)
    requirePositiveInteger(params.term, 'Fixed deposit term')

    try {
      this.logger.info('Staking fixed-term...', params)
      const { signer, regionId } = await this.resolveFixedDepositRegion(params.address)
      const configs = await this.api.getFixedDepositConfigs(regionId)
      const selectedConfig = configs.find((config) => config.term === params.term)
      if (!selectedConfig || selectedConfig.status !== 'FIXED_DEPOSIT_CFG_ACTIVE') {
        throw new Error(
          `Fixed deposit term ${params.term} is not active for ME ID region ${regionId}`,
        )
      }

      return await this.api.createFixedDeposit(params, signer)
    } catch (error: any) {
      this.logger.error('Failed to stake fixed-term:', error)
      throw error
    }
  }

  /**
   * Withdraw principal and interest from a fixed-term staking position.
   * Signer selection is based on the cached wallet address type.
   */
  public async withdrawFixed(params: WithdrawFixedDepositParams): Promise<string> {
    this.ensureInitialized()
    requireAddress(params.address)
    requirePositiveInteger(params.id, 'Fixed deposit id')

    try {
      this.logger.info('Withdrawing fixed-term staking...', params)
      const signer = await this.walletService.createDirectSecp256k1Wallet({
        address: params.address,
      })
      return await this.api.withdrawFixedDeposit(params, signer)
    } catch (error: any) {
      this.logger.error('Failed to withdraw fixed-term staking:', error)
      throw error
    }
  }

  /** Resolve the wallet's ME ID region and return all configured fixed-term options. */
  public async getFixedDepositConfigs(address: string): Promise<FixedDepositConfigResult> {
    this.ensureInitialized()
    requireAddress(address)

    try {
      const { regionId } = await this.resolveFixedDepositRegion(address)
      const configs = await this.api.getFixedDepositConfigs(regionId)
      return { regionId, configs }
    } catch (error: any) {
      this.logger.error('Failed to get fixed deposit configs:', error)
      throw error
    }
  }

  /** Query fixed-term staking positions for an account. */
  public async getFixedDeposits(
    address: string,
    state: FixedDepositState = 'ALL_STATE',
  ): Promise<FixedDepositRecord[]> {
    this.ensureInitialized()
    requireAddress(address)

    try {
      return await this.api.getFixedDeposits(address, state)
    } catch (error: any) {
      this.logger.error('Failed to get fixed deposits:', error)
      throw error
    }
  }

  /**
   * Unstake flexible staking
   * @param params - Unstaking parameters (address, amount, layer)
   * @returns Promise<string> Transaction hash
   */
  public async unstakeFlexible(params: FlexibleStakingParams): Promise<string> {
    this.ensureInitialized()
    try {
      this.logger.info('Unstaking flexible...', params)

      // Get signer
      const signer = await this.walletService.createDirectSecp256k1Wallet({
        address: params.address,
      })

      return await this.api.createUndelegation(params.address, params.amount, params.layer, signer)
    } catch (error: any) {
      this.logger.error('Failed to unstake flexible:', error)
      throw error
    }
  }
  /**
   * Query flexible delegation
   * @param delegatorAddr Delegator address
   * @param layer Target layer (default 'hub')
   * @returns Promise<any>
   */
  public async getFlexibleDelegation(delegatorAddr: string, layer: Layer = 'hub'): Promise<any> {
    this.ensureInitialized()
    try {
      this.logger.info('Getting flexible delegation...', delegatorAddr)
      return await this.api.getFlexibleDelegation(delegatorAddr, layer)
    } catch (error: any) {
      this.logger.error('Failed to get flexible delegation:', error)
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
    this.ensureInitialized()
    try {
      this.logger.info('Getting flexible delegation rewards...', delegatorAddr)
      return await this.api.getFlexibleDelegationRewards(delegatorAddr, layer)
    } catch (error: any) {
      this.logger.error('Failed to get flexible delegation rewards:', error)
      throw error
    }
  }

  private async resolveFixedDepositRegion(address: string) {
    const signer = await this.walletService.createDirectSecp256k1Wallet({ address })
    const meId = isEthSecp256k1DirectSigner(signer)
      ? await this.identityApi.getMeIdBySubAccount(address)
      : await this.identityApi.getMeIdByAddress(address)

    if (!meId.hasMeId || !meId.info?.regionId) {
      throw new Error(`Fixed-term staking requires an ME ID for address ${address}`)
    }
    if (meId.info.status !== 'DID_STATUS_ACTIVE') {
      throw new Error(`Fixed-term staking requires an active ME ID for address ${address}`)
    }

    return { signer, regionId: meId.info.regionId }
  }
}
