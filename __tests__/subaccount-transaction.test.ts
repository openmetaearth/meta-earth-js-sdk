import { afterEach, describe, expect, it, vi } from 'vitest'
import { fromBase64 } from '@cosmjs/encoding'
import { DirectSecp256k1Wallet } from '@cosmjs/proto-signing'
import { TransactionApi } from '../src/api/transaction'
import { WalletApi } from '../src/api/wallet'
import { MsgCreateSubAccount, registry, txClient } from '../src/me-client-ts/metaearth.kyc/module'
import { AuthInfo, TxRaw } from '../src/me-client-ts/cosmos.tx.v1beta1/types/cosmos/tx/v1beta1/tx'

const messageValue = {
  creator: 'me1creator',
  subAccount: 'me1subaccount',
  subAccountPubkey: '{"@type":"/ethermint.crypto.v1.ethsecp256k1.PubKey","key":"compressed-key"}',
}

describe('CreateSubAccount transaction', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers and encodes the chain message schema', () => {
    const encoded = registry.encode({
      typeUrl: '/metaearth.kyc.MsgCreateSubAccount',
      value: MsgCreateSubAccount.fromPartial(messageValue),
    })

    expect(MsgCreateSubAccount.decode(encoded)).toEqual(messageValue)
  })

  it('simulates gas and signs with the calculated fee and gas limit', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42)
    vi.spyOn(WalletApi.prototype, 'getAccountInfo').mockResolvedValue({
      account: { account_number: '7', sequence: '9' },
    } as any)
    vi.spyOn(TransactionApi.prototype, 'simulateGas').mockResolvedValue({
      gas_info: { gas_used: '100000', gas_wanted: '500000' },
      result: { data: '', log: '', events: [] },
    })
    const signer = await DirectSecp256k1Wallet.fromKey(
      Buffer.from('2b522b5191b5ed1420abfdc860146aecbe086f4397179aac28acbc9ab7eff5c7', 'hex'),
      'me',
    )
    const [account] = await signer.getAccounts()
    const client = txClient({ signer, prefix: 'me', addr: '' })

    const { tx_bytes } = await client.sendMsgCreateSubAccount({
      value: { ...messageValue, creator: account.address },
    })
    const txRaw = TxRaw.decode(fromBase64(tx_bytes))
    const authInfo = AuthInfo.decode(txRaw.authInfoBytes)

    expect(authInfo.fee?.gasLimit).toBe(150000)
    expect(authInfo.fee?.amount).toEqual([{ denom: 'umec', amount: '10420' }])
  })
})
