/**
 * Identity Module Service
 * Handles ME ID queries and Cosmos-to-ETH sub-account binding.
 */

import { toBase64 } from '@cosmjs/encoding'
import type { Logger } from '../../utils/logger'
import type { HttpClient } from '../../utils/http-client'
import { IdentityApi } from '../../api/identity'
import type { BindSubAccountParams, Layer, MeIdLookupResult } from '../../types'
import { ETH_SECP256K1_PUBKEY_TYPE_URL } from '../../me-client-utils/eth-secp256k1'
import type { WalletService } from '../wallet/service'

const requireNonEmpty = (value: string, field: string) => {
  if (!value.trim()) {
    throw new Error(`${field} is required`)
  }
}

export class IdentityService {
  private api: IdentityApi

  constructor(
    private logger: Logger,
    httpClient: HttpClient,
    private walletService: WalletService,
    private ensureInitialized: () => void,
  ) {
    this.api = new IdentityApi(httpClient)
  }

  /** Bind cached Cosmos and ETH-derived accounts that share the same secp256k1 key. */
  public async bindSubAccount(params: BindSubAccountParams): Promise<string> {
    this.ensureInitialized()
    requireNonEmpty(params.creator, 'creator')
    requireNonEmpty(params.subAccount, 'subAccount')

    try {
      const [creatorWallet, subAccountWallet] = await Promise.all([
        this.walletService.exportWallet(params.creator),
        this.walletService.exportWallet(params.subAccount),
      ])
      if ((creatorWallet.addressType ?? 'cosmos') !== 'cosmos') {
        throw new Error('creator must be a Cosmos-derived account')
      }
      if (subAccountWallet.addressType !== 'eth') {
        throw new Error('subAccount must be an ETH-derived account')
      }

      const [creatorSigner, subAccountSigner] = await Promise.all([
        this.walletService.createDirectSecp256k1Wallet({ address: params.creator }),
        this.walletService.createDirectSecp256k1Wallet({ address: params.subAccount }),
      ])
      const [creatorSignerAccount] = await creatorSigner.getAccounts()
      const [subAccountSignerAccount] = await subAccountSigner.getAccounts()
      if (!creatorSignerAccount || !subAccountSignerAccount) {
        throw new Error('Unable to load binding account public keys')
      }
      if (
        !Buffer.from(creatorSignerAccount.pubkey).equals(
          Buffer.from(subAccountSignerAccount.pubkey),
        )
      ) {
        throw new Error('creator and subAccount must share the same secp256k1 public key')
      }

      const subAccountPubkey = JSON.stringify({
        '@type': ETH_SECP256K1_PUBKEY_TYPE_URL,
        key: toBase64(subAccountSignerAccount.pubkey),
      })
      this.logger.info('Binding ETH-derived sub-account...', {
        creator: params.creator,
        subAccount: params.subAccount,
        layer: params.layer ?? 'hub',
      })

      return await this.api.bindSubAccount({ ...params, subAccountPubkey }, creatorSigner)
    } catch (error) {
      this.logger.error('Failed to bind ETH-derived sub-account:', error)
      throw error
    }
  }

  /** Query ME ID state and the bound sub-account by a main account address. */
  public async getMeIdByAddress(address: string, layer: Layer = 'hub'): Promise<MeIdLookupResult> {
    this.ensureInitialized()
    requireNonEmpty(address, 'address')
    return this.api.getMeIdByAddress(address, layer)
  }

  /** Query main and sub-account information by ME ID. */
  public async getMeIdByDid(did: string, layer: Layer = 'hub'): Promise<MeIdLookupResult> {
    this.ensureInitialized()
    requireNonEmpty(did, 'did')
    return this.api.getMeIdByDid(did, layer)
  }

  /** Query the main account and ME ID bound to an ETH sub-account. */
  public async getMeIdBySubAccount(
    subAccount: string,
    layer: Layer = 'hub',
  ): Promise<MeIdLookupResult> {
    this.ensureInitialized()
    requireNonEmpty(subAccount, 'subAccount')
    return this.api.getMeIdBySubAccount(subAccount, layer)
  }
}
