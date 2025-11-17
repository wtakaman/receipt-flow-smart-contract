// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '../InvoiceFlowContract.sol';

contract TestInvoiceFlowContract is InvoiceFlowContract {
  constructor(
    address[] memory _owners,
    address _withdrawAddress,
    address[] memory _acceptedTokens,
    uint8 _requiredOwnersApprovals
  ) InvoiceFlowContract(_owners, _withdrawAddress, _acceptedTokens, _requiredOwnersApprovals) {}

  function exposedAddWithdrawRequest(uint256 _amount, address _token) external returns (uint256) {
    return addWithdrawRequest(_amount, _token);
  }
}

