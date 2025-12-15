const hre = require('hardhat')

async function main() {
  const factoryAddress = process.env.FACTORY_ADDRESS
  const receiptAddress = process.env.RECEIPT_NFT_ADDRESS
  if (!factoryAddress || !receiptAddress) {
    throw new Error('Set FACTORY_ADDRESS and RECEIPT_NFT_ADDRESS in env before running')
  }
  const factory = await hre.ethers.getContractAt('InvoiceFlowContractFactory', factoryAddress)
  const tx = await factory.setDefaultReceiptNFT(receiptAddress)
  await tx.wait()
  console.log('Set defaultReceiptNFT to', receiptAddress, 'tx', tx.hash)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
