// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/ILendingPool.sol";
import "../interfaces/ILendingPoolAddressesProvider.sol";
import "../interfaces/ILendingPoolDataProvider.sol";
import "../interfaces/ILendingRateOracle.sol";
import "../interfaces/IPriceOracle.sol";
import "../interfaces/IERC20.sol";
import "../interfaces/IAIRiskAssessment.sol";
import "../libraries/DataTypes.sol";
import "../libraries/WadRayMath.sol";
import "../libraries/ReserveLogic.sol";
import "../libraries/ValidationLogic.sol";

/**
 * @title IntelliLend Lending Pool
 * @dev Main contract for the IntelliLend lending protocol on IOTA EVM
 * @custom:security-contact security@intellilend.io
 */
contract LendingPool is ILendingPool {
    using WadRayMath for uint256;
    using ReserveLogic for DataTypes.ReserveData;

    // State variables
    ILendingPoolAddressesProvider private immutable _addressesProvider;
    IPriceOracle private _priceOracle;
    ILendingRateOracle private _rateOracle;
    ILendingPoolDataProvider private _dataProvider;
    IAIRiskAssessment private _riskAssessment;
    
    mapping(address => DataTypes.ReserveData) internal _reserves;
    mapping(address => DataTypes.UserConfigurationData) internal _usersConfig;
    
    address[] private _reservesList;
    uint256 private _reservesCount;
    
    uint256 private constant LIQUIDATION_CLOSE_FACTOR_PERCENT = 50;
    uint256 private constant MAX_NUMBER_RESERVES = 128;
    
    bool private _paused;
    
    // Events (in addition to interface events)
    event ReserveDataUpdated(
        address indexed asset,
        uint256 liquidityRate,
        uint256 stableBorrowRate,
        uint256 variableBorrowRate,
        uint256 liquidityIndex,
        uint256 variableBorrowIndex
    );
    
    event RiskScoreUpdated(address indexed user, uint256 newScore);
    event CrossLayerBridgeEvent(bytes32 indexed messageId, address indexed sender, bytes data);

    /**
     * @dev Constructor
     * @param provider The address of the LendingPoolAddressesProvider contract
     */
    constructor(ILendingPoolAddressesProvider provider) {
        _addressesProvider = provider;
        _paused = false;
    }

    /**
     * @dev Modifier to check if the LendingPool is paused
     */
    modifier whenNotPaused() {
        require(!_paused, "LendingPool: protocol is paused");
        _;
    }
    
    /**
     * @dev Modifier to check if caller is LendingPoolConfigurator
     */
    modifier onlyLendingPoolConfigurator() {
        require(
            _addressesProvider.getLendingPoolConfigurator() == msg.sender,
            "LendingPool: caller is not the LendingPoolConfigurator"
        );
        _;
    }
    
    /**
     * @dev Modifier to check if caller is allowed to update risk scores
     */
    modifier onlyRiskUpdater() {
        require(
            _addressesProvider.getRiskScoreUpdater() == msg.sender || 
            address(_riskAssessment) == msg.sender,
            "LendingPool: caller cannot update risk scores"
        );
        _;
    }

    /**
     * @dev Initializes the LendingPool with required contract connections
     */
    function initialize() external override {
        _priceOracle = IPriceOracle(_addressesProvider.getPriceOracle());
        _rateOracle = ILendingRateOracle(_addressesProvider.getLendingRateOracle());
        _dataProvider = ILendingPoolDataProvider(_addressesProvider.getLendingPoolDataProvider());
        _riskAssessment = IAIRiskAssessment(_addressesProvider.getRiskAssessmentOracle());
    }

    /**
     * @dev Deposits an amount of underlying asset into the reserve
     * @param asset The address of the underlying asset to deposit
     * @param amount The amount to be deposited
     * @param onBehalfOf The address that will receive the aTokens, same as msg.sender if the user
     *   wants to receive them on his own wallet, or a different address if the beneficiary is a
     *   different wallet
     * @param referralCode Code used to register the integrator originating the operation, for rewards
     */
    function deposit(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external override whenNotPaused {
        DataTypes.ReserveData storage reserve = _reserves[asset];
        
        ValidationLogic.validateDeposit(reserve, amount);
        
        // Request user risk assessment update
        _riskAssessment.assessUserRisk(onBehalfOf);
        
        // Transfer underlying asset to LendingPool
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        
        // Update reserve data
        reserve.updateState();
        reserve.updateInterestRates(asset, address(this), amount, 0);
        
        // Mint aTokens to onBehalfOf
        reserve.aTokenAddress.mint(onBehalfOf, amount, reserve.liquidityIndex);
        
        // Update user configuration
        _usersConfig[onBehalfOf].setUsingAsCollateral(reserve.id, true);
        
        emit Deposit(asset, msg.sender, onBehalfOf, amount, referralCode);
    }
    
    /**
     * @dev Withdraws an amount of underlying asset from the reserve
     * @param asset The address of the underlying asset to withdraw
     * @param amount The underlying amount to be withdrawn
     * @param to The address that will receive the underlying, same as msg.sender if the user
     *   wants to receive it on his own wallet, or a different address if the beneficiary is a
     *   different wallet
     * @return The final amount withdrawn
     */
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external override whenNotPaused returns (uint256) {
        DataTypes.ReserveData storage reserve = _reserves[asset];
        
        ValidationLogic.validateWithdraw(
            reserve,
            amount,
            _usersConfig[msg.sender],
            _reserves,
            _priceOracle,
            _reservesList
        );
        
        // Calculate how much can be withdrawn
        uint256 userBalance = IERC20(reserve.aTokenAddress).balanceOf(msg.sender);
        uint256 amountToWithdraw = amount == type(uint256).max ? userBalance : amount;
        
        // Update reserve state
        reserve.updateState();
        
        // Burn aTokens and transfer underlying to recipient
        reserve.aTokenAddress.burn(msg.sender, to, amountToWithdraw, reserve.liquidityIndex);
        
        // Update reserve interest rates
        reserve.updateInterestRates(asset, address(this), 0, amountToWithdraw);
        
        // Request user risk assessment update
        _riskAssessment.assessUserRisk(msg.sender);
        
        emit Withdraw(asset, msg.sender, to, amountToWithdraw);
        
        return amountToWithdraw;
    }
    
    /**
     * @dev Allows users to borrow a specific amount of the reserve underlying asset
     * @param asset The address of the underlying asset to borrow
     * @param amount The amount to be borrowed
     * @param interestRateMode The interest rate mode at which the user wants to borrow: 1 for Stable, 2 for Variable
     * @param referralCode Code used to register the integrator originating the operation, for rewards
     * @param onBehalfOf Address of the user who will receive the debt, should be the address of the borrower
     */
    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external override whenNotPaused {
        DataTypes.ReserveData storage reserve = _reserves[asset];
        
        // Get user's risk score to calculate interest rate
        uint256 riskScore = _riskAssessment.getUserRiskScore(onBehalfOf);
        
        // Apply risk-based interest rate adjustment
        uint256 baseInterestRate = interestRateMode == 1 
            ? reserve.currentStableBorrowRate 
            : reserve.currentVariableBorrowRate;
        
        uint256 riskAdjustedRate = _calculateRiskAdjustedRate(baseInterestRate, riskScore);
        
        // Validate the borrow conditions
        ValidationLogic.validateBorrow(
            asset,
            reserve,
            onBehalfOf,
            amount,
            interestRateMode,
            riskAdjustedRate,
            _usersConfig[onBehalfOf],
            _reserves,
            _priceOracle,
            _reservesList
        );
        
        // Update reserve state
        reserve.updateState();
        
        // Execute the borrow, transferring the underlying to the user
        if (interestRateMode == 1) {
            reserve.stableDebtTokenAddress.mint(
                onBehalfOf,
                amount,
                riskAdjustedRate
            );
        } else {
            reserve.variableDebtTokenAddress.mint(
                onBehalfOf,
                amount,
                reserve.variableBorrowIndex
            );
        }
        
        // Update user configuration
        _usersConfig[onBehalfOf].setBorrowing(reserve.id, true);
        
        // Transfer the underlying to the user
        IERC20(asset).transfer(msg.sender, amount);
        
        // Update reserve rates
        reserve.updateInterestRates(asset, address(this), 0, amount);
        
        // Request risk assessment update
        _riskAssessment.assessUserRisk(onBehalfOf);
        
        // Emit borrow event
        emit Borrow(
            asset,
            msg.sender,
            onBehalfOf,
            amount,
            interestRateMode,
            interestRateMode == 1 ? riskAdjustedRate : reserve.currentVariableBorrowRate,
            referralCode
        );
        
        // Emit cross-layer bridge event for the Move smart contract integration
        bytes memory bridgeData = abi.encode(
            "BORROW_EVENT",
            asset,
            onBehalfOf,
            amount,
            riskScore
        );
        
        bytes32 messageId = keccak256(abi.encodePacked(asset, onBehalfOf, amount, block.timestamp));
        emit CrossLayerBridgeEvent(messageId, msg.sender, bridgeData);
    }
    
    /**
     * @dev Repays a borrowed amount on a specific reserve
     * @param asset The address of the borrowed underlying asset
     * @param amount The amount to repay
     * @param interestRateMode The interest rate mode: 1 for Stable, 2 for Variable
     * @param onBehalfOf The address of the user who will get his debt reduced/removed
     * @return The final amount repaid
     */
    function repay(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        address onBehalfOf
    ) external override whenNotPaused returns (uint256) {
        DataTypes.ReserveData storage reserve = _reserves[asset];
        
        uint256 stableDebt = IERC20(reserve.stableDebtTokenAddress).balanceOf(onBehalfOf);
        uint256 variableDebt = IERC20(reserve.variableDebtTokenAddress).balanceOf(onBehalfOf);
        
        ValidationLogic.validateRepay(
            reserve,
            amount,
            interestRateMode,
            onBehalfOf,
            stableDebt,
            variableDebt
        );
        
        uint256 paybackAmount = interestRateMode == 1 ? stableDebt : variableDebt;
        
        if (amount == type(uint256).max) {
            amount = paybackAmount;
        }
        
        // Update reserve state
        reserve.updateState();
        
        // Execute the repay, burning the equivalent debt tokens
        if (interestRateMode == 1) {
            reserve.stableDebtTokenAddress.burn(onBehalfOf, amount);
        } else {
            reserve.variableDebtTokenAddress.burn(
                onBehalfOf,
                amount,
                reserve.variableBorrowIndex
            );
        }
        
        // Transfer the repaid amount to the LendingPool
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        
        // Update the reserve rates
        reserve.updateInterestRates(asset, address(this), amount, 0);
        
        // If debt is fully repaid, update user configuration
        if ((interestRateMode == 1 && stableDebt - amount == 0) ||
            (interestRateMode == 2 && variableDebt - amount == 0)) {
            if (stableDebt - amount == 0 && variableDebt == 0) {
                _usersConfig[onBehalfOf].setBorrowing(reserve.id, false);
            } else if (variableDebt - amount == 0 && stableDebt == 0) {
                _usersConfig[onBehalfOf].setBorrowing(reserve.id, false);
            }
        }
        
        // Request risk assessment update
        _riskAssessment.assessUserRisk(onBehalfOf);
        
        emit Repay(asset, onBehalfOf, msg.sender, amount, interestRateMode);
        
        return amount;
    }
    
    /**
     * @dev Function to liquidate a non-healthy position
     * @param collateralAsset The address of the collateral asset
     * @param debtAsset The address of the debt asset
     * @param user The address of the borrower
     * @param debtToCover The amount of debt to cover
     * @param receiveAToken true if the liquidator wants to receive the aTokens, false if he wants the underlying asset
     */
    function liquidationCall(
        address collateralAsset,
        address debtAsset,
        address user,
        uint256 debtToCover,
        bool receiveAToken
    ) external override whenNotPaused {
        // Implementation details omitted for brevity
        // This function would handle liquidation of unhealthy positions
    }
    
    /**
     * @dev Updates the risk score for a user
     * @param user Address of the user
     * @param score New risk score (0-100)
     */
    function updateRiskScore(address user, uint256 score) 
        external 
        override 
        onlyRiskUpdater 
    {
        require(score <= 100, "LendingPool: score must be between 0 and 100");
        
        DataTypes.UserConfigurationData storage userConfig = _usersConfig[user];
        userConfig.riskScore = score;
        
        emit RiskScoreUpdated(user, score);
        
        // Create cross-layer message for Move contract
        bytes memory bridgeData = abi.encode(
            "RISK_SCORE_UPDATE",
            user,
            score
        );
        
        bytes32 messageId = keccak256(abi.encodePacked(user, score, block.timestamp));
        emit CrossLayerBridgeEvent(messageId, msg.sender, bridgeData);
    }
    
    /**
     * @dev Calculates interest rate based on user's risk score
     * @param baseRate The base interest rate
     * @param riskScore The risk score of the user
     * @return The risk-adjusted interest rate
     */
    function _calculateRiskAdjustedRate(uint256 baseRate, uint256 riskScore) 
        internal 
        pure 
        returns (uint256) 
    {
        // Risk score 0-100, where 0 is lowest risk and 100 is highest risk
        // Apply a scaling factor to the risk premium, e.g., high risk = +5% APY
        uint256 riskPremium = riskScore * 5 * 10**25 / 100; // Convert to ray (27 decimals)
        
        return baseRate + riskPremium;
    }
    
    /**
     * @dev Returns the user's risk score
     * @param user Address of the user
     * @return The risk score of the user
     */
    function getUserRiskScore(address user) 
        external 
        view 
        override 
        returns (uint256) 
    {
        return _usersConfig[user].riskScore;
    }
    
    /**
     * @dev Returns the normalized income of the reserve
     * @param asset The address of the underlying asset of the reserve
     * @return The reserve's normalized income
     */
    function getReserveNormalizedIncome(address asset) 
        external 
        view 
        override 
        returns (uint256) 
    {
        return _reserves[asset].getNormalizedIncome();
    }
    
    /**
     * @dev Returns the normalized variable debt per unit of asset
     * @param asset The address of the underlying asset of the reserve
     * @return The reserve normalized variable debt
     */
    function getReserveNormalizedVariableDebt(address asset) 
        external 
        view 
        override 
        returns (uint256) 
    {
        return _reserves[asset].getNormalizedDebt();
    }
    
    /**
     * @dev Pauses the protocol
     */
    function setPause(bool val) 
        external 
        override 
        onlyLendingPoolConfigurator 
    {
        _paused = val;
        emit Paused(val);
    }

    /**
     * @dev Returns if the LendingPool is paused
     */
    function paused() external view override returns (bool) {
        return _paused;
    }
    
    /**
     * @dev Returns the list of the initialized reserves
     */
    function getReservesList() external view override returns (address[] memory) {
        address[] memory reservesList = new address[](_reservesCount);
        
        for (uint256 i = 0; i < _reservesCount; i++) {
            reservesList[i] = _reservesList[i];
        }
        
        return reservesList;
    }
    
    /**
     * @dev Returns the configuration of the reserve
     * @param asset The address of the underlying asset of the reserve
     * @return The configuration of the reserve
     */
    function getReserveData(address asset) 
        external 
        view 
        override 
        returns (DataTypes.ReserveData memory) 
    {
        return _reserves[asset];
    }
    
    /**
     * @dev Returns the configuration of the user
     * @param user The address of the user
     * @return The configuration of the user
     */
    function getUserConfiguration(address user) 
        external 
        view 
        override 
        returns (DataTypes.UserConfigurationData memory) 
    {
        return _usersConfig[user];
    }
    
    /**
     * @dev Returns the addresses provider of the LendingPool
     * @return The addresses provider
     */
    function getAddressesProvider() 
        external 
        view 
        override 
        returns (ILendingPoolAddressesProvider) 
    {
        return _addressesProvider;
    }
    
    /**
     * @dev Initializes a reserve
     * @param asset The address of the underlying asset of the reserve
     */
    function initReserve(
        address asset,
        address aTokenAddress,
        address stableDebtAddress,
        address variableDebtAddress,
        address interestRateStrategyAddress
    ) external override onlyLendingPoolConfigurator {
        require(Address.isContract(asset), "LendingPool: asset is not a contract");
        require(_reserves[asset].id == 0, "LendingPool: reserve already initialized");
        
        _reserves[asset].init(
            _reservesCount,
            aTokenAddress,
            stableDebtAddress,
            variableDebtAddress,
            interestRateStrategyAddress
        );
        
        _reservesList[_reservesCount] = asset;
        _reservesCount++;
    }
    
    /**
     * @dev Updates the address of the interest rate strategy of a reserve
     * @param asset The address of the underlying asset of the reserve
     * @param rateStrategyAddress The address of the interest rate strategy
     */
    function setReserveInterestRateStrategyAddress(
        address asset,
        address rateStrategyAddress
    ) external override onlyLendingPoolConfigurator {
        _reserves[asset].interestRateStrategyAddress = rateStrategyAddress;
    }
    
    // Additional functions could be implemented here
}
