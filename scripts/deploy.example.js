const hre = require('hardhat')

async function main() {
  let ceoAddress = ''
  let ctoAddress = ''
  let cooAddress = ''
  let withdrawAddress1 = ''
  const tstContractAddress = ''
  const owners = [ceoAddress, ctoAddress, cooAddress]
  const acceptedTokens = [tstContractAddress]
  const requiredSignatures = 2

  const ReceiptFlowContract = await hre.ethers.getContractFactory('ReceiptFlowContract')
  return await ReceiptFlowContract.deploy(owners, withdrawAddress1, acceptedTokens, requiredSignatures)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then((sc) => {
    console.log('ReceiptFlowContract deployed to:', sc.address)
  })
  .catch((error) => {
    console.error(error)
  })
;``
