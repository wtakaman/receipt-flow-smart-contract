const hre = require('hardhat')

async function main() {
  const networkName = hre.network.name
  const [deployer] = await hre.ethers.getSigners()

  console.log(`Deploying test ERC-20 token to ${networkName}`)
  console.log('Deployer address:', deployer.address)

  const ERC20PresetFixedSupply = await hre.ethers.getContractFactory('ERC20PresetFixedSupply')
  const token = await ERC20PresetFixedSupply.deploy(
    'Test Token',
    'TEST',
    hre.ethers.utils.parseEther('1000000'), // 1M tokens
    deployer.address // Initial supply goes to deployer
  )

  await token.deployed()

  console.log('Test token deployed to:', token.address)
  console.log('Token name:', await token.name())
  console.log('Token symbol:', await token.symbol())
  console.log('Total supply:', hre.ethers.utils.formatEther(await token.totalSupply()), 'TEST')
  console.log('\nAdd this to your .env file:')
  console.log(`ACCEPTED_TOKENS=0x0000000000000000000000000000000000000000,${token.address}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

