const hre = require('hardhat')

// Contract address to verify (change this to your deployed address)
const CONTRACT_ADDRESS = '0xf897B4F27b3aCA64b24f4a3d57AB7afC49DFd72E'

async function main() {
  console.log('🔍 Verifying TakaCoin at:', CONTRACT_ADDRESS)
  console.log('Network:', hre.network.name)

  try {
    await hre.run('verify:verify', {
      address: CONTRACT_ADDRESS,
      constructorArguments: []
    })
    console.log('✅ Contract verified successfully!')
    console.log('URL: https://sepolia.etherscan.io/address/' + CONTRACT_ADDRESS)
  } catch (error) {
    if (error.message.includes('Already Verified')) {
      console.log('✅ Contract is already verified!')
    } else {
      console.error('❌ Verification failed:', error.message)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
