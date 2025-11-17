// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import './InvoiceFlowContract.sol';

/**
 * @title InvoiceFlowContractFactory
 * @dev This contract is used to create new InvoiceFlowContract contracts
 */
contract InvoiceFlowContractFactory {
  address[] public deployedInvoiceFlowContracts;
  address public owner;

  event NewInvoiceFlowContract(
    address[] _owners,
    address _withdrawAddress,
    address[] _acceptedTokens,
    uint8 _requiredOwnersApprovals
  );

  constructor() {
    owner = msg.sender;
  }

  /**
   * @dev This function is used to create new InvoiceFlowContract contracts
   * @param _owners The owners of the InvoiceFlowContract contract
   * @param _withdrawAddress The withdraw address of the InvoiceFlowContract contract
   * @param _acceptedTokens The accepted tokens of the InvoiceFlowContract contract
   * @param _requiredOwnersApprovals The required owners approvals of the InvoiceFlowContract contract
   */
  function createInvoiceFlowContract(
    address[] memory _owners,
    address _withdrawAddress,
    address[] memory _acceptedTokens,
    uint8 _requiredOwnersApprovals
  ) external payable onlyOwner {
    InvoiceFlowContract newInvoiceFlowContract = new InvoiceFlowContract(
      _owners,
      _withdrawAddress,
      _acceptedTokens,
      _requiredOwnersApprovals
    );

    deployedInvoiceFlowContracts.push(address(newInvoiceFlowContract));
    emit NewInvoiceFlowContract(_owners, _withdrawAddress, _acceptedTokens, _requiredOwnersApprovals);
  }

  /**
   * @dev This function is used to get all deployed InvoiceFlowContract contracts
   * @return The list of deployed InvoiceFlowContract contracts
   */
  function getDeployedInvoiceFlowContracts() public view returns (address[] memory) {
    return deployedInvoiceFlowContracts;
  }

  /**
   * @notice Checks if the caller is an owner
   */
  modifier onlyOwner() {
    require(owner == msg.sender, 'UNAUTHORIZED');
    _;
  }
}
