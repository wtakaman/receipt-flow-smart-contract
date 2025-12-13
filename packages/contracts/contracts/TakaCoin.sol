// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/* ---------------------------------------------------------
 *   Minimal Ownable (OpenZeppelin-compatible)
 * --------------------------------------------------------- */
abstract contract Ownable {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Owner cannot be zero");
        _owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    modifier onlyOwner() {
        require(msg.sender == _owner, "Ownable: caller is not the owner");
        _;
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner is zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}

/* ---------------------------------------------------------
 *   Minimal ERC20 (OpenZeppelin-compatible)
 * --------------------------------------------------------- */
contract ERC20 {
    string private _name;
    string private _symbol;

    uint8 private constant _decimals = 18;
    uint256 private _totalSupply;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    /* -------- View Functions -------- */
    function name() public view returns (string memory) { return _name; }
    function symbol() public view returns (string memory) { return _symbol; }
    function decimals() public pure returns (uint8) { return _decimals; }
    function totalSupply() public view returns (uint256) { return _totalSupply; }
    function balanceOf(address account) public view returns (uint256) { return _balances[account]; }

    /* -------- Transfers -------- */
    function transfer(address to, uint256 amount) public returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "ERC20: transfer to zero");
        require(_balances[from] >= amount, "ERC20: insufficient balance");

        unchecked {
            _balances[from] -= amount;
            _balances[to] += amount;
        }

        emit Transfer(from, to, amount);
    }

    /* -------- Allowance -------- */
    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        require(spender != address(0), "ERC20: approve to zero");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        uint256 allowed = _allowances[from][msg.sender];
        require(allowed >= amount, "ERC20: insufficient allowance");

        _transfer(from, to, amount);

        unchecked {
            _allowances[from][msg.sender] = allowed - amount;
        }

        emit Approval(from, msg.sender, _allowances[from][msg.sender]);
        return true;
    }

    /* -------- Minting -------- */
    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "ERC20: mint to zero");

        _totalSupply += amount;
        _balances[to] += amount;

        emit Transfer(address(0), to, amount);
    }
}

/* ---------------------------------------------------------
 *                  TakaCoin (TKC)
 * --------------------------------------------------------- */

/// @custom:dev-run-script deploy_and_mint.js
contract TakaCoin is ERC20, Ownable {
    constructor()
        ERC20("TakaCoin", "TKC")
        Ownable(msg.sender)
    {}

    // Public minting function - anyone can mint (testnet only!)
    function showMeTheMoney(address to, uint256 amount) external {
        _mint(to, amount);
    }
}