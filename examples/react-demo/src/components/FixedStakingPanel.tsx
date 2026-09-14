import React, { useMemo, useState } from 'react'
import { Button, Form, Input, InputNumber, Select, Space, Tabs, Typography, message } from 'antd'
import type { FixedDepositConfig, FixedDepositState, MetaEarthSDK } from 'meta-earth-js-sdk'

interface FixedStakingPanelProps {
  sdk: MetaEarthSDK
  isInitialized: boolean
  addLog: (message: string) => void
}

const FIXED_DEPOSIT_STATES: Array<{ label: string; value: FixedDepositState }> = [
  { label: 'All positions', value: 'ALL_STATE' },
  { label: 'Not expired', value: 'NOT_EXPIRED' },
  { label: 'Expired', value: 'EXPIRED' },
]

const isFormValidationError = (error: unknown) =>
  typeof error === 'object' && error !== null && 'errorFields' in error

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

export const FixedStakingPanel: React.FC<FixedStakingPanelProps> = ({
  sdk,
  isInitialized,
  addLog,
}) => {
  const [stakeForm] = Form.useForm()
  const [withdrawForm] = Form.useForm()
  const [queryForm] = Form.useForm()
  const [regionId, setRegionId] = useState('')
  const [configs, setConfigs] = useState<FixedDepositConfig[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(false)
  const [staking, setStaking] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [querying, setQuerying] = useState(false)

  const activeTermOptions = useMemo(
    () =>
      configs
        .filter((config) => config.status === 'FIXED_DEPOSIT_CFG_ACTIVE')
        .map((config) => ({
          value: config.term,
          label: `${config.term} days · rate ${config.rate}`,
        })),
    [configs],
  )

  const requireInitialized = () => {
    if (isInitialized) return true
    message.error('Please initialize the SDK first')
    return false
  }

  const handleAddressChange = () => {
    setRegionId('')
    setConfigs([])
    stakeForm.setFieldValue('term', undefined)
  }

  const handleLoadTerms = async () => {
    if (!requireInitialized()) return

    try {
      const { address } = await stakeForm.validateFields(['address'])
      setLoadingConfigs(true)
      addLog(`Loading fixed-term options for ${address}...`)
      const result = await sdk.staking.getFixedDepositConfigs(address)
      setRegionId(result.regionId)
      setConfigs(result.configs)
      stakeForm.setFieldValue('term', undefined)

      const activeCount = result.configs.filter(
        (config) => config.status === 'FIXED_DEPOSIT_CFG_ACTIVE',
      ).length
      addLog(`Loaded ${activeCount} active fixed-term option(s) for region ${result.regionId}.`)
      if (activeCount === 0) {
        message.warning('No active fixed-term options are available for this ME ID region')
      } else {
        message.success('Fixed-term options loaded')
      }
    } catch (error) {
      if (!isFormValidationError(error)) {
        const errorMessage = getErrorMessage(error)
        addLog(`Failed to load fixed-term options: ${errorMessage}`)
        message.error(errorMessage)
      }
    } finally {
      setLoadingConfigs(false)
    }
  }

  const handleStake = async () => {
    if (!requireInitialized()) return

    try {
      const values = await stakeForm.validateFields()
      setStaking(true)
      addLog(`Submitting fixed-term staking transaction for ${values.address}...`)
      const txHash = await sdk.staking.stakeFixed({
        address: values.address,
        principal: { amount: values.amount, denom: values.denom },
        term: values.term,
      })
      addLog(`Fixed-term staking successful. Transaction hash: ${txHash}`)
      message.success('Fixed-term stake successful')
      stakeForm.resetFields()
      setRegionId('')
      setConfigs([])
    } catch (error) {
      if (!isFormValidationError(error)) {
        const errorMessage = getErrorMessage(error)
        addLog(`Fixed-term staking failed: ${errorMessage}`)
        message.error(errorMessage)
      }
    } finally {
      setStaking(false)
    }
  }

  const handleWithdraw = async () => {
    if (!requireInitialized()) return

    try {
      const values = await withdrawForm.validateFields()
      setWithdrawing(true)
      addLog(`Withdrawing fixed-term position ${values.id} for ${values.address}...`)
      const txHash = await sdk.staking.withdrawFixed({
        address: values.address,
        id: values.id,
      })
      addLog(`Fixed-term withdrawal successful. Transaction hash: ${txHash}`)
      message.success('Principal and interest withdrawal submitted')
      withdrawForm.resetFields()
    } catch (error) {
      if (!isFormValidationError(error)) {
        const errorMessage = getErrorMessage(error)
        addLog(`Fixed-term withdrawal failed: ${errorMessage}`)
        message.error(errorMessage)
      }
    } finally {
      setWithdrawing(false)
    }
  }

  const handleQuery = async () => {
    if (!requireInitialized()) return

    try {
      const values = await queryForm.validateFields()
      setQuerying(true)
      addLog(`Loading fixed-term positions for ${values.address}...`)
      const result = await sdk.staking.getFixedDeposits(values.address, values.state)
      addLog(`Fixed-term positions: ${JSON.stringify(result, null, 2)}`)
      message.success(`Loaded ${result.length} fixed-term position(s)`)
    } catch (error) {
      if (!isFormValidationError(error)) {
        const errorMessage = getErrorMessage(error)
        addLog(`Fixed-term position query failed: ${errorMessage}`)
        message.error(errorMessage)
      }
    } finally {
      setQuerying(false)
    }
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Text type="secondary">
        The SDK selects Cosmos or Ethermint signing from the imported wallet address type.
      </Typography.Text>
      <Tabs
        items={[
          {
            key: 'create',
            label: 'Create Deposit',
            children: (
              <Form
                form={stakeForm}
                layout="vertical"
                initialValues={{ denom: 'umec' }}
                onValuesChange={(changedValues) => {
                  if ('address' in changedValues) handleAddressChange()
                }}
              >
                <Form.Item name="address" label="Wallet Address" rules={[{ required: true }]}>
                  <Input placeholder="me1..." />
                </Form.Item>
                <Form.Item>
                  <Button onClick={handleLoadTerms} loading={loadingConfigs}>
                    Load Available Terms
                  </Button>
                  {regionId ? (
                    <Typography.Text type="secondary" style={{ marginLeft: 12 }}>
                      ME ID region: {regionId}
                    </Typography.Text>
                  ) : null}
                </Form.Item>
                <Form.Item name="term" label="Term" rules={[{ required: true }]}>
                  <Select
                    placeholder="Load terms for the wallet first"
                    options={activeTermOptions}
                    disabled={activeTermOptions.length === 0}
                  />
                </Form.Item>
                <Form.Item name="amount" label="Principal Amount" rules={[{ required: true }]}>
                  <Input placeholder="1000000" inputMode="numeric" />
                </Form.Item>
                <Form.Item name="denom" label="Token Denom" rules={[{ required: true }]}>
                  <Input placeholder="umec" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" onClick={handleStake} loading={staking} block>
                    Create Fixed Deposit
                  </Button>
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'withdraw',
            label: 'Withdraw',
            children: (
              <Form form={withdrawForm} layout="vertical">
                <Form.Item name="address" label="Wallet Address" rules={[{ required: true }]}>
                  <Input placeholder="me1..." />
                </Form.Item>
                <Form.Item name="id" label="Fixed Deposit ID" rules={[{ required: true }]}>
                  <InputNumber min={1} precision={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" onClick={handleWithdraw} loading={withdrawing} block>
                    Withdraw Principal and Interest
                  </Button>
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'positions',
            label: 'Positions',
            children: (
              <Form
                form={queryForm}
                layout="vertical"
                initialValues={{ state: 'ALL_STATE' satisfies FixedDepositState }}
              >
                <Form.Item name="address" label="Wallet Address" rules={[{ required: true }]}>
                  <Input placeholder="me1..." />
                </Form.Item>
                <Form.Item name="state" label="Position State" rules={[{ required: true }]}>
                  <Select options={FIXED_DEPOSIT_STATES} />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" onClick={handleQuery} loading={querying} block>
                    View Fixed-term Positions
                  </Button>
                </Form.Item>
              </Form>
            ),
          },
        ]}
      />
    </Space>
  )
}
