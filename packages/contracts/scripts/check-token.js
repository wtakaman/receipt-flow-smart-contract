const hre = require('hardhat')

async function main() {
  const tokenAddress = process.argv[2]
  if (!tokenAddress) {
    console.error('Usage: npx hardhat run scripts/check-token.js --network sepolia <token-address>')
    process.exit(1)
  }

  const checksumAddress = hre.ethers.utils.getAddress(tokenAddress)
  console.log(`Checking token at ${checksumAddress} on ${hre.network.name}...`)
  
  const code = await hre.ethers.provider.getCode(checksumAddress)
  console.log(`Code length: ${code.length} characters`)
  console.log(`Code (first 100 chars): ${code.substring(0, 100)}...`)
  
  if (code === '0x' || code === '0x0') {
    console.log('❌ No code found - RPC cannot see this contract yet')
    console.log(`   Verify on Etherscan: https://sepolia.etherscan.io/address/${checksumAddress}`)
    console.log('   This may be due to RPC sync delay. Wait a few minutes and try again.')
  } else {
    console.log('✓ Code found - contract is visible to RPC')
    const codeSize = (code.length - 2) / 2 // Remove '0x' and convert hex to bytes
    console.log(`   Contract size: ${codeSize} bytes`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

