import React, { useEffect, useState } from 'react'
import {
  Card,
  Button,
  Input,
  InputNumber,
  Space,
  message,
  List,
  Typography,
  Modal,
  Form,
  Radio,
  Tabs,
} from 'antd'
import type { MetaEarthSDK, WalletAddressType } from 'meta-earth-js-sdk'

const ADDRESS_TYPE_OPTIONS: Array<{ label: string; value: WalletAddressType }> = [
  { label: 'Cosmos', value: 'cosmos' },
  { label: 'ETH', value: 'eth' },
]

interface ImportWalletFormValues {
  mnemonic?: string
  privateKey?: string
  addressType: WalletAddressType
}

interface BatchWalletFormValues {
  mnemonic: string
  count: number
  startIndex: number
  addressType: WalletAddressType
}

interface WalletManagerProps {
  sdk: MetaEarthSDK
  isInitialized: boolean
  addLog: (message: string) => void
}

export const WalletManager: React.FC<WalletManagerProps> = ({ sdk, isInitialized, addLog }) => {
  const [walletAddresses, setWalletAddresses] = useState<string[]>([])
  const [addressType, setAddressType] = useState<WalletAddressType>('cosmos')
  const [createdWallet, setCreatedWallet] = useState<{
    address: string
    publicKey: string
    mnemonic: string
    addressType: WalletAddressType
  } | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [batchModalVisible, setBatchModalVisible] = useState(false)
  const [convertModalVisible, setConvertModalVisible] = useState(false)
  const [activeTab, setActiveTab] = useState<'mnemonic' | 'privateKey'>('privateKey')
  const [form] = Form.useForm<ImportWalletFormValues>()
  const [batchForm] = Form.useForm<BatchWalletFormValues>()
  const [convertForm] = Form.useForm()

  const handleCreateWallet = async () => {
    if (!isInitialized) {
      message.error('Please initialize the SDK first')
      return
    }

    try {
      addLog(`Creating ${addressType.toUpperCase()} mnemonic wallet...`)
      const result = await sdk.wallet.createMnemonicWallet(undefined, 0, addressType)
      addLog(`${addressType.toUpperCase()} wallet created successfully. Address: ${result.address}`)
      message.success('Wallet created successfully!')

      setWalletAddresses((prev) => [...prev, result.address])
      // Recovery material is shown directly to the user and never written to the demo log.
      setCreatedWallet({
        address: result.address,
        publicKey: result.publicKey,
        mnemonic: result.mnemonic,
        addressType,
      })
    } catch (error: any) {
      addLog(`Wallet creation failed: ${error.message}`)
      message.error(`Creation failed: ${error.message}`)
    }
  }

  const handleImportWallet = async () => {
    if (!isInitialized) {
      message.error('Please initialize the SDK first')
      return
    }
    form.setFieldsValue({ addressType })
    setModalVisible(true)
  }

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()
      const credential =
        activeTab === 'mnemonic' ? values.mnemonic?.trim() : values.privateKey?.trim()

      if (!credential) {
        message.error('Please enter a mnemonic or private key')
        return
      }

      const walletData =
        activeTab === 'mnemonic'
          ? { mnemonic: credential, addressType: values.addressType }
          : { privateKey: credential, addressType: values.addressType }

      addLog(`Importing ${values.addressType.toUpperCase()} wallet...`)
      const result = await sdk.wallet.importWallet(walletData)
      addLog(
        `${values.addressType.toUpperCase()} wallet imported successfully. Address: ${result.address}`,
      )
      addLog(`Public key: ${result.publicKey}`)
      message.success('Wallet imported successfully!')

      setWalletAddresses((prev) => [...prev, result.address])
      setModalVisible(false)
      form.resetFields()
    } catch (error: any) {
      addLog(`Wallet import failed: ${error.message}`)
      message.error(`Import failed: ${error.message}`)
    }
  }

  const handleModalCancel = () => {
    setModalVisible(false)
    form.resetFields()
  }

  const handleAddressConversion = () => {
    setConvertModalVisible(true)
  }

  const handleConvertModalOk = async () => {
    try {
      const values = await convertForm.validateFields()
      const address = values.address.trim()

      let resultAddress = ''
      let logMsg = ''

      if (address.startsWith('0x')) {
        // 0x -> me
        resultAddress = sdk.wallet.convert0xToMeAddress(address)
        logMsg = `Address conversion (0x -> ME): ${address} -> ${resultAddress}`
      } else {
        // me -> 0x
        resultAddress = sdk.wallet.convertMeTo0xAddress(address)
        logMsg = `Address conversion (ME -> 0x): ${address} -> ${resultAddress}`
      }

      addLog(logMsg)
      message.success(`Conversion successful: ${resultAddress}`)
      setConvertModalVisible(false)
      convertForm.resetFields()
    } catch (error: any) {
      if (error.errorFields) return
      addLog(`Address conversion failed: ${error.message}`)
      message.error('Address conversion failed')
    }
  }

  const handleConvertModalCancel = () => {
    setConvertModalVisible(false)
    convertForm.resetFields()
  }

  const handleGetAddresses = () => {
    const addresses = sdk.wallet.getWalletAddresses()
    setWalletAddresses(addresses)
    addLog(`Current wallet count: ${addresses.length}`)
    if (addresses.length > 0) {
      addresses.forEach((addr, i) => addLog(`  ${i + 1}. ${addr}`))
    }
  }

  const handleBatchCreateWallets = async () => {
    if (!isInitialized) {
      message.error('Please initialize the SDK first')
      return
    }

    batchForm.setFieldsValue({ addressType, count: 5, startIndex: 0 })
    setBatchModalVisible(true)
  }

  const handleBatchModalOk = async () => {
    try {
      const values = await batchForm.validateFields()
      const mnemonic = values.mnemonic.trim()

      addLog(
        `Deriving ${values.count} ${values.addressType.toUpperCase()} wallets from index ${values.startIndex}...`,
      )
      const wallets = await sdk.wallet.batchCreateWallets(
        mnemonic,
        values.count,
        values.startIndex,
        values.addressType,
      )

      wallets.forEach((wallet, index) =>
        addLog(`  [${index + 1}/${values.count}] ${wallet.address} | ${wallet.publicKey}`),
      )
      setWalletAddresses((prev) => [...prev, ...wallets.map((wallet) => wallet.address)])

      addLog(`Batch derivation completed. Created ${wallets.length} wallets`)
      message.success(`Successfully created ${wallets.length} wallets!`)
      setBatchModalVisible(false)
      batchForm.resetFields()
    } catch (error: any) {
      if (error.errorFields) return
      addLog(`Batch creation failed: ${error.message}`)
      message.error(`Batch creation failed: ${error.message}`)
    }
  }

  const handleBatchModalCancel = () => {
    setBatchModalVisible(false)
    batchForm.resetFields()
  }

  const handleExportWallet = async () => {
    if (!isInitialized) {
      message.error('Please initialize the SDK first')
      return
    }

    try {
      const addresses = sdk.wallet.getWalletAddresses()
      if (addresses.length === 0) {
        message.warning('No wallets available to export')
        return
      }

      addLog('Exporting wallet info...')
      addLog(`Total ${addresses.length} wallet addresses:`)
      addresses.forEach((address, index) => {
        addLog(`  ${index + 1}. ${address}`)
      })
      message.success('Wallet addresses have been added to the log')
    } catch (error: any) {
      addLog(`Wallet export failed: ${error.message}`)
      message.error(`Export failed: ${error.message}`)
    }
  }

  return (
    <Card title="Wallet Management" className="demo-section">
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Space wrap align="center">
          <Typography.Text strong>Address Type</Typography.Text>
          <Radio.Group
            options={ADDRESS_TYPE_OPTIONS}
            value={addressType}
            optionType="button"
            buttonStyle="solid"
            onChange={(event) => setAddressType(event.target.value as WalletAddressType)}
          />
        </Space>

        <Space wrap>
          <Button type="primary" onClick={handleCreateWallet}>
            Create Wallet
          </Button>
          <Button onClick={handleBatchCreateWallets}>Batch Derive</Button>
          <Button onClick={handleImportWallet}>Import Wallet</Button>
          <Button onClick={handleGetAddresses}>Refresh Addresses</Button>
          <Button onClick={handleExportWallet}>Export Addresses</Button>
          <Button onClick={handleAddressConversion}>Convert Address</Button>
        </Space>

        <div style={{ border: '1px solid #d9d9d9', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '16px' }}>Wallet Addresses</div>
          {walletAddresses.length === 0 ? (
            <div style={{ color: 'rgba(0, 0, 0, 0.25)', textAlign: 'center' }}>No wallets yet</div>
          ) : (
            walletAddresses.map((address, index) => (
              <div
                key={index}
                style={{
                  padding: '8px 0',
                  borderBottom: index < walletAddresses.length - 1 ? '1px solid #f0f0f0' : 'none',
                }}
              >
                <Typography.Text>
                  {index + 1}. {address}
                </Typography.Text>
              </div>
            ))
          )}
        </div>
      </Space>

      <Modal
        title="Wallet Created"
        open={createdWallet !== null}
        onOk={() => setCreatedWallet(null)}
        onCancel={() => setCreatedWallet(null)}
        cancelButtonProps={{ style: { display: 'none' } }}
        okText="I saved it"
      >
        {createdWallet ? (
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <Typography.Text>
              {createdWallet.addressType.toUpperCase()} address: {createdWallet.address}
            </Typography.Text>
            <Typography.Text copyable={{ text: createdWallet.publicKey }}>
              Public key: {createdWallet.publicKey}
            </Typography.Text>
            <Typography.Text strong>Save this mnemonic securely. Do not share it.</Typography.Text>
            <Typography.Paragraph copyable={{ text: createdWallet.mnemonic }} code>
              {createdWallet.mnemonic}
            </Typography.Paragraph>
          </Space>
        ) : null}
      </Modal>

      <Modal
        title="Import Wallet"
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={600}
      >
        <Form form={form} layout="vertical" initialValues={{ addressType: 'cosmos' }}>
          <Form.Item
            name="addressType"
            label="Address Type"
            rules={[{ required: true, message: 'Please select an address type' }]}
          >
            <Radio.Group options={ADDRESS_TYPE_OPTIONS} optionType="button" buttonStyle="solid" />
          </Form.Item>
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as 'mnemonic' | 'privateKey')}
            items={[
              {
                key: 'mnemonic',
                label: 'Mnemonic',
                children: (
                  <Form.Item
                    name="mnemonic"
                    label="Mnemonic"
                    rules={[
                      {
                        required: activeTab === 'mnemonic',
                        message: 'Please enter a mnemonic',
                      },
                    ]}
                  >
                    <Input.TextArea
                      rows={4}
                      placeholder="Enter a 12- or 24-word mnemonic separated by spaces"
                    />
                  </Form.Item>
                ),
              },
              {
                key: 'privateKey',
                label: 'Private Key',
                children: (
                  <Form.Item
                    name="privateKey"
                    label="Private Key"
                    initialValue={`2b522b5191b5ed1420abfdc860146aecbe086f4397179aac28acbc9ab7eff5c7`}
                    rules={[
                      {
                        required: activeTab === 'privateKey',
                        message: 'Please enter a private key',
                      },
                    ]}
                  >
                    <Input placeholder="Enter a private key" />
                  </Form.Item>
                ),
              },
            ]}
          />
        </Form>
      </Modal>

      <Modal
        title="Batch Derive Wallets"
        open={batchModalVisible}
        onOk={handleBatchModalOk}
        onCancel={handleBatchModalCancel}
        width={600}
      >
        <Form
          form={batchForm}
          layout="vertical"
          initialValues={{ addressType: 'cosmos', count: 5, startIndex: 0 }}
        >
          <Form.Item
            name="addressType"
            label="Address Type"
            rules={[{ required: true, message: 'Please select an address type' }]}
          >
            <Radio.Group options={ADDRESS_TYPE_OPTIONS} optionType="button" buttonStyle="solid" />
          </Form.Item>
          <Form.Item
            name="mnemonic"
            label="Mnemonic"
            rules={[{ required: true, message: 'Please enter a mnemonic' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Enter a 12- or 24-word mnemonic separated by spaces"
            />
          </Form.Item>
          <Space size="middle" wrap>
            <Form.Item
              name="count"
              label="Address Count"
              rules={[
                { required: true, type: 'integer', min: 1, message: 'Enter an integer above 0' },
              ]}
            >
              <InputNumber min={1} precision={0} />
            </Form.Item>
            <Form.Item
              name="startIndex"
              label="Start Index"
              rules={[
                {
                  required: true,
                  type: 'integer',
                  min: 0,
                  message: 'Enter an integer of 0 or more',
                },
              ]}
            >
              <InputNumber min={0} precision={0} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal
        title="Address Conversion"
        open={convertModalVisible}
        onOk={handleConvertModalOk}
        onCancel={handleConvertModalCancel}
      >
        <Form form={convertForm} layout="vertical">
          <Form.Item
            name="address"
            label="Address (0x or me)"
            rules={[{ required: true, message: 'Please enter an address' }]}
          >
            <Input placeholder="0x... or me..." />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
