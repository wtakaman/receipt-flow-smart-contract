// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;
import 'hardhat/console.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol';

contract ReceiptFlowContract {
  using SafeERC20 for IERC20;

  /**
   * @notice The receipt struct
   * @param customer The customer address
   * @param receiptId The receipt id
   * @param amount The amount of the receipt
   * @param expiration The expiration of the receipt
   */
  struct Receipt {
    address customer;
    uint256 id;
    uint256 amount;
    address token;
    uint256 expiration;
  }

  /**
   * @notice The withdraw struct
   * @param value The value of the transaction
   * @param executed The executed status of the transaction
   * @param data The data of the transaction
   */
  struct WithdrawRequest {
    uint256 id;
    uint256 amount;
    address token;
    bool executed;
    bytes data;
    mapping(address => bool) confirmations;
  }

  /*
   * @notice The withdraw address change struct
   * @param withdrawAddress The new withdraw address
   * @param executed The executed status of the transaction
   */
  struct WithdrawAddressChangeRequest {
    address withdrawAddress;
    bool executed;
  }

  // create event for Receipt created

  /**
   * @notice store the receipts registered
   */
  mapping(uint256 => Receipt) public receipts;
  /**
   * @notice store the supported tokens
   */
  mapping(address => bool) supportedTokens;
  /**
   * @notice store the withdraw requests
   */
  mapping(uint => WithdrawRequest) public withdrawRequests;
  /**
   * @notice store the withdraw address change requests
   */
  mapping(address => bool) public withdrawAddressChangeApprovals;
  /**
   * @notice store the withdraw address change requests
   */
  address public newWithdrawAddress;

  /**
   * @notice store the withdraw requests count
   */
  uint256 withdrawRequestCount = 0;

  /**
   * @notice store the withdraw address change requests count
   */
  address public withdrawAddress;

  /**
   * @notice store the required owners approvals
   */
  uint256 public requiredOwnersApprovals;

  /**
   * @notice store the owners
   */
  address[] public owners;

  /**
   * @notice store the owners mappings
   */
  mapping(address => bool) public ownersMappings;

  /**
   * @notice store the smart contract owner
   */
  address smartContractOwner;

  /**
   * @notice Create a new smart contract
   * @param _owners The owners of the smart contract
   * @param _withdrawAddress The withdraw address
   * @param _acceptedTokens The accepted tokens
   * @param _requiredOwnersApprovals The required owners approvals
   */
  constructor(
    address[] memory _owners,
    address _withdrawAddress,
    address[] memory _acceptedTokens,
    uint8 _requiredOwnersApprovals
  ) {
    require(_owners.length > 0, 'OWNERS_ARE_REQUIRED');
    require(_withdrawAddress != address(0), 'WITHDRAW_ADDRESS_REQUIRED');
    require(_requiredOwnersApprovals <= _owners.length, 'INVALID_APPROVALS_NUMBER');

    // set required withdraw approvals
    requiredOwnersApprovals = _requiredOwnersApprovals;

    // set smartContractOwner
    smartContractOwner = msg.sender;

    // set withdraw address
    withdrawAddress = _withdrawAddress;

    // add owners to mapping
    uint ownersLength = _owners.length;
    owners = _owners;

    // adding owners to mapping
    for (uint i = 0; i < ownersLength; i++) {
      ownersMappings[_owners[i]] = true;
    }

    // add ether to supported tokens
    supportedTokens[address(0)] = true;

    // add accepted tokens to mapping
    uint tokensAcceptedLength = _acceptedTokens.length;
    for (uint i = 0; i < tokensAcceptedLength; i++) {
      require(isContract(_acceptedTokens[i]), 'INVALID_TOKEN_ADDRESS');
      supportedTokens[_acceptedTokens[i]] = true;
    }
  }

  /**
   * @notice Add a receipt to the smart contract
   * @param _receiptId The receipt id
   * @param _customer The customer address
   * @param _amount The amount of the receipt
   */
  function registerReceipt(uint256 _receiptId, address _customer, uint256 _amount, address _token) public onlyOwners {
    require(_amount > 0, 'INVALID_AMOUNT');
    require(_customer != address(0), 'INVALID_ADDRESS');
    require(_receiptId > 0, 'INVALID_RECEIPT_ID');
    require(supportedTokens[_token] == true, 'ERC20_TOKEN_NOT_SUPPORTED');
    require(receipts[_receiptId].expiration == 0, 'RECEIPT_ALREADY_EXIST');
    receipts[_receiptId] = Receipt({
      id: _receiptId,
      customer: _customer,
      amount: _amount,
      token: _token,
      expiration: block.timestamp + 15 * 60
    });
  }

  /**
   * @notice Remove a registered receipt
   * @param _receiptId The receipt id
   */
  function removeReceipt(uint256 _receiptId) public onlyOwners {
    require(_receiptId > 0, 'INVALID_RECEIPT_ID');
    require(receipts[_receiptId].id == _receiptId, 'RECEIPT_NOT_FOUND');
    delete receipts[_receiptId];
  }

  /**
   * @notice handleTransfer
   * and check if the receipt exists and the token is supported
   */
  function handleTransfer(uint _receiptId) public payable {
    Receipt storage receipt = receipts[_receiptId];

    require(receipt.id == _receiptId, 'RECEIPT_NOT_FOUND');
    require(receipt.customer == address(msg.sender), 'CUSTOMER_ADDRESS_NOT_MATCH');
    require(block.timestamp <= receipt.expiration, 'RECEIPT_EXPIRED');

    // is ERC-20 token
    if (isContract(receipt.token)) {
      IERC20 token = IERC20(receipt.token);
      require(token.allowance(msg.sender, address(this)) >= receipt.amount, 'ALLOWANCE_NOT_SUFFICIENT');
      require(token.balanceOf(msg.sender) >= receipt.amount, 'INSUFFICIENT_BALANCE');
      token.safeTransferFrom(msg.sender, address(this), receipt.amount);
      delete receipts[_receiptId];
      return;
    }
    // is ether
    require(receipt.amount == msg.value, 'SENT_AMOUNT_NOT_MATCH');
    delete receipts[_receiptId];
    return;
  }

  /**
   * @notice Withdraw funds from the smart contract
   */
  function registerWithdrawRequest(uint256 _amount, address _token) internal onlyOwners returns (uint256) {
    require(_amount > 0, 'INVALID_AMOUNT');
    require(supportedTokens[_token] == true, 'ERC20_TOKEN_NOT_SUPPORTED');
    if (_token != address(0)) {
      IERC20 token = IERC20(_token);
      require(token.balanceOf(address(this)) >= _amount, 'INSUFFICIENT_BALANCE');
    } else {
      require(address(this).balance >= _amount, 'INSUFFICIENT_BALANCE');
    }
    withdrawRequestCount = withdrawRequestCount + 1;
    WithdrawRequest storage withdrawRequest = withdrawRequests[withdrawRequestCount];
    withdrawRequest.id = withdrawRequestCount;
    withdrawRequest.amount = _amount;
    withdrawRequest.token = _token;
    withdrawRequest.executed = false;
    withdrawRequest.data = msg.data;
    return withdrawRequestCount;
  }

  /**
   * @notice Submit a withdraw request
   * @param _amount The value of the transaction
   * @param _token The value smart contract address
   */
  function submitWithdrawRequest(uint _amount, address _token) public onlyOwners returns (uint256) {
    uint256 id = registerWithdrawRequest(_amount, _token);
    confirmWithdrawRequest(id);
    return id;
  }

  /**
   * @notice confirm a withdraw request
   * @param _id The transaction id
   */
  function confirmWithdrawRequest(uint256 _id) public onlyOwners {
    require(withdrawRequests[_id].executed == false, 'WITHDRAW_ALREADY_EXECUTED');
    require(withdrawRequests[_id].confirmations[msg.sender] == false, 'ALREADY_CONFIRMED');
    withdrawRequests[_id].confirmations[msg.sender] = true;
    if (isWithdrawConfirmed(_id)) {
      executeWithdraw(_id);
    }
  }

  /**
   * @notice execute a withdraw transaction
   * @param _id The transaction id
   */
  function executeWithdraw(uint _id) public payable onlyOwners {
    require(withdrawRequests[_id].executed == false, 'WITHDRAW_ALREADY_EXECUTED');
    if (withdrawRequests[_id].token == address(0)) {
      (bool success, ) = withdrawAddress.call{ value: withdrawRequests[_id].amount }(withdrawRequests[_id].data);
      require(success);
      withdrawRequests[_id].executed = true;
    } else {
      IERC20 tokenContract = IERC20(withdrawRequests[_id].token);
      tokenContract.safeApprove(address(this), withdrawRequests[_id].amount);
      tokenContract.safeTransfer(withdrawAddress, withdrawRequests[_id].amount);
      withdrawRequests[_id].executed = true;
    }
  }

  /**
   * @notice check if a withdraw transaction has been confirmed
   * @param _id The transaction id
   * @return uint
   */
  function isWithdrawConfirmed(uint _id) public view returns (bool) {
    return withdrawRequestConfirmationsCount(_id) >= requiredOwnersApprovals;
  }

  function withdrawRequestConfirmationsCount(uint256 _id) public view returns (uint256) {
    uint256 numConfirmations = 0;
    for (uint i = 0; i < owners.length; i++) {
      if (withdrawRequests[_id].confirmations[owners[i]] == true) {
        numConfirmations++;
      }
    }
    return numConfirmations;
  }

  function withdrawAddressChangeConfirmationsCount() public view returns (uint256) {
    uint256 numConfirmations = 0;
    for (uint i = 0; i < owners.length; i++) {
      if (withdrawAddressChangeApprovals[owners[i]] == true) {
        numConfirmations++;
      }
    }
    return numConfirmations;
  }

  /**
   * @notice Withdraw funds from the smart contract
   */
  function changeWithdrawAddressRequest(address _newAddress) public onlyOwners {
    require(_newAddress != address(0), 'INVALID_ADDRESS');
    require(withdrawAddress != _newAddress, 'NEW_ADDRESS_MUST_BE_SET');

    newWithdrawAddress = _newAddress;
    confirmWithdrawAddressChange();
  }

  /**
   * @notice Confirm a withdraw address change
   */
  function confirmWithdrawAddressChange() public onlyOwners {
    require(withdrawAddressChangeApprovals[msg.sender] == false, 'ALREADY_CONFIRMED');
    withdrawAddressChangeApprovals[msg.sender] = true;
    if (withdrawAddressChangeConfirmationsCount() >= requiredOwnersApprovals) {
      withdrawAddress = newWithdrawAddress;
      newWithdrawAddress = address(0);
      for (uint i = 0; i < owners.length; i++) {
        delete withdrawAddressChangeApprovals[owners[i]];
      }
    }
  }

  /**
   * @notice only a smart contract owner can call this function
   */
  modifier onlyOwners() {
    require(isOwner(), 'UNAUTHORIZED');
    _;
  }

  /**
   * @notice Checks if the caller is an owner
   * @return bool
   */
  function isOwner() internal view returns (bool) {
    return ownersMappings[msg.sender];
  }

  /**
   * @notice Checks if the address is a smart contract
   * @return bool
   */
  function isContract(address _addr) private view returns (bool) {
    uint32 size;
    assembly {
      size := extcodesize(_addr)
    }
    return (size > 0);
  }
}
