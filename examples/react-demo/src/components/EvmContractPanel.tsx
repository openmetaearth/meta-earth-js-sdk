import React, { useState } from 'react'
import { Alert, Button, Col, Form, Input, Row, Tabs, message } from 'antd'
import type {
  DeployEvmContractParams,
  MetaEarthSDK,
  QueryEvmContractParams,
} from 'meta-earth-js-sdk'
import erc20Artifact from '../evm/ERC20Token.artifact.json'
import './EvmContractPanel.css'

interface EvmContractPanelProps {
  sdk: MetaEarthSDK
  isInitialized: boolean
  addLog: (message: string) => void
}

type PendingAction = 'deploy' | 'execute' | 'query' | 'info' | null

interface OperationResult {
  title: string
  content: string
}

interface DeployFormValues {
  sender: string
  abi: string
  bytecode: string
  tokenName: string
  tokenSymbol: string
  decimals: string
  initialSupply: string
  value?: string
}

interface ExecuteFormValues {
  sender: string
  contractAddress: string
  abi: string
  method: string
  args: string
  value?: string
}

interface QueryFormValues {
  contractAddress: string
  abi: string
  method: string
  args: string
}

const ERC20_ABI = JSON.stringify(erc20Artifact.abi, null, 2)
const ERC20_COMPILER_VERSION = erc20Artifact.compilerVersion.split('+')[0]
const ERC20_DEPLOY_DEFAULTS: Omit<DeployFormValues, 'sender'> = {
  abi: ERC20_ABI,
  bytecode: erc20Artifact.bytecode,
  tokenName: 'MetaEarth Token',
  tokenSymbol: 'MEC',
  decimals: '18',
  initialSupply: '1000000',
  value: '0',
}
const ERC20_EXECUTE_DEFAULTS: Partial<ExecuteFormValues> = {
  abi: ERC20_ABI,
  method: 'mint',
  args: '[]',
  value: '0',
}
const ERC20_QUERY_DEFAULTS: Partial<QueryFormValues> = {
  abi: ERC20_ABI,
  method: 'name',
  args: '[]',
}

const parseJsonArray = <T,>(value: string, fieldName: string): T[] => {
  let parsed: unknown

  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error(`${fieldName} must be valid JSON`)
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`${fieldName} must be a JSON array`)
  }

  return parsed as T[]
}

const formatResult = (value: unknown): string =>
  JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item), 2)

const getErrorMessage = (error: unknown): string => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'errorFields' in error &&
    Array.isArray(error.errorFields)
  ) {
    return 'Please correct the highlighted fields'
  }

  return error instanceof Error ? error.message : String(error)
}

const optionalValue = (value?: string): string | undefined => value?.trim() || undefined

export const EvmContractPanel: React.FC<EvmContractPanelProps> = ({
  sdk,
  isInitialized,
  addLog,
}) => {
  const [deployForm] = Form.useForm<DeployFormValues>()
  const [executeForm] = Form.useForm<ExecuteFormValues>()
  const [queryForm] = Form.useForm<QueryFormValues>()
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [result, setResult] = useState<OperationResult | null>(null)

  const requireInitialized = (): boolean => {
    if (isInitialized) {
      return true
    }

    message.error('Please initialize the SDK first')
    return false
  }

  const handleDeploy = async () => {
    if (!requireInitialized()) return

    try {
      const values = await deployForm.validateFields()
      const abi = parseJsonArray<unknown>(values.abi, 'ABI') as DeployEvmContractParams['abi']
      const decimals = Number(values.decimals)
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 77) {
        throw new Error('Decimals must be an integer between 0 and 77')
      }

      if (!/^0x[0-9a-fA-F]+$/.test(values.bytecode.trim())) {
        throw new Error('Bytecode must be a non-empty 0x-prefixed hex string')
      }

      setPendingAction('deploy')
      addLog('Deploying EVM contract…')
      addLog(`  Sender: ${values.sender}`)

      const deployment = await sdk.contract.deployEvmContract({
        sender: values.sender,
        abi,
        bytecode: values.bytecode.trim(),
        constructorArgs: [values.tokenName, values.tokenSymbol, decimals, values.initialSupply],
        value: optionalValue(values.value),
      })

      const sender0xAddress = sdk.wallet.convertMeTo0xAddress(values.sender)
      executeForm.setFieldsValue({
        sender: values.sender,
        contractAddress: deployment.contractAddress,
        abi: ERC20_ABI,
        method: 'mint',
        args: JSON.stringify([sender0xAddress, '1000000000000000000'], null, 2),
        value: '0',
      })
      queryForm.setFieldsValue({
        contractAddress: deployment.contractAddress,
        abi: ERC20_ABI,
        method: 'balanceOf',
        args: JSON.stringify([sender0xAddress], null, 2),
      })
      setResult({
        title: 'Deployment Result',
        content: formatResult({
          contractAddress: deployment.contractAddress,
          transactionHash: deployment.transactionHash,
          blockNumber: deployment.receipt.blockNumber,
          status: deployment.receipt.status,
        }),
      })
      addLog(`EVM contract deployed: ${deployment.contractAddress}`)
      addLog(`  Transaction: ${deployment.transactionHash}`)
      message.success('EVM contract deployed successfully')
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      addLog(`EVM deployment failed: ${errorMessage}`)
      message.error(errorMessage)
    } finally {
      setPendingAction(null)
    }
  }

  const handleExecute = async () => {
    if (!requireInitialized()) return

    try {
      const values = await executeForm.validateFields()
      const abi = parseJsonArray<unknown>(values.abi, 'ABI') as DeployEvmContractParams['abi']
      const args = parseJsonArray<unknown>(values.args, 'Method arguments')

      setPendingAction('execute')
      addLog(`Executing EVM method ${values.method}…`)
      addLog(`  Contract: ${values.contractAddress}`)
      addLog(`  Sender: ${values.sender}`)

      const execution = await sdk.contract.executeEvmContract({
        sender: values.sender,
        contractAddress: values.contractAddress,
        abi,
        method: values.method,
        args,
        value: optionalValue(values.value),
      })

      setResult({
        title: `Transaction Result — ${values.method}`,
        content: formatResult({
          transactionHash: execution.transactionHash,
          blockNumber: execution.receipt.blockNumber,
          status: execution.receipt.status,
          gasUsed: execution.receipt.gasUsed,
        }),
      })
      addLog(`EVM method executed: ${execution.transactionHash}`)
      message.success('EVM transaction confirmed')
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      addLog(`EVM execution failed: ${errorMessage}`)
      message.error(errorMessage)
    } finally {
      setPendingAction(null)
    }
  }

  const handleQuery = async () => {
    if (!requireInitialized()) return

    try {
      const values = await queryForm.validateFields()
      const abi = parseJsonArray<unknown>(values.abi, 'ABI') as QueryEvmContractParams['abi']
      const args = parseJsonArray<unknown>(values.args, 'Method arguments')

      setPendingAction('query')
      addLog(`Querying EVM method ${values.method}…`)
      addLog(`  Contract: ${values.contractAddress}`)

      const queryResult = await sdk.contract.queryEvmContract({
        contractAddress: values.contractAddress,
        abi,
        method: values.method,
        args,
      })

      const formatted = formatResult(queryResult)
      setResult({ title: `Query Result — ${values.method}`, content: formatted })
      addLog(`EVM query result: ${formatted}`)
      message.success('EVM query completed')
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      addLog(`EVM query failed: ${errorMessage}`)
      message.error(errorMessage)
    } finally {
      setPendingAction(null)
    }
  }

  const handleGetInfo = async () => {
    if (!requireInitialized()) return

    try {
      const contractAddress = await queryForm.validateFields(['contractAddress'])
      setPendingAction('info')
      addLog(`Loading EVM address information: ${contractAddress.contractAddress}`)

      const info = await sdk.contract.getEvmContractInfo(contractAddress.contractAddress)
      const formatted = formatResult(info)
      setResult({ title: 'Contract Information', content: formatted })
      addLog(`EVM address information: ${formatted}`)
      message.success('EVM address information loaded')
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      addLog(`EVM address lookup failed: ${errorMessage}`)
      message.error(errorMessage)
    } finally {
      setPendingAction(null)
    }
  }

  const renderAbiField = () => (
    <Form.Item
      name="abi"
      label="Contract ABI (JSON array)"
      rules={[{ required: true, message: 'Enter the contract ABI' }]}
      extra="Use strings for uint256 values in method arguments to avoid JavaScript precision loss."
      className="evm-code-field"
    >
      <Input.TextArea
        rows={6}
        autoComplete="off"
        spellCheck={false}
        placeholder='["function balanceOf(address) view returns (uint256)"]'
      />
    </Form.Item>
  )

  return (
    <div className="evm-contract-panel">
      <section className="evm-example-reference" aria-labelledby="evm-example-title">
        <div className="evm-example-header">
          <div>
            <div id="evm-example-title" className="evm-example-title">
              ERC20Token.sol Example
            </div>
            <div className="evm-example-meta">
              Preloaded · Solidity {ERC20_COMPILER_VERSION} · Paris EVM
            </div>
          </div>
          <div className="evm-example-status">ABI &amp; bytecode ready</div>
        </div>

        <p className="evm-example-copy">
          Enter an ETH-derived me1 sender and deploy. The demo then prepares working mint and
          balanceOf calls for the new contract.
        </p>

        <dl className="evm-method-reference">
          <div>
            <dt>Execute</dt>
            <dd>
              <code translate="no">transfer</code>, <code translate="no">approve</code>,{' '}
              <code translate="no">transferFrom</code>, <code translate="no">mint</code>,{' '}
              <code translate="no">burn</code>, <code translate="no">burnFrom</code>,{' '}
              <code translate="no">transferOwnership</code>,{' '}
              <code translate="no">renounceOwnership</code>
            </dd>
          </div>
          <div>
            <dt>Query</dt>
            <dd>
              <code translate="no">name</code>, <code translate="no">symbol</code>,{' '}
              <code translate="no">decimals</code>, <code translate="no">totalSupply</code>,{' '}
              <code translate="no">balanceOf</code>, <code translate="no">allowance</code>,{' '}
              <code translate="no">owner</code>
            </dd>
          </div>
        </dl>

        <p className="evm-method-restrictions">
          <code translate="no">mint</code>, <code translate="no">transferOwnership</code>, and{' '}
          <code translate="no">renounceOwnership</code> are owner-only.{' '}
          <code translate="no">transferFrom</code> and <code translate="no">burnFrom</code> require
          allowance.
        </p>
      </section>

      <Tabs
        className="evm-contract-tabs"
        items={[
          {
            key: 'deploy',
            label: 'Deploy',
            children: (
              <Form
                form={deployForm}
                layout="vertical"
                initialValues={ERC20_DEPLOY_DEFAULTS}
                autoComplete="off"
              >
                <Form.Item
                  name="sender"
                  label="Sender Address"
                  rules={[{ required: true, message: 'Enter an ETH-derived me1 address' }]}
                >
                  <Input placeholder="me1…" autoComplete="off" spellCheck={false} />
                </Form.Item>

                <Row gutter={16}>
                  <Col xs={24} md={16}>
                    <Form.Item
                      name="tokenName"
                      label="Token Name"
                      rules={[{ required: true, message: 'Enter the token name' }]}
                    >
                      <Input placeholder="MetaEarth Token" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="tokenSymbol"
                      label="Token Symbol"
                      rules={[{ required: true, message: 'Enter the token symbol' }]}
                    >
                      <Input placeholder="MEC" spellCheck={false} />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="decimals"
                      label="Decimals"
                      rules={[{ required: true, message: 'Enter decimals from 0 to 77' }]}
                    >
                      <Input type="number" min={0} max={77} inputMode="numeric" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={16}>
                    <Form.Item
                      name="initialSupply"
                      label="Initial Supply (whole tokens)"
                      rules={[
                        { required: true, message: 'Enter the initial supply' },
                        { pattern: /^\d+$/, message: 'Use a non-negative whole number' },
                      ]}
                    >
                      <Input inputMode="numeric" placeholder="1000000" spellCheck={false} />
                    </Form.Item>
                  </Col>
                </Row>

                <details className="evm-advanced">
                  <summary>Advanced Deployment Parameters</summary>
                  <div className="evm-advanced-content">
                    {renderAbiField()}
                    <Form.Item
                      name="bytecode"
                      label="Contract Bytecode"
                      rules={[{ required: true, message: 'Enter compiled EVM bytecode' }]}
                      className="evm-code-field"
                    >
                      <Input.TextArea
                        rows={5}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="0x60806040…"
                      />
                    </Form.Item>
                    <Form.Item name="value" label="Value (wei)">
                      <Input inputMode="numeric" placeholder="0" spellCheck={false} />
                    </Form.Item>
                  </div>
                </details>

                <div className="evm-form-actions">
                  <Button
                    type="primary"
                    onClick={handleDeploy}
                    loading={pendingAction === 'deploy'}
                    disabled={pendingAction !== null && pendingAction !== 'deploy'}
                  >
                    Deploy EVM Contract
                  </Button>
                </div>
              </Form>
            ),
          },
          {
            key: 'execute',
            label: 'Execute',
            children: (
              <Form
                form={executeForm}
                layout="vertical"
                initialValues={ERC20_EXECUTE_DEFAULTS}
                autoComplete="off"
              >
                <Row gutter={16}>
                  <Col xs={24} lg={12}>
                    <Form.Item
                      name="sender"
                      label="Sender Address"
                      rules={[{ required: true, message: 'Enter an ETH-derived me1 address' }]}
                    >
                      <Input placeholder="me1…" autoComplete="off" spellCheck={false} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item
                      name="contractAddress"
                      label="Contract Address"
                      rules={[{ required: true, message: 'Enter a 0x contract address' }]}
                    >
                      <Input placeholder="0x…" autoComplete="off" spellCheck={false} />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="method"
                      label="Method"
                      rules={[{ required: true, message: 'Enter a contract method' }]}
                    >
                      <Input placeholder="mint" autoComplete="off" spellCheck={false} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="value" label="Value (wei)">
                      <Input inputMode="numeric" placeholder="0" spellCheck={false} />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  name="args"
                  label="Method Arguments (JSON array)"
                  rules={[{ required: true }]}
                >
                  <Input.TextArea
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder='["0xRecipient…", "1000000000000000000"]'
                  />
                </Form.Item>

                <details className="evm-advanced">
                  <summary>Advanced Contract Parameters</summary>
                  <div className="evm-advanced-content">{renderAbiField()}</div>
                </details>

                <div className="evm-form-actions">
                  <Button
                    type="primary"
                    onClick={handleExecute}
                    loading={pendingAction === 'execute'}
                    disabled={pendingAction !== null && pendingAction !== 'execute'}
                  >
                    Execute EVM Method
                  </Button>
                </div>
              </Form>
            ),
          },
          {
            key: 'query',
            label: 'Query',
            children: (
              <Form
                form={queryForm}
                layout="vertical"
                initialValues={ERC20_QUERY_DEFAULTS}
                autoComplete="off"
              >
                <Row gutter={16} align="bottom">
                  <Col xs={24} lg={18}>
                    <Form.Item
                      name="contractAddress"
                      label="Contract Address"
                      rules={[{ required: true, message: 'Enter a 0x contract address' }]}
                    >
                      <Input placeholder="0x…" autoComplete="off" spellCheck={false} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={6}>
                    <Form.Item label="Address Action">
                      <Button
                        onClick={handleGetInfo}
                        loading={pendingAction === 'info'}
                        disabled={pendingAction !== null && pendingAction !== 'info'}
                        block
                      >
                        Get Address Info
                      </Button>
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="method"
                      label="Read Method"
                      rules={[{ required: true, message: 'Enter a contract method' }]}
                    >
                      <Input placeholder="balanceOf" autoComplete="off" spellCheck={false} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={16}>
                    <Form.Item
                      name="args"
                      label="Method Arguments (JSON array)"
                      rules={[{ required: true }]}
                    >
                      <Input.TextArea
                        autoSize={{ minRows: 1, maxRows: 5 }}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder='["0xOwner…"]'
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <details className="evm-advanced">
                  <summary>Advanced Contract Parameters</summary>
                  <div className="evm-advanced-content">{renderAbiField()}</div>
                </details>

                <div className="evm-form-actions">
                  <Button
                    type="primary"
                    onClick={handleQuery}
                    loading={pendingAction === 'query'}
                    disabled={pendingAction !== null && pendingAction !== 'query'}
                  >
                    Query EVM Method
                  </Button>
                </div>
              </Form>
            ),
          },
        ]}
      />

      {result && (
        <Alert
          type="success"
          message={result.title}
          description={<pre>{result.content}</pre>}
          className="evm-contract-result"
        />
      )}
    </div>
  )
}
