// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/* istanbul ignore file */

contract RejectEther {
  receive() external payable {
    revert('REJECT_ETHER');
  }
}

