const { expect } = require('chai')
const { ethers, waffle } = require('hardhat')
const { utils, BigNumber } = require('ethers')
const { mine } = require('@nomicfoundation/hardhat-network-helpers')
const { anyValue } = require('@nomicfoundation/hardhat-chai-matchers/withArgs')

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
const expirationInSec = 300

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

  // deploy invoice flow contract
  const InvoiceFlowContract = await ethers.getContractFactory('InvoiceFlowContract')
  const owners = [ceoSigner.address, ctoSigner.address, cooSigner.address]
  const acceptedTokens = [ercContractAddress]
  const requiredSignatures = 2
  contract = await InvoiceFlowContract.deploy(owners, withdrawSigner1.address, acceptedTokens, requiredSignatures)
  await contract.deployed()

  // fund test accounts
  await contractERC20.transfer(customerWithBalanceSigner.address, utils.parseEther('500000'))
})

describe('InvoiceFlowContract', () => {
  describe('contructor', () => {
    it('should deploy a contract', async () => {
      const [coSigner1, coSigner2, coSigner3, withdrawSigner] = await ethers.getSigners()
      const InvoiceFlowContract = await ethers.getContractFactory('InvoiceFlowContract')
      const owners = [coSigner1.address, coSigner2.address, coSigner3.address]
      const acceptedTokens = [ercContractAddress]
      const requiredSignatures = 2
      await expect(InvoiceFlowContract.deploy(owners, withdrawSigner.address, acceptedTokens, requiredSignatures)).to.be
        .not.reverted
    })

    it('should fail with OWNERS_ARE_REQUIRED', async () => {
      const [withdrawSigner] = await ethers.getSigners()
      const InvoiceFlowContract = await ethers.getContractFactory('InvoiceFlowContract')
      const owners = []
      const acceptedTokens = [ercContractAddress]
      const requiredSignatures = 2
      await expect(
        InvoiceFlowContract.deploy(owners, withdrawSigner.address, acceptedTokens, requiredSignatures)
      ).to.be.revertedWith('OWNERS_ARE_REQUIRED')
    })

    it('should fail with WITHDRAW_ADDRESS_REQUIRED', async () => {
      const [coSigner1, coSigner2, coSigner3] = await ethers.getSigners()
      const InvoiceFlowContract = await ethers.getContractFactory('InvoiceFlowContract')
      const owners = [coSigner1.address, coSigner2.address, coSigner3.address]
      const acceptedTokens = [ercContractAddress]
      const requiredSignatures = 2
      await expect(
        InvoiceFlowContract.deploy(owners, EMPTY_ADDRESS, acceptedTokens, requiredSignatures)
      ).to.be.revertedWith('WITHDRAW_ADDRESS_REQUIRED')
    })

    it('should fail with INVALID_APPROVALS_NUMBER', async () => {
      const [coSigner1, coSigner2, coSigner3, withdrawSigner] = await ethers.getSigners()
      const InvoiceFlowContract = await ethers.getContractFactory('InvoiceFlowContract')
      const owners = [coSigner1.address, coSigner2.address, coSigner3.address]
      const acceptedTokens = [ercContractAddress]
      const requiredSignatures = 10
      await expect(
        InvoiceFlowContract.deploy(owners, withdrawSigner.address, acceptedTokens, requiredSignatures)
      ).to.be.revertedWith('INVALID_APPROVALS_NUMBER')
    })

    it('should fail with INVALID_TOKEN_ADDRESS', async () => {
      const [coSigner1, coSigner2, coSigner3, withdrawSigner] = await ethers.getSigners()
      const InvoiceFlowContract = await ethers.getContractFactory('InvoiceFlowContract')
      const owners = [coSigner1.address, coSigner2.address, coSigner3.address]
      const notATokenAddress = '0x829432eF1471e34C5499f2f9A11D3e34D4056553'
      const acceptedTokens = [notATokenAddress]
      const requiredSignatures = 2
      await expect(
        InvoiceFlowContract.deploy(owners, withdrawSigner.address, acceptedTokens, requiredSignatures)
      ).to.be.revertedWith('INVALID_TOKEN_ADDRESS')
    })
  })

  describe('registerInvoice', () => {
    it('should reject with UNAUTHORIZED', async () => {
      const amount = utils.parseEther('1.0')
      const invoiceId = 1

      // Add the invoice
      await expect(
        contract
          .connect(customerWithoutBalanceSigner)
          .registerInvoice(invoiceId, customerWithBalanceSigner.address, amount, ercContractAddress, expirationInSec)
      ).to.be.revertedWith('UNAUTHORIZED')
    })

    it('should reject with INVALID_AMOUNT for amount <= 0', async () => {
      const amount = utils.parseEther('0')
      const invoiceId = 1

      // Add the invoice
      await expect(
        contract
          .connect(ceoSigner)
          .registerInvoice(invoiceId, customerWithBalanceSigner.address, amount, ercContractAddress, expirationInSec)
      ).to.be.revertedWith('INVALID_AMOUNT')
    })

    it('should reject with INVALID_ADDRESS for empty customer address', async () => {
      const amount = utils.parseEther('1')
      const invoiceId = 1

      // Add the invoice
      await expect(
        contract
          .connect(ceoSigner)
          .registerInvoice(invoiceId, EMPTY_ADDRESS, amount, ercContractAddress, expirationInSec)
      ).to.be.revertedWith('INVALID_ADDRESS')
    })

    it('should reject with INVALID_INVOICE_ID for invoice id = 0', async () => {
      const amount = utils.parseEther('1')
      const invoiceId = 0

      // Add the invoice
      await expect(
        contract
          .connect(ceoSigner)
          .registerInvoice(invoiceId, customerWithBalanceSigner.address, amount, ercContractAddress, expirationInSec)
      ).to.be.revertedWith('INVALID_INVOICE_ID')
    })

    it('should reject with ERC20_TOKEN_NOT_SUPPORTED for unsupported token', async () => {
      const amount = utils.parseEther('1')
      const invoiceId = 1
      // Add the invoice
      await expect(
        contract
          .connect(ceoSigner)
          .registerInvoice(invoiceId, customerWithBalanceSigner.address, amount, UNSUPPORTED_ERC20, expirationInSec)
      ).to.be.revertedWith('ERC20_TOKEN_NOT_SUPPORTED')
    })

    it('should reject with INVOICE_ALREADY_EXIST invoice with same id', async () => {
      const invoiceId = 1
      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(
          invoiceId,
          customerWithBalanceSigner.address,
          utils.parseEther('1.0'),
          ercContractAddress,
          expirationInSec
        )
      await expect(
        contract
          .connect(ceoSigner)
          .registerInvoice(
            invoiceId,
            customerWithoutBalanceSigner.address,
            utils.parseEther('2.0'),
            ercContractAddress,
            expirationInSec
          )
      ).to.be.revertedWith('INVOICE_ALREADY_EXIST')
    })

    it('should reject with INVALID_EXPIRATION_VALUE', async () => {
      const invoiceId = 1
      const invalidExpirationInSec = 0
      // Add the invoice
      await expect(
        contract
          .connect(ceoSigner)
          .registerInvoice(
            invoiceId,
            customerWithoutBalanceSigner.address,
            utils.parseEther('1'),
            ercContractAddress,
            invalidExpirationInSec
          )
      ).to.be.revertedWith('INVALID_EXPIRATION_VALUE')
    })

    it('should add invoice', async () => {
      const now = parseInt(new Date().getTime() / 1000)
      const amount = utils.parseEther('1.0')
      const invoiceId = 1
      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(invoiceId, customerWithBalanceSigner.address, amount, ercContractAddress, expirationInSec)
      // Check the invoice exists in the contract
      const invoice = await contract.connect(ceoSigner).invoices(invoiceId)
      expect(invoice.customer.toString()).to.eq(customerWithBalanceSigner.address.toString())
      expect(invoice.id.toBigInt()).to.eq(BigNumber.from(invoiceId).toBigInt())
      expect(invoice.amount.toBigInt()).to.eq(BigNumber.from(amount).toBigInt())
      expect(invoice.token.toString().toLowerCase()).to.eq(ercContractAddress.toLowerCase())
      expect(parseInt(invoice.expiration.toBigInt().toString())).to.be.gt(now)
    })
    it('should emit event InvoiceRegistered', async () => {
      const amount = utils.parseEther('1.0')
      const invoiceId = 1
      const tx = await contract
        .connect(ceoSigner)
        .registerInvoice(invoiceId, customerWithBalanceSigner.address, amount, ercContractAddress, expirationInSec)

      tx.wait()
      await expect(tx)
        .to.emit(contract, 'InvoiceRegistered')
        .withArgs(invoiceId, customerWithBalanceSigner.address, amount, ercContractAddress, anyValue)
    })
  })

  describe('removeInvoice', () => {
    it('should remove a invoice', async () => {
      const amount = utils.parseEther('1.0')
      const invoiceId = 1
      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(invoiceId, customerWithBalanceSigner.address, amount, ercContractAddress, expirationInSec)

      // cehck invoice exists
      const invoice = await contract.connect(ceoSigner).invoices(invoiceId)
      expect(invoice.customer.toString()).to.eq(customerWithBalanceSigner.address.toString())
      expect(invoice.id.toBigInt()).to.eq(BigNumber.from(invoiceId).toBigInt())
      expect(invoice.amount.toBigInt()).to.eq(BigNumber.from(amount).toBigInt())
      expect(invoice.token.toString().toLowerCase()).to.eq(ercContractAddress.toLowerCase())

      await contract.connect(ceoSigner).removeInvoice(1)

      // Check the invoice has been deleted from the contract
      const invoiceAfter = await contract.connect(ceoSigner).invoices(invoiceId)
      expect(invoiceAfter.customer).to.be.eq(EMPTY_ADDRESS)
      expect(invoiceAfter.id.toBigInt()).to.eq(BigNumber.from(0).toBigInt())
      expect(invoiceAfter.amount.toBigInt()).to.eq(BigNumber.from(0).toBigInt())
      expect(invoiceAfter.token).to.be.eq(EMPTY_ADDRESS)
      expect(parseInt(invoiceAfter.expiration.toBigInt().toString())).to.be.eq(0)
    })

    it('should reject with UNAUTHORIZED', async () => {
      await expect(contract.connect(customerWithBalanceSigner).removeInvoice(1)).to.be.revertedWith('UNAUTHORIZED')
    })

    it('should reject with INVALID_INVOICE_ID', async () => {
      await expect(contract.connect(ceoSigner).removeInvoice(0)).to.be.revertedWith('INVALID_INVOICE_ID')
    })

    it('should reject with INVOICE_NOT_FOUND', async () => {
      await expect(contract.connect(ceoSigner).removeInvoice(10)).to.be.revertedWith('INVOICE_NOT_FOUND')
    })

    it('should emit event InvoiceRegistered', async () => {
      const amount = utils.parseEther('1.0')
      const invoiceId = 1
      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(invoiceId, customerWithBalanceSigner.address, amount, ercContractAddress, expirationInSec)

      const tx = await contract.connect(ceoSigner).removeInvoice(invoiceId)
      tx.wait()
      await expect(tx)
        .to.emit(contract, 'InvoiceRemoved')
        .withArgs(invoiceId, customerWithBalanceSigner.address, amount, ercContractAddress, anyValue)
    })
  })

  describe('handleTransfer', () => {
    it('should pay invoice in token amount', async () => {
      const amount = utils.parseEther('0.001')
      const invoiceId = 1

      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(invoiceId, customerWithBalanceSigner.address, amount, ercContractAddress, expirationInSec)
      const invoice = await contract.connect(ceoSigner).invoices(invoiceId)
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, invoice.amount)
      await contract.connect(customerWithBalanceSigner).handleTransfer(invoiceId, { value: amount })

      // Check the invoice has been deleted from the contract
      const invoiceAfter = await contract.connect(ceoSigner).invoices(invoiceId)
      expect(invoiceAfter.customer).to.be.eq(EMPTY_ADDRESS)
      expect(invoiceAfter.id.toBigInt()).to.eq(BigNumber.from(0).toBigInt())
      expect(invoiceAfter.amount.toBigInt()).to.eq(BigNumber.from(0).toBigInt())
      expect(invoiceAfter.token).to.be.eq(EMPTY_ADDRESS)
      expect(parseInt(invoiceAfter.expiration.toBigInt().toString())).to.be.eq(0)
    })

    it('should pay invoice in eth amount', async () => {
      const amount = utils.parseEther('1')
      const invoiceId = 1

      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(invoiceId, customerWithBalanceSigner.address, amount, EMPTY_ADDRESS, expirationInSec)
      await contract.connect(customerWithBalanceSigner).handleTransfer(invoiceId, { value: amount })

      // Check the invoice has been deleted from the contract
      const invoiceAfter = await contract.connect(ceoSigner).invoices(invoiceId)
      expect(invoiceAfter.customer).to.be.eq(EMPTY_ADDRESS)
      expect(invoiceAfter.id.toBigInt()).to.eq(BigNumber.from(0).toBigInt())
      expect(invoiceAfter.amount.toBigInt()).to.eq(BigNumber.from(0).toBigInt())
      expect(invoiceAfter.token).to.be.eq(EMPTY_ADDRESS)
      expect(parseInt(invoiceAfter.expiration.toBigInt().toString())).to.be.eq(0)
    })

    it('should emit InvoicePaid for ERC-20', async () => {
      const amount = utils.parseEther('0.001')
      const invoiceId = 1

      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(invoiceId, customerWithBalanceSigner.address, amount, ercContractAddress, expirationInSec)
      const invoice = await contract.connect(ceoSigner).invoices(invoiceId)
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, invoice.amount)
      await expect(contract.connect(customerWithBalanceSigner).handleTransfer(invoiceId, { value: amount }))
        .to.emit(contract, 'InvoicePaid')
        .withArgs(invoiceId, customerWithBalanceSigner.address, amount, ercContractAddress, anyValue)
    })

    it('should emit InvoicePaid for ETH', async () => {
      const amount = utils.parseEther('0.001')
      const invoiceId = 1

      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(invoiceId, customerWithBalanceSigner.address, amount, EMPTY_ADDRESS, expirationInSec)
      await expect(contract.connect(customerWithBalanceSigner).handleTransfer(invoiceId, { value: amount }))
        .to.emit(contract, 'InvoicePaid')
        .withArgs(invoiceId, customerWithBalanceSigner.address, amount, EMPTY_ADDRESS, anyValue)
    })

    it('should fail on wrong eth amount', async () => {
      const amount = utils.parseEther('1')
      const invoiceId = 1

      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(invoiceId, customerWithBalanceSigner.address, amount, EMPTY_ADDRESS, expirationInSec)

      await expect(
        contract.connect(customerWithBalanceSigner).handleTransfer(invoiceId, { value: utils.parseEther('20') })
      ).to.be.revertedWith('SENT_AMOUNT_NOT_MATCH')
    })

    it('should return empty invoice', async () => {
      const invoiceId = 99
      const invoiceAfter = await contract.connect(ceoSigner).invoices(invoiceId)
      expect(invoiceAfter.customer).to.be.eq(EMPTY_ADDRESS)
      expect(invoiceAfter.id.toBigInt()).to.eq(BigNumber.from(0).toBigInt())
      expect(invoiceAfter.amount.toBigInt()).to.eq(BigNumber.from(0).toBigInt())
      expect(invoiceAfter.token).to.be.eq(EMPTY_ADDRESS)
      expect(parseInt(invoiceAfter.expiration.toBigInt().toString())).to.be.eq(0)
    })

    it('should reject with INVOICE_NOT_FOUND', async () => {
      const amount = utils.parseEther('0.001')
      const invoiceId = 99
      await expect(
        contract.connect(customerWithBalanceSigner).handleTransfer(invoiceId, { value: amount })
      ).to.be.revertedWith('INVOICE_NOT_FOUND')
    })

    it('should reject with INVOICE_NOT_FOUND', async () => {
      const amount = utils.parseEther('0.001')
      const invoiceId = 1
      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(invoiceId, customerWithBalanceSigner.address, amount, ercContractAddress, expirationInSec)
      const invoice = await contract.connect(ceoSigner).invoices(invoiceId)

      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, invoice.amount)
    })

    it('should reject with INVOICE_EXPIRED', async () => {
      const amount = utils.parseEther('0.001')
      const invoiceId = 1
      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(invoiceId, customerWithBalanceSigner.address, amount, ercContractAddress, expirationInSec)
      const invoice = await contract.connect(ceoSigner).invoices(invoiceId)
      // Wait for the invoice to expire
      await mine(1000)

      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, invoice.amount)
      await expect(
        contract.connect(customerWithBalanceSigner).handleTransfer(invoiceId, { value: amount })
      ).to.be.revertedWith('INVOICE_EXPIRED')
    })

    it('should reject with ALLOWANCE_NOT_SUFFICIENT', async () => {
      const amount = utils.parseEther('0.001')
      const invoiceId = 1
      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(invoiceId, customerWithBalanceSigner.address, amount, ercContractAddress, expirationInSec)
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, utils.parseEther('0.0009'))
      await expect(
        contract.connect(customerWithBalanceSigner).handleTransfer(invoiceId, { value: amount })
      ).to.be.revertedWith('ALLOWANCE_NOT_SUFFICIENT')
    })

    it('should reject with INSUFFICIENT_BALANCE', async () => {
      const amount = utils.parseEther('1')
      const invoiceId = 1
      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(invoiceId, customerWithoutBalanceSigner.address, amount, ercContractAddress, expirationInSec)
      await contractERC20.connect(customerWithoutBalanceSigner).approve(contract.address, amount)
      await expect(
        contract.connect(customerWithoutBalanceSigner).handleTransfer(invoiceId, { value: amount })
      ).to.be.revertedWith('INSUFFICIENT_BALANCE')
    })
  })

  describe('registerWithdrawRequest', () => {
    it('should register withdraw request', async () => {
      const paymentAmount = utils.parseEther('10')
      const invoiceId = 1
      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(
          invoiceId,
          customerWithBalanceSigner.address,
          paymentAmount,
          ercContractAddress,
          expirationInSec
        )
      const invoice = await contract.connect(ceoSigner).invoices(invoiceId)

      // pay invoice
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, invoice.amount)
      await contract.connect(customerWithBalanceSigner).handleTransfer(invoiceId, { value: paymentAmount })

      // request withdraw
      const withdrawAmount = utils.parseEther('1')
      const withdrawRequestId = 1
      await contract.connect(ceoSigner).registerWithdrawRequest(withdrawAmount, ercContractAddress)
      const withdrawRequest = await contract.connect(ceoSigner).withdrawRequests(withdrawRequestId)

      expect(BigNumber.from(withdrawRequest.amount)).to.eq(withdrawAmount)
      expect(withdrawRequest.token).to.be.eq(ercContractAddress)
      expect(withdrawRequest.id).to.eq(withdrawRequestId)
      expect(withdrawRequest.executed).to.eq(false)
    })

    it('should reject with ERC20_TOKEN_NOT_SUPPORTED', async () => {
      await expect(
        contract.connect(ceoSigner).registerWithdrawRequest(utils.parseEther('1'), UNSUPPORTED_ERC20)
      ).to.be.revertedWith('ERC20_TOKEN_NOT_SUPPORTED')
    })

    it('should reject with INVALID_AMOUNT', async () => {
      const paymentAmount = utils.parseEther('10')
      const invoiceId = 1

      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(
          invoiceId,
          customerWithBalanceSigner.address,
          paymentAmount,
          ercContractAddress,
          expirationInSec
        )
      const invoice = await contract.connect(ceoSigner).invoices(invoiceId)

      // pay invoice
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, invoice.amount)
      await contract.connect(customerWithBalanceSigner).handleTransfer(invoiceId, { value: paymentAmount })

      await expect(
        contract.connect(ceoSigner).registerWithdrawRequest(utils.parseEther('0'), ercContractAddress)
      ).to.be.revertedWith('INVALID_AMOUNT')
    })

    it('should reject with INSUFFICIENT_BALANCE for ERC20', async () => {
      const paymentAmount = utils.parseEther('1')
      const invoiceId = 1

      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(
          invoiceId,
          customerWithBalanceSigner.address,
          paymentAmount,
          ercContractAddress,
          expirationInSec
        )
      const invoice = await contract.connect(ceoSigner).invoices(invoiceId)

      // pay invoice
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, invoice.amount)
      await contract.connect(customerWithBalanceSigner).handleTransfer(invoiceId, { value: paymentAmount })

      await expect(
        contract.connect(ceoSigner).registerWithdrawRequest(utils.parseEther('10'), ercContractAddress)
      ).to.be.revertedWith('INSUFFICIENT_BALANCE')
    })

    it('should reject with INSUFFICIENT_BALANCE for ETH', async () => {
      const paymentAmount = utils.parseEther('1')
      const invoiceId = 1

      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(invoiceId, customerWithBalanceSigner.address, paymentAmount, EMPTY_ADDRESS, expirationInSec)
      const invoice = await contract.connect(ceoSigner).invoices(invoiceId)

      // pay invoice
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, invoice.amount)
      await contract.connect(customerWithBalanceSigner).handleTransfer(invoiceId, { value: paymentAmount })

      await expect(
        contract.connect(ceoSigner).registerWithdrawRequest(utils.parseEther('10'), EMPTY_ADDRESS)
      ).to.be.revertedWith('INSUFFICIENT_BALANCE')
    })

    it('should reject with UNAUTHORIZED', async () => {
      const paymentAmount = utils.parseEther('10')
      const invoiceId = 1

      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(
          invoiceId,
          customerWithBalanceSigner.address,
          paymentAmount,
          ercContractAddress,
          expirationInSec
        )
      const invoice = await contract.connect(ceoSigner).invoices(invoiceId)

      // pay invoice
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, invoice.amount)
      await contract.connect(customerWithBalanceSigner).handleTransfer(invoiceId, { value: paymentAmount })

      // request withdraw
      await expect(
        contract.connect(customerWithBalanceSigner).registerWithdrawRequest(utils.parseEther('0'), ercContractAddress)
      ).to.be.revertedWith('UNAUTHORIZED')
    })

    it('should emit WithdrawRequestRegistered', async () => {
      const paymentAmount = utils.parseEther('10')
      const invoiceId = 1
      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(
          invoiceId,
          customerWithBalanceSigner.address,
          paymentAmount,
          ercContractAddress,
          expirationInSec
        )
      const invoice = await contract.connect(ceoSigner).invoices(invoiceId)

      // pay invoice
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, invoice.amount)
      await contract.connect(customerWithBalanceSigner).handleTransfer(invoiceId, { value: paymentAmount })

      // request withdraw
      const withdrawAmount = utils.parseEther('1')
      await expect(contract.connect(ceoSigner).registerWithdrawRequest(withdrawAmount, ercContractAddress))
        .to.emit(contract, 'WithdrawRequestRegistered')
        .withArgs(anyValue, withdrawAmount, ercContractAddress, false)
    })
  })

  describe('approveWithdrawRequest', () => {
    it('should not execute until required approvals are met', async () => {
      const paymentAmount = utils.parseEther('10')
      const invoiceId = 1
      const withdrawAddressBalanceBefore = await provider.getBalance(withdrawSigner1.address)
      const withdrawAmount = utils.parseEther('1')
      const withdrawRequestId = 1

      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(invoiceId, customerWithBalanceSigner.address, paymentAmount, EMPTY_ADDRESS, expirationInSec)

      // pay invoice
      await contract.connect(customerWithBalanceSigner).handleTransfer(invoiceId, { value: paymentAmount })

      // submit withdraw request
      await contract.connect(ceoSigner).registerWithdrawRequest(withdrawAmount, EMPTY_ADDRESS)

      const withdrawRequestBeforeApproval = await contract.connect(ceoSigner).withdrawRequests(withdrawRequestId)
      const withdrawAddressBalancePreApproval = await provider.getBalance(withdrawSigner1.address)

      expect(withdrawRequestBeforeApproval.id).to.eq(withdrawRequestId)
      expect(withdrawRequestBeforeApproval.executed).to.eq(false)

      // checking financial impact pre approval
      expect(withdrawAddressBalancePreApproval).to.eq(withdrawAddressBalanceBefore)

      // confirm withdraw
      await contract.connect(ctoSigner).approveWithdrawRequest(withdrawRequestId)

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
      const invoiceId = 1
      const withdrawAddressBalanceBefore = await provider.getBalance(withdrawSigner1.address)
      const withdrawAmount = utils.parseEther('1')
      const withdrawRequestId = 1

      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(invoiceId, customerWithBalanceSigner.address, paymentAmount, EMPTY_ADDRESS, expirationInSec)

      // pay invoice
      await contract.connect(customerWithBalanceSigner).handleTransfer(invoiceId, { value: paymentAmount })

      // submit withdraw request
      await contract.connect(ceoSigner).registerWithdrawRequest(withdrawAmount, EMPTY_ADDRESS)
      // request withdraw
      await contract.connect(ctoSigner).approveWithdrawRequest(withdrawRequestId)
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
      const invoiceId = 1
      const withdrawAddressBalanceBefore = await contractERC20.balanceOf(withdrawSigner1.address)
      const withdrawAmount = utils.parseEther('1')
      const withdrawRequestId = 1

      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(
          invoiceId,
          customerWithBalanceSigner.address,
          paymentAmount,
          ercContractAddress,
          expirationInSec
        )

      // pay invoice
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, paymentAmount)
      await contract.connect(customerWithBalanceSigner).handleTransfer(invoiceId, { value: paymentAmount })

      // submit withdraw request
      await contract.connect(ceoSigner).registerWithdrawRequest(withdrawAmount, ercContractAddress)
      // request withdraw
      await contract.connect(ctoSigner).approveWithdrawRequest(withdrawRequestId)
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
      const invoiceId = 1
      const withdrawAmount = utils.parseEther('1')
      const withdrawRequestId = 1

      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(
          invoiceId,
          customerWithBalanceSigner.address,
          paymentAmount,
          ercContractAddress,
          expirationInSec
        )

      // pay invoice
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, paymentAmount)
      await contract.connect(customerWithBalanceSigner).handleTransfer(invoiceId, { value: paymentAmount })
      // submit withdraw request
      await contract.connect(ceoSigner).registerWithdrawRequest(withdrawAmount, ercContractAddress)
      // the withdraw request is already confirmed on the registerWithdrawRequest
      // trying to confirm withdraw request again
      await expect(contract.connect(ceoSigner).approveWithdrawRequest(withdrawRequestId)).to.be.revertedWith(
        'ALREADY_CONFIRMED'
      )
    })

    it('should reject with WITHDRAW_ALREADY_EXECUTED', async () => {
      const paymentAmount = utils.parseEther('10')
      const invoiceId = 1
      const withdrawAddressBalanceBefore = await contractERC20.balanceOf(withdrawSigner1.address)
      const withdrawAmount = utils.parseEther('1')
      const withdrawRequestId = 1

      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(
          invoiceId,
          customerWithBalanceSigner.address,
          paymentAmount,
          ercContractAddress,
          expirationInSec
        )

      // pay invoice
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, paymentAmount)
      await contract.connect(customerWithBalanceSigner).handleTransfer(invoiceId, { value: paymentAmount })
      //
      // submit withdraw request
      await contract.connect(ceoSigner).registerWithdrawRequest(withdrawAmount, ercContractAddress)
      // request withdraw
      await contract.connect(ctoSigner).approveWithdrawRequest(withdrawRequestId)
      const withdrawRequest = await contract.connect(ceoSigner).withdrawRequests(withdrawRequestId)
      const withdrawAddressBalanceAfter = await contractERC20.balanceOf(withdrawSigner1.address)

      expect(withdrawRequest.token).to.be.eq(ercContractAddress)
      expect(withdrawRequest.id).to.eq(withdrawRequestId)
      expect(withdrawRequest.executed).to.eq(true)

      // checking financial impact
      expect(withdrawAddressBalanceAfter).to.eq(withdrawAddressBalanceBefore.add(withdrawAmount))
      expect(withdrawAddressBalanceAfter).to.eq(withdrawAmount)

      await expect(contract.connect(cooSigner).approveWithdrawRequest(withdrawRequestId)).to.be.revertedWith(
        'WITHDRAW_ALREADY_EXECUTED'
      )
    })

    it('should reject with UNAUTHORIZED', async () => {
      const withdrawRequestId = 1
      await expect(
        contract.connect(customerWithBalanceSigner).approveWithdrawRequest(withdrawRequestId)
      ).to.be.revertedWith('UNAUTHORIZED')
    })

    it('should emit WithdrawRequestApproved', async () => {
      const paymentAmount = utils.parseEther('10')
      const invoiceId = 1
      const withdrawAmount = utils.parseEther('1')
      const withdrawRequestId = 1

      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(invoiceId, customerWithBalanceSigner.address, paymentAmount, EMPTY_ADDRESS, expirationInSec)

      // pay invoice
      await contract.connect(customerWithBalanceSigner).handleTransfer(invoiceId, { value: paymentAmount })

      // submit withdraw request
      await contract.connect(ceoSigner).registerWithdrawRequest(withdrawAmount, EMPTY_ADDRESS)
      await expect(contract.connect(ctoSigner).approveWithdrawRequest(withdrawRequestId))
        .to.emit(contract, 'WithdrawRequestApproved')
        .withArgs(invoiceId, ctoSigner.address, withdrawAmount, EMPTY_ADDRESS)
    })

    it('should emit WithdrawRequestExecuted', async () => {
      const paymentAmount = utils.parseEther('10')
      const invoiceId = 1
      const withdrawAmount = utils.parseEther('1')
      const withdrawRequestId = 1

      // Add the invoice
      await contract
        .connect(ceoSigner)
        .registerInvoice(
          invoiceId,
          customerWithBalanceSigner.address,
          paymentAmount,
          ercContractAddress,
          expirationInSec
        )
      // pay invoice
      await contractERC20.connect(customerWithBalanceSigner).approve(contract.address, paymentAmount)
      await contract.connect(customerWithBalanceSigner).handleTransfer(invoiceId, { value: paymentAmount })
      // submit withdraw request
      await contract.connect(ceoSigner).registerWithdrawRequest(withdrawAmount, ercContractAddress)
      await expect(contract.connect(ctoSigner).approveWithdrawRequest(withdrawRequestId))
        .to.emit(contract, 'WithdrawRequestExecuted')
        .withArgs(withdrawRequestId, withdrawAmount, ercContractAddress, true)
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

    it('should emit WithdrawAddressChangeRequested', async () => {
      expect(contract.connect(ceoSigner).changeWithdrawAddressRequest(withdrawSigner2.address))
        .to.emit(contract, 'WithdrawAddressChangeRequested')
        .withArgs(withdrawSigner2.address, ceoSigner.address)
    })

    it('should emit WithdrawAddressChangeApproved', async () => {
      // Add change withdraw address
      await contract.connect(ceoSigner).changeWithdrawAddressRequest(withdrawSigner2.address)
      // should have one confirmation after request
      const numConfirmations = await contract.connect(ceoSigner).withdrawAddressChangeConfirmationsCount()
      expect(numConfirmations).to.be.eq(1)
      // confirm withdraw address change
      expect(contract.connect(ctoSigner).confirmWithdrawAddressChange())
        .to.emit(contract, 'WithdrawAddressChangeApproved')
        .withArgs(withdrawSigner2.address, ctoSigner.address)
    })

    it('should emit WithdrawAddressChanged', async () => {
      // Add change withdraw address
      await contract.connect(ceoSigner).changeWithdrawAddressRequest(withdrawSigner2.address)
      // should have one confirmation after request
      const numConfirmations = await contract.connect(ceoSigner).withdrawAddressChangeConfirmationsCount()
      expect(numConfirmations).to.be.eq(1)
      // confirm withdraw address change
      expect(contract.connect(ctoSigner).confirmWithdrawAddressChange())
        .to.emit(contract, 'WithdrawAddressChanged')
        .withArgs(withdrawSigner1.address, withdrawSigner2.address)
    })
  })
})
