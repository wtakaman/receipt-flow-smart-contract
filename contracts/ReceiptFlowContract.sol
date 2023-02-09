// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;
import 'hardhat/console.sol';
// import IERC20 from openzeppelin
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

// test tokken
import '@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol';

contract ReceiptFlowContract {
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

  mapping(uint256 => Receipt) public receipts;
  mapping(address => bool) supportedTokens;
  mapping(uint => WithdrawRequest) public withdrawRequests;
  mapping(uint => mapping(address => bool)) public withdrawRequestsConfirmation;
  mapping(address => bool) public withdrawAddressChangeApprovals;
  address newWithdrawAddress;

  uint256 withdrawRequestCount = 0;
  address withdrawAddress;
  uint256 public requiredOwnersApprovals;

  address[] public owners;
  address smartContractOwner;

  constructor(
    address[] memory _owners,
    address _withdrawAddress,
    address[] memory _acceptedTokens,
    uint8 _requiredOwnersApprovals
  ) {
    require(_owners.length > 0, 'Owners must be greater than 0');
    require(_withdrawAddress != address(0), 'Withdraw address must be set');
    require(_acceptedTokens.length > 0, 'Accepted tokens must be greater than 0');
    require(_requiredOwnersApprovals <= _owners.length, 'Required approvals must be less than or equal to owners');

    // set required withdraw approvals
    requiredOwnersApprovals = _requiredOwnersApprovals;

    // set smartContractOwner
    smartContractOwner = msg.sender;

    // set withdraw address
    withdrawAddress = _withdrawAddress;

    // add owners to mapping
    uint ownersLength = _owners.length;
    for (uint i = 0; i < ownersLength; i++) {
      owners.push(_owners[i]);
    }

    // add ether to supported tokens
    supportedTokens[address(0)] = true;

    // add accepted tokens to mapping
    uint tokensAcceptedLength = _acceptedTokens.length;
    for (uint i = 0; i < tokensAcceptedLength; i++) {
      supportedTokens[_acceptedTokens[i]] = true;
    }
  }

  /**
   * @notice Add a receipt to the smart contract
   * @param _receiptId The receipt id
   * @param _customer The customer address
   * @param _amount The amount of the receipt
   */
  function addReceipt(uint256 _receiptId, address _customer, uint256 _amount, address _token) public onlyOwners {
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
   * @notice handleTransfer
   * and check if the receipt exists and the token is supported
   */
  function handleTransfer(uint _receiptId) public payable {
    Receipt storage receipt = receipts[_receiptId];

    require(receipt.id > 0, 'Receipt does not exist');
    require(receipt.customer == address(msg.sender), 'Sender address does not match customer address in receipt');
    require(block.timestamp <= receipt.expiration, 'Receipt has expired');

    // is ERC-20 token
    if (isContract(receipt.token)) {
      IERC20 token = IERC20(receipt.token);
      require(token.allowance(msg.sender, address(this)) >= receipt.amount, 'Token allowance is not sufficient');
      require(token.balanceOf(msg.sender) >= receipt.amount, 'Token balance is not sufficient');
      require(token.transferFrom(msg.sender, address(this), receipt.amount), 'Token transfer failed');
      delete receipts[_receiptId];
      return;
    }
    // is ether
    require(receipt.amount == msg.value, 'Amount in transfer does not match receipt amount');
    delete receipts[_receiptId];
    return;
  }

  /**
   * @notice Withdraw funds from the smart contract
   */
  function addWithdrawRequest(uint256 _amount, address _token) internal onlyOwners returns (uint256) {
    uint256 newId = ++withdrawRequestCount;
    withdrawRequests[newId] = WithdrawRequest(newId, _amount, _token, false, msg.data);
    return newId;
  }

  /**
   * @notice Submit a withdraw request
   * @param _value The value of the transaction
   * @param _token The value smart contract address
   */
  function submitWithdrawRequest(uint _value, address _token) public onlyOwners {
    require(withdrawAddress != address(0), 'Withdraw address not set');
    require(_value > 0, 'Value must be greater than 0');
    require(supportedTokens[_token] == true, 'ERC20_TOKEN_NOT_SUPPORTED');
    if (_token == address(0)) {
      IERC20 token = IERC20(_token);
      require(token.balanceOf(address(this)) >= _value, 'Insufficient funds');
    } else {
      require(address(this).balance >= _value, 'Insufficient funds');
    }
    uint id = addWithdrawRequest(_value, _token);
    confirmWithdraw(id);
  }

  /**
   * @notice confirm a withdraw request
   * @param _id The transaction id
   */
  function confirmWithdraw(uint256 _id) public onlyOwners {
    require(withdrawRequests[_id].executed == false, 'Transaction already executed');
    require(withdrawRequestsConfirmation[_id][msg.sender] == false, 'Already confirmed by owner');
    withdrawRequestsConfirmation[_id][msg.sender] = true;

    if (isWithdrawConfirmed(_id)) {
      executeWithdraw(_id);
    }
  }

  /**
   * @notice check if a withdraw transaction has been confirmed
   * @param _id The transaction id
   * @return uint
   */
  function isWithdrawConfirmed(uint _id) public view returns (bool) {
    return getWithdrawConfirmationsCount(_id) >= requiredOwnersApprovals;
  }

  function getWithdrawConfirmationsCount(uint256 _id) internal view returns (uint256) {
    uint256 numConfirmations = 0;
    for (uint i = 0; i < owners.length; i++) {
      if (withdrawRequestsConfirmation[_id][owners[i]] == true) {
        numConfirmations++;
      }
    }
    return numConfirmations;
  }

  function getWithdrawAddressChangeConfirmationsCount() internal view returns (uint256) {
    uint256 numConfirmations = 0;
    for (uint i = 0; i < owners.length; i++) {
      if (withdrawAddressChangeApprovals[owners[i]] == true) {
        numConfirmations++;
      }
    }
    return numConfirmations;
  }

  /**
   * @notice execute a withdraw transaction
   * @param _id The transaction id
   */
  function executeWithdraw(uint _id) public payable onlyOwners {
    require(withdrawRequests[_id].executed == false, 'Transaction already executed');
    (bool success, ) = withdrawAddress.call{ value: withdrawRequests[_id].amount }(withdrawRequests[_id].data);
    require(success);
    withdrawRequests[_id].executed = true;
  }

  /**
   * @notice Withdraw funds from the smart contract
   */
  function changeWithdrawAddress(address _newAddress) public onlyOwners {
    require(_newAddress != address(0), 'New address must be set');
    require(withdrawAddress != _newAddress, 'New address must be different than current address');

    newWithdrawAddress = _newAddress;
    withdrawAddressChangeApprovals[msg.sender] = true;
    confirmWithdrawAddressChange();
  }

  /**
   * @notice Confirm a withdraw address change
   */
  function confirmWithdrawAddressChange() public onlyOwners {
    require(newWithdrawAddress != address(0), 'New address must be set');
    require(withdrawAddressChangeApprovals[msg.sender] == false, 'Already confirmed by owner');
    require(withdrawAddress != newWithdrawAddress, 'New address must be different than current address');
    if (getWithdrawAddressChangeConfirmationsCount() >= requiredOwnersApprovals) {
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
    require(isOwner(), 'Caller is not in the owners list');
    _;
  }

  /**
   * @notice Checks if the caller is an owner
   * @return bool
   */
  function isOwner() internal view returns (bool) {
    for (uint i = 0; i < owners.length; i++) {
      if (owners[i] == msg.sender) {
        return true;
      }
    }
    return false;
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
