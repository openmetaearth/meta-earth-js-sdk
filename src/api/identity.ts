/**
 * Identity and sub-account API methods.
 */

import type { OfflineSigner } from '@cosmjs/proto-signing'
import { PREFIX, gas_max_set } from '../config/define'
import { txClient as kycClient } from '../me-client-ts/metaearth.kyc/module'
import type { BindSubAccountParams, Layer, MeIdInfo, MeIdLookupResult } from '../types'
import { HttpClient, HttpError } from '../utils/http-client'
import { TransactionApi } from './transaction'

type CreateSubAccountTransactionParams = BindSubAccountParams & {
  subAccountPubkey: string
}

type RawMeIdInfo = Partial<Omit<MeIdInfo, 'subAccount'>> & {
  subAccount?: string
  sub_account?: string
}

type RawMeIdResponse = {
  info?: RawMeIdInfo | null
}

const normalizeMeIdResponse = (data: RawMeIdResponse): MeIdLookupResult => {
  const info = data.info
  if (!info?.did) {
    return { hasMeId: false, info: null }
  }

  return {
    hasMeId: true,
    info: {
      did: info.did,
      address: info.address ?? '',
      pubkey: info.pubkey ?? '',
      status: info.status ?? '',
      regionId: info.regionId ?? '',
      kycLevel: info.kycLevel ?? '',
      subAccount: info.subAccount ?? info.sub_account ?? '',
    },
  }
}

const isKnownMissingMeIdError = (error: unknown, messages: readonly string[]) => {
  if (!(error instanceof HttpError)) {
    return false
  }

  const message = typeof error.data?.message === 'string' ? error.data.message : error.message
  return messages.some((candidate) => message.includes(candidate))
}

const MISSING_ME_ID_MESSAGES = ['DID not found', 'failed to get DID by sub-account'] as const

export class IdentityApi {
  constructor(private httpClient: HttpClient) {}

  /** Sign and broadcast a transaction that binds a Cosmos account to an ETH sub-account. */
  public async bindSubAccount(
    params: CreateSubAccountTransactionParams,
    signer: OfflineSigner,
  ): Promise<string> {
    const { layer = 'hub', memo = '', creator, subAccount, subAccountPubkey } = params
    const client = kycClient({ signer, prefix: PREFIX, addr: '' })
    const { tx_bytes } = await client.sendMsgCreateSubAccount({
      value: { creator, subAccount, subAccountPubkey },
      gas: gas_max_set,
      memo,
    })
    const response = await new TransactionApi(this.httpClient).sendTransaction(tx_bytes, layer)

    if (Number(response.tx_response.code) !== 0) {
      throw new Error(
        `CreateSubAccount transaction failed: ${response.tx_response.raw_log || 'unknown chain error'}`,
      )
    }

    return response.tx_response.txhash
  }

  /** Query ME ID state and the bound sub-account by a main account address. */
  public async getMeIdByAddress(address: string, layer: Layer = 'hub'): Promise<MeIdLookupResult> {
    try {
      const response = await this.httpClient.get<RawMeIdResponse>('/metaearth/did/did', {
        params: { address },
        layer,
      })
      return normalizeMeIdResponse(response.data)
    } catch (error) {
      if (isKnownMissingMeIdError(error, MISSING_ME_ID_MESSAGES)) {
        return { hasMeId: false, info: null }
      }
      throw error
    }
  }

  /** Query main and sub-account information by ME ID. */
  public async getMeIdByDid(did: string, layer: Layer = 'hub'): Promise<MeIdLookupResult> {
    try {
      const response = await this.httpClient.get<RawMeIdResponse>('/metaearth/did/didInfo', {
        params: { did },
        layer,
      })
      return normalizeMeIdResponse(response.data)
    } catch (error) {
      if (isKnownMissingMeIdError(error, MISSING_ME_ID_MESSAGES)) {
        return { hasMeId: false, info: null }
      }
      throw error
    }
  }

  /** Query the main account and ME ID bound to an ETH sub-account. */
  public async getMeIdBySubAccount(
    subAccount: string,
    layer: Layer = 'hub',
  ): Promise<MeIdLookupResult> {
    try {
      const response = await this.httpClient.get<RawMeIdResponse>(
        '/metaearth/kyc/QuerySubAccountDidResponse',
        {
          params: { sub_account: subAccount },
          layer,
        },
      )
      return normalizeMeIdResponse(response.data)
    } catch (error) {
      if (isKnownMissingMeIdError(error, MISSING_ME_ID_MESSAGES)) {
        return { hasMeId: false, info: null }
      }
      throw error
    }
  }
}
