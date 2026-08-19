import { MsgSubmitProposal } from './me-client-ts/cosmos.gov.v1beta1/module'
import type { BigNumberish, BlockTag, BytesLike, InterfaceAbi, TransactionReceipt } from 'ethers'

/**
 * Network Type
 */
export type Network = 'testnet' | 'mainnet'

/**
 * Layer Type
 */
export type Layer = 'hub' | 'rollup'

/**
 * Contract Layer Type
 */
export type ContractLayer = 'evm' | 'wasm'

/**
 * Wallet address derivation type
 */
export type WalletAddressType = 'cosmos' | 'eth'

/**
 * SDK Configuration Interface
 */
export interface SDKConfig {
  timeout?: number
  debug?: boolean
  network?: Network
  layer?: Layer
  /** Optional EVM JSON-RPC override. */
  evmRpcUrl?: string
  /** Expected EVM chain ID used to reject a mismatched RPC endpoint. */
  evmChainId?: number
}

/**
 * Environment Type
 */
export type Environment = 'browser' | 'node' | 'unknown'

/**
 * SDK Options
 */
export interface SDKOptions {
  config?: SDKConfig
}

/**
 * Wallet Information
 */
export interface WalletInfo {
  mnemonic?: string
  privateKey?: string
  privateKeyBuffer?: Buffer
  publicKey?: string
  addressType?: WalletAddressType
  address?: string
  index?: number
}

/**
 * Coin
 */
export interface Coin {
  denom: string
  amount: string
}

/**
 * Transfer Parameters
 */
export interface TransferParams {
  fromAddress: string
  toAddress: string
  amount: Coin[]
  gas?: string
  layer?: Layer
  memo?: string
}

/**
 * Parameters for binding a Cosmos account to its ETH-derived sub-account.
 */
export interface BindSubAccountParams {
  creator: string
  subAccount: string
  memo?: string
  layer?: Layer
}

/**
 * ME ID information returned by the chain REST API.
 */
export interface MeIdInfo {
  did: string
  address: string
  pubkey: string
  status: string
  regionId: string
  kycLevel: string
  subAccount: string
}

/**
 * ME ID lookup result. Network and protocol errors are still thrown.
 */
export interface MeIdLookupResult {
  hasMeId: boolean
  info: MeIdInfo | null
}

/**
 * Flexible Staking Parameters
 */
export interface FlexibleStakingParams {
  address: string
  amount: Coin
  layer?: Layer
}

/**
 * Proposal Parameters
 * Based on cosmos.gov.v1 MsgSubmitProposal structure
 */
export interface ProposalParams {
  /** Proposer address */
  proposer: string
  /** Initial deposit amount */
  // Default: 100000000 umec
  initialDeposit: Coin[]
  /** Memo for the transaction */
  memo?: string
  /** Upgrade plan for software_upgrade proposals */
  content: SoftwareUpgradeProposalParams
  /** Target layer */
  layer?: Layer
}

export interface SoftwareUpgradeProposalParams {
  /** Proposal title */
  title: string
  /** Proposal description */
  description: string
  /** Proposal plan */
  plan: {
    name: string // Upgrade version name
    height: string | number // Upgrade block height
    time?: string // Upgrade time
    info?: string // Upgrade info
    upgradedClientState?: any // Upgraded client state
  }
}

// Override content type for SoftwareUpgradeProposal
export interface SoftwareUpgradeProposalMsg extends Omit<MsgSubmitProposal, 'content'> {
  content: SoftwareUpgradeProposalParams
}

/**
 * Vote Parameters
 */
export interface VoteParams {
  proposalId: number
  voter: string
  option: 'yes' | 'no' | 'abstain' | 'no_with_veto'
  metadata?: string
  layer?: Layer
}

/**
 * Contract Deployment Parameters
 */
export interface DeployContractParams {
  sender: string
  codeId: number
  initMsg: any
  label?: string
  funds?: { denom: string; amount: string }[]
  admin?: string
  layer?: ContractLayer
  networkLayer?: Layer
}

/**
 * Contract Execution Parameters
 */
export interface ExecuteContractParams {
  contractAddress: string
  msg: any
  sender: string
  funds?: { denom: string; amount: string }[]
  layer?: ContractLayer
  networkLayer?: Layer
}

/**
 * Store Code Parameters
 */
export interface StoreCodeParams {
  sender: string
  wasmByteCode: string | Uint8Array
  instantiatePermission?: any
  layer?: ContractLayer
  networkLayer?: Layer
}

/**
 * Common EVM transaction overrides. Amounts use wei-compatible BigNumberish values.
 */
export interface EvmTransactionOptions {
  value?: BigNumberish
  gasLimit?: BigNumberish
  maxFeePerGas?: BigNumberish
  maxPriorityFeePerGas?: BigNumberish
  nonce?: number
  confirmations?: number
}

/**
 * EVM contract deployment parameters.
 */
export interface DeployEvmContractParams extends EvmTransactionOptions {
  /** Cached me1 ETH-derived account used for local signing. */
  sender: string
  abi: InterfaceAbi
  bytecode: BytesLike | { object: string }
  constructorArgs?: readonly unknown[]
}

/**
 * EVM contract state-changing method parameters.
 */
export interface ExecuteEvmContractParams extends EvmTransactionOptions {
  /** Cached me1 ETH-derived account used for local signing. */
  sender: string
  contractAddress: string
  abi: InterfaceAbi
  /** Use a full signature such as transfer(address,uint256) for overloaded methods. */
  method: string
  args?: readonly unknown[]
  /** Run an eth_call preflight before broadcasting, enabled by default. */
  simulate?: boolean
}

/**
 * Read-only EVM contract method parameters.
 */
export interface QueryEvmContractParams {
  contractAddress: string
  abi: InterfaceAbi
  method: string
  args?: readonly unknown[]
  blockTag?: BlockTag
}

export interface EvmDeploymentResult {
  contractAddress: string
  transactionHash: string
  receipt: TransactionReceipt
}

export interface EvmExecutionResult {
  transactionHash: string
  receipt: TransactionReceipt
}

export interface EvmContractInfo {
  address: string
  chainId: bigint
  isContract: boolean
  bytecode: string
  balance: bigint
  transactionCount: number
}

/**
 * Balance Information
 */
export interface BalanceInfo {
  amount: string
  denom: string
}
