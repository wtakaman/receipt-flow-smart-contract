const { expect } = require('chai')
const { ethers } = require('hardhat')
const { utils, BigNumber } = require('ethers')
const { mine } = require('@nomicfoundation/hardhat-network-helpers')

let contract
let deployerSigner
let ceoSigner
let ctoSigner
let cooSigner
let customerWithBalanceSigner
let customerWithoutBalanceSigner
let withdrawSigner1
let withdrawSigner2
let ercContractAddress
let contractERC20
const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000'
beforeEach(async () => {
  ;[
    deployerSigner,
    ceoSigner,
    ctoSigner,
    cooSigner,
    withdrawSigner1,
    withdrawSigner2,
    customerWithBalanceSigner,
    customerWithoutBalanceSigner
  ] = await ethers.getSigners()

  // deploy erc20 token
  const ERC20PresetFixedSupply = await ethers.getContractFactory('ERC20PresetFixedSupply')
  contractERC20 = await ERC20PresetFixedSupply.deploy(
    'TakaToken',
    'TTK',
    utils.parseEther('10000000'),
    deployerSigner.address
  )
  await contractERC20.deployed()
  ercContractAddress = await contractERC20.address

  // deploy receipt flow contract
  const ReceiptFlowContract = await ethers.getContractFactory('ReceiptFlowContract')
  const owners = [ceoSigner.address, ctoSigner.address, cooSigner.address]
  const acceptedTokens = [ercContractAddress]
  const requiredSignatures = 2
  contract = await ReceiptFlowContract.deploy(owners, withdrawSigner1.address, acceptedTokens, requiredSignatures)
  await contract.deployed()

  // fund test accounts
  await contractERC20.transfer(customerWithBalanceSigner.address, utils.parseEther('500000'))
})

describe('ReceiptFlowContract', () => {
  it('deploys a contract', () => {
    expect(contract.address).to.not.be.null
  })

  describe('addReceipt', () => {
    it('should reject call from non-owners', async () => {
      const amount = utils.parseEther('1.0')
      const receiptId = 1

      // Add the receipt
      await expect(
        contract
          .connect(customerWithoutBalanceSigner)
          .addReceipt(receiptId, customerWithBalanceSigner.address, amount, ercContractAddress)
      ).to.be.revertedWith('Caller is not in the owners list')
    })

    it('should reject for amount <= 0', async () => {
      const amount = utils.parseEther('0')
      const receiptId = 1

      // Add the receipt
      await expect(
        contract.connect(ceoSigner).addReceipt(receiptId, customerWithBalanceSigner.address, amount, ercContractAddress)
      ).to.be.revertedWith('INVALID_AMOUNT')
    })

    it('should reject for empty customer address', async () => {
      const amount = utils.parseEther('1')
      const receiptId = 1

      // Add the receipt
      await expect(
        contract.connect(ceoSigner).addReceipt(receiptId, EMPTY_ADDRESS, amount, ercContractAddress)
      ).to.be.revertedWith('INVALID_ADDRESS')
    })

    it('should reject for receipt id = 0', async () => {
      const amount = utils.parseEther('1')
      const receiptId = 0

      // Add the receipt
      await expect(
        contract.connect(ceoSigner).addReceipt(receiptId, customerWithBalanceSigner.address, amount, ercContractAddress)
      ).to.be.revertedWith('INVALID_RECEIPT_ID')
    })

    it('should reject for unsupported token', async () => {
      const amount = utils.parseEther('1')
      const receiptId = 1
      const usdcTokenAddress = '0x07865c6E87B9F70255377e024ace6630C1Eaa37F'
      // Add the receipt
      await expect(
        contract.connect(ceoSigner).addReceipt(receiptId, customerWithBalanceSigner.address, amount, usdcTokenAddress)
      ).to.be.revertedWith('ERC20_TOKEN_NOT_SUPPORTED')
    })

    it('should reject receipt with same id', async () => {
      const receiptId = 1
      // Add the receipt
      await contract
        .connect(ceoSigner)
        .addReceipt(receiptId, customerWithBalanceSigner.address, utils.parseEther('1.0'), ercContractAddress)
      await expect(
        contract
          .connect(ceoSigner)
          .addReceipt(receiptId, customerWithoutBalanceSigner.address, utils.parseEther('2.0'), ercContractAddress)
      ).to.be.revertedWith('RECEIPT_ALREADY_EXIST')
    })

    it('should add receipt', async () => {
      const now = parseInt(new Date().getTime() / 1000)
      const amount = utils.parseEther('1.0')
      const receiptId = 1
      // Add the receipt
      await contract
        .connect(ceoSigner)
        .addReceipt(receiptId, customerWithBalanceSigner.address, amount, ercContractAddress)
      // Check the receipt exists in the contract
      const receipt = await contract.connect(ceoSigner).receipts(receiptId)
      expect(receipt.customer.toString()).to.eq(customerWithBalanceSigner.address.toString())
      expect(receipt.id.toBigInt()).to.eq(BigNumber.from(receiptId).toBigInt())
      expect(receipt.amount.toBigInt()).to.eq(BigNumber.from(amount).toBigInt())
      expect(receipt.token.toString().toLowerCase()).to.eq(ercContractAddress.toLowerCase())
      expect(parseInt(receipt.expiration.toBigInt().toString())).to.be.gt(now)
    })
  })

  describe('handleTransfer', () => {
    it('should pay receipt in token amount', async () => {
      const amount = utils.parseEther('0.001')
      const receiptId = 1

      // Add the receipt
      await contract
        .connect(ceoSigner)
        .addReceipt(receiptId, customerWithBalanceSigner.address, amount, ercContractAddress)
      const receipt = await contract.connect(ceoSigner).receipts(receiptId)
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, receipt.amount)
      await contract.connect(customerWithBalanceSigner).handleTransfer(receiptId, { value: amount })

      // Check the receipt has been deleted from the contract
      const receiptAfter = await contract.connect(ceoSigner).receipts(receiptId)
      expect(receiptAfter.customer).to.be.eq(EMPTY_ADDRESS)
      expect(receiptAfter.id.toBigInt()).to.eq(BigNumber.from(0).toBigInt())
      expect(receiptAfter.amount.toBigInt()).to.eq(BigNumber.from(0).toBigInt())
      expect(receiptAfter.token).to.be.eq(EMPTY_ADDRESS)
      expect(parseInt(receiptAfter.expiration.toBigInt().toString())).to.be.eq(0)
    })

    it('should pay receipt in eth amount', async () => {
      const amount = utils.parseEther('1')
      const receiptId = 1

      // Add the receipt
      await contract.connect(ceoSigner).addReceipt(receiptId, customerWithBalanceSigner.address, amount, EMPTY_ADDRESS)
      await contract.connect(customerWithBalanceSigner).handleTransfer(receiptId, { value: amount })

      // Check the receipt has been deleted from the contract
      const receiptAfter = await contract.connect(ceoSigner).receipts(receiptId)
      expect(receiptAfter.customer).to.be.eq(EMPTY_ADDRESS)
      expect(receiptAfter.id.toBigInt()).to.eq(BigNumber.from(0).toBigInt())
      expect(receiptAfter.amount.toBigInt()).to.eq(BigNumber.from(0).toBigInt())
      expect(receiptAfter.token).to.be.eq(EMPTY_ADDRESS)
      expect(parseInt(receiptAfter.expiration.toBigInt().toString())).to.be.eq(0)
    })

    it('should fail on wrong eth amount', async () => {
      const amount = utils.parseEther('1')
      const receiptId = 1

      // Add the receipt
      await contract.connect(ceoSigner).addReceipt(receiptId, customerWithBalanceSigner.address, amount, EMPTY_ADDRESS)

      await expect(
        contract.connect(customerWithBalanceSigner).handleTransfer(receiptId, { value: utils.parseEther('20') })
      ).to.be.revertedWith('Amount in transfer does not match receipt amount')
    })

    it('should return empty receipt', async () => {
      const receiptId = 99
      const receiptAfter = await contract.connect(ceoSigner).receipts(receiptId)
      expect(receiptAfter.customer).to.be.eq(EMPTY_ADDRESS)
      expect(receiptAfter.id.toBigInt()).to.eq(BigNumber.from(0).toBigInt())
      expect(receiptAfter.amount.toBigInt()).to.eq(BigNumber.from(0).toBigInt())
      expect(receiptAfter.token).to.be.eq(EMPTY_ADDRESS)
      expect(parseInt(receiptAfter.expiration.toBigInt().toString())).to.be.eq(0)
    })

    it('should reject with receipt does not exist', async () => {
      const amount = utils.parseEther('0.001')
      const receiptId = 99
      await expect(
        contract.connect(customerWithBalanceSigner).handleTransfer(receiptId, { value: amount })
      ).to.be.revertedWith('Receipt does not exist')
    })

    it('should reject with receipt does not exist', async () => {
      const amount = utils.parseEther('0.001')
      const receiptId = 1
      // Add the receipt
      await contract
        .connect(ceoSigner)
        .addReceipt(receiptId, customerWithBalanceSigner.address, amount, ercContractAddress)
      const receipt = await contract.connect(ceoSigner).receipts(receiptId)

      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, receipt.amount)
    })

    it('should reject with Receipt has expired', async () => {
      const amount = utils.parseEther('0.001')
      const receiptId = 1
      // Add the receipt
      await contract
        .connect(ceoSigner)
        .addReceipt(receiptId, customerWithBalanceSigner.address, amount, ercContractAddress)
      const receipt = await contract.connect(ceoSigner).receipts(receiptId)
      // Wait for the receipt to expire
      await mine(1000)

      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, receipt.amount)
      await expect(
        contract.connect(customerWithBalanceSigner).handleTransfer(receiptId, { value: amount })
      ).to.be.revertedWith('Receipt has expired')
    })

    it('should reject with Token allowance is not sufficient', async () => {
      const amount = utils.parseEther('0.001')
      const receiptId = 1
      // Add the receipt
      await contract
        .connect(ceoSigner)
        .addReceipt(receiptId, customerWithBalanceSigner.address, amount, ercContractAddress)
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, utils.parseEther('0.0009'))
      await expect(
        contract.connect(customerWithBalanceSigner).handleTransfer(receiptId, { value: amount })
      ).to.be.revertedWith('Token allowance is not sufficient')
    })

    it('should reject with Token balance is not sufficient', async () => {
      const amount = utils.parseEther('1')
      const receiptId = 1
      // Add the receipt
      await contract
        .connect(ceoSigner)
        .addReceipt(receiptId, customerWithoutBalanceSigner.address, amount, ercContractAddress)
      await contractERC20.connect(customerWithoutBalanceSigner).approve(contract.address, amount)
      await expect(
        contract.connect(customerWithoutBalanceSigner).handleTransfer(receiptId, { value: amount })
      ).to.be.revertedWith('Token balance is not sufficient')
    })
  })

  describe('addWithdrawRequest', () => {
    it('should register withdraw request', async () => {
      const paymentAmount = utils.parseEther('10')
      const receiptId = 1

      // Add the receipt
      await contract
        .connect(ceoSigner)
        .addReceipt(receiptId, customerWithBalanceSigner.address, paymentAmount, ercContractAddress)
      const receipt = await contract.connect(ceoSigner).receipts(receiptId)

      // pay receipt
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, receipt.amount)
      await contract.connect(customerWithBalanceSigner).handleTransfer(receiptId, { value: paymentAmount })

      // request withdraw
      const withdrawAmount = utils.parseEther('1')
      const withdrawRequestId = 1
      await contract.connect(ceoSigner).submitWithdrawRequest(withdrawAmount, ercContractAddress)
      const withdrawRequest = await contract.connect(ceoSigner).withdrawRequests(withdrawRequestId)

      expect(BigNumber.from(withdrawRequest.amount)).to.eq(withdrawAmount)
      expect(withdrawRequest.token).to.be.eq(ercContractAddress)
      expect(withdrawRequest.id).to.eq(withdrawRequestId)
      expect(withdrawRequest.executed).to.eq(false)
    })
  })
})
