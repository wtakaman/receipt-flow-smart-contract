const hre = require('hardhat')

async function main() {
  const networkName = hre.network.name
  const ownersEnv = process.env.OWNERS?.split(',').map((owner) => owner.trim()).filter(Boolean) ?? []
  const withdrawAddress = process.env.WITHDRAW_ADDRESS
  const requiredSignatures = Number(process.env.REQUIRED_SIGNATURES ?? 2)
  const acceptedTokens =
    process.env.ACCEPTED_TOKENS?.split(',').map((token) => token.trim()).filter(Boolean) ?? []

  if (ownersEnv.length === 0) {
    throw new Error('Set OWNERS=0xabc,0xdef,... in packages/contracts/.env before deploying')
  }
  if (!withdrawAddress) {
    throw new Error('Set WITHDRAW_ADDRESS in packages/contracts/.env before deploying')
  }
  if (acceptedTokens.length === 0) {
    throw new Error('Set ACCEPTED_TOKENS=0xToken1,0xToken2,... in packages/contracts/.env before deploying')
  }

  console.log(`Deploying InvoiceFlowContract to ${networkName}`)
  console.log('Owners:', ownersEnv)
  console.log('Withdraw address:', withdrawAddress)
  console.log('Accepted tokens:', acceptedTokens)
  console.log('Required signatures:', requiredSignatures)

  const InvoiceFlowContract = await hre.ethers.getContractFactory('InvoiceFlowContract')
  return await InvoiceFlowContract.deploy(ownersEnv, withdrawAddress, acceptedTokens, requiredSignatures)
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
