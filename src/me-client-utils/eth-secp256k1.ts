import { encodeSecp256k1Signature, type StdFee } from '@cosmjs/amino'
import { fromBase64, toBech32 } from '@cosmjs/encoding'
import {
  makeAuthInfoBytes,
  makeSignBytes,
  makeSignDoc,
  type EncodeObject,
  type OfflineDirectSigner,
  type OfflineSigner,
  type Registry,
} from '@cosmjs/proto-signing'
import { keccak_256 } from '@noble/hashes/sha3'
import _m0 from 'protobufjs/minimal'
import * as secp256k1 from 'secp256k1'
import { TxRaw } from '../me-client-ts/cosmos.tx.v1beta1/types/cosmos/tx/v1beta1/tx'

export const ETH_SECP256K1_PUBKEY_TYPE_URL = '/ethermint.crypto.v1.ethsecp256k1.PubKey'

export type EthSecp256k1DirectSigner = OfflineDirectSigner & {
  readonly publicKeyTypeUrl: typeof ETH_SECP256K1_PUBKEY_TYPE_URL
}

export const isEthSecp256k1DirectSigner = (
  signer: OfflineSigner | undefined,
): signer is EthSecp256k1DirectSigner =>
  typeof signer === 'object' &&
  signer !== null &&
  (signer as Partial<EthSecp256k1DirectSigner>).publicKeyTypeUrl === ETH_SECP256K1_PUBKEY_TYPE_URL

/** Build a direct signer whose address and digest rules match Ethermint ethsecp256k1 accounts. */
export const createEthSecp256k1DirectSigner = (
  privateKey: Uint8Array,
  address: string,
  prefix: string,
): EthSecp256k1DirectSigner => {
  const privateKeyBuffer = Buffer.from(privateKey)
  if (!secp256k1.privateKeyVerify(privateKeyBuffer)) {
    throw new Error('Invalid secp256k1 private key')
  }

  const compressedPublicKey = Buffer.from(secp256k1.publicKeyCreate(privateKeyBuffer, true))
  const uncompressedPublicKey = secp256k1.publicKeyCreate(privateKeyBuffer, false)
  const expectedAddress = toBech32(prefix, keccak_256(uncompressedPublicKey.slice(1)).slice(-20))
  if (expectedAddress !== address) {
    throw new Error(`Private key does not match ETH-derived address ${address}`)
  }

  return {
    publicKeyTypeUrl: ETH_SECP256K1_PUBKEY_TYPE_URL,
    getAccounts: async () => [
      {
        algo: 'secp256k1' as const,
        address,
        pubkey: compressedPublicKey,
      },
    ],
    signDirect: async (signerAddress, signDoc) => {
      if (signerAddress !== address) {
        throw new Error(`Address ${signerAddress} not found in wallet`)
      }

      const digest = Buffer.from(keccak_256(makeSignBytes(signDoc)))
      const { signature } = secp256k1.sign(digest, privateKeyBuffer)
      return {
        signed: signDoc,
        signature: encodeSecp256k1Signature(compressedPublicKey, signature),
      }
    },
  }
}

/** Encode the standard secp256k1 PubKey message under Ethermint's public-key type URL. */
const encodeEthSecp256k1Pubkey = (publicKey: Uint8Array) => {
  if (publicKey.length !== 33) {
    throw new Error(`Invalid compressed secp256k1 public key length: ${publicKey.length}`)
  }

  return {
    typeUrl: ETH_SECP256K1_PUBKEY_TYPE_URL,
    value: _m0.Writer.create().uint32(10).bytes(publicKey).finish(),
  }
}

const toSafeInteger = (value: string | number, field: string): number => {
  const result = Number(value)
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error(`Invalid ${field}: ${String(value)}`)
  }
  return result
}

/** Build a TxRaw whose AuthInfo and signature both follow Ethermint ethsecp256k1 rules. */
export const signDirectWithEthSecp256k1Pubkey = async ({
  signer,
  registry,
  address,
  messages,
  fee,
  memo = '',
  accountNumber,
  sequence,
  chainId,
}: {
  signer: EthSecp256k1DirectSigner
  registry: Registry
  address: string
  messages: readonly EncodeObject[]
  fee: StdFee
  memo?: string
  accountNumber: string | number
  sequence: string | number
  chainId: string
}): Promise<TxRaw> => {
  const account = (await signer.getAccounts()).find((item) => item.address === address)
  if (!account) {
    throw new Error('Failed to retrieve account from signer')
  }

  const txBodyBytes = registry.encode({
    typeUrl: '/cosmos.tx.v1beta1.TxBody',
    value: { messages, memo },
  })
  const authInfoBytes = makeAuthInfoBytes(
    [
      {
        pubkey: encodeEthSecp256k1Pubkey(account.pubkey),
        sequence: toSafeInteger(sequence, 'sequence'),
      },
    ],
    fee.amount,
    toSafeInteger(fee.gas, 'gas'),
    fee.granter,
    fee.payer,
  )
  const signDoc = makeSignDoc(
    txBodyBytes,
    authInfoBytes,
    chainId,
    toSafeInteger(accountNumber, 'account number'),
  )
  const { signature, signed } = await signer.signDirect(address, signDoc)

  return TxRaw.fromPartial({
    bodyBytes: signed.bodyBytes,
    authInfoBytes: signed.authInfoBytes,
    signatures: [fromBase64(signature.signature)],
  })
}
