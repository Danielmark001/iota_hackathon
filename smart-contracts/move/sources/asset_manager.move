module intellilend::asset_manager {
    use std::error;
    use std::signer;
    use std::string::{Self, String};
    use std::vector;
    
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::table::{Self, Table};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use sui::dynamic_field as df;
    
    // Import our enhanced asset module
    use intellilend::enhanced_asset::{Self, EnhancedLendingAsset, EnhancedAssetRegistry};
    
    // Constants for permission control
    const ADMIN_ROLE: u8 = 0;
    const BRIDGE_ROLE: u8 = 1;
    const VERIFIER_ROLE: u8 = 2;
    
    // Error codes
    const INSUFFICIENT_FUNDS: u64 = 0;
    const INVALID_COLLATERAL: u64 = 1;
    const UNAUTHORIZED: u64 = 2;
    const INVALID_ASSET: u64 = 3;
    const ALREADY_REGISTERED: u64 = 4;
    const NOT_REGISTERED: u64 = 5;
    const INSUFFICIENT_COLLATERAL: u64 = 6;
    const LIQUIDATION_THRESHOLD: u64 = 7;
    const INVALID_PARAMETER: u64 = 8;
    
    // Market configuration constants
    const MAX_LTV: u64 = 75; // 75% maximum loan-to-value ratio
    const LIQUIDATION_THRESHOLD: u64 = 83; // 83% liquidation threshold
    const LIQUIDATION_BONUS: u64 = 5; // 5% bonus for liquidators
    const MIN_HEALTH_FACTOR: u64 = 100; // 1.0 minimum health factor (scaled by 100)
    
    // Registry for all users and their lending positions
    struct LendingRegistry has key {
        id: UID,
        admin: address,
        users: Table<address, UserPosition>,
        total_deposits: u64,
        total_borrows: u64,
        total_collateral: u64,
        total_users: u64,
        liquidation_count: u64,
        platform_fees: Balance<sui::sui::SUI>,
        asset_registry_id: ID,
        oracle_addresses: Table<String, address>, // Token symbol -> Price Oracle
        risk_model_configs: Table<String, RiskModelConfig>,
        role_assignments: Table<address, u8>, // Address -> Role
        reserve_factor: u64, // Percentage of interest that goes to protocol (scaled by 100)
        active: bool
    }
    
    // User's lending position
    struct UserPosition has store {
        deposits: Table<String, u64>,       // Token symbol -> Amount
        borrows: Table<String, u64>,        // Token symbol -> Amount
        collaterals: Table<String, u64>,    // Token symbol -> Amount
        risk_score: u64,                    // 0-100 risk score
        last_interest_update: u64,          // Last time interest was accrued
        health_factor: u64,                 // Current health factor (scaled by 100)
        asset_ids: vector<ID>,              // IDs of assets owned by user
        verified_status: bool,              // Whether identity is verified
        cross_chain_activities: Table<u64, CrossChainActivity>, // Chain ID -> Activity
        reward_points: u64,                 // Loyalty/reward points
        last_active: u64                    // Last activity timestamp
    }
    
    // Configuration for risk models across different assets
    struct RiskModelConfig has store, drop {
        base_rate: u64,               // Base interest rate (scaled by 100)
        slope1: u64,                  // Interest rate slope below optimal utilization (scaled by 100)
        slope2: u64,                  // Interest rate slope above optimal utilization (scaled by 100)
        optimal_utilization: u64,     // Optimal utilization point (scaled by 100)
        risk_premium_factor: u64,     // How much risk score affects interest rate (scaled by 100)
        ltv_risk_adjustment: u64      // How much risk score affects LTV (scaled by 100)
    }
    
    // Record of cross-chain activity
    struct CrossChainActivity has store, drop {
        chain_id: u64,                // External chain ID
        deposits: u64,                // Total deposits on that chain
        borrows: u64,                 // Total borrows on that chain
        collaterals: u64,             // Total collateral on that chain
        last_synced: u64,             // Last time data was synced
        transaction_count: u64        // Number of transactions on that chain
    }
    
    // Events for on-chain tracking
    struct DepositEvent has copy, drop {
        user: address,
        token: String,
        amount: u64,
        timestamp: u64
    }
    
    struct BorrowEvent has copy, drop {
        user: address,
        token: String,
        amount: u64,
        interest_rate: u64,
        timestamp: u64
    }
    
    struct RepayEvent has copy, drop {
        user: address,
        token: String,
        amount: u64,
        timestamp: u64
    }
    
    struct CollateralAddedEvent has copy, drop {
        user: address,
        token: String,
        amount: u64,
        timestamp: u64
    }
    
    struct CollateralRemovedEvent has copy, drop {
        user: address,
        token: String,
        amount: u64,
        timestamp: u64
    }
    
    struct LiquidationEvent has copy, drop {
        liquidator: address,
        borrower: address,
        token: String,
        collateral_token: String,
        repaid_amount: u64,
        liquidated_collateral: u64,
        timestamp: u64
    }
    
    struct RiskScoreUpdatedEvent has copy, drop {
        user: address,
        old_score: u64,
        new_score: u64,
        timestamp: u64
    }
    
    struct CrossChainUpdateEvent has copy, drop {
        user: address,
        chain_id: u64,
        update_type: String, // "DEPOSIT", "BORROW", "REPAY", etc.
        amount: u64,
        timestamp: u64
    }
    
    // Initialize the lending registry
    fun init(ctx: &mut TxContext) {
        let registry = LendingRegistry {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            users: table::new<address, UserPosition>(ctx),
            total_deposits: 0,
            total_borrows: 0,
            total_collateral: 0,
            total_users: 0,
            liquidation_count: 0,
            platform_fees: balance::zero<sui::sui::SUI>(),
            asset_registry_id: object::id_from_address(signer::address_of(ctx)),
            oracle_addresses: table::new<String, address>(ctx),
            risk_model_configs: table::new<String, RiskModelConfig>(ctx),
            role_assignments: table::new<address, u8>(ctx),
            reserve_factor: 10, // 10% of interest goes to protocol
            active: true
        };
        
        // Share the registry as a shared object
        transfer::share_object(registry);
    }
    
    // Register a user in the lending registry
    public fun register_user(
        registry: &mut LendingRegistry,
        user: &signer,
        ctx: &mut TxContext
    ) {
        let sender = signer::address_of(user);
        
        // Check if user is already registered
        assert!(!table::contains(&registry.users, sender), error::already_exists(ALREADY_REGISTERED));
        
        // Create new user position
        let position = UserPosition {
            deposits: table::new<String, u64>(ctx),
            borrows: table::new<String, u64>(ctx),
            collaterals: table::new<String, u64>(ctx),
            risk_score: 50, // Default risk score of 50
            last_interest_update: tx_context::epoch(ctx),
            health_factor: 100 * 100, // 100.00 as initial health factor
            asset_ids: vector::empty<ID>(),
            verified_status: false,
            cross_chain_activities: table::new<u64, CrossChainActivity>(ctx),
            reward_points: 0,
            last_active: tx_context::epoch(ctx)
        };
        
        // Add user to registry
        table::add(&mut registry.users, sender, position);
        registry.total_users = registry.total_users + 1;
    }
    
    // Deposit a token into the lending pool
    public fun deposit(
        registry: &mut LendingRegistry,
        user: &signer,
        token_symbol: String,
        amount: u64,
        asset_registry: &mut EnhancedAssetRegistry,
        ctx: &mut TxContext
    ) {
        let sender = signer::address_of(user);
        
        // Ensure registry is active
        assert!(registry.active, error::unavailable(UNAUTHORIZED));
        
        // Check if user is registered
        assert!(table::contains(&registry.users, sender), error::not_found(NOT_REGISTERED));
        
        // Ensure amount is valid
        assert!(amount > 0, error::invalid_argument(INVALID_PARAMETER));
        
        // Get user position
        let position = table::borrow_mut(&mut registry.users, sender);
        
        // Add to deposits or update existing deposit
        if (table::contains(&position.deposits, token_symbol)) {
            let deposit_amount = table::borrow_mut(&mut position.deposits, token_symbol);
            *deposit_amount = *deposit_amount + amount;
        } else {
            table::add(&mut position.deposits, token_symbol, amount);
        }
        
        // Update total deposits
        registry.total_deposits = registry.total_deposits + amount;
        
        // Update user's last activity
        position.last_active = tx_context::epoch(ctx);
        
        // Create enhanced asset for tracking in asset registry
        let asset = enhanced_asset::create_enhanced_asset(
            user,
            asset_registry,
            token_symbol,
            amount,
            string::utf8(b"deposit asset"),
            ctx
        );
        
        // Add asset ID to user's assets
        vector::push_back(&mut position.asset_ids, object::id(&asset));
        
        // Emit deposit event
        event::emit(DepositEvent {
            user: sender,
            token: token_symbol,
            amount,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    // Withdraw a token from the lending pool
    public fun withdraw(
        registry: &mut LendingRegistry,
        user: &signer,
        token_symbol: String,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let sender = signer::address_of(user);
        
        // Ensure registry is active
        assert!(registry.active, error::unavailable(UNAUTHORIZED));
        
        // Check if user is registered
        assert!(table::contains(&registry.users, sender), error::not_found(NOT_REGISTERED));
        
        // Get user position
        let position = table::borrow_mut(&mut registry.users, sender);
        
        // Ensure user has deposits in this token
        assert!(table::contains(&position.deposits, token_symbol), error::not_found(INVALID_ASSET));
        
        // Get current deposit
        let deposit_amount = table::borrow_mut(&mut position.deposits, token_symbol);
        
        // Ensure sufficient funds
        assert!(*deposit_amount >= amount, error::invalid_argument(INSUFFICIENT_FUNDS));
        
        // Ensure amount is valid
        assert!(amount > 0, error::invalid_argument(INVALID_PARAMETER));
        
        // Check if user has outstanding borrows
        let has_borrows = false;
        if (table::contains(&position.borrows, token_symbol)) {
            has_borrows = *table::borrow(&position.borrows, token_symbol) > 0;
        };
        
        // If user has borrows, check health factor after withdrawal
        if (has_borrows) {
            // Calculate hypothetical health factor after withdrawal
            let new_health_factor = calculate_health_factor_after_withdrawal(
                registry,
                position,
                token_symbol,
                amount
            );
            
            // Ensure health factor stays above minimum
            assert!(new_health_factor >= MIN_HEALTH_FACTOR, error::invalid_argument(INSUFFICIENT_COLLATERAL));
        }
        
        // Update deposit amount
        *deposit_amount = *deposit_amount - amount;
        
        // Update total deposits
        registry.total_deposits = registry.total_deposits - amount;
        
        // Update user's last activity
        position.last_active = tx_context::epoch(ctx);
        
        // Emit event
        event::emit(DepositEvent {
            user: sender,
            token: token_symbol,
            amount: amount,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    // Borrow tokens from the lending pool
    public fun borrow(
        registry: &mut LendingRegistry,
        user: &signer,
        token_symbol: String,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let sender = signer::address_of(user);
        
        // Ensure registry is active
        assert!(registry.active, error::unavailable(UNAUTHORIZED));
        
        // Check if user is registered
        assert!(table::contains(&registry.users, sender), error::not_found(NOT_REGISTERED));
        
        // Ensure amount is valid
        assert!(amount > 0, error::invalid_argument(INVALID_PARAMETER));
        
        // Get user position
        let position = table::borrow_mut(&mut registry.users, sender);
        
        // Accrue interest before borrowing
        accrue_interest(registry, position, token_symbol, ctx);
        
        // Calculate current health factor and max borrowable amount
        let (current_health_factor, max_borrowable) = calculate_max_borrowable(
            registry,
            position,
            token_symbol
        );
        
        // Ensure user has sufficient collateral for this borrow
        assert!(amount <= max_borrowable, error::invalid_argument(INSUFFICIENT_COLLATERAL));
        
        // Add to borrows or update existing borrow
        if (table::contains(&position.borrows, token_symbol)) {
            let borrow_amount = table::borrow_mut(&mut position.borrows, token_symbol);
            *borrow_amount = *borrow_amount + amount;
        } else {
            table::add(&mut position.borrows, token_symbol, amount);
        }
        
        // Update total borrows
        registry.total_borrows = registry.total_borrows + amount;
        
        // Update health factor
        position.health_factor = calculate_health_factor(registry, position);
        
        // Update last interest update time
        position.last_interest_update = tx_context::epoch(ctx);
        
        // Update user's last activity
        position.last_active = tx_context::epoch(ctx);
        
        // Calculate interest rate for this borrow
        let interest_rate = calculate_interest_rate(registry, token_symbol, position.risk_score);
        
        // Emit borrow event
        event::emit(BorrowEvent {
            user: sender,
            token: token_symbol,
            amount,
            interest_rate,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    // Repay borrowed tokens
    public fun repay(
        registry: &mut LendingRegistry,
        user: &signer,
        token_symbol: String,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let sender = signer::address_of(user);
        
        // Ensure registry is active
        assert!(registry.active, error::unavailable(UNAUTHORIZED));
        
        // Check if user is registered
        assert!(table::contains(&registry.users, sender), error::not_found(NOT_REGISTERED));
        
        // Ensure amount is valid
        assert!(amount > 0, error::invalid_argument(INVALID_PARAMETER));
        
        // Get user position
        let position = table::borrow_mut(&mut registry.users, sender);
        
        // Accrue interest before repayment
        accrue_interest(registry, position, token_symbol, ctx);
        
        // Ensure user has borrows in this token
        assert!(table::contains(&position.borrows, token_symbol), error::not_found(INVALID_ASSET));
        
        // Get current borrow
        let borrow_amount = table::borrow_mut(&mut position.borrows, token_symbol);
        
        // Cap repayment amount to outstanding debt
        let repay_amount = if (amount > *borrow_amount) { *borrow_amount } else { amount };
        
        // Update borrow amount
        *borrow_amount = *borrow_amount - repay_amount;
        
        // Update total borrows
        registry.total_borrows = registry.total_borrows - repay_amount;
        
        // Update health factor
        position.health_factor = calculate_health_factor(registry, position);
        
        // Update last interest update time
        position.last_interest_update = tx_context::epoch(ctx);
        
        // Update user's last activity
        position.last_active = tx_context::epoch(ctx);
        
        // Emit repay event
        event::emit(RepayEvent {
            user: sender,
            token: token_symbol,
            amount: repay_amount,
            timestamp: tx_context::epoch(ctx)
        });
        
        // Award loyalty points for repayment (1 point per 100 units repaid)
        position.reward_points = position.reward_points + (repay_amount / 100);
    }
    
    // Add collateral to the lending pool
    public fun add_collateral(
        registry: &mut LendingRegistry,
        user: &signer,
        token_symbol: String,
        amount: u64,
        asset_registry: &mut EnhancedAssetRegistry,
        ctx: &mut TxContext
    ) {
        let sender = signer::address_of(user);
        
        // Ensure registry is active
        assert!(registry.active, error::unavailable(UNAUTHORIZED));
        
        // Check if user is registered
        assert!(table::contains(&registry.users, sender), error::not_found(NOT_REGISTERED));
        
        // Ensure amount is valid
        assert!(amount > 0, error::invalid_argument(INVALID_PARAMETER));
        
        // Get user position
        let position = table::borrow_mut(&mut registry.users, sender);
        
        // Add to collaterals or update existing collateral
        if (table::contains(&position.collaterals, token_symbol)) {
            let collateral_amount = table::borrow_mut(&mut position.collaterals, token_symbol);
            *collateral_amount = *collateral_amount + amount;
        } else {
            table::add(&mut position.collaterals, token_symbol, amount);
        }
        
        // Update total collateral
        registry.total_collateral = registry.total_collateral + amount;
        
        // Update health factor
        position.health_factor = calculate_health_factor(registry, position);
        
        // Update user's last activity
        position.last_active = tx_context::epoch(ctx);
        
        // Create enhanced asset for tracking in asset registry
        let risk_data = vector::empty<u8>(); // Placeholder for real risk data
        let asset = enhanced_asset::create_enhanced_asset(
            user,
            asset_registry,
            token_symbol,
            amount,
            string::utf8(b"collateral asset"),
            ctx
        );
        
        // Mark asset as collateral in asset registry
        enhanced_asset::mark_as_enhanced_collateral(
            user,
            asset_registry,
            &mut asset,
            risk_data,
            ctx
        );
        
        // Add asset ID to user's assets
        vector::push_back(&mut position.asset_ids, object::id(&asset));
        
        // Emit collateral added event
        event::emit(CollateralAddedEvent {
            user: sender,
            token: token_symbol,
            amount,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    // Remove collateral from the lending pool
    public fun remove_collateral(
        registry: &mut LendingRegistry,
        user: &signer,
        token_symbol: String,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let sender = signer::address_of(user);
        
        // Ensure registry is active
        assert!(registry.active, error::unavailable(UNAUTHORIZED));
        
        // Check if user is registered
        assert!(table::contains(&registry.users, sender), error::not_found(NOT_REGISTERED));
        
        // Ensure amount is valid
        assert!(amount > 0, error::invalid_argument(INVALID_PARAMETER));
        
        // Get user position
        let position = table::borrow_mut(&mut registry.users, sender);
        
        // Ensure user has collateral in this token
        assert!(table::contains(&position.collaterals, token_symbol), error::not_found(INVALID_ASSET));
        
        // Get current collateral
        let collateral_amount = table::borrow_mut(&mut position.collaterals, token_symbol);
        
        // Ensure sufficient collateral
        assert!(*collateral_amount >= amount, error::invalid_argument(INSUFFICIENT_COLLATERAL));
        
        // Calculate hypothetical health factor after collateral removal
        let new_health_factor = calculate_health_factor_after_collateral_removal(
            registry,
            position,
            token_symbol,
            amount
        );
        
        // Ensure health factor stays above minimum
        assert!(new_health_factor >= MIN_HEALTH_FACTOR, error::invalid_argument(INSUFFICIENT_COLLATERAL));
        
        // Update collateral amount
        *collateral_amount = *collateral_amount - amount;
        
        // Update total collateral
        registry.total_collateral = registry.total_collateral - amount;
        
        // Update health factor
        position.health_factor = new_health_factor;
        
        // Update user's last activity
        position.last_active = tx_context::epoch(ctx);
        
        // Emit collateral removed event
        event::emit(CollateralRemovedEvent {
            user: sender,
            token: token_symbol,
            amount,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    // Liquidate an undercollateralized position
    public fun liquidate(
        registry: &mut LendingRegistry,
        liquidator: &signer,
        borrower: address,
        debt_token: String,
        collateral_token: String,
        debt_amount: u64,
        ctx: &mut TxContext
    ) {
        let liquidator_addr = signer::address_of(liquidator);
        
        // Ensure registry is active
        assert!(registry.active, error::unavailable(UNAUTHORIZED));
        
        // Check if borrower is registered
        assert!(table::contains(&registry.users, borrower), error::not_found(NOT_REGISTERED));
        
        // Ensure liquidator is not the borrower
        assert!(liquidator_addr != borrower, error::invalid_argument(UNAUTHORIZED));
        
        // Ensure amount is valid
        assert!(debt_amount > 0, error::invalid_argument(INVALID_PARAMETER));
        
        // Get borrower position
        let borrower_position = table::borrow_mut(&mut registry.users, borrower);
        
        // Accrue interest before liquidation
        accrue_interest(registry, borrower_position, debt_token, ctx);
        
        // Ensure borrower has debt in this token
        assert!(table::contains(&borrower_position.borrows, debt_token), error::not_found(INVALID_ASSET));
        
        // Ensure borrower has collateral in the collateral token
        assert!(table::contains(&borrower_position.collaterals, collateral_token), error::not_found(INVALID_ASSET));
        
        // Check if position is liquidatable (health factor below 1.0)
        assert!(borrower_position.health_factor < MIN_HEALTH_FACTOR, error::invalid_argument(LIQUIDATION_THRESHOLD));
        
        // Get current debt
        let debt = table::borrow_mut(&mut borrower_position.borrows, debt_token);
        
        // Cap liquidation amount to debt
        let actual_debt_amount = if (debt_amount > *debt) { *debt } else { debt_amount };
        
        // Calculate collateral to seize with liquidation bonus
        let collateral_to_seize = calculate_collateral_to_seize(
            registry,
            debt_token,
            collateral_token,
            actual_debt_amount,
            LIQUIDATION_BONUS
        );
        
        // Get borrower's collateral
        let collateral = table::borrow_mut(&mut borrower_position.collaterals, collateral_token);
        
        // Cap collateral to seize to available collateral
        let actual_collateral = if (collateral_to_seize > *collateral) { *collateral } else { collateral_to_seize };
        
        // Update borrower's debt
        *debt = *debt - actual_debt_amount;
        
        // Update borrower's collateral
        *collateral = *collateral - actual_collateral;
        
        // Get liquidator position or create it if not registered
        if (!table::contains(&registry.users, liquidator_addr)) {
            // Create minimal user position for liquidator
            let liquidator_position = UserPosition {
                deposits: table::new<String, u64>(ctx),
                borrows: table::new<String, u64>(ctx),
                collaterals: table::new<String, u64>(ctx),
                risk_score: 50,
                last_interest_update: tx_context::epoch(ctx),
                health_factor: 100 * 100,
                asset_ids: vector::empty<ID>(),
                verified_status: false,
                cross_chain_activities: table::new<u64, CrossChainActivity>(ctx),
                reward_points: 0,
                last_active: tx_context::epoch(ctx)
            };
            
            table::add(&mut registry.users, liquidator_addr, liquidator_position);
            registry.total_users = registry.total_users + 1;
        }
        
        // Get liquidator position
        let liquidator_position = table::borrow_mut(&mut registry.users, liquidator_addr);
        
        // Add collateral to liquidator
        if (table::contains(&liquidator_position.collaterals, collateral_token)) {
            let liquidator_collateral = table::borrow_mut(&mut liquidator_position.collaterals, collateral_token);
            *liquidator_collateral = *liquidator_collateral + actual_collateral;
        } else {
            table::add(&mut liquidator_position.collaterals, collateral_token, actual_collateral);
        }
        
        // Update liquidator's last activity
        liquidator_position.last_active = tx_context::epoch(ctx);
        
        // Update borrower's health factor
        borrower_position.health_factor = calculate_health_factor(registry, borrower_position);
        
        // Update registry stats
        registry.liquidation_count = registry.liquidation_count + 1;
        registry.total_borrows = registry.total_borrows - actual_debt_amount;
        
        // Emit liquidation event
        event::emit(LiquidationEvent {
            liquidator: liquidator_addr,
            borrower,
            token: debt_token,
            collateral_token,
            repaid_amount: actual_debt_amount,
            liquidated_collateral: actual_collateral,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    // Update a user's risk score (only callable by admin or authorized oracles)
    public fun update_risk_score(
        registry: &mut LendingRegistry,
        admin: &signer,
        user: address,
        new_score: u64,
        ctx: &mut TxContext
    ) {
        let admin_addr = signer::address_of(admin);
        
        // Ensure caller is admin or has oracle role
        assert!(
            admin_addr == registry.admin || 
            (table::contains(&registry.role_assignments, admin_addr) && 
             *table::borrow(&registry.role_assignments, admin_addr) == VERIFIER_ROLE),
            error::permission_denied(UNAUTHORIZED)
        );
        
        // Ensure score is in valid range
        assert!(new_score <= 100, error::invalid_argument(INVALID_PARAMETER));
        
        // Check if user is registered
        assert!(table::contains(&registry.users, user), error::not_found(NOT_REGISTERED));
        
        // Get user position
        let position = table::borrow_mut(&mut registry.users, user);
        
        // Store old score for event
        let old_score = position.risk_score;
        
        // Update risk score
        position.risk_score = new_score;
        
        // Update health factor since risk affects collateral requirements
        position.health_factor = calculate_health_factor(registry, position);
        
        // Emit risk score updated event
        event::emit(RiskScoreUpdatedEvent {
            user,
            old_score,
            new_score,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    // Process a cross-chain update (only callable by bridge role)
    public fun process_cross_chain_update(
        registry: &mut LendingRegistry,
        bridge: &signer,
        user: address,
        chain_id: u64,
        update_type: String,
        token_symbol: String,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let bridge_addr = signer::address_of(bridge);
        
        // Ensure caller has bridge role
        assert!(
            table::contains(&registry.role_assignments, bridge_addr) && 
            *table::borrow(&registry.role_assignments, bridge_addr) == BRIDGE_ROLE,
            error::permission_denied(UNAUTHORIZED)
        );
        
        // Check if user is registered
        assert!(table::contains(&registry.users, user), error::not_found(NOT_REGISTERED));
        
        // Get user position
        let position = table::borrow_mut(&mut registry.users, user);
        
        // Process update based on type
        if (string::to_ascii(update_type) == string::to_ascii(string::utf8(b"DEPOSIT"))) {
            // Process deposit from other chain
            if (table::contains(&position.deposits, token_symbol)) {
                let deposit = table::borrow_mut(&mut position.deposits, token_symbol);
                *deposit = *deposit + amount;
            } else {
                table::add(&mut position.deposits, token_symbol, amount);
            }
            
            registry.total_deposits = registry.total_deposits + amount;
        } else if (string::to_ascii(update_type) == string::to_ascii(string::utf8(b"BORROW"))) {
            // Process borrow from other chain
            if (table::contains(&position.borrows, token_symbol)) {
                let borrow = table::borrow_mut(&mut position.borrows, token_symbol);
                *borrow = *borrow + amount;
            } else {
                table::add(&mut position.borrows, token_symbol, amount);
            }
            
            registry.total_borrows = registry.total_borrows + amount;
        } else if (string::to_ascii(update_type) == string::to_ascii(string::utf8(b"COLLATERAL"))) {
            // Process collateral from other chain
            if (table::contains(&position.collaterals, token_symbol)) {
                let collateral = table::borrow_mut(&mut position.collaterals, token_symbol);
                *collateral = *collateral + amount;
            } else {
                table::add(&mut position.collaterals, token_symbol, amount);
            }
            
            registry.total_collateral = registry.total_collateral + amount;
        }
        
        // Update cross-chain activity record
        if (table::contains(&position.cross_chain_activities, chain_id)) {
            let activity = table::borrow_mut(&mut position.cross_chain_activities, chain_id);
            
            if (string::to_ascii(update_type) == string::to_ascii(string::utf8(b"DEPOSIT"))) {
                activity.deposits = activity.deposits + amount;
            } else if (string::to_ascii(update_type) == string::to_ascii(string::utf8(b"BORROW"))) {
                activity.borrows = activity.borrows + amount;
            } else if (string::to_ascii(update_type) == string::to_ascii(string::utf8(b"COLLATERAL"))) {
                activity.collaterals = activity.collaterals + amount;
            }
            
            activity.transaction_count = activity.transaction_count + 1;
            activity.last_synced = tx_context::epoch(ctx);
        } else {
            // Create new activity record
            let activity = CrossChainActivity {
                chain_id,
                deposits: if (string::to_ascii(update_type) == string::to_ascii(string::utf8(b"DEPOSIT"))) { amount } else { 0 },
                borrows: if (string::to_ascii(update_type) == string::to_ascii(string::utf8(b"BORROW"))) { amount } else { 0 },
                collaterals: if (string::to_ascii(update_type) == string::to_ascii(string::utf8(b"COLLATERAL"))) { amount } else { 0 },
                last_synced: tx_context::epoch(ctx),
                transaction_count: 1
            };
            
            table::add(&mut position.cross_chain_activities, chain_id, activity);
        }
        
        // Update health factor
        position.health_factor = calculate_health_factor(registry, position);
        
        // Emit cross-chain update event
        event::emit(CrossChainUpdateEvent {
            user,
            chain_id,
            update_type,
            amount,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    // Internal helper functions
    
    // Accrue interest for a user's borrow
    fun accrue_interest(
        registry: &LendingRegistry,
        position: &mut UserPosition,
        token_symbol: String,
        ctx: &mut TxContext
    ) {
        // Only accrue if user has borrows in this token
        if (!table::contains(&position.borrows, token_symbol)) {
            position.last_interest_update = tx_context::epoch(ctx);
            return
        }
        
        let borrow_amount = table::borrow(&position.borrows, token_symbol);
        
        // Only accrue if borrow amount is positive
        if (*borrow_amount == 0) {
            position.last_interest_update = tx_context::epoch(ctx);
            return
        }
        
        // Calculate time elapsed since last update
        let current_time = tx_context::epoch(ctx);
        let time_elapsed = current_time - position.last_interest_update;
        
        // Only accrue if time has passed
        if (time_elapsed == 0) {
            return
        }
        
        // Get interest rate for this token and user
        let interest_rate = calculate_interest_rate(registry, token_symbol, position.risk_score);
        
        // Calculate interest: principal * rate * time / (365 days * 10000 for scaling)
        // Interest rate is in basis points (1/100 of a percent)
        let interest = (*borrow_amount * interest_rate * time_elapsed) / (365 * 24 * 3600 * 10000);
        
        if (interest > 0) {
            // Calculate platform fee
            let platform_fee = (interest * registry.reserve_factor) / 100;
            let user_interest = interest - platform_fee;
            
            // Update borrow amount
            let borrow = table::borrow_mut(&mut position.borrows, token_symbol);
            *borrow = *borrow + user_interest;
            
            // Update last interest update time
            position.last_interest_update = current_time;
        }
    }
    
    // Calculate interest rate for a specific token and user
    fun calculate_interest_rate(
        registry: &LendingRegistry,
        token_symbol: String,
        risk_score: u64
    ): u64 {
        // Get token-specific risk model if available
        let base_rate: u64 = 300; // Default 3% base rate
        let slope1: u64 = 1000;   // Default 10% slope below optimal utilization
        let slope2: u64 = 3000;   // Default 30% slope above optimal utilization
        let optimal_utilization: u64 = 8000; // Default 80% optimal utilization
        let risk_premium_factor: u64 = 5;   // Default 5% risk premium factor
        
        if (table::contains(&registry.risk_model_configs, token_symbol)) {
            let config = table::borrow(&registry.risk_model_configs, token_symbol);
            base_rate = config.base_rate;
            slope1 = config.slope1;
            slope2 = config.slope2;
            optimal_utilization = config.optimal_utilization;
            risk_premium_factor = config.risk_premium_factor;
        };
        
        // Calculate utilization rate
        let utilization_rate: u64 = 0;
        let total_deposits = registry.total_deposits;
        let total_borrows = registry.total_borrows;
        
        if (total_deposits > 0) {
            utilization_rate = (total_borrows * 10000) / total_deposits; // Scaled by 10000
        };
        
        // Calculate interest rate based on utilization
        let interest_rate: u64;
        
        if (utilization_rate <= optimal_utilization) {
            interest_rate = base_rate + (slope1 * utilization_rate) / 10000;
        } else {
            let excess_utilization = utilization_rate - optimal_utilization;
            interest_rate = base_rate + (slope1 * optimal_utilization) / 10000 + 
                           (slope2 * excess_utilization) / 10000;
        };
        
        // Apply risk premium based on risk score
        let risk_premium = (risk_score * risk_premium_factor) / 100; // Higher risk = higher premium
        interest_rate = interest_rate + risk_premium;
        
        return interest_rate;
    }
    
    // Calculate a user's health factor
    fun calculate_health_factor(
        registry: &LendingRegistry,
        position: &UserPosition
    ): u64 {
        // Calculate total value of borrows and collateral
        let total_borrows_value: u64 = 0;
        let total_collateral_value: u64 = 0;
        
        // Sum all borrows
        let borrow_tokens = table::keys(&position.borrows);
        let i = 0;
        let len = vector::length(&borrow_tokens);
        
        while (i < len) {
            let token = *vector::borrow(&borrow_tokens, i);
            let amount = *table::borrow(&position.borrows, token);
            
            if (amount > 0) {
                // In a real implementation, we would use price oracles
                // For simplicity, assuming 1:1 exchange rate for now
                total_borrows_value = total_borrows_value + amount;
            }
            
            i = i + 1;
        };
        
        // Sum all collateral
        let collateral_tokens = table::keys(&position.collaterals);
        let i = 0;
        let len = vector::length(&collateral_tokens);
        
        while (i < len) {
            let token = *vector::borrow(&collateral_tokens, i);
            let amount = *table::borrow(&position.collaterals, token);
            
            if (amount > 0) {
                // In a real implementation, we would use price oracles and apply LTV
                // For simplicity, assuming 1:1 exchange rate and 75% LTV
                let adjusted_amount = (amount * MAX_LTV) / 100;
                total_collateral_value = total_collateral_value + adjusted_amount;
            }
            
            i = i + 1;
        };
        
        // Calculate health factor (collateral / borrows)
        if (total_borrows_value == 0) {
            return 10000; // Max health factor if no borrows
        };
        
        return (total_collateral_value * 100) / total_borrows_value; // Scaled by 100
    }
    
    // Calculate maximum borrowable amount for a user
    fun calculate_max_borrowable(
        registry: &LendingRegistry,
        position: &UserPosition,
        token_symbol: String
    ): (u64, u64) {
        // Calculate total collateral value adjusted by LTV
        let total_collateral_value: u64 = 0;
        
        // Sum all collateral
        let collateral_tokens = table::keys(&position.collaterals);
        let i = 0;
        let len = vector::length(&collateral_tokens);
        
        while (i < len) {
            let token = *vector::borrow(&collateral_tokens, i);
            let amount = *table::borrow(&position.collaterals, token);
            
            if (amount > 0) {
                // Adjust LTV based on risk score
                let adjusted_ltv = MAX_LTV;
                
                // Higher risk = lower LTV
                if (position.risk_score > 50) {
                    adjusted_ltv = MAX_LTV - ((position.risk_score - 50) / 5); // Each 5 points above 50 reduces LTV by 1%
                }
                
                // Adjust collateral value by LTV
                let adjusted_amount = (amount * adjusted_ltv) / 100;
                total_collateral_value = total_collateral_value + adjusted_amount;
            }
            
            i = i + 1;
        };
        
        // Calculate current total borrow value
        let total_borrows_value: u64 = 0;
        
        // Sum all borrows
        let borrow_tokens = table::keys(&position.borrows);
        let i = 0;
        let len = vector::length(&borrow_tokens);
        
        while (i < len) {
            let token = *vector::borrow(&borrow_tokens, i);
            let amount = *table::borrow(&position.borrows, token);
            
            if (amount > 0) {
                total_borrows_value = total_borrows_value + amount;
            }
            
            i = i + 1;
        };
        
        // Calculate max additional borrowable
        let max_borrowable: u64;
        
        if (total_collateral_value > total_borrows_value) {
            max_borrowable = total_collateral_value - total_borrows_value;
        } else {
            max_borrowable = 0;
        }
        
        return (position.health_factor, max_borrowable)
    }
    
    // Calculate health factor after withdrawal
    fun calculate_health_factor_after_withdrawal(
        registry: &LendingRegistry,
        position: &UserPosition,
        token_symbol: String,
        amount: u64
    ): u64 {
        // For simplicity, we're assuming withdrawal impacts collateral
        // In a real implementation, we'd check if the token is used as collateral
        
        // Get current collateral for this token
        if (!table::contains(&position.collaterals, token_symbol)) {
            return position.health_factor; // No impact on health factor
        }
        
        let current_collateral = *table::borrow(&position.collaterals, token_symbol);
        
        // If withdrawal amount exceeds collateral, use all collateral
        let withdrawal_impact = if (amount > current_collateral) { 
            current_collateral 
        } else { 
            amount 
        };
        
        // Calculate new collateral amount
        let new_collateral = current_collateral - withdrawal_impact;
        
        // Create a copy of position to simulate health factor
        let adjusted_position = *position;
        
        // Update collateral in the copy
        if (table::contains(&adjusted_position.collaterals, token_symbol)) {
            let collateral = table::borrow_mut(&mut adjusted_position.collaterals, token_symbol);
            *collateral = new_collateral;
        }
        
        // Calculate new health factor
        return calculate_health_factor(registry, &adjusted_position)
    }
    
    // Calculate health factor after collateral removal
    fun calculate_health_factor_after_collateral_removal(
        registry: &LendingRegistry,
        position: &UserPosition,
        token_symbol: String,
        amount: u64
    ): u64 {
        // Get current collateral for this token
        if (!table::contains(&position.collaterals, token_symbol)) {
            return position.health_factor; // No impact on health factor
        }
        
        let current_collateral = *table::borrow(&position.collaterals, token_symbol);
        
        // Cap removal amount to available collateral
        let removal_amount = if (amount > current_collateral) { 
            current_collateral 
        } else { 
            amount 
        };
        
        // Calculate new collateral amount
        let new_collateral = current_collateral - removal_amount;
        
        // Create a copy of position to simulate health factor
        let adjusted_position = *position;
        
        // Update collateral in the copy
        if (table::contains(&adjusted_position.collaterals, token_symbol)) {
            let collateral = table::borrow_mut(&mut adjusted_position.collaterals, token_symbol);
            *collateral = new_collateral;
        }
        
        // Calculate new health factor
        return calculate_health_factor(registry, &adjusted_position)
    }
    
    // Calculate collateral to seize during liquidation
    fun calculate_collateral_to_seize(
        registry: &LendingRegistry,
        debt_token: String,
        collateral_token: String,
        debt_amount: u64,
        bonus_percentage: u64
    ): u64 {
        // In a real implementation, this would use price oracles
        // For simplicity, assuming 1:1 exchange rate
        
        // Apply liquidation bonus
        return (debt_amount * (100 + bonus_percentage)) / 100
    }
}
