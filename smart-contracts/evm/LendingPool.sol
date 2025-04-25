// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IntelliLend Lending Pool
 * @dev Main contract for the IntelliLend lending protocol on IOTA EVM
 */
contract LendingPool is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // Interfaces to the cross-layer bridge (for Move integration)
    ICrossLayerBridge public bridge;

    // State variables
    address public admin;
    mapping(address => uint256) public deposits;
    mapping(address => uint256) public borrows;
    mapping(address => uint256) public collaterals;
    mapping(address => uint256) public riskScores; // Populated by the AI system
    mapping(address => uint256) public lastInterestUpdate;
    
    // Protocol settings
    uint256 public collateralFactor = 75; // 75% (multiplied by 100)
    uint256 public liquidationThreshold = 83; // 83% (multiplied by 100)
    uint256 public liquidationPenalty = 8; // 8% (multiplied by 100)
    uint256 public platformFee = 10; // 10% of interest (multiplied by 100)
    uint256 public constant PERCENTAGE_FACTOR = 100;
    
    // Token addresses
    IERC20 public lendingToken;
    IERC20 public collateralToken;
    
    // Total protocol values
    uint256 public totalDeposits;
    uint256 public totalBorrows;
    uint256 public totalCollateral;
    
    // Events
    event Deposit(address indexed user, uint256 amount);
    event Borrow(address indexed user, uint256 amount);
    event Repay(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event CollateralAdded(address indexed user, uint256 amount);
    event CollateralRemoved(address indexed user, uint256 amount);
    event Liquidation(
        address indexed liquidator, 
        address indexed borrower, 
        uint256 repayAmount, 
        uint256 collateralAmount
    );
    event RiskScoreUpdated(address indexed user, uint256 newScore);
    event InterestAccrued(address indexed user, uint256 interestAmount);

    /**
     * @dev Constructor to initialize the lending pool
     * @param _lendingToken Address of the token used for lending (e.g., IOTA)
     * @param _collateralToken Address of the token used for collateral (e.g., MIOTA)
     * @param _bridgeAddress Address of the cross-layer bridge contract
     */
    constructor(
        address _lendingToken,
        address _collateralToken,
        address _bridgeAddress
    ) {
        admin = msg.sender;
        lendingToken = IERC20(_lendingToken);
        collateralToken = IERC20(_collateralToken);
        bridge = ICrossLayerBridge(_bridgeAddress);
    }
    
    // Modifier to restrict access to admin
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }

    /**
     * @dev Updates the risk score for a user
     * @param user Address of the user
     * @param score New risk score (0-100)
     */
    function updateRiskScore(address user, uint256 score) external onlyAdmin {
        require(score <= 100, "Score must be between 0 and 100");
        riskScores[user] = score;
        emit RiskScoreUpdated(user, score);
        
        // Send risk score update to Move layer
        _sendRiskScoreToMoveLayer(user, score);
    }

    /**
     * @dev Calculates interest rate based on user's risk score
     * @param user Address of the user
     * @return Interest rate as a percentage (e.g., 5 = 5%)
     */
    function calculateInterestRate(address user) public view returns (uint256) {
        // Base rate is 3%
        uint256 baseRate = 3;
        
        // Add risk premium based on risk score (higher score = higher risk)
        // For example, risk score of 50 adds 5% to the base rate
        uint256 riskPremium = riskScores[user] / 10;
        
        // Add utilization factor (higher utilization = higher interest)
        uint256 utilizationRate = totalDeposits > 0 
            ? (totalBorrows * 100) / totalDeposits 
            : 0;
        uint256 utilizationFactor = utilizationRate / 20; // Each 20% utilization adds 1%
        
        return baseRate + riskPremium + utilizationFactor;
    }

    /**
     * @dev Deposit funds into the lending pool
     * @param amount Amount to deposit
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        // Transfer tokens from user to contract
        lendingToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Update state
        deposits[msg.sender] += amount;
        totalDeposits += amount;
        
        emit Deposit(msg.sender, amount);
    }
    
    /**
     * @dev Withdraw deposited funds from the lending pool
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(deposits[msg.sender] >= amount, "Insufficient deposit balance");
        
        // Check if there's enough liquidity available
        require(
            lendingToken.balanceOf(address(this)) >= amount,
            "Insufficient liquidity in pool"
        );
        
        // Update state
        deposits[msg.sender] -= amount;
        totalDeposits -= amount;
        
        // Transfer tokens to user
        lendingToken.safeTransfer(msg.sender, amount);
        
        emit Withdraw(msg.sender, amount);
    }
    
    /**
     * @dev Add collateral to support borrowing
     * @param amount Amount of collateral to add
     */
    function addCollateral(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        // Transfer collateral tokens from user to contract
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Update state
        collaterals[msg.sender] += amount;
        totalCollateral += amount;
        
        emit CollateralAdded(msg.sender, amount);
        
        // Notify Move layer about collateral change
        _sendCollateralUpdateToMoveLayer(msg.sender, collaterals[msg.sender]);
    }
    
    /**
     * @dev Remove collateral if not needed for loans
     * @param amount Amount of collateral to remove
     */
    function removeCollateral(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(collaterals[msg.sender] >= amount, "Insufficient collateral");
        
        // Calculate required collateral for current borrows
        uint256 requiredCollateral = _calculateRequiredCollateral(msg.sender);
        require(
            collaterals[msg.sender] - amount >= requiredCollateral,
            "Collateral removal would make position unsafe"
        );
        
        // Update state
        collaterals[msg.sender] -= amount;
        totalCollateral -= amount;
        
        // Transfer collateral tokens back to user
        collateralToken.safeTransfer(msg.sender, amount);
        
        emit CollateralRemoved(msg.sender, amount);
        
        // Notify Move layer about collateral change
        _sendCollateralUpdateToMoveLayer(msg.sender, collaterals[msg.sender]);
    }
    
    /**
     * @dev Borrow funds against collateral
     * @param amount Amount to borrow
     */
    function borrow(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        // Accrue interest before borrowing
        _accrueInterest(msg.sender);
        
        // Check if there's enough collateral
        uint256 newBorrowAmount = borrows[msg.sender] + amount;
        uint256 requiredCollateral = _calculateRequiredCollateralForAmount(newBorrowAmount, msg.sender);
        
        require(
            collaterals[msg.sender] >= requiredCollateral,
            "Insufficient collateral for borrow amount"
        );
        
        // Check if there's enough liquidity available
        require(
            lendingToken.balanceOf(address(this)) >= amount,
            "Insufficient liquidity in pool"
        );
        
        // Update state
        borrows[msg.sender] = newBorrowAmount;
        totalBorrows += amount;
        lastInterestUpdate[msg.sender] = block.timestamp;
        
        // Transfer tokens to user
        lendingToken.safeTransfer(msg.sender, amount);
        
        emit Borrow(msg.sender, amount);
    }
    
    /**
     * @dev Repay borrowed funds
     * @param amount Amount to repay
     */
    function repay(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        // Accrue interest before repayment
        _accrueInterest(msg.sender);
        
        // Check if there's a borrow to repay
        require(borrows[msg.sender] > 0, "No borrow to repay");
        
        // Cap repayment amount to the user's borrow balance
        uint256 repayAmount = amount;
        if (repayAmount > borrows[msg.sender]) {
            repayAmount = borrows[msg.sender];
        }
        
        // Transfer tokens from user to contract
        lendingToken.safeTransferFrom(msg.sender, address(this), repayAmount);
        
        // Update state
        borrows[msg.sender] -= repayAmount;
        totalBorrows -= repayAmount;
        
        emit Repay(msg.sender, repayAmount);
    }
    
    /**
     * @dev Liquidate an undercollateralized position
     * @param borrower Address of the borrower to liquidate
     * @param repayAmount Amount of debt to repay
     */
    function liquidate(address borrower, uint256 repayAmount) external nonReentrant {
        require(repayAmount > 0, "Repay amount must be greater than 0");
        require(borrower != msg.sender, "Cannot liquidate your own position");
        
        // Accrue interest for the borrower
        _accrueInterest(borrower);
        
        // Check if the position is undercollateralized
        uint256 requiredCollateral = _calculateRequiredCollateralForLiquidation(
            borrows[borrower],
            borrower
        );
        
        require(
            collaterals[borrower] < requiredCollateral,
            "Position is not undercollateralized"
        );
        
        // Cap repayment amount to the borrower's borrow balance
        uint256 actualRepayAmount = repayAmount;
        if (actualRepayAmount > borrows[borrower]) {
            actualRepayAmount = borrows[borrower];
        }
        
        // Calculate collateral to seize with liquidation penalty
        uint256 collateralPriceInLendingToken = 1; // For simplicity, assuming 1:1 price ratio
        uint256 collateralToSeize = (actualRepayAmount * (100 + liquidationPenalty) * collateralPriceInLendingToken) / 100;
        
        // Cap collateral to seize to the borrower's collateral balance
        if (collateralToSeize > collaterals[borrower]) {
            collateralToSeize = collaterals[borrower];
        }
        
        // Transfer repayment from liquidator to contract
        lendingToken.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
        
        // Update state
        borrows[borrower] -= actualRepayAmount;
        totalBorrows -= actualRepayAmount;
        collaterals[borrower] -= collateralToSeize;
        totalCollateral -= collateralToSeize;
        
        // Transfer seized collateral to liquidator
        collateralToken.safeTransfer(msg.sender, collateralToSeize);
        
        emit Liquidation(msg.sender, borrower, actualRepayAmount, collateralToSeize);
        
        // Notify Move layer about liquidation
        _sendLiquidationToMoveLayer(borrower, actualRepayAmount, collateralToSeize);
    }
    
    /**
     * @dev Check if a borrower's position is healthy
     * @param borrower Address of the borrower
     * @return isHealthy True if the position is healthy
     */
    function isPositionHealthy(address borrower) public view returns (bool) {
        if (borrows[borrower] == 0) return true;
        
        uint256 requiredCollateral = _calculateRequiredCollateral(borrower);
        return collaterals[borrower] >= requiredCollateral;
    }
    
    /**
     * @dev Get the health factor of a borrower's position (collateral-to-loan ratio)
     * @param borrower Address of the borrower
     * @return healthFactor The health factor (1.0 = 100% collateralized according to required ratio)
     */
    function getHealthFactor(address borrower) public view returns (uint256) {
        if (borrows[borrower] == 0) return type(uint256).max; // Max value if no borrows
        
        uint256 requiredCollateral = _calculateRequiredCollateral(borrower);
        if (requiredCollateral == 0) return type(uint256).max;
        
        return (collaterals[borrower] * 100) / requiredCollateral;
    }
    
    /**
     * @dev Accrue interest for a borrower
     * @param borrower Address of the borrower
     */
    function _accrueInterest(address borrower) internal {
        if (borrows[borrower] == 0) {
            lastInterestUpdate[borrower] = block.timestamp;
            return;
        }
        
        // Calculate interest only if some time has passed
        if (block.timestamp > lastInterestUpdate[borrower]) {
            uint256 timeElapsed = block.timestamp - lastInterestUpdate[borrower];
            uint256 interestRate = calculateInterestRate(borrower);
            
            // Calculate interest: principal * rate * time / (365 days * 100 for percentage)
            uint256 interest = (borrows[borrower] * interestRate * timeElapsed) / (365 days * 100);
            
            if (interest > 0) {
                // Calculate platform fee
                uint256 fee = (interest * platformFee) / 100;
                uint256 borrowerInterest = interest - fee;
                
                // Update state
                borrows[borrower] += borrowerInterest;
                totalBorrows += borrowerInterest;
                
                // Add platform fee to the admin's deposits
                deposits[admin] += fee;
                totalDeposits += fee;
                
                emit InterestAccrued(borrower, interest);
            }
            
            lastInterestUpdate[borrower] = block.timestamp;
        }
    }
    
    /**
     * @dev Calculate required collateral for a borrow amount
     * @param borrowAmount Amount borrowed or to be borrowed
     * @param user Address of the user
     * @return requiredCollateral The required collateral amount
     */
    function _calculateRequiredCollateralForAmount(
        uint256 borrowAmount,
        address user
    ) internal view returns (uint256) {
        // Required collateral = borrow amount / collateral factor
        // Adjusted by risk score and ML-based metrics
        
        // Advanced risk adjustment using multiple factors
        // Base risk adjustment from risk score
        uint256 baseRiskAdjustment = 100 + (riskScores[user] / 5); // Each 5 points of risk adds 1% to required collateral
        
        // Additional market condition adjustment
        uint256 marketConditionFactor = _getMarketConditionFactor();
        
        // User behavior adjustment based on historical performance
        uint256 userBehaviorFactor = _getUserBehaviorFactor(user);
        
        // Combined risk adjustment
        uint256 riskAdjustment = (baseRiskAdjustment * marketConditionFactor * userBehaviorFactor) / 10000; // Scale back from percentage calculations
        
        // Apply non-linear scaling for high-risk users (exponential increase in collateral requirement)
        if (riskScores[user] > 70) {
            riskAdjustment = riskAdjustment * 120 / 100; // 20% additional penalty for very high risk
        }
        
        // For simplicity, assuming 1:1 price ratio between lending and collateral tokens
        // In production, we would use oracle price feeds
        return (borrowAmount * 100 * riskAdjustment) / (collateralFactor * 100);
    }
    
    /**
     * @dev Get market condition factor based on utilization and external data
     * @return Factor to adjust collateral requirements (in percentage basis points)
     */
    function _getMarketConditionFactor() internal view returns (uint256) {
        // Base factor of 100 (100%)
        uint256 factor = 100;
        
        // Adjust based on utilization rate
        uint256 utilizationRate = totalDeposits > 0 
            ? (totalBorrows * 100) / totalDeposits 
            : 0;
            
        if (utilizationRate > 80) {
            // High utilization increases collateral requirements
            factor += (utilizationRate - 80) * 2; // Each 1% above 80% adds 2% to requirements
        }
        
        // In a production environment, we would incorporate external market data
        // from oracles to adjust for broader market volatility
        
        return factor;
    }
    
    /**
     * @dev Get user behavior factor based on historical performance
     * @param user Address of the user
     * @return Factor to adjust collateral requirements (in percentage basis points)
     */
    function _getUserBehaviorFactor(address user) internal view returns (uint256) {
        // Base factor of 100 (100%)
        uint256 factor = 100;
        
        // This would be enriched with on-chain analysis of user behavior patterns
        // For the demo, we'll use a simplified version based on current state
        
        // Decrease factor (better terms) for users with more deposits than borrows
        if (deposits[user] > borrows[user] * 2) {
            factor = factor * 95 / 100; // 5% reduction in requirements
        }
        
        // Factor would normally be provided by the AI risk assessment module
        // through the cross-layer bridge
        
        return factor;
    }
    
    /**
     * @dev Calculate required collateral for a user's current borrow
     * @param user Address of the user
     * @return requiredCollateral The required collateral amount
     */
    function _calculateRequiredCollateral(
        address user
    ) internal view returns (uint256) {
        return _calculateRequiredCollateralForAmount(borrows[user], user);
    }
    
    /**
     * @dev Calculate required collateral for liquidation threshold
     * @param borrowAmount Amount borrowed
     * @param user Address of the user
     * @return requiredCollateral The required collateral for liquidation
     */
    function _calculateRequiredCollateralForLiquidation(
        uint256 borrowAmount,
        address user
    ) internal view returns (uint256) {
        // Risk adjustment: higher risk score increases required collateral
        uint256 riskAdjustment = 100 + (riskScores[user] / 5);
        
        // For simplicity, assuming 1:1 price ratio between lending and collateral tokens
        return (borrowAmount * 100 * riskAdjustment) / (liquidationThreshold * 100);
    }
    
    /**
     * @dev Send risk score update to Move layer through cross-layer bridge
     * @param user Address of the user
     * @param score The risk score
     */
    function _sendRiskScoreToMoveLayer(address user, uint256 score) internal {
        bytes32 targetAddress = bytes32(uint256(uint160(user))); // Convert to bytes32 for Move layer
        bytes memory payload = abi.encode(user, score);
        
        // Use the bridge to send the message to L1
        try bridge.sendMessageToL1(
            targetAddress,
            "RISK_SCORE_UPDATE",
            payload,
            2000000 // gas limit
        ) returns (bytes32 messageId) {
            // Message sent successfully
        } catch {
            // Handle error (in production, we'd have more robust error handling)
        }
    }
    
    /**
     * @dev Send collateral update to Move layer through cross-layer bridge
     * @param user Address of the user
     * @param collateralAmount The new collateral amount
     */
    function _sendCollateralUpdateToMoveLayer(
        address user,
        uint256 collateralAmount
    ) internal {
        bytes32 targetAddress = bytes32(uint256(uint160(user)));
        bytes memory payload = abi.encode(user, collateralAmount);
        
        try bridge.sendMessageToL1(
            targetAddress,
            "COLLATERAL_CHANGE",
            payload,
            2000000
        ) returns (bytes32 messageId) {
            // Message sent successfully
        } catch {
            // Handle error
        }
    }
    
    /**
     * @dev Send liquidation info to Move layer through cross-layer bridge
     * @param borrower Address of the borrower
     * @param repayAmount Amount repaid
     * @param collateralSeized Amount of collateral seized
     */
    function _sendLiquidationToMoveLayer(
        address borrower,
        uint256 repayAmount,
        uint256 collateralSeized
    ) internal {
        bytes32 targetAddress = bytes32(uint256(uint160(borrower)));
        bytes memory payload = abi.encode(borrower, repayAmount, collateralSeized);
        
        try bridge.sendMessageToL1(
            targetAddress,
            "LIQUIDATION",
            payload,
            2000000
        ) returns (bytes32 messageId) {
            // Message sent successfully
        } catch {
            // Handle error
        }
    }
    
    /**
     * @dev Update protocol parameters
     * @param _collateralFactor New collateral factor
     * @param _liquidationThreshold New liquidation threshold
     * @param _liquidationPenalty New liquidation penalty
     * @param _platformFee New platform fee
     */
    function updateParameters(
        uint256 _collateralFactor,
        uint256 _liquidationThreshold,
        uint256 _liquidationPenalty,
        uint256 _platformFee
    ) external onlyOwner {
        require(_collateralFactor <= 90, "Collateral factor too high");
        require(_liquidationThreshold > _collateralFactor, "Invalid liquidation threshold");
        require(_liquidationPenalty <= 20, "Liquidation penalty too high");
        require(_platformFee <= 30, "Platform fee too high");
        
        collateralFactor = _collateralFactor;
        liquidationThreshold = _liquidationThreshold;
        liquidationPenalty = _liquidationPenalty;
        platformFee = _platformFee;
    }
}

/**
 * @dev Interface for the CrossLayerBridge
 */
interface ICrossLayerBridge {
    function sendMessageToL1(
        bytes32 targetAddress,
        string calldata messageType,
        bytes calldata payload,
        uint256 gasLimit
    ) external payable returns (bytes32 messageId);
}
