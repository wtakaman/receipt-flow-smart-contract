const hre = require('hardhat')

async function main() {
  console.log(`Deploying ReceiptNFT to ${hre.network.name}...`)
  const Receipt = await hre.ethers.getContractFactory('ReceiptNFT')
  const receipt = await Receipt.deploy()
  await receipt.deployed()
  console.log('ReceiptNFT deployed at:', receipt.address)
  console.log('Deployer:', await receipt.owner())
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
