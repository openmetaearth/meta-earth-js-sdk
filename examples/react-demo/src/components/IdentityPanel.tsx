import React, { useState } from 'react'
import { Button, Descriptions, Form, Input, Radio, Space, Typography, message } from 'antd'
import type { MeIdLookupResult, MetaEarthSDK } from 'meta-earth-js-sdk'

type LookupMode = 'address' | 'did' | 'subAccount'

interface IdentityPanelProps {
  sdk: MetaEarthSDK
  isInitialized: boolean
  addLog: (message: string) => void
}

interface BindFormValues {
  creator: string
  subAccount: string
  memo?: string
}

interface LookupFormValues {
  mode: LookupMode
  value: string
}

const LOOKUP_OPTIONS: Array<{ label: string; value: LookupMode }> = [
  { label: 'Main Address', value: 'address' },
  { label: 'ME ID', value: 'did' },
  { label: 'Sub-account', value: 'subAccount' },
]

export const IdentityPanel: React.FC<IdentityPanelProps> = ({ sdk, isInitialized, addLog }) => {
  const [bindForm] = Form.useForm<BindFormValues>()
  const [lookupForm] = Form.useForm<LookupFormValues>()
  const [lookupResult, setLookupResult] = useState<MeIdLookupResult | null>(null)
  const [isBinding, setIsBinding] = useState(false)
  const [isLookingUp, setIsLookingUp] = useState(false)

  const handleBind = async () => {
    if (!isInitialized) {
      message.error('Please initialize the SDK first')
      return
    }

    try {
      const values = await bindForm.validateFields()
      setIsBinding(true)
      const hash = await sdk.identity.bindSubAccount({
        creator: values.creator.trim(),
        subAccount: values.subAccount.trim(),
        memo: values.memo?.trim(),
      })
      addLog(`Sub-account binding submitted. Transaction hash: ${hash}`)
      message.success('Sub-account binding submitted')
    } catch (error: any) {
      if (error.errorFields) return
      addLog(`Sub-account binding failed: ${error.message}`)
      message.error(`Binding failed: ${error.message}`)
    } finally {
      setIsBinding(false)
    }
  }

  const handleLookup = async () => {
    if (!isInitialized) {
      message.error('Please initialize the SDK first')
      return
    }

    try {
      const values = await lookupForm.validateFields()
      const queryValue = values.value.trim()
      setIsLookingUp(true)

      let result: MeIdLookupResult
      if (values.mode === 'did') {
        result = await sdk.identity.getMeIdByDid(queryValue)
      } else if (values.mode === 'subAccount') {
        result = await sdk.identity.getMeIdBySubAccount(queryValue)
      } else {
        result = await sdk.identity.getMeIdByAddress(queryValue)
      }

      setLookupResult(result)
      addLog(result.hasMeId ? `ME ID found: ${result.info?.did}` : 'ME ID not found')
    } catch (error: any) {
      if (error.errorFields) return
      setLookupResult(null)
      addLog(`ME ID lookup failed: ${error.message}`)
      message.error(`Lookup failed: ${error.message}`)
    } finally {
      setIsLookingUp(false)
    }
  }

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Typography.Text strong>Bind ETH Sub-account</Typography.Text>
        <Form form={bindForm} layout="vertical">
          <Form.Item
            name="creator"
            label="Cosmos Main Address"
            rules={[{ required: true, message: 'Please enter the Cosmos main address' }]}
          >
            <Input placeholder="me1..." />
          </Form.Item>
          <Form.Item
            name="subAccount"
            label="ETH-derived Sub-account"
            rules={[{ required: true, message: 'Please enter the ETH-derived sub-account' }]}
          >
            <Input placeholder="me1..." />
          </Form.Item>
          <Form.Item name="memo" label="Memo">
            <Input placeholder="Optional" />
          </Form.Item>
          <Button type="primary" onClick={handleBind} loading={isBinding}>
            Bind Sub-account
          </Button>
        </Form>
      </div>

      <div>
        <Typography.Text strong>ME ID Lookup</Typography.Text>
        <Form
          form={lookupForm}
          layout="vertical"
          initialValues={{ mode: 'address' satisfies LookupMode }}
        >
          <Form.Item name="mode" label="Lookup By">
            <Radio.Group options={LOOKUP_OPTIONS} optionType="button" buttonStyle="solid" />
          </Form.Item>
          <Form.Item
            name="value"
            label="Query Value"
            rules={[{ required: true, message: 'Please enter a query value' }]}
          >
            <Input placeholder="Main address, ME ID, or sub-account" />
          </Form.Item>
          <Button onClick={handleLookup} loading={isLookingUp}>
            Query
          </Button>
        </Form>
      </div>

      {lookupResult ? (
        lookupResult.info ? (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="ME ID">{lookupResult.info.did}</Descriptions.Item>
            <Descriptions.Item label="Main Address">{lookupResult.info.address}</Descriptions.Item>
            <Descriptions.Item label="Sub-account">
              {lookupResult.info.subAccount || '--'}
            </Descriptions.Item>
            <Descriptions.Item label="Status">{lookupResult.info.status}</Descriptions.Item>
            <Descriptions.Item label="KYC Level">{lookupResult.info.kycLevel}</Descriptions.Item>
            <Descriptions.Item label="Region">{lookupResult.info.regionId}</Descriptions.Item>
          </Descriptions>
        ) : (
          <Typography.Text type="secondary">No ME ID record found.</Typography.Text>
        )
      ) : null}
    </Space>
  )
}
