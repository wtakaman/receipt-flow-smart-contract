const { ethers } = require('hardhat')

async function main() {
  // Target token and recipient
  const tokenAddress = process.env.MINT_TOKEN_ADDRESS || '0x17e71Bb5592046dc9002283F963CAEbE65851577'
  const recipient = process.env.MINT_TOKEN_RECIPIENT || '0xFe5FfD72e6561b3621c85807f56D93E21c069Ef9'
  const amount = ethers.utils.parseUnits('1000000', 18) // 1M tokens with 18 decimals

  const token = await ethers.getContractAt(
    ['function showMeTheMoney(address to,uint256 amount) external'],
    tokenAddress
  )

  console.log(`Minting ${amount.toString()} to ${recipient} on token ${tokenAddress}`)
  const tx = await token.showMeTheMoney(recipient, amount)
  console.log('Tx sent:', tx.hash)
  await tx.wait()
  console.log('Mint confirmed')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})


