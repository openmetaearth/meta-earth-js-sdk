import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdentityApi } from '../src/api/identity'
import { TransactionApi } from '../src/api/transaction'
import { ETH_SECP256K1_PUBKEY_TYPE_URL } from '../src/me-client-utils/eth-secp256k1'
import { IdentityService } from '../src/modules/identity/service'
import { HttpError, type HttpClient } from '../src/utils/http-client'

const kycMocks = vi.hoisted(() => ({
  sendMsgCreateSubAccount: vi.fn().mockResolvedValue({ tx_bytes: 'sub-account-bytes' }),
}))

vi.mock('../src/me-client-ts/metaearth.kyc/module', () => ({
  txClient: () => ({
    sendMsgCreateSubAccount: kycMocks.sendMsgCreateSubAccount,
  }),
}))

describe('Identity API and service', () => {
  const creator = 'me1creator'
  const subAccount = 'me1subaccount'
  const compressedPublicKey = Uint8Array.from([2, ...new Array(32).fill(7)])
  const signer = {
    getAccounts: vi
      .fn()
      .mockResolvedValue([{ address: creator, algo: 'secp256k1', pubkey: compressedPublicKey }]),
  } as any

  let httpClient: HttpClient

  beforeEach(() => {
    vi.clearAllMocks()
    httpClient = {
      get: vi.fn(),
      post: vi.fn(),
    } as any
  })

  it('normalizes address lookup results and the snake-case sub-account field', async () => {
    vi.mocked(httpClient.get).mockResolvedValue({
      data: {
        info: {
          did: '5010874248025',
          address: creator,
          pubkey: 'pubkey-json',
          status: 'DID_STATUS_ACTIVE',
          regionId: 'me_earth',
          kycLevel: 'KYC_LEVEL_TWO',
          sub_account: subAccount,
        },
      },
    } as any)
    const api = new IdentityApi(httpClient)

    const result = await api.getMeIdByAddress(creator, 'rollup')

    expect(result.hasMeId).toBe(true)
    expect(result.info?.subAccount).toBe(subAccount)
    expect(httpClient.get).toHaveBeenCalledWith('/metaearth/did/did', {
      params: { address: creator },
      layer: 'rollup',
    })
  })

  it('returns an explicit missing result for every ME ID lookup', async () => {
    vi.mocked(httpClient.get).mockRejectedValue(
      new HttpError('request failed', 500, 'Internal Server Error', {
        code: 2,
        message: 'codespace did code 111: DID not found',
      }),
    )
    const api = new IdentityApi(httpClient)

    const missingResult = {
      hasMeId: false,
      info: null,
    }
    await expect(api.getMeIdByAddress(creator)).resolves.toEqual(missingResult)
    await expect(api.getMeIdByDid('9999999999999')).resolves.toEqual(missingResult)
    await expect(api.getMeIdBySubAccount(subAccount)).resolves.toEqual(missingResult)
  })

  it('uses the documented sub-account lookup route and query name', async () => {
    vi.mocked(httpClient.get).mockResolvedValue({ data: { info: null } } as any)
    const api = new IdentityApi(httpClient)

    await api.getMeIdBySubAccount(subAccount)

    expect(httpClient.get).toHaveBeenCalledWith('/metaearth/kyc/QuerySubAccountDidResponse', {
      params: { sub_account: subAccount },
      layer: 'hub',
    })
  })

  it('broadcasts the CreateSubAccount transaction on the selected layer', async () => {
    vi.spyOn(TransactionApi.prototype, 'sendTransaction').mockResolvedValue({
      tx_response: { code: 0, txhash: '0xbind' },
    } as any)
    const api = new IdentityApi(httpClient)

    const hash = await api.bindSubAccount(
      {
        creator,
        subAccount,
        subAccountPubkey: 'pubkey-json',
        layer: 'rollup',
      },
      signer,
    )

    expect(hash).toBe('0xbind')
    expect(kycMocks.sendMsgCreateSubAccount).toHaveBeenCalledWith({
      value: { creator, subAccount, subAccountPubkey: 'pubkey-json' },
      gas: '500000',
      memo: '',
    })
    expect(TransactionApi.prototype.sendTransaction).toHaveBeenCalledWith(
      'sub-account-bytes',
      'rollup',
    )
  })

  it('derives the Ethermint public-key payload from matching cached accounts', async () => {
    const walletService = {
      exportWallet: vi.fn(async (address: string) => ({
        address,
        addressType: address === creator ? 'cosmos' : 'eth',
      })),
      createDirectSecp256k1Wallet: vi.fn(async ({ address }: { address: string }) => ({
        getAccounts: vi
          .fn()
          .mockResolvedValue([{ address, algo: 'secp256k1', pubkey: compressedPublicKey }]),
      })),
    } as any
    const service = new IdentityService(
      { info: vi.fn(), error: vi.fn() } as any,
      httpClient,
      walletService,
      vi.fn(),
    )
    const bindSpy = vi.spyOn(IdentityApi.prototype, 'bindSubAccount').mockResolvedValue('0xbind')

    await expect(service.bindSubAccount({ creator, subAccount })).resolves.toBe('0xbind')

    const transactionParams = bindSpy.mock.calls[0][0]
    expect(JSON.parse(transactionParams.subAccountPubkey)).toEqual({
      '@type': ETH_SECP256K1_PUBKEY_TYPE_URL,
      key: Buffer.from(compressedPublicKey).toString('base64'),
    })
  })

  it('rejects accounts that do not share the same secp256k1 key', async () => {
    const walletService = {
      exportWallet: vi.fn(async (address: string) => ({
        address,
        addressType: address === creator ? 'cosmos' : 'eth',
      })),
      createDirectSecp256k1Wallet: vi.fn(async ({ address }: { address: string }) => ({
        getAccounts: vi.fn().mockResolvedValue([
          {
            address,
            algo: 'secp256k1',
            pubkey:
              address === creator
                ? compressedPublicKey
                : Uint8Array.from([3, ...new Array(32).fill(8)]),
          },
        ]),
      })),
    } as any
    const service = new IdentityService(
      { info: vi.fn(), error: vi.fn() } as any,
      httpClient,
      walletService,
      vi.fn(),
    )

    await expect(service.bindSubAccount({ creator, subAccount })).rejects.toThrow(
      'must share the same secp256k1 public key',
    )
  })
})
