# Meta Earth JS SDK

A TypeScript SDK for Meta Earth wallet management, Cosmos and ETH-derived accounts, transactions, ME ID, sub-accounts, staking, governance, and contracts. Supports both browser and Node.js environments.

## Feature Status

| Module | Implemented Features | Status |
| ------------ | ------------------------------------------------------------ | --------- |
| **Wallet Management** | Cosmos and ETH-derived addresses, mnemonic/private-key import, batch derivation, public-key retention, balance query | 100% |
| **Transaction** | Transfer, Cosmos/Ethermint signing, transaction query, gas simulation and fee calculation | 100% |
| **ME ID / Sub-accounts** | Bind Cosmos and ETH-derived accounts, query by address, ME ID, or sub-account | 100% |
| **Network Info** | Node version query, network status query | 100% |
| **Staking** | Flexible staking plus region-aware fixed-term deposit, withdrawal, and position queries | 100% |
| **Governance** | Query proposals, submit proposals, vote on proposals | 100% |
| **WASM Contract** | Store code, deploy contract, execute contract, query contract, query by creator/CodeID | 100% |
| **EVM Contract** | Deploy bytecode, execute methods, query methods, inspect contract bytecode and balance | Implemented* |

\* Testnet includes default EVM RPC settings. Mainnet EVM operations require explicit `evmRpcUrl` and `evmChainId` configuration.

---

## Quick Start

### Installation

```bash
npm install meta-earth-js-sdk
```

### Browser Environment (ESM)

```typescript
import { MetaEarthSDK } from 'meta-earth-js-sdk'

// Initialize SDK
const sdk = new MetaEarthSDK({
  config: {
    network: 'testnet', // 'testnet' or 'mainnet'
    debug: true,
  },
})

await sdk.initialize()

// Create wallet
const wallet = await sdk.wallet.createMnemonicWallet()
console.log('Address:', wallet.address)
// Never log or transmit wallet.mnemonic or wallet.privateKey. Store recovery material securely.

// Query balance
const balance = await sdk.wallet.getBalance(wallet.address, 'hub')
console.log('Balance:', balance)

// Transfer
const txHash = await sdk.transaction.transfer({
  fromAddress: wallet.address,
  toAddress: 'me1...',
  amount: [{ amount: '1000000', denom: 'umec' }],
  layer: 'hub',
})
console.log('Transaction Hash:', txHash)
```

### Node.js Environment

```javascript
const { MetaEarthSDK } = require('meta-earth-js-sdk')

async function main() {
  const sdk = new MetaEarthSDK({
    config: { network: 'testnet' },
  })

  await sdk.initialize()

  // Address conversion
  const meAddr = sdk.wallet.convert0xToMeAddress('0x1234...')
  console.log('ME Address:', meAddr)

  // Query node version
  const nodeInfo = await sdk.wallet.getNodeVersion('hub')
  console.log('Node Version:', nodeInfo)
}

main()
```

---

## API Documentation

### SDK Initialization

#### `new MetaEarthSDK(options?)`

Create SDK instance.

```typescript
const sdk = new MetaEarthSDK({
  config: {
    timeout?: number     // Request timeout (default: 60000ms)
    debug?: boolean      // Enable debug logs (default: false)
    network?: Network    // Network type ('testnet' / 'mainnet')
    layer?: Layer        // Default layer ('hub' / 'rollup')
    evmRpcUrl?: string   // Optional EVM JSON-RPC override
    evmChainId?: number  // Expected EVM chain ID for RPC validation
  }
})
```

#### `sdk.initialize()`

Initialize SDK. Must be called before using other methods.

```typescript
await sdk.initialize()
```

---

### Wallet Management (`sdk.wallet`)

#### `createMnemonicWallet(mnemonic?, index?, addressType?)`

Create or import a mnemonic wallet. `addressType` supports `'cosmos'` (default) and `'eth'`.

```typescript
// Generate new wallet
const wallet = await sdk.wallet.createMnemonicWallet()
// Returns: { address, addressType, publicKey, mnemonic, privateKey, ... }

// Import existing mnemonic
const wallet2 = await sdk.wallet.createMnemonicWallet('word1 word2 ...')

// Generate an ETH-derived secp256k1 address encoded with the me Bech32 prefix
const ethWallet = await sdk.wallet.createMnemonicWallet(undefined, 0, 'eth')
```

#### `createPrivateKeyWallet(privateKey, addressType?)`

Create wallet from a private key. The default remains the existing Cosmos address rule.

```typescript
const wallet = await sdk.wallet.createPrivateKeyWallet('0x...')
const ethWallet = await sdk.wallet.createPrivateKeyWallet('0x...', 'eth')
```

#### `importWallet(data)`

Import wallet (supports mnemonic or private key).

```typescript
const wallet = await sdk.wallet.importWallet({
  mnemonic: '...', // or privateKey: '...'
  addressType: 'eth',
})
```

#### `batchCreateWallets(mnemonic, count, startIndex?, addressType?)`

Derive multiple wallets from one mnemonic. `count` controls the number of returned addresses.

```typescript
const ethWallets = await sdk.wallet.batchCreateWallets('word1 word2 ...', 10, 0, 'eth')
```

Every generated wallet retains `addressType` and `publicKey`. `publicKey` is lowercase hex
without a `0x` prefix: Cosmos uses a 33-byte compressed SEC1 public key, while ETH uses the
64-byte `X || Y` coordinates without the leading `0x04`. The legacy `pubKeyAnyString` field
remains the compressed Cosmos public key for compatibility.

#### `convert0xToMeAddress(address)`

Convert 0x format address to ME address.

```typescript
const meAddr = sdk.wallet.convert0xToMeAddress('0x...')
```

#### `convertMeTo0xAddress(address)`

Convert ME address to 0x format.

```typescript
const ethAddr = sdk.wallet.convertMeTo0xAddress('me1...')
```

#### `getWalletAddresses()`

Get all addresses in current wallet.

```typescript
const addresses = sdk.wallet.getWalletAddresses()
```

#### `getBalance(address, layer?)`

Query address balance.

```typescript
const balance = await sdk.wallet.getBalance('me1...', 'hub')
```

**API Endpoint**: `/cosmos/bank/v1beta1/balances/${address}`

#### `getNodeVersion(layer?)`

Query node version info.

```typescript
const nodeVersion = await sdk.wallet.getNodeVersion('hub')
```

**API Endpoint**: `/abci_info` (RPC)

#### `getNetworkStatus(layer?)`

Query network status info.

```typescript
const status = await sdk.wallet.getNetworkStatus('hub')
```

**API Endpoint**: `/status` (RPC)

---

### Transaction Operations (`sdk.transaction`)

#### `transfer(params)`

Send transfer transaction (supports HUB and Rollup layers).

```typescript
const txHash = await sdk.transaction.transfer({
  fromAddress: 'me1...',
  toAddress: 'me1...',
  amount: [{ amount: '1000000', denom: 'umec' }],
  layer: 'hub', // or 'rollup'
})
```

Wallets created or imported with `addressType: 'eth'` automatically use Ethermint
`ethsecp256k1` direct signing: SignDoc bytes are hashed with Keccak-256 and AuthInfo embeds
`/ethermint.crypto.v1.ethsecp256k1.PubKey`. Cosmos wallets keep the existing signing path.

#### `getTransaction(hash, layer?)`

Query transaction details by hash.

```typescript
const tx = await sdk.transaction.getTransaction('ABC123...', 'hub')
```

**API Endpoint**: `/cosmos/tx/v1beta1/txs/${hash}`

#### `simulateGas(params)`

Simulate transaction to estimate Gas fees.

```typescript
const result = await sdk.transaction.simulateGas({
  tx_bytes: txBytesBase64,
})
console.log('Estimated Gas:', result.gas_info.gas_used)
```

**API Endpoint**: `/cosmos/tx/v1beta1/simulate`

#### Gas and fee calculation

Transactions that use the SDK simulation path apply the same policy as the wallet runtime:

```text
gasLimit = ceil(simulatedGas × 1.5)
fee      = ceil(gasLimit × 0.02)
```

When the calculated fee is less than or equal to `10000 umec`, the SDK uses the minimum fee plus
an integer offset from `0` to `999 umec`. Generated client method signatures retain their legacy
custom-gas argument for compatibility, but callers cannot override this shared formula.

---

### ME ID and Sub-accounts (`sdk.identity`)

#### `bindSubAccount(params)`

Bind a cached Cosmos-derived account to the ETH-derived address created from the same mnemonic
and account index. The SDK verifies that both addresses share the same compressed secp256k1
public key, serializes the Ethermint public key, simulates gas, signs, and broadcasts
`/metaearth.kyc.MsgCreateSubAccount`.

```typescript
const txHash = await sdk.identity.bindSubAccount({
  creator: cosmosWallet.address,
  subAccount: ethWallet.address,
  memo: 'Bind ETH sub-account',
})
```

#### `getMeIdByAddress(address, layer?)`

Query ME ID status and the bound sub-account by a main account address.

```typescript
const result = await sdk.identity.getMeIdByAddress('me1...')
if (result.hasMeId) {
  console.log(result.info?.did, result.info?.subAccount)
}
```

#### `getMeIdByDid(did, layer?)`

Query the main account and bound sub-account by ME ID.

```typescript
const result = await sdk.identity.getMeIdByDid('5010874248025')
```

#### `getMeIdBySubAccount(subAccount, layer?)`

Query the main account and ME ID associated with an ETH-derived sub-account.

```typescript
const result = await sdk.identity.getMeIdBySubAccount('me1...')
```

Known chain responses for missing records are returned as `{ hasMeId: false, info: null }`.
Network and unexpected protocol errors are thrown.

---

### Staking (`sdk.staking`)

All staking APIs operate on the HUB layer. Omit `layer`; rollup staking is not supported.

#### `stakeFlexible(params)`

Flexible staking (HUB layer).

```typescript
const txHash = await sdk.staking.stakeFlexible({
  address: 'me1...',
  amount: { amount: '1000000', denom: 'umec' },
})
```

#### `unstakeFlexible(params)`

Unstake flexible staking (HUB layer).

```typescript
const txHash = await sdk.staking.unstakeFlexible({
  address: 'me1...',
  amount: { amount: '1000000', denom: 'umec' },
})
```

#### `getFlexibleDelegation(delegatorAddr)`

Query flexible delegation.

```typescript
const delegation = await sdk.staking.getFlexibleDelegation('me1...')
```

**API Endpoint**: `/metaearth/wstaking/delegation/{delegator_addr}`

#### `getFlexibleDelegationRewards(delegatorAddr)`

Query flexible delegation rewards.

```typescript
const rewards = await sdk.staking.getFlexibleDelegationRewards('me1...')
```

**API Endpoint**: `/metaearth/wstaking/delegation-rewards/{delegator_address}`

#### `claimStakingReward(address)`

Claim flexible staking rewards (HUB layer).

```typescript
const txHash = await sdk.staking.claimStakingReward('me1...')
```

#### `getFixedDepositConfigs(address)`

Resolve the wallet's ME ID region and query its fixed-term options. Cosmos accounts use the
main-address ME ID lookup; ETH-derived sub-accounts use the sub-account lookup. The address must
belong to a wallet already imported into this SDK instance because its cached `addressType`
selects the lookup path.

```typescript
const { regionId, configs } = await sdk.staking.getFixedDepositConfigs('me1...')
const activeConfigs = configs.filter((config) => config.status === 'FIXED_DEPOSIT_CFG_ACTIVE')
```

**API Endpoints**:

- Cosmos account: `/metaearth/did/did?address={address}`
- ETH-derived sub-account: `/metaearth/kyc/QuerySubAccountDidResponse?sub_account={address}`
- Region options: `/metaearth/wstaking/fixed_deposit_cfg?regionIds={regionId}`

Fixed-term queries use these public data contracts:

```typescript
type FixedDepositConfigStatus =
  | 'FIXED_DEPOSIT_CFG_ACTIVE'
  | 'FIXED_DEPOSIT_CFG_INACTIVE'
  | 'UNRECOGNIZED'

type FixedDepositState = 'ALL_STATE' | 'NOT_EXPIRED' | 'EXPIRED'

interface FixedDepositConfig {
  term: number
  rate: string
  status: FixedDepositConfigStatus
}

interface FixedDepositRecord {
  id: number
  account: string
  principal?: { denom: string; amount: string }
  interest?: { denom: string; amount: string }
  startTime: string
  endTime: string
  term: number
  rate: string
}
```

`term` is measured in days. Rates and coin amounts remain strings so chain values are not rounded.
REST `start_time` and `end_time` fields are returned as `startTime` and `endTime`. Missing or blank
protocol-required fields cause the query to throw instead of returning incomplete records.

#### `stakeFixed(params)`

Create a fixed-term position after validating that the requested term is active for the wallet's
ME ID region. The SDK automatically selects standard Cosmos `secp256k1` or Ethermint
`ethsecp256k1` signing from the imported wallet's `addressType`. The principal amount must be a
positive integer string, and `term` must be a positive integer matching an active regional config.

```typescript
const txHash = await sdk.staking.stakeFixed({
  address: 'me1...',
  principal: { amount: '1000000', denom: 'umec' },
  term: 30,
  memo: 'optional memo',
})
```

#### `withdrawFixed(params)`

Submit a fixed-term withdrawal transaction. The chain validates whether the position is
withdrawable. `id` must be a positive integer.

```typescript
const txHash = await sdk.staking.withdrawFixed({
  address: 'me1...',
  id: 191,
  memo: 'optional memo',
})
```

#### `getFixedDeposits(address, state?)`

Query fixed-term positions. `state` defaults to `ALL_STATE`; use `NOT_EXPIRED` or `EXPIRED` to
filter by expiry state. This query accepts any account address and does not require an imported
wallet.

```typescript
const positions = await sdk.staking.getFixedDeposits('me1...', 'ALL_STATE')
```

**API Endpoint**: `/metaearth/wstaking/fixed_deposit_by_acct/{address}/{state}`

---

### Governance (`sdk.governance`)

#### `getProposals(status?, layer?)`

Query current proposals (HUB layer, using SDK V1 endpoint).

```typescript
import { ProposalStatus } from 'meta-earth-js-sdk'

// Query all proposals
const allProposals = await sdk.governance.getProposals()

// Query by status
const votingProposals = await sdk.governance.getProposals(
  ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD,
)
```

**API Endpoint**: `/cosmos/gov/v1/proposals`

**Supported Proposal Statuses**:

- `PROPOSAL_STATUS_UNSPECIFIED`
- `PROPOSAL_STATUS_DEPOSIT_PERIOD`
- `PROPOSAL_STATUS_VOTING_PERIOD`
- `PROPOSAL_STATUS_PASSED`
- `PROPOSAL_STATUS_REJECTED`
- `PROPOSAL_STATUS_FAILED`

#### `submitSoftwareUpgradeProposal(params)`

Submit a software upgrade proposal.

```typescript
const txHash = await sdk.governance.submitSoftwareUpgradeProposal({
  proposer: 'me1...',
  content: {
    title: 'Upgrade to v2.0.0',
    description: 'Upgrade description...',
    plan: {
      name: 'v2.0.0',
      height: 1000000,
      info: 'Upgrade details',
    },
  },
  initialDeposit: [{ denom: 'umec', amount: '100000000' }],
})
console.log('Transaction Hash:', txHash)
```

#### `voteProposal(params)`

Vote on a proposal.

```typescript
const txHash = await sdk.governance.voteProposal({
  proposalId: 1,
  voter: 'me1...',
  option: 'yes', // 'yes' | 'no' | 'abstain' | 'no_with_veto'
})
console.log('Transaction Hash:', txHash)
```

---

### WASM Contract Operations (`sdk.contract`)

#### `storeCode(params)`

Store WASM contract code on chain.

```typescript
const txHash = await sdk.contract.storeCode({
  sender: 'me1...',
  wasmByteCode: wasmBytes, // Uint8Array or base64 string
  layer: 'wasm',
})
console.log('Transaction Hash:', txHash)
```

#### `deployContract(params)`

Instantiate contract (MsgInstantiateContract).

```typescript
const txHash = await sdk.contract.deployContract({
  sender: 'me1...',
  codeId: 1,
  label: 'My Contract',
  initMsg: { name: 'Token', symbol: 'TKN' },
  admin: 'me1...', // optional
  funds: [], // optional
  layer: 'wasm',
})
```

#### `executeContract(params)`

Execute contract method (MsgExecuteContract).

```typescript
const txHash = await sdk.contract.executeContract({
  sender: 'me1...',
  contractAddress: 'me1...',
  msg: { transfer: { recipient: 'me1...', amount: '1000000' } },
  funds: [{ denom: 'umec', amount: '1000000' }], // optional
  layer: 'wasm',
})
```

#### `getCodeIdByHash(dataHash, layer?)`

Find existing Code ID on chain by WASM code SHA256 hash.

```typescript
// Calculate hash of local WASM file
const hash = 'A87926C34CF2D4C7E8D85C8F09853351207170CEDAE18AC8D69AEBEAF2864954'

// Check if code already exists on chain
const codeId = await sdk.contract.getCodeIdByHash(hash)
if (codeId) {
  console.log('Existing Code ID:', codeId)
} else {
  console.log('Need to store code first')
}
```

**API Endpoint**: `/cosmwasm/wasm/v1/code`

#### `getContractsByCodeId(codeId, layer?)`

Query all contract addresses using specified Code ID.

```typescript
const result = await sdk.contract.getContractsByCodeId(28)
console.log('Contract List:', result.contracts)
// ['me1...', 'me1...', ...]
```

**API Endpoint**: `/cosmwasm/wasm/v1/code/{code_id}/contracts`

#### `getContractsByCreator(creatorAddress, layer?)`

Query all contract addresses created by specified creator.

```typescript
const result = await sdk.contract.getContractsByCreator('me1...')
console.log('Contract List:', result.contract_addresses)
// ['me1...', 'me1...', ...]
```

**API Endpoint**: `/cosmwasm/wasm/v1/contracts/creator/{creator_address}`

#### `queryContractSmart(contractAddress, queryData, layer?)`

Query contract state (Smart Query). Query data will be automatically base64 encoded.

```typescript
// Query contract config
const result = await sdk.contract.queryContractSmart(
  'me1xnl29l92rt8y76fqvukz8al373h4ld3wwn58g6m0tazgwzgcp7mqjaypfn',
  { get_config: {} },
)
console.log('Contract Config:', result.data)

// Query specific candy info
const candy = await sdk.contract.queryContractSmart('me1...', { get_candy: { candy_id: 1 } })
console.log('Candy Info:', candy.data)
```

**API Endpoint**: `/cosmwasm/wasm/v1/contract/{contractAddress}/smart/{query_data}`

---

### EVM Contract Operations (`sdk.contract`)

EVM contract operations use Ethers.js and an EVM JSON-RPC endpoint. The testnet defaults to `http://118.175.0.249:8545` with chain ID `400`. Override both values together when using another endpoint:

```typescript
const sdk = new MetaEarthSDK({
  config: {
    network: 'testnet',
    evmRpcUrl: 'https://your-evm-rpc.example.com',
    evmChainId: 1234,
  },
})

await sdk.initialize()
```

The `sender` for deployment and state-changing calls must be an ETH-derived `me1` account already created or imported through `sdk.wallet`. Its private key stays in the wallet service and is used only for local transaction signing.

The examples below assume `ethWallet` was created or imported with `addressType: 'eth'`, while `abi` and `bytecode` come from the target contract's compiler artifact. Never hardcode production private keys in application source.

#### `deployEvmContract(params)`

Deploy compiled EVM bytecode with its ABI and constructor arguments:

```typescript
const deployment = await sdk.contract.deployEvmContract({
  sender: ethWallet.address,
  abi,
  bytecode,
  constructorArgs: ['MetaEarth Token', 'MEC', 18, '1000000'],
})

console.log('Contract Address:', deployment.contractAddress)
console.log('Transaction Hash:', deployment.transactionHash)
```

#### `executeEvmContract(params)`

Execute a state-changing method. Use the full signature when the ABI contains overloaded methods:

```typescript
const execution = await sdk.contract.executeEvmContract({
  sender: ethWallet.address,
  contractAddress: deployment.contractAddress,
  abi,
  method: 'transfer(address,uint256)',
  args: ['0xRecipient...', '1000000000000000000'],
  value: '0', // wei, optional
})

console.log('Transaction Hash:', execution.transactionHash)
```

The SDK performs an `eth_call` preflight by default before broadcasting. Set `simulate: false` only when the target method cannot be simulated safely.

#### `queryEvmContract(params)`

Call a read-only contract method through `eth_call`:

```typescript
const balance = await sdk.contract.queryEvmContract({
  contractAddress: deployment.contractAddress,
  abi,
  method: 'balanceOf',
  args: ['0xOwner...'],
})

console.log('Token Balance:', String(balance))
```

#### `getEvmContractInfo(contractAddress)`

Inspect an EVM address without an ABI:

```typescript
const info = await sdk.contract.getEvmContractInfo(deployment.contractAddress)
console.log({
  address: info.address,
  chainId: info.chainId.toString(),
  isContract: info.isContract,
  bytecode: info.bytecode,
  balance: info.balance.toString(),
  transactionCount: info.transactionCount,
})
```

An address alone can only provide RPC-level information such as bytecode and native balance. Querying contract state or methods requires the contract ABI. For deployments and writes, gas is estimated automatically and a 20% margin is applied; `gasLimit`, EIP-1559 fee fields, `nonce`, and `confirmations` can be supplied explicitly when needed.

Browser applications served over HTTPS must use an HTTPS EVM RPC endpoint; browsers block calls from an HTTPS page to the default HTTP testnet endpoint as mixed content.

---

## Utility Functions

### Environment Detection

```typescript
import { isBrowser, isNode, detectEnvironment } from 'meta-earth-js-sdk'

if (isBrowser()) {
  console.log('Running in browser')
}

console.log('Environment:', detectEnvironment()) // 'browser' or 'node'
```

### Logger

```typescript
import { Logger } from 'meta-earth-js-sdk'

const logger = new Logger({ enabled: true })
logger.info('Log message')
logger.error('Error message')
```

---

## React Demo App

The project includes a complete React + TypeScript demo application showcasing all implemented features.

### Run Demo

```bash
cd examples/react-demo
pnpm install
pnpm run dev
```

Visit http://localhost:5173

### Demo Features

- **Wallet Management Panel** - Create, import, address conversion
- **Query Panel** - Balance query, transaction query, node info
- **Transaction Panel** - HUB and Rollup layer transfers
- **Staking Panel** - Flexible staking plus fixed-term options, deposits, withdrawals, and queries
- **Governance Panel** - Query proposals (V1)
- **WASM Contract Panel** - Store code, instantiate contract, execute contract
- **EVM Contract Panel** - Deploy bytecode, execute methods, query methods, inspect addresses
- **Real-time Log System** - View all operation logs

The EVM panel includes a complete `ERC20Token.sol` example. Its ABI, Paris-compatible bytecode, and constructor arguments are preloaded. After a successful deployment, the new contract address and matching `mint`/`balanceOf` examples are copied into the Execute and Query tabs automatically.

The Solidity source and generated artifact are located under `examples/react-demo/src/evm`. `pnpm run compile:evm-example` regenerates the artifact, and both `dev` and `build` run this compilation automatically.

---

## Best Practices

### 1. Network Switching

```typescript
const sdk = new MetaEarthSDK({
  config: { network: 'testnet' }, // Default to testnet
})

await sdk.initialize()

// Switch to mainnet
sdk.setNetwork('mainnet')
```

### 2. Error Handling

```typescript
try {
  const txHash = await sdk.transaction.transfer({
    fromAddress: 'me1...',
    toAddress: 'me1...',
    amount: [{ amount: '1000000', denom: 'umec' }],
    layer: 'hub',
  })
  console.log('Transfer successful:', txHash)
} catch (error) {
  console.error('Transfer failed:', error instanceof Error ? error.message : String(error))
}
```

### 3. Debug Mode

```typescript
const sdk = new MetaEarthSDK({
  config: {
    debug: true, // Enable detailed logs
  },
})

await sdk.initialize()

// View SDK version
console.log('SDK Version:', sdk.getVersion())

// View current network
console.log('Current Network:', sdk.getCurrentNetwork())

// View environment
console.log('Environment:', sdk.getEnvironment())
```

---

## FAQ

### Q: Which networks does the SDK support?

**A**: Supports Meta Earth testnet (`testnet`) and mainnet (`mainnet`). Defaults to testnet. Testnet includes default EVM RPC settings; mainnet EVM operations require explicit `evmRpcUrl` and `evmChainId` overrides.

### Q: What is a Layer?

**A**: Meta Earth blockchain has two layers:

- `hub`: HUB layer, main chain
- `rollup`: Rollup layer, application chain

Most operations execute on the HUB layer by default.

### Q: How to get test tokens?

**A**: Please contact the Meta Earth team to obtain testnet tokens.

### Q: Can I use this in production?

**A**: Perform an application-specific security review and testnet validation before production use. Configure and verify the expected EVM RPC and chain ID explicitly for mainnet; the included EVM write workflow has not been validated through a live mainnet deployment.

### Q: What contract operations are supported?

**A**: Supports both WASM and EVM contract operations:

- `storeCode` - Store contract code
- `deployContract` - Instantiate contract
- `executeContract` - Execute contract
- `getCodeIdByHash` - Find Code ID by hash
- `deployEvmContract` - Deploy EVM bytecode with Ethers.js
- `executeEvmContract` - Sign and send an EVM contract transaction
- `queryEvmContract` - Call an EVM contract read method
- `getEvmContractInfo` - Inspect EVM bytecode, balance, and address metadata

---

## Architecture

### Module Structure

```
src/
├── sdk.ts                    # Main SDK class
├── types.ts                  # Public SDK types
├── modules/                  # Feature modules
│   ├── wallet/
│   │   └── service.ts       # Wallet service
│   ├── transaction/
│   │   └── service.ts       # Transaction service
│   ├── staking/
│   │   └── service.ts       # Staking service
│   ├── governance/
│   │   └── service.ts       # Governance service
│   ├── contract/
│   │   └── service.ts       # WASM and EVM contract service
│   └── identity/
│       └── service.ts       # ME ID and sub-account service
├── api/                     # API layer
│   ├── wallet.ts
│   ├── transaction.ts
│   ├── staking.ts
│   ├── governance.ts
│   ├── identity.ts
│   ├── contract.ts
│   ├── evm-contract.ts
│   └── types.ts             # API type definitions
├── types/                   # Type definitions
│   ├── base.ts
│   ├── wallet.ts
│   ├── transaction.ts
│   ├── staking.ts
│   ├── governance.ts
│   └── contract.ts
└── utils/                   # Utility functions
    ├── http-client.ts
    ├── logger.ts
    └── environment.ts
```

### Tech Stack

- **Language**: TypeScript 5.3+
- **Build**: Vite 5.0 + Rollup
- **Blockchain**: @cosmjs/\* (0.31.3)
- **Cryptography**: ethers.js ^6.17.0, secp256k1, bip39
- **Testing**: Vitest
- **UI Demo**: React + Ant Design 6.0

---

## Development Guide

### Install Dependencies

```bash
npm install
# or
pnpm install
```

### Build SDK

```bash
npm run build

# Output:
# - dist/index.js (ESM format)
# - dist/index.d.ts (Type declarations)
```

### Development Mode

```bash
npm run dev
```

### Run Tests

```bash
npm test
```

### Type Check

```bash
npm run type-check
```

---

## Blockchain Module Integration

SDK integrates the following blockchain modules:

### Cosmos SDK Standard Modules

- `cosmos.auth`, `cosmos.bank`, `cosmos.staking`
- `cosmos.gov`, `cosmos.distribution`, `cosmos.slashing`
- etc...

### IBC Modules

- `ibc.core.channel`, `ibc.core.client`, `ibc.core.connection`
- `ibc.applications.transfer`

### EVM Modules

- `ethermint.evm.v1`, `ethermint.feemarket.v1`

### Meta Earth Custom Modules

- `metaearth.dao`, `metaearth.did`, `metaearth.kyc`
- `metaearth.wstaking`, `metaearth.wdistri`, `metaearth.wnft`
- etc...
