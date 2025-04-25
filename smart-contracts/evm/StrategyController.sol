// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title StrategyController
 * @dev Controls yield strategies for the IntelliLend cross-chain liquidity module
 */
contract StrategyController is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Cross-chain liquidity module address
    address public liquidityModule;
    
    // Strategy information
    struct Strategy {
        string name;
        uint256 projectedAPY;
        uint256 riskScore;
        bool isActive;
        uint256 allocatedAmount;
        uint256 lastHarvest;
        uint256 totalHarvested;
        address targetProtocol;
        bytes32 targetChain;
    }
    
    // Token to strategy mapping
    mapping(address => Strategy) public strategies;
    
    // Authorized strategies
    mapping(address => bool) public authorizedTokens;
    
    // Events
    event Allocated(address indexed token, uint256 amount);
    event Withdrawn(address indexed token, uint256 amount);
    event Harvested(address indexed token, uint256 amount, uint256 fee);
    event StrategyUpdated(address indexed token, string name, uint256 projectedAPY, uint256 riskScore);
    event EmergencyWithdrawn(address indexed token, uint256 amount);
    
    /**
     * @dev Constructor
     * @param _liquidityModule Address of the cross-chain liquidity module
     */
    constructor(address _liquidityModule) {
        require(_liquidityModule != address(0), "Invalid liquidity module address");
        liquidityModule = _liquidityModule;
    }
    
    /**
     * @dev Modifier to restrict access to liquidity module
     */
    modifier onlyLiquidityModule() {
        require(msg.sender == liquidityModule, "Only liquidity module can call");
        _;
    }
    
    /**
     * @dev Register a new token strategy
     * @param token ERC20 token address
     * @param name Strategy name
     * @param projectedAPY Projected annual yield (in basis points)
     * @param riskScore Risk score (0-100)
     * @param targetProtocol Address of the target protocol
     * @param targetChain Chain identifier (if cross-chain)
     */
    function registerStrategy(
        address token,
        string calldata name,
        uint256 projectedAPY,
        uint256 riskScore,
        address targetProtocol,
        bytes32 targetChain
    ) 
        external 
        onlyOwner 
    {
        require(token != address(0), "Invalid token address");
        require(bytes(name).length > 0, "Strategy name cannot be empty");
        require(riskScore <= 100, "Risk score must be 0-100");
        
        Strategy storage strategy = strategies[token];
        strategy.name = name;
        strategy.projectedAPY = projectedAPY;
        strategy.riskScore = riskScore;
        strategy.isActive = true;
        strategy.targetProtocol = targetProtocol;
        strategy.targetChain = targetChain;
        
        authorizedTokens[token] = true;
        
        emit StrategyUpdated(token, name, projectedAPY, riskScore);
    }
    
    /**
     * @dev Update strategy parameters
     * @param token ERC20 token address
     * @param projectedAPY Projected annual yield (in basis points)
     * @param riskScore Risk score (0-100)
     * @param isActive Whether the strategy is active
     */
    function updateStrategy(
        address token,
        uint256 projectedAPY,
        uint256 riskScore,
        bool isActive
    ) 
        external 
        onlyOwner 
    {
        require(authorizedTokens[token], "Token not registered");
        require(riskScore <= 100, "Risk score must be 0-100");
        
        Strategy storage strategy = strategies[token];
        strategy.projectedAPY = projectedAPY;
        strategy.riskScore = riskScore;
        strategy.isActive = isActive;
        
        emit StrategyUpdated(token, strategy.name, projectedAPY, riskScore);
    }
    
    /**
     * @dev Allocate tokens to the strategy
     * @param token ERC20 token address
     * @param amount Amount to allocate
     */
    function allocate(
        address token,
        uint256 amount
    ) 
        external 
        nonReentrant 
        whenNotPaused 
        onlyLiquidityModule 
        returns (bool) 
    {
        require(authorizedTokens[token], "Token not registered");
        require(amount > 0, "Amount must be greater than 0");
        require(strategies[token].isActive, "Strategy not active");
        
        Strategy storage strategy = strategies[token];
        
        // Transfer tokens from sender
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Update strategy state
        strategy.allocatedAmount += amount;
        
        // Deposit to target protocol (if applicable)
        if (strategy.targetProtocol != address(0)) {
            _depositToProtocol(token, amount, strategy.targetProtocol);
        }
        
        emit Allocated(token, amount);
        return true;
    }
    
    /**
     * @dev Withdraw tokens from the strategy
     * @param token ERC20 token address
     * @param amount Amount to withdraw
     */
    function withdraw(
        address token,
        uint256 amount
    ) 
        external 
        nonReentrant 
        onlyLiquidityModule 
        returns (bool) 
    {
        require(authorizedTokens[token], "Token not registered");
        require(amount > 0, "Amount must be greater than 0");
        
        Strategy storage strategy = strategies[token];
        require(strategy.allocatedAmount >= amount, "Insufficient allocated amount");
        
        // Withdraw from target protocol (if applicable)
        if (strategy.targetProtocol != address(0)) {
            _withdrawFromProtocol(token, amount, strategy.targetProtocol);
        }
        
        // Update strategy state
        strategy.allocatedAmount -= amount;
        
        // Transfer tokens to sender
        IERC20(token).safeTransfer(msg.sender, amount);
        
        emit Withdrawn(token, amount);
        return true;
    }
    
    /**
     * @dev Harvest yield from the strategy
     * @param token ERC20 token address
     */
    function harvest(
        address token
    ) 
        external 
        nonReentrant 
        whenNotPaused 
        returns (bool) 
    {
        require(authorizedTokens[token], "Token not registered");
        require(strategies[token].isActive, "Strategy not active");
        
        Strategy storage strategy = strategies[token];
        
        // Get token balance before harvest
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        
        // Claim rewards from target protocol (if applicable)
        if (strategy.targetProtocol != address(0)) {
            _claimRewards(token, strategy.targetProtocol);
        } else {
            // For demo purposes, simulate yield generation
            _simulateYield(token);
        }
        
        // Get token balance after harvest
        uint256 balanceAfter = IERC20(token).balanceOf(address(this));
        
        // Calculate harvested amount
        uint256 harvestedAmount = balanceAfter - balanceBefore;
        
        if (harvestedAmount > 0) {
            // Calculate fee (10%)
            uint256 fee = harvestedAmount * 10 / 100;
            uint256 netAmount = harvestedAmount - fee;
            
            // Update strategy state
            strategy.totalHarvested += harvestedAmount;
            strategy.lastHarvest = block.timestamp;
            
            // Transfer net amount to liquidity module
            IERC20(token).safeTransfer(liquidityModule, netAmount);
            
            // Keep fee in the contract
            
            emit Harvested(token, harvestedAmount, fee);
        }
        
        return true;
    }
    
    /**
     * @dev Emergency withdraw all funds from the strategy
     * @param token ERC20 token address
     */
    function emergencyWithdraw(
        address token
    ) 
        external 
        nonReentrant 
        onlyOwner 
        returns (bool) 
    {
        require(authorizedTokens[token], "Token not registered");
        
        Strategy storage strategy = strategies[token];
        uint256 amount = strategy.allocatedAmount;
        
        if (amount > 0) {
            // Withdraw from target protocol (if applicable)
            if (strategy.targetProtocol != address(0)) {
                _emergencyWithdrawFromProtocol(token, strategy.targetProtocol);
            }
            
            // Reset strategy state
            strategy.allocatedAmount = 0;
            
            // Transfer all tokens to liquidity module
            uint256 balance = IERC20(token).balanceOf(address(this));
            IERC20(token).safeTransfer(liquidityModule, balance);
            
            emit EmergencyWithdrawn(token, balance);
        }
        
        return true;
    }
    
    /**
     * @dev Pause the strategy controller
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause the strategy controller
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Set the liquidity module address
     * @param _liquidityModule New liquidity module address
     */
    function setLiquidityModule(address _liquidityModule) external onlyOwner {
        require(_liquidityModule != address(0), "Invalid liquidity module address");
        liquidityModule = _liquidityModule;
    }
    
    /**
     * @dev Get strategy details
     * @param token ERC20 token address
     * @return name Strategy name
     * @return projectedAPY Projected annual yield
     * @return riskScore Risk score
     * @return isActive Whether the strategy is active
     * @return allocatedAmount Amount allocated to the strategy
     * @return lastHarvest Timestamp of the last harvest
     * @return totalHarvested Total amount harvested
     */
    function getStrategyDetails(
        address token
    ) 
        external 
        view 
        returns (
            string memory name,
            uint256 projectedAPY,
            uint256 riskScore,
            bool isActive,
            uint256 allocatedAmount,
            uint256 lastHarvest,
            uint256 totalHarvested
        ) 
    {
        Strategy storage strategy = strategies[token];
        
        return (
            strategy.name,
            strategy.projectedAPY,
            strategy.riskScore,
            strategy.isActive,
            strategy.allocatedAmount,
            strategy.lastHarvest,
            strategy.totalHarvested
        );
    }
    
    /**
     * @dev Get all fees collected for a token
     * @param token ERC20 token address
     * @return amount Amount of fees collected
     */
    function getCollectedFees(address token) external view returns (uint256) {
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 allocated = strategies[token].allocatedAmount;
        
        // Fees = balance - allocated (since allocated amount doesn't include fees)
        return balance > allocated ? balance - allocated : 0;
    }
    
    /**
     * @dev Withdraw collected fees
     * @param token ERC20 token address
     * @param recipient Address to receive the fees
     */
    function withdrawFees(address token, address recipient) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 allocated = strategies[token].allocatedAmount;
        
        // Calculate fees
        uint256 fees = balance > allocated ? balance - allocated : 0;
        require(fees > 0, "No fees to withdraw");
        
        // Transfer fees to recipient
        IERC20(token).safeTransfer(recipient, fees);
    }
    
    /**
     * @dev Deposit tokens to target protocol
     * @param token ERC20 token address
     * @param amount Amount to deposit
     * @param targetProtocol Address of the target protocol
     */
    function _depositToProtocol(
        address token,
        uint256 amount,
        address targetProtocol
    ) 
        internal 
    {
        // In a real implementation, this would call the appropriate
        // function on the target protocol to deposit tokens
        
        // For demo purposes, we'll just simulate it by keeping tokens in this contract
        // IERC20(token).safeApprove(targetProtocol, amount);
        // IExternalProtocol(targetProtocol).deposit(token, amount);
    }
    
    /**
     * @dev Withdraw tokens from target protocol
     * @param token ERC20 token address
     * @param amount Amount to withdraw
     * @param targetProtocol Address of the target protocol
     */
    function _withdrawFromProtocol(
        address token,
        uint256 amount,
        address targetProtocol
    ) 
        internal 
    {
        // In a real implementation, this would call the appropriate
        // function on the target protocol to withdraw tokens
        
        // For demo purposes, we'll just simulate it
        // IExternalProtocol(targetProtocol).withdraw(token, amount);
    }
    
    /**
     * @dev Claim rewards from target protocol
     * @param token ERC20 token address
     * @param targetProtocol Address of the target protocol
     */
    function _claimRewards(
        address token,
        address targetProtocol
    ) 
        internal 
    {
        // In a real implementation, this would call the appropriate
        // function on the target protocol to claim rewards
        
        // For demo purposes, we'll just simulate it
        // IExternalProtocol(targetProtocol).claimRewards(token);
    }
    
    /**
     * @dev Emergency withdraw from target protocol
     * @param token ERC20 token address
     * @param targetProtocol Address of the target protocol
     */
    function _emergencyWithdrawFromProtocol(
        address token,
        address targetProtocol
    ) 
        internal 
    {
        // In a real implementation, this would call the appropriate
        // function on the target protocol for emergency withdrawal
        
        // For demo purposes, we'll just simulate it
        // IExternalProtocol(targetProtocol).emergencyWithdraw(token);
    }
    
    /**
     * @dev Simulate yield generation (for demo purposes)
     * @param token ERC20 token address
     */
    function _simulateYield(address token) internal {
        Strategy storage strategy = strategies[token];
        
        // Calculate time since last harvest
        uint256 timeSinceLastHarvest = block.timestamp - strategy.lastHarvest;
        if (timeSinceLastHarvest == 0) timeSinceLastHarvest = 1 days;
        
        // Calculate yield based on APY
        // Formula: allocated * (APY / 100) * (timeSinceLastHarvest / 365 days)
        uint256 yield = strategy.allocatedAmount * strategy.projectedAPY * timeSinceLastHarvest / (365 days * 10000);
        
        // In a real implementation, yield would come from the target protocol
        // For demo purposes, we'll mint tokens or use a separate source
        
        // Option 1: If token has a mint function (for testing)
        // IMintableToken(token).mint(address(this), yield);
        
        // Option 2: Transfer from a yield source (e.g., owner for testing)
        // IERC20(token).safeTransferFrom(owner(), address(this), yield);
        
        // Option 3: For demo, use a small percentage of allocated amount
        // yield = strategy.allocatedAmount * 1 / 100; // 1% of allocated
    }
}

/**
 * @dev Interface for external protocol integration
 */
interface IExternalProtocol {
    function deposit(address token, uint256 amount) external;
    function withdraw(address token, uint256 amount) external;
    function claimRewards(address token) external;
    function emergencyWithdraw(address token) external;
}

/**
 * @dev Interface for mintable token (for testing)
 */
interface IMintableToken {
    function mint(address to, uint256 amount) external;
}
