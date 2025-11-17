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

  // Validate token addresses are contracts (or zero address for ETH)
  // Note: RPC may be out of sync, so we warn but don't fail - the contract will validate anyway
  const skipValidation = process.env.SKIP_TOKEN_VALIDATION === 'true'
  const zeroAddress = '0x0000000000000000000000000000000000000000'
  
  if (!skipValidation) {
    for (const token of acceptedTokens) {
      const normalizedToken = token.toLowerCase()
      if (normalizedToken === zeroAddress) {
        console.log('Note: Using zero address for ETH payments')
        continue
      }
      // Normalize to checksum address for better error messages
      const checksumToken = hre.ethers.utils.getAddress(token)
      console.log(`Checking token contract at ${checksumToken}...`)
      const code = await hre.ethers.provider.getCode(checksumToken)
      if (code === '0x' || code === '0x0') {
        console.warn(`⚠ Warning: No code found at ${checksumToken}`)
        console.warn(`  This may be due to RPC sync delay. The contract will validate it during deployment.`)
        console.warn(`  Verify on Etherscan: https://${networkName === 'sepolia' ? 'sepolia.' : ''}etherscan.io/address/${checksumToken}`)
        console.warn(`  To skip this check, set SKIP_TOKEN_VALIDATION=true in .env`)
        // Continue anyway - the contract will reject invalid addresses
      } else {
        console.log(`✓ Token contract verified at ${checksumToken}`)
      }
    }
  } else {
    console.log('Skipping token validation (SKIP_TOKEN_VALIDATION=true)')
  }

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
