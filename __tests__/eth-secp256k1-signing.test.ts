import { afterEach, describe, expect, it, vi } from 'vitest'
import { fromBase64 } from '@cosmjs/encoding'
import { makeSignBytes, makeSignDoc, Registry } from '@cosmjs/proto-signing'
import type { SigningStargateClient } from '@cosmjs/stargate'
import { keccak_256 } from '@noble/hashes/sha3'
import * as secp256k1 from 'secp256k1'
import { WalletApi } from '../src/api/wallet'
import { getSignData } from '../src/me-client-utils'
import {
  createEthSecp256k1DirectSigner,
  ETH_SECP256K1_PUBKEY_TYPE_URL,
  signDirectWithEthSecp256k1Pubkey,
} from '../src/me-client-utils/eth-secp256k1'
import { MsgSend } from '../src/me-client-ts/cosmos.bank.v1beta1/types/cosmos/bank/v1beta1/tx'
import { AuthInfo } from '../src/me-client-ts/cosmos.tx.v1beta1/types/cosmos/tx/v1beta1/tx'

const privateKeyHex = '2b522b5191b5ed1420abfdc860146aecbe086f4397179aac28acbc9ab7eff5c7'
const ethAddress = 'me1ukskhxdz5vy2sqrvps5cgc8n720wsmqqxkrdan'

const createMessage = () => ({
  typeUrl: '/cosmos.bank.v1beta1.MsgSend',
  value: MsgSend.fromPartial({
    fromAddress: ethAddress,
    toAddress: 'me1ec50cpu4rwwpr2thku5hrhksxvkcdah3y95ehj',
    amount: [],
  }),
})

describe('Ethermint ethsecp256k1 signing', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('signs direct sign bytes with Keccak-256 for the ETH-derived address', async () => {
    const signer = createEthSecp256k1DirectSigner(
      Buffer.from(privateKeyHex, 'hex'),
      ethAddress,
      'me',
    )
    const [account] = await signer.getAccounts()
    const signDoc = makeSignDoc(
      Uint8Array.from([1, 2, 3]),
      Uint8Array.from([4, 5, 6]),
      'me-test-chain',
      7,
    )

    const result = await signer.signDirect(ethAddress, signDoc)
    const signature = fromBase64(result.signature.signature)
    const digest = keccak_256(makeSignBytes(signDoc))

    expect(account.address).toBe(ethAddress)
    expect(account.pubkey).toHaveLength(33)
    expect(signature).toHaveLength(64)
    expect(
      secp256k1.verify(Buffer.from(digest), Buffer.from(signature), Buffer.from(account.pubkey)),
    ).toBe(true)
    await expect(signer.signDirect('me1wrong', signDoc)).rejects.toThrow('not found in wallet')
  })

  it('encodes the Ethermint public-key type in AuthInfo', async () => {
    const signer = createEthSecp256k1DirectSigner(
      Buffer.from(privateKeyHex, 'hex'),
      ethAddress,
      'me',
    )
    const [account] = await signer.getAccounts()
    const txRaw = await signDirectWithEthSecp256k1Pubkey({
      signer,
      registry: new Registry(),
      address: ethAddress,
      messages: [createMessage()],
      fee: { amount: [], gas: '200000' },
      accountNumber: '7',
      sequence: '9',
      chainId: 'me-test-chain',
    })
    const authInfo = AuthInfo.decode(txRaw.authInfoBytes)
    const publicKeyAny = authInfo.signerInfos[0].publicKey

    expect(publicKeyAny?.typeUrl).toBe(ETH_SECP256K1_PUBKEY_TYPE_URL)
    expect(publicKeyAny?.value[0]).toBe(10)
    expect(publicKeyAny?.value[1]).toBe(33)
    expect(publicKeyAny?.value.slice(2)).toEqual(account.pubkey)
    expect(txRaw.signatures[0]).toHaveLength(64)
  })

  it('routes shared getSignData through the Ethermint branch', async () => {
    const signer = createEthSecp256k1DirectSigner(
      Buffer.from(privateKeyHex, 'hex'),
      ethAddress,
      'me',
    )
    vi.spyOn(WalletApi.prototype, 'getAccountInfo').mockResolvedValue({
      account: { account_number: '7', sequence: '9' },
    } as any)
    const cosmosSign = vi.fn()
    const signingClient = {
      registry: new Registry(),
      sign: cosmosSign,
    } as unknown as SigningStargateClient

    const result = await getSignData({
      signingClient,
      signer,
      address: ethAddress,
      msg: createMessage(),
      fee: { amount: [], gas: '200000' },
      chainId: 'me-test-chain',
    })
    const authInfo = AuthInfo.decode(result.rowRes!.authInfoBytes)

    expect(result.result).toBe(true)
    expect(cosmosSign).not.toHaveBeenCalled()
    expect(authInfo.signerInfos[0].publicKey?.typeUrl).toBe(ETH_SECP256K1_PUBKEY_TYPE_URL)
  })
})
