// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Strings.sol';
import './IReceiptNFT.sol';

/**
 * @title ReceiptNFT
 * @dev Soulbound ERC-721 receipts for paid invoices. Only authorized minters (invoice contracts)
 *      can mint. Transfers are blocked after minting.
 */
contract ReceiptNFT is ERC721, Ownable, IReceiptNFT {
  using Strings for uint256;

  struct Receipt {
    address invoiceContract;
    uint256 invoiceId;
    address payer;
    address token;
    uint256 amount;
    uint256 paidAt;
  }

  mapping(uint256 => Receipt) private receipts;
  mapping(address => bool) public minters;
  uint256 private nextId = 1;

  event ReceiptMinted(uint256 indexed tokenId, address indexed invoiceContract, uint256 indexed invoiceId, address payer);
  event MinterAdded(address indexed minter);
  event MinterRemoved(address indexed minter);

  modifier onlyMinter() {
    require(minters[msg.sender], 'NOT_MINTER');
    _;
  }

  constructor() ERC721('ReceiptNFT', 'RCPT') {}

  /**
   * @dev Authorize an invoice contract to mint receipts.
   */
  function addMinter(address minter) external onlyOwner {
    require(minter != address(0), 'INVALID_MINTER');
    minters[minter] = true;
    emit MinterAdded(minter);
  }

  /**
   * @dev Revoke a minter.
   */
  function removeMinter(address minter) external onlyOwner {
    delete minters[minter];
    emit MinterRemoved(minter);
  }

  /**
   * @dev Mint a receipt NFT to the payer. Only callable by authorized minters.
   */
  function mintReceipt(
    address invoiceContract,
    uint256 invoiceId,
    address payer,
    address token,
    uint256 amount
  ) external override onlyMinter returns (uint256) {
    require(payer != address(0), 'INVALID_PAYER');
    uint256 tokenId = nextId++;
    receipts[tokenId] = Receipt({
      invoiceContract: invoiceContract,
      invoiceId: invoiceId,
      payer: payer,
      token: token,
      amount: amount,
      paidAt: block.timestamp
    });
    _safeMint(payer, tokenId);
    emit ReceiptMinted(tokenId, invoiceContract, invoiceId, payer);
    return tokenId;
  }

  /**
   * @dev Returns receipt data.
   */
  function getReceipt(uint256 tokenId) external view returns (Receipt memory) {
    require(_exists(tokenId), 'NONEXISTENT_TOKEN');
    return receipts[tokenId];
  }

  /**
   * @dev Prevent transfers after minting (soulbound).
   */
  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 tokenId,
    uint256 batchSize
  ) internal override {
    if (from != address(0) && to != address(0)) {
      revert('SOULBOUND');
    }
    super._beforeTokenTransfer(from, to, tokenId, batchSize);
  }

  /**
   * @dev On-chain metadata with minimal JSON.
   */
  function tokenURI(uint256 tokenId) public view override returns (string memory) {
    require(_exists(tokenId), 'NONEXISTENT_TOKEN');
    Receipt memory r = receipts[tokenId];
    string memory json = string.concat(
      '{"name":"Receipt #',
      tokenId.toString(),
      '",',
      '"description":"On-chain receipt for invoice ',
      r.invoiceId.toString(),
      '",',
      '"attributes":[',
      '{"trait_type":"Invoice ID","value":"', r.invoiceId.toString(), '"},',
      '{"trait_type":"Invoice Contract","value":"', _toHexString(r.invoiceContract), '"},',
      '{"trait_type":"Payer","value":"', _toHexString(r.payer), '"},',
      '{"trait_type":"Token","value":"', _toHexString(r.token), '"},',
      '{"trait_type":"Amount","value":"', r.amount.toString(), '"},',
      '{"trait_type":"Paid At","value":"', r.paidAt.toString(), '"}',
      ']}'
    );
    return string(abi.encodePacked('data:application/json,', json));
  }

  function _toHexString(address account) private pure returns (string memory) {
    return Strings.toHexString(uint256(uint160(account)), 20);
  }
}
