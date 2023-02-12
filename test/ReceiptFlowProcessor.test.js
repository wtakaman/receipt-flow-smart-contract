const { expect } = require('chai')
const { ethers, waffle } = require('hardhat')
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
const UNSUPPORTED_ERC20 = '0x829432eF1471e34C5499f2f9A11D3e34D4056553'
const provider = waffle.provider

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
  describe('contructor', () => {
    it('should deploy a contract', async () => {
      const [coSigner1, coSigner2, coSigner3, withdrawSigner] = await ethers.getSigners()
      const ReceiptFlowContract = await ethers.getContractFactory('ReceiptFlowContract')
      const owners = [coSigner1.address, coSigner2.address, coSigner3.address]
      const acceptedTokens = [ercContractAddress]
      const requiredSignatures = 2
      await expect(ReceiptFlowContract.deploy(owners, withdrawSigner.address, acceptedTokens, requiredSignatures)).to.be
        .not.reverted
    })

    it('should fail with OWNERS_ARE_REQUIRED', async () => {
      const [withdrawSigner] = await ethers.getSigners()
      const ReceiptFlowContract = await ethers.getContractFactory('ReceiptFlowContract')
      const owners = []
      const acceptedTokens = [ercContractAddress]
      const requiredSignatures = 2
      await expect(
        ReceiptFlowContract.deploy(owners, withdrawSigner.address, acceptedTokens, requiredSignatures)
      ).to.be.revertedWith('OWNERS_ARE_REQUIRED')
    })

    it('should fail with WITHDRAW_ADDRESS_REQUIRED', async () => {
      const [coSigner1, coSigner2, coSigner3] = await ethers.getSigners()
      const ReceiptFlowContract = await ethers.getContractFactory('ReceiptFlowContract')
      const owners = [coSigner1.address, coSigner2.address, coSigner3.address]
      const acceptedTokens = [ercContractAddress]
      const requiredSignatures = 2
      await expect(
        ReceiptFlowContract.deploy(owners, EMPTY_ADDRESS, acceptedTokens, requiredSignatures)
      ).to.be.revertedWith('WITHDRAW_ADDRESS_REQUIRED')
    })

    it('should fail with INVALID_APPROVALS_NUMBER', async () => {
      const [coSigner1, coSigner2, coSigner3, withdrawSigner] = await ethers.getSigners()
      const ReceiptFlowContract = await ethers.getContractFactory('ReceiptFlowContract')
      const owners = [coSigner1.address, coSigner2.address, coSigner3.address]
      const acceptedTokens = [ercContractAddress]
      const requiredSignatures = 10
      await expect(
        ReceiptFlowContract.deploy(owners, withdrawSigner.address, acceptedTokens, requiredSignatures)
      ).to.be.revertedWith('INVALID_APPROVALS_NUMBER')
    })

    it('should fail with INVALID_TOKEN_ADDRESS', async () => {
      const [coSigner1, coSigner2, coSigner3, withdrawSigner] = await ethers.getSigners()
      const ReceiptFlowContract = await ethers.getContractFactory('ReceiptFlowContract')
      const owners = [coSigner1.address, coSigner2.address, coSigner3.address]
      const notATokenAddress = '0x829432eF1471e34C5499f2f9A11D3e34D4056553'
      const acceptedTokens = [notATokenAddress]
      const requiredSignatures = 2
      await expect(
        ReceiptFlowContract.deploy(owners, withdrawSigner.address, acceptedTokens, requiredSignatures)
      ).to.be.revertedWith('INVALID_TOKEN_ADDRESS')
    })
  })

  describe('registerReceipt', () => {
    it('should reject with UNAUTHORIZED', async () => {
      const amount = utils.parseEther('1.0')
      const receiptId = 1

      // Add the receipt
      await expect(
        contract
          .connect(customerWithoutBalanceSigner)
          .registerReceipt(receiptId, customerWithBalanceSigner.address, amount, ercContractAddress)
      ).to.be.revertedWith('UNAUTHORIZED')
    })

    it('should reject with INVALID_AMOUNT for amount <= 0', async () => {
      const amount = utils.parseEther('0')
      const receiptId = 1

      // Add the receipt
      await expect(
        contract
          .connect(ceoSigner)
          .registerReceipt(receiptId, customerWithBalanceSigner.address, amount, ercContractAddress)
      ).to.be.revertedWith('INVALID_AMOUNT')
    })

    it('should reject with INVALID_ADDRESS for empty customer address', async () => {
      const amount = utils.parseEther('1')
      const receiptId = 1

      // Add the receipt
      await expect(
        contract.connect(ceoSigner).registerReceipt(receiptId, EMPTY_ADDRESS, amount, ercContractAddress)
      ).to.be.revertedWith('INVALID_ADDRESS')
    })

    it('should reject with INVALID_RECEIPT_ID for receipt id = 0', async () => {
      const amount = utils.parseEther('1')
      const receiptId = 0

      // Add the receipt
      await expect(
        contract
          .connect(ceoSigner)
          .registerReceipt(receiptId, customerWithBalanceSigner.address, amount, ercContractAddress)
      ).to.be.revertedWith('INVALID_RECEIPT_ID')
    })

    it('should reject with ERC20_TOKEN_NOT_SUPPORTED for unsupported token', async () => {
      const amount = utils.parseEther('1')
      const receiptId = 1
      // Add the receipt
      await expect(
        contract
          .connect(ceoSigner)
          .registerReceipt(receiptId, customerWithBalanceSigner.address, amount, UNSUPPORTED_ERC20)
      ).to.be.revertedWith('ERC20_TOKEN_NOT_SUPPORTED')
    })

    it('should reject with RECEIPT_ALREADY_EXIST receipt with same id', async () => {
      const receiptId = 1
      // Add the receipt
      await contract
        .connect(ceoSigner)
        .registerReceipt(receiptId, customerWithBalanceSigner.address, utils.parseEther('1.0'), ercContractAddress)
      await expect(
        contract
          .connect(ceoSigner)
          .registerReceipt(receiptId, customerWithoutBalanceSigner.address, utils.parseEther('2.0'), ercContractAddress)
      ).to.be.revertedWith('RECEIPT_ALREADY_EXIST')
    })

    it('should add receipt', async () => {
      const now = parseInt(new Date().getTime() / 1000)
      const amount = utils.parseEther('1.0')
      const receiptId = 1
      // Add the receipt
      await contract
        .connect(ceoSigner)
        .registerReceipt(receiptId, customerWithBalanceSigner.address, amount, ercContractAddress)
      // Check the receipt exists in the contract
      const receipt = await contract.connect(ceoSigner).receipts(receiptId)
      expect(receipt.customer.toString()).to.eq(customerWithBalanceSigner.address.toString())
      expect(receipt.id.toBigInt()).to.eq(BigNumber.from(receiptId).toBigInt())
      expect(receipt.amount.toBigInt()).to.eq(BigNumber.from(amount).toBigInt())
      expect(receipt.token.toString().toLowerCase()).to.eq(ercContractAddress.toLowerCase())
      expect(parseInt(receipt.expiration.toBigInt().toString())).to.be.gt(now)
    })
  })

  describe('removeReceipt', () => {
    it('should remove a receipt', async () => {
      const amount = utils.parseEther('1.0')
      const receiptId = 1
      // Add the receipt
      await contract
        .connect(ceoSigner)
        .registerReceipt(receiptId, customerWithBalanceSigner.address, amount, ercContractAddress)

      // cehck receipt exists
      const receipt = await contract.connect(ceoSigner).receipts(receiptId)
      expect(receipt.customer.toString()).to.eq(customerWithBalanceSigner.address.toString())
      expect(receipt.id.toBigInt()).to.eq(BigNumber.from(receiptId).toBigInt())
      expect(receipt.amount.toBigInt()).to.eq(BigNumber.from(amount).toBigInt())
      expect(receipt.token.toString().toLowerCase()).to.eq(ercContractAddress.toLowerCase())

      await contract.connect(ceoSigner).removeReceipt(1)

      // Check the receipt has been deleted from the contract
      const receiptAfter = await contract.connect(ceoSigner).receipts(receiptId)
      expect(receiptAfter.customer).to.be.eq(EMPTY_ADDRESS)
      expect(receiptAfter.id.toBigInt()).to.eq(BigNumber.from(0).toBigInt())
      expect(receiptAfter.amount.toBigInt()).to.eq(BigNumber.from(0).toBigInt())
      expect(receiptAfter.token).to.be.eq(EMPTY_ADDRESS)
      expect(parseInt(receiptAfter.expiration.toBigInt().toString())).to.be.eq(0)
    })

    it('should reject with UNAUTHORIZED', async () => {
      await expect(contract.connect(customerWithBalanceSigner).removeReceipt(1)).to.be.revertedWith('UNAUTHORIZED')
    })

    it('should reject with INVALID_RECEIPT_ID', async () => {
      await expect(contract.connect(ceoSigner).removeReceipt(0)).to.be.revertedWith('INVALID_RECEIPT_ID')
    })

    it('should reject with RECEIPT_NOT_FOUND', async () => {
      await expect(contract.connect(ceoSigner).removeReceipt(10)).to.be.revertedWith('RECEIPT_NOT_FOUND')
    })
  })

  describe('handleTransfer', () => {
    it('should pay receipt in token amount', async () => {
      const amount = utils.parseEther('0.001')
      const receiptId = 1

      // Add the receipt
      await contract
        .connect(ceoSigner)
        .registerReceipt(receiptId, customerWithBalanceSigner.address, amount, ercContractAddress)
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
      await contract
        .connect(ceoSigner)
        .registerReceipt(receiptId, customerWithBalanceSigner.address, amount, EMPTY_ADDRESS)
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
      await contract
        .connect(ceoSigner)
        .registerReceipt(receiptId, customerWithBalanceSigner.address, amount, EMPTY_ADDRESS)

      await expect(
        contract.connect(customerWithBalanceSigner).handleTransfer(receiptId, { value: utils.parseEther('20') })
      ).to.be.revertedWith('SENT_AMOUNT_NOT_MATCH')
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

    it('should reject with RECEIPT_NOT_FOUND', async () => {
      const amount = utils.parseEther('0.001')
      const receiptId = 99
      await expect(
        contract.connect(customerWithBalanceSigner).handleTransfer(receiptId, { value: amount })
      ).to.be.revertedWith('RECEIPT_NOT_FOUND')
    })

    it('should reject with RECEIPT_NOT_FOUND', async () => {
      const amount = utils.parseEther('0.001')
      const receiptId = 1
      // Add the receipt
      await contract
        .connect(ceoSigner)
        .registerReceipt(receiptId, customerWithBalanceSigner.address, amount, ercContractAddress)
      const receipt = await contract.connect(ceoSigner).receipts(receiptId)

      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, receipt.amount)
    })

    it('should reject with RECEIPT_EXPIRED', async () => {
      const amount = utils.parseEther('0.001')
      const receiptId = 1
      // Add the receipt
      await contract
        .connect(ceoSigner)
        .registerReceipt(receiptId, customerWithBalanceSigner.address, amount, ercContractAddress)
      const receipt = await contract.connect(ceoSigner).receipts(receiptId)
      // Wait for the receipt to expire
      await mine(1000)

      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, receipt.amount)
      await expect(
        contract.connect(customerWithBalanceSigner).handleTransfer(receiptId, { value: amount })
      ).to.be.revertedWith('RECEIPT_EXPIRED')
    })

    it('should reject with ALLOWANCE_NOT_SUFFICIENT', async () => {
      const amount = utils.parseEther('0.001')
      const receiptId = 1
      // Add the receipt
      await contract
        .connect(ceoSigner)
        .registerReceipt(receiptId, customerWithBalanceSigner.address, amount, ercContractAddress)
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, utils.parseEther('0.0009'))
      await expect(
        contract.connect(customerWithBalanceSigner).handleTransfer(receiptId, { value: amount })
      ).to.be.revertedWith('ALLOWANCE_NOT_SUFFICIENT')
    })

    it('should reject with INSUFFICIENT_BALANCE', async () => {
      const amount = utils.parseEther('1')
      const receiptId = 1
      // Add the receipt
      await contract
        .connect(ceoSigner)
        .registerReceipt(receiptId, customerWithoutBalanceSigner.address, amount, ercContractAddress)
      await contractERC20.connect(customerWithoutBalanceSigner).approve(contract.address, amount)
      await expect(
        contract.connect(customerWithoutBalanceSigner).handleTransfer(receiptId, { value: amount })
      ).to.be.revertedWith('INSUFFICIENT_BALANCE')
    })
  })

  describe('submitWithdrawRequest', () => {
    it('should register withdraw request', async () => {
      const paymentAmount = utils.parseEther('10')
      const receiptId = 1
      // Add the receipt
      await contract
        .connect(ceoSigner)
        .registerReceipt(receiptId, customerWithBalanceSigner.address, paymentAmount, ercContractAddress)
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

    it('should reject with ERC20_TOKEN_NOT_SUPPORTED', async () => {
      await expect(
        contract.connect(ceoSigner).submitWithdrawRequest(utils.parseEther('1'), UNSUPPORTED_ERC20)
      ).to.be.revertedWith('ERC20_TOKEN_NOT_SUPPORTED')
    })

    it('should reject with INVALID_AMOUNT', async () => {
      const paymentAmount = utils.parseEther('10')
      const receiptId = 1

      // Add the receipt
      await contract
        .connect(ceoSigner)
        .registerReceipt(receiptId, customerWithBalanceSigner.address, paymentAmount, ercContractAddress)
      const receipt = await contract.connect(ceoSigner).receipts(receiptId)

      // pay receipt
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, receipt.amount)
      await contract.connect(customerWithBalanceSigner).handleTransfer(receiptId, { value: paymentAmount })

      await expect(
        contract.connect(ceoSigner).submitWithdrawRequest(utils.parseEther('0'), ercContractAddress)
      ).to.be.revertedWith('INVALID_AMOUNT')
    })

    it('should reject with INSUFFICIENT_BALANCE for ERC20', async () => {
      const paymentAmount = utils.parseEther('1')
      const receiptId = 1

      // Add the receipt
      await contract
        .connect(ceoSigner)
        .registerReceipt(receiptId, customerWithBalanceSigner.address, paymentAmount, ercContractAddress)
      const receipt = await contract.connect(ceoSigner).receipts(receiptId)

      // pay receipt
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, receipt.amount)
      await contract.connect(customerWithBalanceSigner).handleTransfer(receiptId, { value: paymentAmount })

      await expect(
        contract.connect(ceoSigner).submitWithdrawRequest(utils.parseEther('10'), ercContractAddress)
      ).to.be.revertedWith('INSUFFICIENT_BALANCE')
    })

    it('should reject with INSUFFICIENT_BALANCE for ETH', async () => {
      const paymentAmount = utils.parseEther('1')
      const receiptId = 1

      // Add the receipt
      await contract
        .connect(ceoSigner)
        .registerReceipt(receiptId, customerWithBalanceSigner.address, paymentAmount, EMPTY_ADDRESS)
      const receipt = await contract.connect(ceoSigner).receipts(receiptId)

      // pay receipt
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, receipt.amount)
      await contract.connect(customerWithBalanceSigner).handleTransfer(receiptId, { value: paymentAmount })

      await expect(
        contract.connect(ceoSigner).submitWithdrawRequest(utils.parseEther('10'), EMPTY_ADDRESS)
      ).to.be.revertedWith('INSUFFICIENT_BALANCE')
    })

    it('should reject with UNAUTHORIZED', async () => {
      const paymentAmount = utils.parseEther('10')
      const receiptId = 1

      // Add the receipt
      await contract
        .connect(ceoSigner)
        .registerReceipt(receiptId, customerWithBalanceSigner.address, paymentAmount, ercContractAddress)
      const receipt = await contract.connect(ceoSigner).receipts(receiptId)

      // pay receipt
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, receipt.amount)
      await contract.connect(customerWithBalanceSigner).handleTransfer(receiptId, { value: paymentAmount })

      // request withdraw
      await expect(
        contract.connect(customerWithBalanceSigner).submitWithdrawRequest(utils.parseEther('0'), ercContractAddress)
      ).to.be.revertedWith('UNAUTHORIZED')
    })
  })

  describe('confirmWithdrawRequest', () => {
    it('should not execute until required approvals are met', async () => {
      const paymentAmount = utils.parseEther('10')
      const receiptId = 1
      const withdrawAddressBalanceBefore = await provider.getBalance(withdrawSigner1.address)
      const withdrawAmount = utils.parseEther('1')
      const withdrawRequestId = 1

      // Add the receipt
      await contract
        .connect(ceoSigner)
        .registerReceipt(receiptId, customerWithBalanceSigner.address, paymentAmount, EMPTY_ADDRESS)

      // pay receipt
      await contract.connect(customerWithBalanceSigner).handleTransfer(receiptId, { value: paymentAmount })

      // submit withdraw request
      await contract.connect(ceoSigner).submitWithdrawRequest(withdrawAmount, EMPTY_ADDRESS)

      const withdrawRequestBeforeApproval = await contract.connect(ceoSigner).withdrawRequests(withdrawRequestId)
      const withdrawAddressBalancePreApproval = await provider.getBalance(withdrawSigner1.address)

      expect(withdrawRequestBeforeApproval.id).to.eq(withdrawRequestId)
      expect(withdrawRequestBeforeApproval.executed).to.eq(false)

      // checking financial impact pre approval
      expect(withdrawAddressBalancePreApproval).to.eq(withdrawAddressBalanceBefore)

      // confirm withdraw
      await contract.connect(ctoSigner).confirmWithdrawRequest(withdrawRequestId)

      const withdrawRequestAfterApproval = await contract.connect(ceoSigner).withdrawRequests(withdrawRequestId)
      const withdrawAddressBalanceAfter = await provider.getBalance(withdrawSigner1.address)

      expect(withdrawRequestAfterApproval.id).to.eq(withdrawRequestId)
      expect(withdrawRequestAfterApproval.executed).to.eq(true)

      // checking financial impact
      expect(withdrawRequestAfterApproval.amount).to.eq(withdrawAddressBalanceAfter.sub(withdrawAddressBalanceBefore))
      expect(withdrawRequestAfterApproval.token).to.be.eq(EMPTY_ADDRESS)
    })

    it('should confirm ETH withdraw request', async () => {
      const paymentAmount = utils.parseEther('10')
      const receiptId = 1
      const withdrawAddressBalanceBefore = await provider.getBalance(withdrawSigner1.address)
      const withdrawAmount = utils.parseEther('1')
      const withdrawRequestId = 1

      // Add the receipt
      await contract
        .connect(ceoSigner)
        .registerReceipt(receiptId, customerWithBalanceSigner.address, paymentAmount, EMPTY_ADDRESS)

      // pay receipt
      await contract.connect(customerWithBalanceSigner).handleTransfer(receiptId, { value: paymentAmount })

      // submit withdraw request
      await contract.connect(ceoSigner).submitWithdrawRequest(withdrawAmount, EMPTY_ADDRESS)
      // request withdraw
      await contract.connect(ctoSigner).confirmWithdrawRequest(withdrawRequestId)
      const withdrawRequest = await contract.connect(ceoSigner).withdrawRequests(withdrawRequestId)
      const withdrawAddressBalanceAfter = await provider.getBalance(withdrawSigner1.address)

      expect(withdrawRequest.id).to.eq(withdrawRequestId)
      expect(withdrawRequest.executed).to.eq(true)
      expect(withdrawRequest.token).to.be.eq(EMPTY_ADDRESS)

      // checking financial impact
      expect(withdrawRequest.amount).to.eq(withdrawAddressBalanceAfter.sub(withdrawAddressBalanceBefore))
      expect(withdrawRequest.token).to.be.eq(EMPTY_ADDRESS)
    })

    it('should confirm TOKEN withdraw request', async () => {
      const paymentAmount = utils.parseEther('10')
      const receiptId = 1
      const withdrawAddressBalanceBefore = await contractERC20.balanceOf(withdrawSigner1.address)
      const withdrawAmount = utils.parseEther('1')
      const withdrawRequestId = 1

      // Add the receipt
      await contract
        .connect(ceoSigner)
        .registerReceipt(receiptId, customerWithBalanceSigner.address, paymentAmount, ercContractAddress)

      // pay receipt
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, paymentAmount)
      await contract.connect(customerWithBalanceSigner).handleTransfer(receiptId, { value: paymentAmount })

      // submit withdraw request
      await contract.connect(ceoSigner).submitWithdrawRequest(withdrawAmount, ercContractAddress)
      // request withdraw
      await contract.connect(ctoSigner).confirmWithdrawRequest(withdrawRequestId)
      const withdrawRequest = await contract.connect(ceoSigner).withdrawRequests(withdrawRequestId)
      const withdrawAddressBalanceAfter = await contractERC20.balanceOf(withdrawSigner1.address)

      expect(withdrawRequest.token).to.be.eq(ercContractAddress)
      expect(withdrawRequest.id).to.eq(withdrawRequestId)
      expect(withdrawRequest.executed).to.eq(true)

      // checking financial impact
      expect(withdrawAddressBalanceAfter).to.eq(withdrawAddressBalanceBefore.add(withdrawAmount))
      expect(withdrawAddressBalanceAfter).to.eq(withdrawAmount)
    })

    it('should reject with ALREADY_CONFIRMED', async () => {
      const paymentAmount = utils.parseEther('10')
      const receiptId = 1
      const withdrawAmount = utils.parseEther('1')
      const withdrawRequestId = 1

      // Add the receipt
      await contract
        .connect(ceoSigner)
        .registerReceipt(receiptId, customerWithBalanceSigner.address, paymentAmount, ercContractAddress)

      // pay receipt
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, paymentAmount)
      await contract.connect(customerWithBalanceSigner).handleTransfer(receiptId, { value: paymentAmount })
      // submit withdraw request
      await contract.connect(ceoSigner).submitWithdrawRequest(withdrawAmount, ercContractAddress)
      // the withdraw request is already confirmed on the submitWithdrawRequest
      // trying to confirm withdraw request again
      await expect(contract.connect(ceoSigner).confirmWithdrawRequest(withdrawRequestId)).to.be.revertedWith(
        'ALREADY_CONFIRMED'
      )
    })

    it('should reject with WITHDRAW_ALREADY_EXECUTED', async () => {
      const paymentAmount = utils.parseEther('10')
      const receiptId = 1
      const withdrawAddressBalanceBefore = await contractERC20.balanceOf(withdrawSigner1.address)
      const withdrawAmount = utils.parseEther('1')
      const withdrawRequestId = 1

      // Add the receipt
      await contract
        .connect(ceoSigner)
        .registerReceipt(receiptId, customerWithBalanceSigner.address, paymentAmount, ercContractAddress)

      // pay receipt
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, paymentAmount)
      await contract.connect(customerWithBalanceSigner).handleTransfer(receiptId, { value: paymentAmount })
      //
      // submit withdraw request
      await contract.connect(ceoSigner).submitWithdrawRequest(withdrawAmount, ercContractAddress)
      // request withdraw
      await contract.connect(ctoSigner).confirmWithdrawRequest(withdrawRequestId)
      const withdrawRequest = await contract.connect(ceoSigner).withdrawRequests(withdrawRequestId)
      const withdrawAddressBalanceAfter = await contractERC20.balanceOf(withdrawSigner1.address)

      expect(withdrawRequest.token).to.be.eq(ercContractAddress)
      expect(withdrawRequest.id).to.eq(withdrawRequestId)
      expect(withdrawRequest.executed).to.eq(true)

      // checking financial impact
      expect(withdrawAddressBalanceAfter).to.eq(withdrawAddressBalanceBefore.add(withdrawAmount))
      expect(withdrawAddressBalanceAfter).to.eq(withdrawAmount)

      await expect(contract.connect(cooSigner).confirmWithdrawRequest(withdrawRequestId)).to.be.revertedWith(
        'WITHDRAW_ALREADY_EXECUTED'
      )
    })

    it('should reject with UNAUTHORIZED', async () => {
      const withdrawRequestId = 1
      await expect(
        contract.connect(customerWithBalanceSigner).confirmWithdrawRequest(withdrawRequestId)
      ).to.be.revertedWith('UNAUTHORIZED')
    })
  })

  describe('changeWithdrawAddress', () => {
    it('should change withdraw address', async () => {
      const initialWithdrawAddress = await contract.connect(ceoSigner).withdrawAddress()
      // Add change withdraw address
      await contract.connect(ceoSigner).changeWithdrawAddressRequest(withdrawSigner2.address)
      // should have one confirmation after request
      const numConfirmations = await contract.connect(ceoSigner).withdrawAddressChangeConfirmationsCount()
      expect(numConfirmations).to.be.eq(1)
      // confirm withdraw address change
      await contract.connect(ctoSigner).confirmWithdrawAddressChange()
      const finalWithdrawAddress = await contract.connect(ceoSigner).withdrawAddress()
      expect(initialWithdrawAddress).to.be.eq(withdrawSigner1.address)
      expect(initialWithdrawAddress).to.be.not.eq(finalWithdrawAddress)
      expect(finalWithdrawAddress).to.be.eq(withdrawSigner2.address)
      // withdraw address proposal should be reset
      const newWithdrawAddress = await contract.connect(ceoSigner).newWithdrawAddress()
      expect(newWithdrawAddress).to.be.eq(EMPTY_ADDRESS)
    })

    it('should not change withdraw address until required confirmations are met', async () => {
      const initialWithdrawAddress = await contract.connect(ceoSigner).withdrawAddress()
      // Add change withdraw address
      await contract.connect(ceoSigner).changeWithdrawAddressRequest(withdrawSigner2.address)

      // should have one confirmation after request
      const numConfirmations = await contract.connect(ceoSigner).withdrawAddressChangeConfirmationsCount()
      expect(numConfirmations).to.be.eq(1)

      // should maintain the initial withdraw address
      const withdrawAddressAfterRequest = await contract.connect(ceoSigner).withdrawAddress()
      expect(withdrawAddressAfterRequest).to.be.eq(withdrawSigner1.address)

      // confirm withdraw address change
      await contract.connect(ctoSigner).confirmWithdrawAddressChange()
      const finalWithdrawAddress = await contract.connect(ceoSigner).withdrawAddress()
      expect(initialWithdrawAddress).to.be.not.eq(finalWithdrawAddress)
      // new withdraw address should be set
      expect(finalWithdrawAddress).to.be.eq(withdrawSigner2.address)
      // withdraw address proposal should be reset
      const newWithdrawAddress = await contract.connect(ceoSigner).newWithdrawAddress()
      expect(newWithdrawAddress).to.be.eq(EMPTY_ADDRESS)
    })

    it('should reject with UNAUTHORIZED', async () => {
      await expect(
        contract.connect(customerWithBalanceSigner).changeWithdrawAddressRequest(withdrawSigner2.address)
      ).to.be.revertedWith('UNAUTHORIZED')
    })

    it('should reject with ALREADY_CONFIRMED', async () => {
      await contract.connect(ceoSigner).changeWithdrawAddressRequest(withdrawSigner2.address)
      // try to confirm twice
      await expect(contract.connect(ceoSigner).confirmWithdrawAddressChange()).to.be.revertedWith('ALREADY_CONFIRMED')
    })

    it('should reject with INVALID_ADDRESS', async () => {
      await expect(contract.connect(ceoSigner).changeWithdrawAddressRequest(EMPTY_ADDRESS)).to.be.revertedWith(
        'INVALID_ADDRESS'
      )
    })

    it('should reject with NEW_ADDRESS_MUST_BE_SET', async () => {
      const initialWithdrawAddress = await contract.connect(ceoSigner).withdrawAddress()
      await expect(contract.connect(ceoSigner).changeWithdrawAddressRequest(initialWithdrawAddress)).to.be.revertedWith(
        'NEW_ADDRESS_MUST_BE_SET'
      )
    })
  })
})
