/**
 * EVM contract runtime backed by an ethers JSON-RPC provider.
 */

import {
  Contract,
  ContractFactory,
  JsonRpcProvider,
  getAddress,
  type Signer,
  type TransactionRequest,
  type TransactionResponse,
} from 'ethers'
import type {
  DeployEvmContractParams,
  EvmContractInfo,
  EvmDeploymentResult,
  EvmExecutionResult,
  EvmTransactionOptions,
  ExecuteEvmContractParams,
  QueryEvmContractParams,
} from '../types'

const GAS_LIMIT_NUMERATOR = 120n
const GAS_LIMIT_DENOMINATOR = 100n

type EvmNetworkConfig = {
  rpcUrl?: string
  chainId?: number
}

const getConfirmations = (value: number | undefined) => {
  const confirmations = value ?? 1
  if (!Number.isInteger(confirmations) || confirmations < 1) {
    throw new Error('confirmations must be a positive integer')
  }
  return confirmations
}

const addGasMargin = (estimate: bigint) =>
  (estimate * GAS_LIMIT_NUMERATOR + GAS_LIMIT_DENOMINATOR - 1n) / GAS_LIMIT_DENOMINATOR

const toTransactionOverrides = (params: EvmTransactionOptions): TransactionRequest => {
  const overrides: TransactionRequest = {}
  if (params.value !== undefined) overrides.value = params.value
  if (params.gasLimit !== undefined) overrides.gasLimit = params.gasLimit
  if (params.maxFeePerGas !== undefined) overrides.maxFeePerGas = params.maxFeePerGas
  if (params.maxPriorityFeePerGas !== undefined) {
    overrides.maxPriorityFeePerGas = params.maxPriorityFeePerGas
  }
  if (params.nonce !== undefined) overrides.nonce = params.nonce
  return overrides
}

const waitForReceipt = async (transaction: TransactionResponse, confirmations: number) => {
  const receipt = await transaction.wait(confirmations)
  if (!receipt) {
    throw new Error(`Transaction ${transaction.hash} was not mined`)
  }
  return receipt
}

export class EvmContractApi {
  private provider: JsonRpcProvider | null = null
  private providerUrl = ''

  constructor(private getNetworkConfig: () => EvmNetworkConfig) {}

  /** Return a validated provider and recreate it when the configured RPC URL changes. */
  public async getProvider(): Promise<JsonRpcProvider> {
    const config = this.getNetworkConfig()
    const rpcUrl = config.rpcUrl?.trim()
    if (!rpcUrl) {
      throw new Error('EVM RPC URL is not configured for the selected network')
    }

    if (!this.provider || this.providerUrl !== rpcUrl) {
      this.provider?.destroy()
      this.provider = new JsonRpcProvider(rpcUrl)
      this.providerUrl = rpcUrl
    }

    const network = await this.provider.getNetwork()
    if (config.chainId !== undefined && network.chainId !== BigInt(config.chainId)) {
      throw new Error(
        `EVM chain ID mismatch: expected ${config.chainId}, received ${network.chainId.toString()}`,
      )
    }

    return this.provider
  }

  public destroy(): void {
    this.provider?.destroy()
    this.provider = null
    this.providerUrl = ''
  }

  public async deployContract(
    params: DeployEvmContractParams,
    signer: Signer,
  ): Promise<EvmDeploymentResult> {
    const factory = new ContractFactory(params.abi, params.bytecode, signer)
    const constructorArgs = [...(params.constructorArgs ?? [])]
    const requestedOverrides = toTransactionOverrides(params)
    let gasLimit = params.gasLimit

    if (gasLimit === undefined) {
      const deployRequest = await factory.getDeployTransaction(
        ...([...constructorArgs, requestedOverrides] as any[]),
      )
      gasLimit = addGasMargin(await signer.estimateGas(deployRequest))
    }

    const contract = await factory.deploy(
      ...([...constructorArgs, { ...requestedOverrides, gasLimit }] as any[]),
    )
    await contract.waitForDeployment()
    const deploymentTransaction = contract.deploymentTransaction()
    if (!deploymentTransaction) {
      throw new Error('EVM deployment transaction is unavailable')
    }
    const receipt = await waitForReceipt(
      deploymentTransaction,
      getConfirmations(params.confirmations),
    )

    return {
      contractAddress: await contract.getAddress(),
      transactionHash: deploymentTransaction.hash,
      receipt,
    }
  }

  public async executeContract(
    params: ExecuteEvmContractParams,
    signer: Signer,
  ): Promise<EvmExecutionResult> {
    const contract = new Contract(getAddress(params.contractAddress), params.abi, signer)
    const method = contract.getFunction(params.method)
    const args = [...(params.args ?? [])]
    const requestedOverrides = toTransactionOverrides(params)

    if (params.simulate !== false) {
      await method.staticCall(...args, requestedOverrides)
    }

    let gasLimit = params.gasLimit
    if (gasLimit === undefined) {
      gasLimit = addGasMargin(await method.estimateGas(...args, requestedOverrides))
    }

    const transaction = await method.send(...args, { ...requestedOverrides, gasLimit })
    const receipt = await waitForReceipt(transaction, getConfirmations(params.confirmations))
    return { transactionHash: transaction.hash, receipt }
  }

  public async queryContract(params: QueryEvmContractParams): Promise<unknown> {
    const provider = await this.getProvider()
    const contract = new Contract(getAddress(params.contractAddress), params.abi, provider)
    const method = contract.getFunction(params.method)
    const args = [...(params.args ?? [])]
    if (params.blockTag === undefined) {
      return method.staticCall(...args)
    }
    return method.staticCall(...args, { blockTag: params.blockTag })
  }

  public async getContractInfo(contractAddress: string): Promise<EvmContractInfo> {
    const provider = await this.getProvider()
    const address = getAddress(contractAddress)
    const [network, bytecode, balance, transactionCount] = await Promise.all([
      provider.getNetwork(),
      provider.getCode(address),
      provider.getBalance(address),
      provider.getTransactionCount(address),
    ])

    return {
      address,
      chainId: network.chainId,
      isContract: bytecode !== '0x',
      bytecode,
      balance,
      transactionCount,
    }
  }
}
