const hre = require('hardhat')

async function main() {
  let deployerAddress = '0xaa607c2Ad9f1c536c3Ff5376c7073BbfDed4fE33'
  let ceoAddress = '0x77693A66f60D89fDEb85F627fB6E736d9e9D04C5'
  let ctoAddress = '0xe17F1383339b69AF3C4023B77f1cd6a8eeBD3939'
  let cooAddress = '0x51f2b55De2A77270541f974D85f84ACA4a88F52B'
  let customer = '0x976EA74026E726554dB657fA54763abd0C3a0aa9'
  let withdrawAddress1 = '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f'
  const tstContractAddress = '0xfbdb3f7db18cb66327279dd3ab86154aa66ab95c'
  const owners = [ceoAddress, ctoAddress, cooAddress]
  const acceptedTokens = [tstContractAddress]
  const requiredSignatures = 2

  // const InvoiceFlowContract = await hre.ethers.getContractFactory('InvoiceFlowContract')
  // return await InvoiceFlowContract.deploy(owners, withdrawAddress1, acceptedTokens, requiredSignatures)
  const InvoiceFlowContractFactory = await hre.ethers.getContractFactory('InvoiceFlowContractFactory')
  return await InvoiceFlowContractFactory.deploy()
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then((sc) => {
    console.log('InvoiceFlowContract deployed to:', sc.address)
  })
  .catch((error) => {
    console.error(error)
  })
;``
