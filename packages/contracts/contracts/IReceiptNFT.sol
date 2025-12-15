// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IReceiptNFT {
  function mintReceipt(
    address invoiceContract,
    uint256 invoiceId,
    address payer,
    address token,
    uint256 amount
  ) external returns (uint256);
}
