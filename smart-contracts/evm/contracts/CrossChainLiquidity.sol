// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CrossChainLiquidity
 * @dev Manages cross-chain liquidity for the IntelliLend protocol
 * @notice Uses IOTA's cross-chain capabilities to optimize liquidity across different pools
 */
contract CrossChainLiquidity is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Supported chains
    struct ChainInfo {
        uint256 chainId;
        string name;
        address bridge;
        bool supported;
        uint256 totalLiquidity;
        uint256 utilizationRate;
        uint256 interestRate;
    }
    
    // Liquidity sources
    struct LiquiditySource {
        uint256 chainId;
        address protocol;
        address asset;
        uint256 amount;
        uint256 apy;
        uint256 utilizationRate;
        bool active;
    }
    
    // Liquidity pools
    struct LiquidityPool {
        address asset;
        uint256 totalLiquidity;
        uint256 availableLiquidity;
        uint256 utilizationRate;
        uint256 interestRate;
        bool active;
    }
    
    // Events
    event LiquidityAdded(uint256 indexed chainId, address indexed protocol, address indexed asset, uint256 amount);
    event LiquidityRemoved(uint256 indexed chainId, address indexed protocol, address indexed asset, uint256 amount);
    event StrategyExecuted(uint256 indexed strategyId, uint256 timestamp);
    event ChainAdded(uint256 indexed chainId, string name, address bridge);
    event ChainRemoved(uint256 indexed chainId);
    event StrategyCreated(uint256 indexed strategyId, string name);
    event StrategyUpdated(uint256 indexed strategyId, string name);
    event YieldHarvested(uint256 indexed chainId, address indexed protocol, address indexed asset, uint256 amount);
    
    // Mappings and state variables
    mapping(uint256 => ChainInfo) public chains;
    mapping(bytes32 => LiquiditySource) public liquiditySources;
    mapping(address => LiquidityPool) public liquidityPools;
    mapping(uint256 => bytes32[]) public chainLiquiditySources;
    
    address[] public supportedAssets;
    uint256 public totalCrossChainLiquidity;
    uint256 public totalAvailableLiquidity;
    uint256 public globalUtilizationRate;
    
    // Strategy management
    struct Strategy {
        string name;
        bool active;
        uint256 lastExecuted;
        bytes parameters;
    }
    
    mapping(uint256 => Strategy) public strategies;
    uint256 public nextStrategyId;
    
    // Bridge and factory contracts
    address public bridgeFactory;
    
    /**
     * @dev Constructor to initialize the cross-chain liquidity module
     * @param _bridgeFactory Address of the bridge factory contract
     */
    constructor(address _bridgeFactory) {
        bridgeFactory = _bridgeFactory;
    }
    
    /**
     * @dev Adds a new chain to the supported chains
     * @param chainId Chain ID
     * @param name Chain name
     * @param bridge Bridge contract address
     */
    function addChain(uint256 chainId, string memory name, address bridge) external onlyOwner {
        require(!chains[chainId].supported, "Chain already supported");
        
        chains[chainId] = ChainInfo({
            chainId: chainId,
            name: name,
            bridge: bridge,
            supported: true,
            totalLiquidity: 0,
            utilizationRate: 0,
            interestRate: 0
        });
        
        emit ChainAdded(chainId, name, bridge);
    }
    
    /**
     * @dev Removes a chain from the supported chains
     * @param chainId Chain ID to remove
     */
    function removeChain(uint256 chainId) external onlyOwner {
        require(chains[chainId].supported, "Chain not supported");
        require(chains[chainId].totalLiquidity == 0, "Chain has liquidity");
        
        chains[chainId].supported = false;
        
        emit ChainRemoved(chainId);
    }
    
    /**
     * @dev Adds a new liquidity source
     * @param chainId Chain ID
     * @param protocol Protocol address
     * @param asset Asset address
     * @param amount Initial amount
     * @param apy Expected APY
     */
    function addLiquiditySource(
        uint256 chainId,
        address protocol,
        address asset,
        uint256 amount,
        uint256 apy
    ) external onlyOwner {
        require(chains[chainId].supported, "Chain not supported");
        
        bytes32 sourceId = keccak256(abi.encodePacked(chainId, protocol, asset));
        
        liquiditySources[sourceId] = LiquiditySource({
            chainId: chainId,
            protocol: protocol,
            asset: asset,
            amount: amount,
            apy: apy,
            utilizationRate: 0,
            active: true
        });
        
        chainLiquiditySources[chainId].push(sourceId);
        
        // Update chain totals
        chains[chainId].totalLiquidity += amount;
        totalCrossChainLiquidity += amount;
        
        emit LiquidityAdded(chainId, protocol, asset, amount);
    }
    
    /**
     * @dev Updates a liquidity source
     * @param chainId Chain ID
     * @param protocol Protocol address
     * @param asset Asset address
     * @param amount New amount
     * @param apy New APY
     * @param active Whether the source is active
     */
    function updateLiquiditySource(
        uint256 chainId,
        address protocol,
        address asset,
        uint256 amount,
        uint256 apy,
        bool active
    ) external onlyOwner {
        bytes32 sourceId = keccak256(abi.encodePacked(chainId, protocol, asset));
        
        require(liquiditySources[sourceId].chainId == chainId, "Liquidity source not found");
        
        // Update chain totals
        uint256 oldAmount = liquiditySources[sourceId].amount;
        chains[chainId].totalLiquidity = chains[chainId].totalLiquidity - oldAmount + amount;
        totalCrossChainLiquidity = totalCrossChainLiquidity - oldAmount + amount;
        
        // Update source
        liquiditySources[sourceId].amount = amount;
        liquiditySources[sourceId].apy = apy;
        liquiditySources[sourceId].active = active;
        
        if (amount > oldAmount) {
            emit LiquidityAdded(chainId, protocol, asset, amount - oldAmount);
        } else if (amount < oldAmount) {
            emit LiquidityRemoved(chainId, protocol, asset, oldAmount - amount);
        }
    }
    
    /**
     * @dev Adds a liquidity pool
     * @param asset Asset address
     * @param totalLiquidity Total liquidity
     * @param utilizationRate Utilization rate
     * @param interestRate Interest rate
     */
    function addLiquidityPool(
        address asset,
        uint256 totalLiquidity,
        uint256 utilizationRate,
        uint256 interestRate
    ) external onlyOwner {
        require(liquidityPools[asset].asset == address(0), "Pool already exists");
        
        liquidityPools[asset] = LiquidityPool({
            asset: asset,
            totalLiquidity: totalLiquidity,
            availableLiquidity: totalLiquidity,
            utilizationRate: utilizationRate,
            interestRate: interestRate,
            active: true
        });
        
        supportedAssets.push(asset);
        
        // Update global statistics
        totalAvailableLiquidity += totalLiquidity;
        updateGlobalUtilizationRate();
    }
    
    /**
     * @dev Updates a liquidity pool
     * @param asset Asset address
     * @param totalLiquidity New total liquidity
     * @param availableLiquidity New available liquidity
     * @param active Whether the pool is active
     */
    function updateLiquidityPool(
        address asset,
        uint256 totalLiquidity,
        uint256 availableLiquidity,
        bool active
    ) external onlyOwner {
        require(liquidityPools[asset].asset == asset, "Pool does not exist");
        
        // Update global statistics
        totalAvailableLiquidity = totalAvailableLiquidity - liquidityPools[asset].availableLiquidity + availableLiquidity;
        
        // Update pool
        liquidityPools[asset].totalLiquidity = totalLiquidity;
        liquidityPools[asset].availableLiquidity = availableLiquidity;
        liquidityPools[asset].utilizationRate = totalLiquidity > 0 
            ? ((totalLiquidity - availableLiquidity) * 10000) / totalLiquidity 
            : 0;
        liquidityPools[asset].active = active;
        
        updateGlobalUtilizationRate();
    }
    
    /**
     * @dev Creates a new yield optimization strategy
     * @param name Strategy name
     * @param parameters Strategy parameters
     * @return strategyId The ID of the new strategy
     */
    function createStrategy(
        string memory name,
        bytes memory parameters
    ) external onlyOwner returns (uint256 strategyId) {
        strategyId = nextStrategyId++;
        
        strategies[strategyId] = Strategy({
            name: name,
            active: true,
            lastExecuted: 0,
            parameters: parameters
        });
        
        emit StrategyCreated(strategyId, name);
        
        return strategyId;
    }
    
    /**
     * @dev Updates an existing strategy
     * @param strategyId Strategy ID
     * @param name New strategy name
     * @param active Whether the strategy is active
     * @param parameters New strategy parameters
     */
    function updateStrategy(
        uint256 strategyId,
        string memory name,
        bool active,
        bytes memory parameters
    ) external onlyOwner {
        require(strategyId < nextStrategyId, "Strategy does not exist");
        
        strategies[strategyId].name = name;
        strategies[strategyId].active = active;
        strategies[strategyId].parameters = parameters;
        
        emit StrategyUpdated(strategyId, name);
    }
    
    /**
     * @dev Executes a yield optimization strategy
     * @param strategyId Strategy ID
     * @param data Execution data
     */
    function executeStrategy(
        uint256 strategyId,
        bytes memory data
    ) external onlyOwner nonReentrant whenNotPaused {
        require(strategyId < nextStrategyId, "Strategy does not exist");
        require(strategies[strategyId].active, "Strategy is not active");
        
        // Update execution timestamp
        strategies[strategyId].lastExecuted = block.timestamp;
        
        // Decode strategy parameters and execution data
        // This is a placeholder - actual implementation would depend on strategy types
        (uint256 sourceChainId, uint256 destChainId, address asset, uint256 amount) = abi.decode(
            data,
            (uint256, uint256, address, uint256)
        );
        
        // Verify chains are supported
        require(chains[sourceChainId].supported, "Source chain not supported");
        require(chains[destChainId].supported, "Destination chain not supported");
        
        // Here you would implement the actual cross-chain logic:
        // 1. Call the bridge to move assets between chains
        // 2. Update liquidity sources and pools
        // 3. Emit events
        
        // This is just a placeholder for the hackathon
        emit StrategyExecuted(strategyId, block.timestamp);
    }
    
    /**
     * @dev Harvests yield from a cross-chain liquidity source
     * @param chainId Chain ID
     * @param protocol Protocol address
     * @param asset Asset address
     * @param amount Amount of yield to harvest
     */
    function harvestYield(
        uint256 chainId,
        address protocol,
        address asset,
        uint256 amount
    ) external onlyOwner nonReentrant whenNotPaused {
        bytes32 sourceId = keccak256(abi.encodePacked(chainId, protocol, asset));
        
        require(liquiditySources[sourceId].chainId == chainId, "Liquidity source not found");
        require(liquiditySources[sourceId].active, "Liquidity source not active");
        
        // Here you would implement the actual yield harvesting logic:
        // 1. Call the bridge to retrieve yield from the source chain
        // 2. Distribute yield to the protocol treasury or to lenders
        
        // This is just a placeholder for the hackathon
        emit YieldHarvested(chainId, protocol, asset, amount);
    }
    
    /**
     * @dev Updates the global utilization rate
     */
    function updateGlobalUtilizationRate() private {
        if (totalCrossChainLiquidity > 0) {
            globalUtilizationRate = ((totalCrossChainLiquidity - totalAvailableLiquidity) * 10000) / totalCrossChainLiquidity;
        } else {
            globalUtilizationRate = 0;
        }
    }
    
    /**
     * @dev Gets all supported assets
     * @return _assets Array of supported asset addresses
     */
    function getSupportedAssets() external view returns (address[] memory _assets) {
        return supportedAssets;
    }
    
    /**
     * @dev Gets all liquidity sources for a chain
     * @param chainId Chain ID
     * @return _sources Array of liquidity source IDs
     */
    function getChainLiquiditySources(uint256 chainId) external view returns (bytes32[] memory _sources) {
        return chainLiquiditySources[chainId];
    }
    
    /**
     * @dev Gets details for a liquidity source
     * @param sourceId Liquidity source ID
     * @return chainId Chain ID
     * @return protocol Protocol address
     * @return asset Asset address
     * @return amount Amount
     * @return apy APY
     * @return utilizationRate Utilization rate
     * @return active Whether the source is active
     */
    function getLiquiditySourceDetails(bytes32 sourceId) external view returns (
        uint256 chainId,
        address protocol,
        address asset,
        uint256 amount,
        uint256 apy,
        uint256 utilizationRate,
        bool active
    ) {
        LiquiditySource memory source = liquiditySources[sourceId];
        return (
            source.chainId,
            source.protocol,
            source.asset,
            source.amount,
            source.apy,
            source.utilizationRate,
            source.active
        );
    }
    
    /**
     * @dev Pauses the contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpauses the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
