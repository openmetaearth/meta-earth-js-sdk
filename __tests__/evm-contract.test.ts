import { afterEach, describe, expect, it, vi } from 'vitest'
import { Contract, ContractFactory, JsonRpcProvider } from 'ethers'
import { EvmContractApi } from '../src/api/evm-contract'
import { ContractService } from '../src/modules/contract/service'

const contractAddress = '0x1111111111111111111111111111111111111111'

describe('EVM contract runtime', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('validates the configured EVM chain ID', async () => {
    vi.spyOn(JsonRpcProvider.prototype, 'getNetwork').mockResolvedValue({ chainId: 2405n } as any)
    const api = new EvmContractApi(() => ({
      rpcUrl: 'http://localhost:8545',
      chainId: 2404,
    }))

    await expect(api.getProvider()).rejects.toThrow(
      'EVM chain ID mismatch: expected 2404, received 2405',
    )
    api.destroy()
  })

  it('deploys with a 20 percent gas margin and waits for a receipt', async () => {
    const receipt = { hash: '0xreceipt' }
    const transaction = {
      hash: '0xdeploy',
      wait: vi.fn().mockResolvedValue(receipt),
    }
    const contract = {
      waitForDeployment: vi.fn().mockResolvedValue(undefined),
      deploymentTransaction: vi.fn().mockReturnValue(transaction),
      getAddress: vi.fn().mockResolvedValue(contractAddress),
    }
    const getDeployTransaction = vi
      .spyOn(ContractFactory.prototype, 'getDeployTransaction')
      .mockResolvedValue({} as any)
    const deploy = vi.spyOn(ContractFactory.prototype, 'deploy').mockResolvedValue(contract as any)
    const signer = {
      estimateGas: vi.fn().mockResolvedValue(100000n),
    } as any
    const api = new EvmContractApi(() => ({}))

    const result = await api.deployContract(
      {
        sender: 'me1sender',
        abi: [],
        bytecode: '0x6000',
        constructorArgs: ['name'],
      },
      signer,
    )

    expect(getDeployTransaction).toHaveBeenCalledWith('name', {})
    expect(deploy).toHaveBeenCalledWith('name', { gasLimit: 120000n })
    expect(transaction.wait).toHaveBeenCalledWith(1)
    expect(result).toEqual({
      contractAddress,
      transactionHash: '0xdeploy',
      receipt,
    })
  })

  it('preflights and sends state-changing contract methods', async () => {
    const receipt = { hash: '0xreceipt' }
    const method = {
      staticCall: vi.fn().mockResolvedValue(true),
      estimateGas: vi.fn().mockResolvedValue(50000n),
      send: vi.fn().mockResolvedValue({
        hash: '0xexecute',
        wait: vi.fn().mockResolvedValue(receipt),
      }),
    }
    vi.spyOn(Contract.prototype, 'getFunction').mockReturnValue(method as any)
    const api = new EvmContractApi(() => ({}))

    const result = await api.executeContract(
      {
        sender: 'me1sender',
        contractAddress,
        abi: ['function setValue(uint256)'],
        method: 'setValue',
        args: [7n],
        value: 1n,
      },
      {} as any,
    )

    expect(method.staticCall).toHaveBeenCalledWith(7n, { value: 1n })
    expect(method.estimateGas).toHaveBeenCalledWith(7n, { value: 1n })
    expect(method.send).toHaveBeenCalledWith(7n, { value: 1n, gasLimit: 60000n })
    expect(result).toEqual({ transactionHash: '0xexecute', receipt })
  })

  it('queries contract methods and address-level information', async () => {
    vi.spyOn(JsonRpcProvider.prototype, 'getNetwork').mockResolvedValue({ chainId: 2404n } as any)
    vi.spyOn(JsonRpcProvider.prototype, 'getCode').mockResolvedValue('0x6000')
    vi.spyOn(JsonRpcProvider.prototype, 'getBalance').mockResolvedValue(15n)
    vi.spyOn(JsonRpcProvider.prototype, 'getTransactionCount').mockResolvedValue(2)
    const method = { staticCall: vi.fn().mockResolvedValue('MET') }
    vi.spyOn(Contract.prototype, 'getFunction').mockReturnValue(method as any)
    const api = new EvmContractApi(() => ({
      rpcUrl: 'http://localhost:8545',
      chainId: 2404,
    }))

    await expect(
      api.queryContract({
        contractAddress,
        abi: ['function symbol() view returns (string)'],
        method: 'symbol',
      }),
    ).resolves.toBe('MET')
    await expect(api.getContractInfo(contractAddress)).resolves.toEqual({
      address: contractAddress,
      chainId: 2404n,
      isContract: true,
      bytecode: '0x6000',
      balance: 15n,
      transactionCount: 2,
    })
    api.destroy()
  })

  it('exposes EVM deployment through ContractService', async () => {
    const provider = {} as JsonRpcProvider
    const signer = {} as any
    const deploymentResult = {
      contractAddress,
      transactionHash: '0xdeploy',
      receipt: {} as any,
    }
    vi.spyOn(EvmContractApi.prototype, 'getProvider').mockResolvedValue(provider)
    vi.spyOn(EvmContractApi.prototype, 'deployContract').mockResolvedValue(deploymentResult)
    const wallet = { createEvmWallet: vi.fn().mockResolvedValue(signer) } as any
    const ensureInitialized = vi.fn()
    const service = new ContractService(
      { info: vi.fn(), error: vi.fn() } as any,
      {} as any,
      wallet,
      ensureInitialized,
      () => ({ rpcUrl: 'http://localhost:8545', chainId: 2404 }),
    )

    await expect(
      service.deployEvmContract({
        sender: 'me1sender',
        abi: [],
        bytecode: '0x6000',
      }),
    ).resolves.toEqual(deploymentResult)
    expect(ensureInitialized).toHaveBeenCalled()
    expect(wallet.createEvmWallet).toHaveBeenCalledWith('me1sender', provider)
  })
})
