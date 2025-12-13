const hre = require('hardhat')

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  
  console.log('Deploying TakaCoin to', hre.network.name)
  console.log('Deployer address:', deployer.address)
  console.log('Deployer balance:', hre.ethers.utils.formatEther(await deployer.getBalance()), 'ETH')

  const TakaCoin = await hre.ethers.getContractFactory('TakaCoin')
  const token = await TakaCoin.deploy()
  await token.deployed()

  console.log('')
  console.log('✅ TakaCoin deployed!')
  console.log('Address:', token.address)
  console.log('Owner:', await token.owner())

  // Auto-verify on Etherscan (skip for local networks)
  if (hre.network.name !== 'hardhat' && hre.network.name !== 'localhost') {
    console.log('')
    console.log('⏳ Waiting for block confirmations...')
    await token.deployTransaction.wait(5) // Wait for 5 confirmations

    console.log('🔍 Verifying contract on Etherscan...')
    try {
      await hre.run('verify:verify', {
        address: token.address,
        constructorArguments: []
      })
      console.log('✅ Contract verified on Etherscan!')
    } catch (error) {
      if (error.message.includes('Already Verified')) {
        console.log('✅ Contract already verified!')
      } else {
        console.error('❌ Verification failed:', error.message)
      }
    }
  }

  console.log('')
  console.log('Contract URL: https://sepolia.etherscan.io/address/' + token.address)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
