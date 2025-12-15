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
  address public defaultReceiptNFT;

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
   * @dev Set a default receipt NFT contract; factory will attempt to link new invoice contracts to it.
   */
  function setDefaultReceiptNFT(address _receiptNFT) external onlyOwner {
    defaultReceiptNFT = _receiptNFT;
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
  ) external payable {
    InvoiceFlowContract newInvoiceFlowContract = new InvoiceFlowContract(
      _owners,
      _withdrawAddress,
      _acceptedTokens,
      _requiredOwnersApprovals
    );

    if (defaultReceiptNFT != address(0)) {
      try newInvoiceFlowContract.setReceiptNFT(defaultReceiptNFT) {
        // best-effort; will succeed only if factory is an owner
      } catch {
        // ignore if caller is not authorized; front-end can set manually
      }
    }

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
