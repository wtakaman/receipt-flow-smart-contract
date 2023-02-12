// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;
import 'hardhat/console.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol';

contract InvoiceFlowContract {
  using SafeERC20 for IERC20;

  /**
   * @notice The invoice struct
   * @param customer The customer address
   * @param invoiceId The invoice id
   * @param amount The amount of the invoice
   * @param expiration The expiration of the invoice
   */
  struct Invoice {
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

  event InvoiceRegistered(uint _id, address _customer, uint _amount, address _token, uint _expiration);
  event InvoicePaid(uint _id, address _customer, uint _amount, address _token, uint _expiration);
  event InvoiceRemoved(uint _id, address _customer, uint _amount, address _token, uint _expiration);

  event WithdrawRequestRegistered(uint256 _id, uint256 _amount, address _token, bool _executed);
  event WithdrawRequestApproved(uint256 _id, address _approver, uint256 _amount, address _token);
  event WithdrawRequestExecuted(uint256 _id, uint256 _amount, address _token, bool _executed);

  event WithdrawAddressChangeRequested(address _newAddress, address _submitter);
  event WithdrawAddressChangeApproved(address _newAddress, address _submitter);
  event WithdrawAddressChanged(address _oldAddress, address _newAddress);

  /**
   * @notice store the invoices registered
   */
  mapping(uint256 => Invoice) public invoices;
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
   * @notice Add a invoice to the smart contract
   * @param _invoiceId The invoice id
   * @param _customer The customer address
   * @param _amount The amount of the invoice
   * @param _expiresInSec expiration config in seconds
   */
  function registerInvoice(
    uint256 _invoiceId,
    address _customer,
    uint256 _amount,
    address _token,
    uint _expiresInSec
  ) public onlyOwners {
    require(_amount > 0, 'INVALID_AMOUNT');
    require(_customer != address(0), 'INVALID_ADDRESS');
    require(_invoiceId > 0, 'INVALID_INVOICE_ID');
    require(_expiresInSec > 0, 'INVALID_EXPIRATION_VALUE');
    require(supportedTokens[_token] == true, 'ERC20_TOKEN_NOT_SUPPORTED');
    require(invoices[_invoiceId].expiration == 0, 'INVOICE_ALREADY_EXIST');
    uint expiration = block.timestamp + _expiresInSec;
    invoices[_invoiceId] = Invoice({
      id: _invoiceId,
      customer: _customer,
      amount: _amount,
      token: _token,
      expiration: expiration
    });
    emit InvoiceRegistered(_invoiceId, _customer, _amount, _token, expiration);
  }

  /**
   * @notice Remove a registered invoice
   * @param _invoiceId The invoice id
   */
  function removeInvoice(uint256 _invoiceId) public onlyOwners {
    require(_invoiceId > 0, 'INVALID_INVOICE_ID');
    require(invoices[_invoiceId].id == _invoiceId, 'INVOICE_NOT_FOUND');
    emit InvoiceRemoved(
      invoices[_invoiceId].id,
      invoices[_invoiceId].customer,
      invoices[_invoiceId].amount,
      invoices[_invoiceId].token,
      invoices[_invoiceId].expiration
    );
    delete invoices[_invoiceId];
  }

  /**
   * @notice handleTransfer
   * and check if the invoice exists and the token is supported
   */
  function handleTransfer(uint _invoiceId) public payable {
    Invoice storage invoice = invoices[_invoiceId];

    require(invoice.id == _invoiceId, 'INVOICE_NOT_FOUND');
    require(invoice.customer == address(msg.sender), 'CUSTOMER_ADDRESS_NOT_MATCH');
    require(block.timestamp <= invoice.expiration, 'INVOICE_EXPIRED');

    // is ERC-20 token
    if (isContract(invoice.token)) {
      IERC20 token = IERC20(invoice.token);
      require(token.allowance(msg.sender, address(this)) >= invoice.amount, 'ALLOWANCE_NOT_SUFFICIENT');
      require(token.balanceOf(msg.sender) >= invoice.amount, 'INSUFFICIENT_BALANCE');
      token.safeTransferFrom(msg.sender, address(this), invoice.amount);
      emit InvoicePaid(
        invoices[_invoiceId].id,
        invoices[_invoiceId].customer,
        invoices[_invoiceId].amount,
        invoices[_invoiceId].token,
        invoices[_invoiceId].expiration
      );
      delete invoices[_invoiceId];
    } else {
      // is ether
      require(invoice.amount == msg.value, 'SENT_AMOUNT_NOT_MATCH');
      emit InvoicePaid(
        invoices[_invoiceId].id,
        invoices[_invoiceId].customer,
        invoices[_invoiceId].amount,
        invoices[_invoiceId].token,
        invoices[_invoiceId].expiration
      );
      delete invoices[_invoiceId];
    }
  }

  /**
   * @notice Withdraw funds from the smart contract
   */
  function addWithdrawRequest(uint256 _amount, address _token) internal onlyOwners returns (uint256) {
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
    emit WithdrawRequestRegistered(withdrawRequestCount, _amount, _token, false);
    return withdrawRequestCount;
  }

  /**
   * @notice Submit a withdraw request
   * @param _amount The value of the transaction
   * @param _token The value smart contract address
   */
  function registerWithdrawRequest(uint _amount, address _token) public onlyOwners returns (uint256) {
    uint256 id = addWithdrawRequest(_amount, _token);
    approveWithdrawRequest(id);
    return id;
  }

  /**
   * @notice confirm a withdraw request
   * @param _id The transaction id
   */
  function approveWithdrawRequest(uint256 _id) public onlyOwners {
    require(withdrawRequests[_id].executed == false, 'WITHDRAW_ALREADY_EXECUTED');
    require(withdrawRequests[_id].confirmations[msg.sender] == false, 'ALREADY_CONFIRMED');
    withdrawRequests[_id].confirmations[msg.sender] = true;
    emit WithdrawRequestApproved(_id, msg.sender, withdrawRequests[_id].amount, withdrawRequests[_id].token);
    if (isWithdrawConfirmed(_id)) {
      executeWithdrawRequest(_id);
    }
  }

  /**
   * @notice execute a withdraw transaction
   * @param _id The transaction id
   */
  function executeWithdrawRequest(uint _id) public payable onlyOwners {
    require(isWithdrawConfirmed(_id), 'NOT_ENOUGH_CONFIRMATIONS');
    require(withdrawRequests[_id].executed == false, 'WITHDRAW_ALREADY_EXECUTED');
    if (withdrawRequests[_id].token == address(0)) {
      (bool success, ) = withdrawAddress.call{ value: withdrawRequests[_id].amount }(withdrawRequests[_id].data);
      require(success);
      withdrawRequests[_id].executed = true;
      emit WithdrawRequestExecuted(_id, withdrawRequests[_id].amount, withdrawRequests[_id].token, true);
    } else {
      IERC20 tokenContract = IERC20(withdrawRequests[_id].token);
      tokenContract.safeApprove(address(this), withdrawRequests[_id].amount);
      tokenContract.safeTransfer(withdrawAddress, withdrawRequests[_id].amount);
      withdrawRequests[_id].executed = true;
      emit WithdrawRequestExecuted(_id, withdrawRequests[_id].amount, withdrawRequests[_id].token, true);
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
    emit WithdrawAddressChangeRequested(_newAddress, msg.sender);
    confirmWithdrawAddressChange();
  }

  /**
   * @notice Confirm a withdraw address change
   */
  function confirmWithdrawAddressChange() public onlyOwners {
    require(withdrawAddressChangeApprovals[msg.sender] == false, 'ALREADY_CONFIRMED');
    withdrawAddressChangeApprovals[msg.sender] = true;
    emit WithdrawAddressChangeRequested(newWithdrawAddress, msg.sender);
    if (withdrawAddressChangeConfirmationsCount() >= requiredOwnersApprovals) {
      address oldAddress = withdrawAddress;
      withdrawAddress = newWithdrawAddress;
      newWithdrawAddress = address(0);
      for (uint i = 0; i < owners.length; i++) {
        delete withdrawAddressChangeApprovals[owners[i]];
      }
      emit WithdrawAddressChangeRequested(oldAddress, newWithdrawAddress);
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
