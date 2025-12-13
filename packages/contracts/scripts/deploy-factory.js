const hre = require('hardhat')

async function main() {
  console.log(`Deploying InvoiceFlowContractFactory to ${hre.network.name}...`)
  const Factory = await hre.ethers.getContractFactory('InvoiceFlowContractFactory')
  const factory = await Factory.deploy()
  await factory.deployed()
  console.log('Factory deployed at:', factory.address)
  console.log('Deployer:', await factory.owner())
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})


