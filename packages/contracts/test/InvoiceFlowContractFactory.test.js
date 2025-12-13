const { expect } = require('chai')
const { ethers } = require('hardhat')
const { utils } = require('ethers')

let contractFactory
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

  // deploy invoice flow contract factory
  const InvoiceFlowContractFactory = await ethers.getContractFactory('InvoiceFlowContractFactory')
  contractFactory = await InvoiceFlowContractFactory.deploy()
  await contractFactory.deployed()
})

describe('InvoiceFlowContractFactory', () => {
  it('should deploy a contract', async () => {
    const owners = [ceoSigner.address, ctoSigner.address, cooSigner.address]
    const acceptedTokens = [ercContractAddress]
    const requiredSignatures = 2
    const tx = await contractFactory
      .connect(deployerSigner)
      .createInvoiceFlowContract(owners, withdrawSigner1.address, acceptedTokens, requiredSignatures)

    await expect(tx)
      .to.emit(contractFactory, 'NewInvoiceFlowContract')
      .withArgs(owners, withdrawSigner1.address, acceptedTokens, requiredSignatures)
  })

  it('should allow any signer to deploy a contract', async () => {
    const owners = [ceoSigner.address, ctoSigner.address, cooSigner.address]
    const acceptedTokens = [ercContractAddress]
    const requiredSignatures = 2
    const tx = await contractFactory
      .connect(withdrawSigner1)
      .createInvoiceFlowContract(owners, withdrawSigner1.address, acceptedTokens, requiredSignatures)

    await expect(tx)
      .to.emit(contractFactory, 'NewInvoiceFlowContract')
      .withArgs(owners, withdrawSigner1.address, acceptedTokens, requiredSignatures)
  })

  it('should list deployed InvoiceFlowContracts', async () => {
    const owners = [ceoSigner.address, ctoSigner.address, cooSigner.address]
    const acceptedTokens = [ercContractAddress]
    const requiredSignatures = 2
    const tx = await contractFactory
      .connect(deployerSigner)
      .createInvoiceFlowContract(owners, withdrawSigner1.address, acceptedTokens, requiredSignatures)
    await expect(tx)
      .to.emit(contractFactory, 'NewInvoiceFlowContract')
      .withArgs(owners, withdrawSigner1.address, acceptedTokens, requiredSignatures)
    const deployedInvoiceFlowContract = await contractFactory.deployedInvoiceFlowContracts(0)
    expect(deployedInvoiceFlowContract).to.not.eq(undefined)
  })

  it('should return deployed contracts via getter', async () => {
    const owners = [ceoSigner.address, ctoSigner.address, cooSigner.address]
    const acceptedTokens = [ercContractAddress]
    const requiredSignatures = 2
    await contractFactory
      .connect(deployerSigner)
      .createInvoiceFlowContract(owners, withdrawSigner1.address, acceptedTokens, requiredSignatures)
    const deployedList = await contractFactory.getDeployedInvoiceFlowContracts()
    expect(deployedList).to.have.lengthOf(1)
    expect(deployedList[0]).to.eq(await contractFactory.deployedInvoiceFlowContracts(0))
  })
})
