/**
 * Contract Module Service
 * Contract module service - Handles all smart contract related operations
 */

import { Logger } from '../../utils/logger'
import { HttpClient } from '../../utils/http-client'
import { ContractApi } from '../../api/contract'
import { EvmContractApi } from '../../api/evm-contract'
import { WalletService } from '../wallet/service'
import type {
  StoreCodeParams,
  DeployContractParams,
  ExecuteContractParams,
  Layer,
  DeployEvmContractParams,
  ExecuteEvmContractParams,
  QueryEvmContractParams,
  EvmDeploymentResult,
  EvmExecutionResult,
  EvmContractInfo,
} from '../../types'

/**
 * Contract Service Class
 * Encapsulates all smart contract related operations
 */
export class ContractService {
  private logger: Logger
  private httpClient: HttpClient
  private api: ContractApi
  private evmApi: EvmContractApi
  private wallet: WalletService
  private ensureInitialized: () => void

  constructor(
    logger: Logger,
    httpClient: HttpClient,
    wallet: WalletService,
    ensureInitialized: () => void,
    getEvmNetworkConfig: () => { rpcUrl?: string; chainId?: number } = () => ({}),
  ) {
    this.logger = logger
    this.httpClient = httpClient
    this.wallet = wallet
    this.ensureInitialized = ensureInitialized
    this.api = new ContractApi(this.httpClient)
    this.evmApi = new EvmContractApi(getEvmNetworkConfig)
  }

  /**
   * Store smart contract code (WASM only)
   * @param params - Store code parameters (sender, wasmByteCode, etc.)
   * @returns Promise<string> Transaction hash
   */
  public async storeCode(params: StoreCodeParams): Promise<string> {
    this.ensureInitialized()

    try {
      this.logger.info('Storing contract code...', { sender: params.sender })

      const contractLayer = params.layer || 'wasm'

      if (contractLayer === 'evm') {
        throw new Error('EVM contract store code not supported yet')
      }

      // Get signer
      const signer = await this.wallet.createDirectSecp256k1Wallet({
        address: params.sender,
      })

      return await this.api.createStoreCode(params, signer)
    } catch (error: any) {
      this.logger.error('Failed to store contract code:', error)
      throw error
    }
  }

  /**
   * Deploy smart contract (WASM only)
   * @param params - Deployment parameters (codeId, initMsg, label, sender, layer, etc.)
   * @returns Promise<string> Transaction hash
   */
  public async deployContract(params: DeployContractParams): Promise<string> {
    this.ensureInitialized()

    try {
      this.logger.info('Deploying contract...', params)

      // Validate parameters
      if (!params.codeId || !params.initMsg) {
        throw new Error('codeId and initMsg are required')
      }

      const contractLayer = params.layer || 'wasm'

      if (contractLayer === 'evm') {
        throw new Error('EVM contract deployment not supported yet')
      }

      // Get signer
      const signer = await this.wallet.createDirectSecp256k1Wallet({
        address: params.sender,
      })

      return await this.api.createInstantiateContract(params, signer)
    } catch (error: any) {
      this.logger.error('Failed to deploy contract:', error)
      throw error
    }
  }

  /**
   * Execute smart contract (EVM and WASM)
   * Currently only supports WASM contract execution
   * @param params - Execution parameters (contractAddress, msg, sender, layer, etc.)
   * @returns Promise<string> Transaction hash
   */
  public async executeContract(params: ExecuteContractParams): Promise<string> {
    this.ensureInitialized()

    try {
      this.logger.info('Executing contract...', params)

      // Validate parameters
      if (!params.contractAddress || !params.msg || !params.sender) {
        throw new Error('contractAddress, msg, and sender are required')
      }

      const contractLayer = params.layer || 'wasm'

      if (contractLayer === 'evm') {
        throw new Error('EVM contract execution not supported yet')
      }

      // Get signer
      const signer = await this.wallet.createDirectSecp256k1Wallet({
        address: params.sender,
      })

      return await this.api.createExecuteContract(params, signer)
    } catch (error: any) {
      this.logger.error('Failed to execute contract:', error)
      throw error
    }
  }

  /**
   * Get code_id by WASM data hash
   * Query /cosmwasm/wasm/v1/code to find code_id matching the given data_hash
   * @param dataHash - WASM code SHA256 hash (hex string)
   * @param layer - Target layer (default 'hub')
   * @returns Promise<string | null> code_id if found, null otherwise
   */
  public async getCodeIdByHash(dataHash: string, layer: Layer = 'hub'): Promise<string | null> {
    this.ensureInitialized()

    try {
      this.logger.info('Looking up code_id by hash...', { dataHash })
      const codeId = await this.api.getCodeIdByHash(dataHash, layer)

      if (codeId) {
        this.logger.info(`Found code_id: ${codeId} for hash: ${dataHash}`)
      } else {
        this.logger.info(`No code_id found for hash: ${dataHash}`)
      }

      return codeId
    } catch (error: any) {
      this.logger.error('Failed to get code_id by hash:', error)
      throw error
    }
  }

  /**
   * Get contract addresses by Code ID
   * Query /cosmwasm/wasm/v1/code/{code_id}/contracts
   * @param codeId - Code ID
   * @param layer - Target layer (default 'hub')
   * @returns Promise<{ contracts: string[], pagination: any }>
   */
  public async getContractsByCodeId(
    codeId: number,
    layer: Layer = 'hub',
  ): Promise<{ contracts: string[]; pagination: any }> {
    this.ensureInitialized()

    try {
      this.logger.info('Getting contracts by code_id...', { codeId })
      const result = await this.api.getContractsByCodeId(codeId, layer)
      this.logger.info(`Found ${result.contracts?.length || 0} contracts for code_id: ${codeId}`)
      return result
    } catch (error: any) {
      this.logger.error('Failed to get contracts by code_id:', error)
      throw error
    }
  }

  /**
   * Get contract addresses by creator address
   * Query /cosmwasm/wasm/v1/contracts/creator/{creator_address}
   * @param creatorAddress - Creator address
   * @param layer - Target layer (default 'hub')
   * @returns Promise<{ contract_addresses: string[], pagination: any }>
   */
  public async getContractsByCreator(
    creatorAddress: string,
    layer: Layer = 'hub',
  ): Promise<{ contract_addresses: string[]; pagination: any }> {
    this.ensureInitialized()

    try {
      this.logger.info('Getting contracts by creator...', { creatorAddress })
      const result = await this.api.getContractsByCreator(creatorAddress, layer)
      this.logger.info(
        `Found ${result.contract_addresses?.length || 0} contracts for creator: ${creatorAddress}`,
      )
      return result
    } catch (error: any) {
      this.logger.error('Failed to get contracts by creator:', error)
      throw error
    }
  }

  /**
   * Query contract smart state
   * API endpoint: /cosmwasm/wasm/v1/contract/{contractAddress}/smart/{query_data}
   * @param contractAddress - Contract address
   * @param queryData - Query data object (will be base64 encoded automatically)
   * @param layer - Target layer (default 'hub')
   * @returns Promise<{ data: any }> Query result
   */
  public async queryContractSmart(
    contractAddress: string,
    queryData: any,
    layer: Layer = 'hub',
  ): Promise<{ data: any }> {
    this.ensureInitialized()

    try {
      this.logger.info('Querying contract smart...', { contractAddress, queryData })
      const result = await this.api.queryContractSmart(contractAddress, queryData, layer)
      this.logger.info('Query result:', result)
      return result
    } catch (error: any) {
      this.logger.error('Failed to query contract smart:', error)
      throw error
    }
  }

  /** Deploy an EVM contract using a cached ETH-derived account and local signing. */
  public async deployEvmContract(params: DeployEvmContractParams): Promise<EvmDeploymentResult> {
    this.ensureInitialized()
    if (!params.sender || !params.abi || !params.bytecode) {
      throw new Error('sender, abi, and bytecode are required')
    }

    try {
      this.logger.info('Deploying EVM contract...', { sender: params.sender })
      const provider = await this.evmApi.getProvider()
      const signer = await this.wallet.createEvmWallet(params.sender, provider)
      return await this.evmApi.deployContract(params, signer)
    } catch (error) {
      this.logger.error('Failed to deploy EVM contract:', error)
      throw error
    }
  }

  /** Execute a state-changing EVM contract method using local signing. */
  public async executeEvmContract(params: ExecuteEvmContractParams): Promise<EvmExecutionResult> {
    this.ensureInitialized()
    if (!params.sender || !params.contractAddress || !params.abi || !params.method) {
      throw new Error('sender, contractAddress, abi, and method are required')
    }

    try {
      this.logger.info('Executing EVM contract...', {
        sender: params.sender,
        contractAddress: params.contractAddress,
        method: params.method,
      })
      const provider = await this.evmApi.getProvider()
      const signer = await this.wallet.createEvmWallet(params.sender, provider)
      return await this.evmApi.executeContract(params, signer)
    } catch (error) {
      this.logger.error('Failed to execute EVM contract:', error)
      throw error
    }
  }

  /** Query an EVM contract method through eth_call. */
  public async queryEvmContract(params: QueryEvmContractParams): Promise<unknown> {
    this.ensureInitialized()
    if (!params.contractAddress || !params.abi || !params.method) {
      throw new Error('contractAddress, abi, and method are required')
    }

    try {
      return await this.evmApi.queryContract(params)
    } catch (error) {
      this.logger.error('Failed to query EVM contract:', error)
      throw error
    }
  }

  /** Query address-level EVM contract information without requiring an ABI. */
  public async getEvmContractInfo(contractAddress: string): Promise<EvmContractInfo> {
    this.ensureInitialized()
    if (!contractAddress) {
      throw new Error('contractAddress is required')
    }

    try {
      return await this.evmApi.getContractInfo(contractAddress)
    } catch (error) {
      this.logger.error('Failed to get EVM contract info:', error)
      throw error
    }
  }

  public destroy(): void {
    this.evmApi.destroy()
  }
}
