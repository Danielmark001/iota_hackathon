module intellilend::core {
    use std::error;
    use std::signer;
    use std::string::{Self, String};
    use std::vector;
    
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::table::{Self, Table};
    use sui::event;
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use sui::dynamic_field as df;
    
    // Imported from enhanced_asset.move
    use intellilend::enhanced_asset::{
        EnhancedLendingAsset, 
        IdentityProof, 
        EnhancedCrossLayerMessage, 
        EnhancedAssetRegistry,
        RegistryAdminCap,
        BridgeAdminCap,
        IdentityVerifierCap
    };
    
    /// One-time witness for the intellilend protocol
    struct INTELLILEND has drop {}
    
    /// Protocol configuration
    struct ProtocolConfig has key {
        id: UID,
        // Interest rate parameters
        base_interest_rate: u64, // in basis points (e.g., 300 = 3%)
        interest_rate_slope1: u64, // in basis points
        interest_rate_slope2: u64, // in basis points
        optimal_utilization: u64, // in basis points (e.g., 8000 = 80%)
        // Fee parameters
        origination_fee: u64, // in basis points
        liquidation_incentive: u64, // in basis points
        // Risk parameters
        collateral_factor: u64, // in basis points (e.g., 7500 = 75%)
        liquidation_threshold: u64, // in basis points
        min_loan_duration: u64, // minimum duration in seconds
        // Protocol status
        paused: bool,
        // Admin capability
        governance_cap: ID
    }
    
    /// Governance capability for protocol management
    struct GovernanceCap has key {
        id: UID
    }
    
    /// Lending market for a specific asset
    struct LendingMarket<phantom T> has key {
        id: UID,
        // Market assets
        total_deposits: Balance<T>,
        total_borrows: u64, // Scaled amount
        // Market parameters
        reserve_factor: u64, // in basis points
        interest_rate_spread: u64, // in basis points
        // Interest model
        last_update_timestamp: u64,
        cumulative_interest_rate: u64, // Scaled by 1e18
        // Market statistics
        utilization_rate: u64, // in basis points
        borrow_interest_rate: u64, // in basis points
        deposit_interest_rate: u64, // in basis points
        // User data
        deposits: Table<address, DepositInfo>,
        borrows: Table<address, BorrowInfo>,
        // Market status
        is_active: bool,
        // Configuration
        config_id: ID
    }
    
    /// Deposit information for a user
    struct DepositInfo has store {
        amount: u64,
        scaled_amount: u64, // For interest calculation
        last_update_timestamp: u64
    }
    
    /// Borrow information for a user
    struct BorrowInfo has store {
        amount: u64,
        scaled_amount: u64, // For interest calculation
        collateral_id: ID, // Enhanced asset used as collateral
        interest_rate: u64, // Personalized rate in basis points
        risk_score: u8, // User risk score (0-100)
        start_time: u64,
        last_update_timestamp: u64
    }
    
    /// Cross-layer message processor for L1
    struct MessageProcessor has key {
        id: UID,
        // Message processing
        pending_messages: Table<ID, EnhancedCrossLayerMessage>,
        processed_messages_count: u64,
        failed_messages_count: u64,
        // Processor settings
        allowed_message_sources: vector<vector<u8>>, // List of allowed EVM addresses
        // Capability references
        registry_cap_id: ID,
        bridge_cap_id: ID
    }
    
    // Events
    struct DepositEvent has copy, drop {
        market_id: ID,
        user: address,
        amount: u64,
        timestamp: u64
    }
    
    struct WithdrawEvent has copy, drop {
        market_id: ID,
        user: address,
        amount: u64,
        timestamp: u64
    }
    
    struct BorrowEvent has copy, drop {
        market_id: ID,
        user: address,
        amount: u64,
        collateral_id: ID,
        interest_rate: u64,
        timestamp: u64
    }
    
    struct RepayEvent has copy, drop {
        market_id: ID,
        user: address,
        amount: u64,
        timestamp: u64
    }
    
    struct LiquidationEvent has copy, drop {
        market_id: ID,
        borrower: address,
        liquidator: address,
        repay_amount: u64,
        collateral_seized_id: ID,
        timestamp: u64
    }
    
    struct MessageProcessedEvent has copy, drop {
        message_id: ID,
        success: bool,
        timestamp: u64
    }
    
    struct ParameterUpdateEvent has copy, drop {
        config_id: ID,
        parameter_name: String,
        old_value: u64,
        new_value: u64,
        timestamp: u64
    }
    
    // Error codes
    const ENOT_AUTHORIZED: u64 = 1;
    const EMARKET_PAUSED: u64 = 2;
    const EINVALID_AMOUNT: u64 = 3;
    const EMARKET_NOT_FOUND: u64 = 4;
    const EINSUFFICIENT_COLLATERAL: u64 = 5;
    const EINSUFFICIENT_BALANCE: u64 = 6;
    const EBORROW_LIMIT_EXCEEDED: u64 = 7;
    const ENO_BORROWING_POSITION: u64 = 8;
    const EBORROW_NOT_LIQUIDATABLE: u64 = 9;
    const EINVALID_PARAMETER: u64 = 10;
    const ECOLLATERAL_NOT_OWNED: u64 = 11;
    const EMESSAGE_ALREADY_PROCESSED: u64 = 12;
    const EMESSAGE_SOURCE_NOT_ALLOWED: u64 = 13;
    const EINVALID_MESSAGE_SIGNATURE: u64 = 14;
    
    /// Initialize the lending protocol
    fun init(witness: INTELLILEND, ctx: &mut TxContext) {
        // Create governance capability
        let governance_cap = GovernanceCap {
            id: object::new(ctx)
        };
        
        let governance_cap_id = object::id(&governance_cap);
        
        // Create default protocol configuration
        let config = ProtocolConfig {
            id: object::new(ctx),
            base_interest_rate: 300, // 3%
            interest_rate_slope1: 1000, // 10%
            interest_rate_slope2: 5000, // 50%
            optimal_utilization: 8000, // 80%
            origination_fee: 10, // 0.1%
            liquidation_incentive: 1000, // 10%
            collateral_factor: 7500, // 75%
            liquidation_threshold: 8300, // 83%
            min_loan_duration: 300, // 5 minutes
            paused: false,
            governance_cap: governance_cap_id
        };
        
        // Create message processor
        let processor = MessageProcessor {
            id: object::new(ctx),
            pending_messages: table::new(ctx),
            processed_messages_count: 0,
            failed_messages_count: 0,
            allowed_message_sources: vector::empty<vector<u8>>(),
            registry_cap_id: object::id_from_address(@0), // Placeholder
            bridge_cap_id: object::id_from_address(@0) // Placeholder
        };
        
        // Transfer governance capability to sender
        transfer::transfer(governance_cap, tx_context::sender(ctx));
        
        // Share protocol configuration and message processor as immutable objects
        transfer::share_object(config);
        transfer::share_object(processor);
    }
    
    /// Create a new lending market for an asset
    public fun create_lending_market<T>(
        admin: &signer,
        config: &ProtocolConfig,
        reserve_factor: u64,
        interest_rate_spread: u64,
        governance_cap: &GovernanceCap,
        ctx: &mut TxContext
    ) {
        // Verify admin has the governance capability
        assert!(object::id(governance_cap) == config.governance_cap, error::permission_denied(ENOT_AUTHORIZED));
        
        // Verify parameters are valid
        assert!(reserve_factor <= 5000, error::invalid_argument(EINVALID_PARAMETER)); // Max 50%
        assert!(interest_rate_spread <= 2000, error::invalid_argument(EINVALID_PARAMETER)); // Max 20%
        
        // Create new lending market
        let market = LendingMarket<T> {
            id: object::new(ctx),
            total_deposits: balance::zero<T>(),
            total_borrows: 0,
            reserve_factor: reserve_factor,
            interest_rate_spread: interest_rate_spread,
            last_update_timestamp: tx_context::epoch(ctx),
            cumulative_interest_rate: 1000000000000000000, // 1.0 in 1e18 scale
            utilization_rate: 0,
            borrow_interest_rate: config.base_interest_rate,
            deposit_interest_rate: 0,
            deposits: table::new(ctx),
            borrows: table::new(ctx),
            is_active: true,
            config_id: object::id(config)
        };
        
        // Share market as an immutable object
        transfer::share_object(market);
    }
    
    /// Deposit assets into a lending market
    public fun deposit<T>(
        account: &signer,
        market: &mut LendingMarket<T>,
        coin: Coin<T>,
        config: &ProtocolConfig,
        ctx: &mut TxContext
    ) {
        // Check market is not paused
        assert!(!config.paused && market.is_active, error::permission_denied(EMARKET_PAUSED));
        
        // Check amount is valid
        let deposit_amount = coin::value(&coin);
        assert!(deposit_amount > 0, error::invalid_argument(EINVALID_AMOUNT));
        
        // Update market interest rates
        update_market_interest_rates(market, config, ctx);
        
        // Convert coin to balance and add to market deposits
        let deposit_balance = coin::into_balance(coin);
        
        // Calculate scaled amount based on cumulative interest rate
        let scaled_amount = (deposit_amount * 1000000000000000000) / market.cumulative_interest_rate;
        
        // Get sender address
        let sender = signer::address_of(account);
        
        // Update or create user deposit info
        if (table::contains(&market.deposits, sender)) {
            let deposit_info = table::borrow_mut(&mut market.deposits, sender);
            deposit_info.amount = deposit_info.amount + deposit_amount;
            deposit_info.scaled_amount = deposit_info.scaled_amount + scaled_amount;
            deposit_info.last_update_timestamp = tx_context::epoch(ctx);
        } else {
            let deposit_info = DepositInfo {
                amount: deposit_amount,
                scaled_amount: scaled_amount,
                last_update_timestamp: tx_context::epoch(ctx)
            };
            table::add(&mut market.deposits, sender, deposit_info);
        };
        
        // Add balance to market total
        balance::join(&mut market.total_deposits, deposit_balance);
        
        // Recalculate utilization rate
        update_utilization_rate(market);
        
        // Emit deposit event
        event::emit(DepositEvent {
            market_id: object::id(market),
            user: sender,
            amount: deposit_amount,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    /// Withdraw assets from a lending market
    public fun withdraw<T>(
        account: &signer,
        market: &mut LendingMarket<T>,
        amount: u64,
        config: &ProtocolConfig,
        ctx: &mut TxContext
    ): Coin<T> {
        // Check market is not paused
        assert!(!config.paused && market.is_active, error::permission_denied(EMARKET_PAUSED));
        
        // Check amount is valid
        assert!(amount > 0, error::invalid_argument(EINVALID_AMOUNT));
        
        // Get sender address
        let sender = signer::address_of(account);
        
        // Check user has a deposit and sufficient balance
        assert!(table::contains(&market.deposits, sender), error::not_found(EINSUFFICIENT_BALANCE));
        
        // Update market interest rates
        update_market_interest_rates(market, config, ctx);
        
        // Get user's current deposit info with updated amounts
        let deposit_info = table::borrow_mut(&mut market.deposits, sender);
        assert!(deposit_info.amount >= amount, error::invalid_argument(EINSUFFICIENT_BALANCE));
        
        // Calculate scaled amount to withdraw
        let scaled_amount_to_withdraw = (amount * 1000000000000000000) / market.cumulative_interest_rate;
        
        // Update user deposit info
        deposit_info.amount = deposit_info.amount - amount;
        deposit_info.scaled_amount = deposit_info.scaled_amount - scaled_amount_to_withdraw;
        deposit_info.last_update_timestamp = tx_context::epoch(ctx);
        
        // Remove user entry if balance is zero
        if (deposit_info.amount == 0) {
            table::remove(&mut market.deposits, sender);
        };
        
        // Take balance from market total
        let withdrawn_balance = balance::split(&mut market.total_deposits, amount);
        
        // Recalculate utilization rate
        update_utilization_rate(market);
        
        // Emit withdraw event
        event::emit(WithdrawEvent {
            market_id: object::id(market),
            user: sender,
            amount: amount,
            timestamp: tx_context::epoch(ctx)
        });
        
        // Convert balance to coin and return
        coin::from_balance(withdrawn_balance, ctx)
    }
    
    /// Borrow assets from a lending market using an enhanced asset as collateral
    public fun borrow<T>(
        account: &signer,
        market: &mut LendingMarket<T>,
        collateral: &EnhancedLendingAsset,
        registry: &EnhancedAssetRegistry,
        amount: u64,
        config: &ProtocolConfig,
        ctx: &mut TxContext
    ): Coin<T> {
        // Check market is not paused
        assert!(!config.paused && market.is_active, error::permission_denied(EMARKET_PAUSED));
        
        // Check amount is valid
        assert!(amount > 0, error::invalid_argument(EINVALID_AMOUNT));
        
        // Get sender address
        let sender = signer::address_of(account);
        
        // Check collateral ownership
        assert!(intellilend::enhanced_asset::is_owner(collateral, sender), error::permission_denied(ECOLLATERAL_NOT_OWNED));
        
        // Update market interest rates
        update_market_interest_rates(market, config, ctx);
        
        // Calculate maximum allowed borrow amount based on collateral value and risk score
        let collateral_value = intellilend::enhanced_asset::get_value(collateral);
        let risk_score = intellilend::enhanced_asset::get_risk_score(collateral);
        
        // Risk adjustment - higher risk score means lower collateral factor
        let adjusted_collateral_factor = adjust_collateral_factor(config.collateral_factor, risk_score);
        
        let max_borrow_amount = (collateral_value * adjusted_collateral_factor) / 10000;
        
        // Check if the requested amount exceeds borrowing capacity
        let current_borrow_amount = if (table::contains(&market.borrows, sender)) {
            table::borrow(&market.borrows, sender).amount
        } else {
            0
        };
        
        assert!(current_borrow_amount + amount <= max_borrow_amount, error::invalid_argument(EBORROW_LIMIT_EXCEEDED));
        
        // Check if market has enough liquidity
        assert!(balance::value(&market.total_deposits) >= amount, error::invalid_argument(EINSUFFICIENT_BALANCE));
        
        // Calculate scaled borrow amount based on cumulative interest rate
        let scaled_amount = (amount * 1000000000000000000) / market.cumulative_interest_rate;
        
        // Calculate personalized interest rate based on risk score
        let personalized_rate = calculate_personalized_interest_rate(market.borrow_interest_rate, risk_score);
        
        // Create or update borrow position
        if (table::contains(&market.borrows, sender)) {
            let borrow_info = table::borrow_mut(&mut market.borrows, sender);
            borrow_info.amount = borrow_info.amount + amount;
            borrow_info.scaled_amount = borrow_info.scaled_amount + scaled_amount;
            borrow_info.interest_rate = personalized_rate; // Update to latest rate
            borrow_info.risk_score = risk_score;
            borrow_info.last_update_timestamp = tx_context::epoch(ctx);
        } else {
            let borrow_info = BorrowInfo {
                amount: amount,
                scaled_amount: scaled_amount,
                collateral_id: object::id(collateral),
                interest_rate: personalized_rate,
                risk_score: risk_score,
                start_time: tx_context::epoch(ctx),
                last_update_timestamp: tx_context::epoch(ctx)
            };
            table::add(&mut market.borrows, sender, borrow_info);
        };
        
        // Update market total borrows
        market.total_borrows = market.total_borrows + scaled_amount;
        
        // Take balance from market deposits
        let borrowed_balance = balance::split(&mut market.total_deposits, amount);
        
        // Recalculate utilization rate
        update_utilization_rate(market);
        
        // Apply origination fee if configured
        if (config.origination_fee > 0) {
            let fee_amount = (amount * config.origination_fee) / 10000;
            if (fee_amount > 0) {
                // Implementation would transfer fee to protocol treasury
                // For simplicity, just reduce the borrowed amount
                let fee_balance = balance::split(&mut borrowed_balance, fee_amount);
                balance::join(&mut market.total_deposits, fee_balance);
            };
        };
        
        // Emit borrow event
        event::emit(BorrowEvent {
            market_id: object::id(market),
            user: sender,
            amount: amount,
            collateral_id: object::id(collateral),
            interest_rate: personalized_rate,
            timestamp: tx_context::epoch(ctx)
        });
        
        // Convert balance to coin and return
        coin::from_balance(borrowed_balance, ctx)
    }
    
    /// Repay borrowed assets
    public fun repay<T>(
        account: &signer,
        market: &mut LendingMarket<T>,
        coin: Coin<T>,
        config: &ProtocolConfig,
        ctx: &mut TxContext
    ) {
        // Check market is not paused
        assert!(!config.paused && market.is_active, error::permission_denied(EMARKET_PAUSED));
        
        // Check amount is valid
        let repay_amount = coin::value(&coin);
        assert!(repay_amount > 0, error::invalid_argument(EINVALID_AMOUNT));
        
        // Get sender address
        let sender = signer::address_of(account);
        
        // Check user has a borrow position
        assert!(table::contains(&market.borrows, sender), error::not_found(ENO_BORROWING_POSITION));
        
        // Update market interest rates
        update_market_interest_rates(market, config, ctx);
        
        // Get user's current borrow info with updated amounts
        let borrow_info = table::borrow_mut(&mut market.borrows, sender);
        
        // Cap repayment to actual debt
        let actual_repay_amount = if (repay_amount > borrow_info.amount) {
            borrow_info.amount
        } else {
            repay_amount
        };
        
        // Convert coin to balance and add to market deposits
        let repay_balance = coin::into_balance(coin);
        
        // If repay amount exceeds debt, return the excess
        if (repay_amount > actual_repay_amount) {
            let excess_balance = balance::split(&mut repay_balance, repay_amount - actual_repay_amount);
            let excess_coin = coin::from_balance(excess_balance, ctx);
            transfer::transfer(excess_coin, sender);
        };
        
        // Calculate scaled amount to repay
        let scaled_amount_to_repay = (actual_repay_amount * 1000000000000000000) / market.cumulative_interest_rate;
        
        // Update user borrow info
        borrow_info.amount = borrow_info.amount - actual_repay_amount;
        borrow_info.scaled_amount = borrow_info.scaled_amount - scaled_amount_to_repay;
        borrow_info.last_update_timestamp = tx_context::epoch(ctx);
        
        // Remove user entry if fully repaid
        if (borrow_info.amount == 0) {
            table::remove(&mut market.borrows, sender);
        };
        
        // Update market total borrows
        market.total_borrows = market.total_borrows - scaled_amount_to_repay;
        
        // Add repayment to market deposits
        balance::join(&mut market.total_deposits, repay_balance);
        
        // Recalculate utilization rate
        update_utilization_rate(market);
        
        // Emit repay event
        event::emit(RepayEvent {
            market_id: object::id(market),
            user: sender,
            amount: actual_repay_amount,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    /// Process a cross-layer message from L2
    public fun process_message(
        account: &signer,
        processor: &mut MessageProcessor,
        message: EnhancedCrossLayerMessage,
        registry: &mut EnhancedAssetRegistry,
        registry_cap: &RegistryAdminCap,
        bridge_cap: &BridgeAdminCap,
        ctx: &mut TxContext
    ): bool {
        // Verify admin has the registry capability
        assert!(object::id(registry_cap) == processor.registry_cap_id, error::permission_denied(ENOT_AUTHORIZED));
        
        // Verify bridge capability
        assert!(object::id(bridge_cap) == processor.bridge_cap_id, error::permission_denied(ENOT_AUTHORIZED));
        
        // Verify message sender is allowed
        let message_sender = intellilend::enhanced_asset::get_message_sender(&message);
        let is_allowed = false;
        let i = 0;
        let len = vector::length(&processor.allowed_message_sources);
        
        while (i < len) {
            if (message_sender == *vector::borrow(&processor.allowed_message_sources, i)) {
                is_allowed = true;
                break;
            };
            i = i + 1;
        };
        
        assert!(is_allowed, error::permission_denied(EMESSAGE_SOURCE_NOT_ALLOWED));
        
        // Verify message not already processed
        assert!(!intellilend::enhanced_asset::is_processed(&message), error::invalid_argument(EMESSAGE_ALREADY_PROCESSED));
        
        // Get message ID
        let message_id = object::id(&message);
        
        // Process message based on type
        let success = false;
        let message_type = intellilend::enhanced_asset::get_message_type(&message);
        
        if (message_type == string::utf8(b"RISK_SCORE_UPDATE")) {
            success = process_risk_score_update(&message, registry, ctx);
        } else if (message_type == string::utf8(b"COLLATERAL_CHANGE")) {
            success = process_collateral_change(&message, registry, ctx);
        } else if (message_type == string::utf8(b"LIQUIDATION")) {
            success = process_liquidation(&message, registry, ctx);
        } else {
            // Unknown message type
            success = false;
        };
        
        // Update processor stats
        if (success) {
            processor.processed_messages_count = processor.processed_messages_count + 1;
        } else {
            processor.failed_messages_count = processor.failed_messages_count + 1;
        };
        
        // Mark message as processed
        intellilend::enhanced_asset::mark_as_processed(&mut message, success);
        
        // Store message for reference
        table::add(&mut processor.pending_messages, message_id, message);
        
        // Emit event
        event::emit(MessageProcessedEvent {
            message_id: message_id,
            success: success,
            timestamp: tx_context::epoch(ctx)
        });
        
        success
    }
    
    /// Process a risk score update message
    fun process_risk_score_update(
        message: &EnhancedCrossLayerMessage,
        registry: &mut EnhancedAssetRegistry,
        ctx: &mut TxContext
    ): bool {
        // Extract user address and risk score from payload
        // In a real implementation, we would use proper deserialization
        // For simplicity, we'll implement a basic extraction
        
        let payload = intellilend::enhanced_asset::get_message_payload(message);
        
        // Check payload length
        if (vector::length(&payload) < 21) {
            return false
        };
        
        // Extract address (first 20 bytes)
        let address_bytes = vector::empty<u8>();
        let i = 0;
        while (i < 20) {
            vector::push_back(&mut address_bytes, *vector::borrow(&payload, i));
            i = i + 1;
        };
        
        // Convert to address
        let user_address = intellilend::enhanced_asset::convert_bytes_to_address(address_bytes);
        
        // Extract risk score (byte 20)
        let risk_score = *vector::borrow(&payload, 20);
        
        // Update risk scores for all user assets
        let user_assets = intellilend::enhanced_asset::get_user_assets(registry, user_address);
        let assets_updated = false;
        
        let i = 0;
        let len = vector::length(&user_assets);
        
        while (i < len) {
            let asset_id = *vector::borrow(&user_assets, i);
            
            // In a real implementation, we would update each asset's risk score
            // For simplicity, just mark as successfully updated
            assets_updated = true;
            
            i = i + 1;
        };
        
        assets_updated
    }
    
    /// Process a collateral change message
    fun process_collateral_change(
        message: &EnhancedCrossLayerMessage,
        registry: &mut EnhancedAssetRegistry,
        ctx: &mut TxContext
    ): bool {
        // In a real implementation, this would update collateral status
        // For demo, just return true
        true
    }
    
    /// Process a liquidation message
    fun process_liquidation(
        message: &EnhancedCrossLayerMessage,
        registry: &mut EnhancedAssetRegistry,
        ctx: &mut TxContext
    ): bool {
        // In a real implementation, this would handle liquidation
        // For demo, just return true
        true
    }
    
    /// Update market interest rates
    fun update_market_interest_rates<T>(
        market: &mut LendingMarket<T>,
        config: &ProtocolConfig,
        ctx: &mut TxContext
    ) {
        // Check if update is needed
        let current_time = tx_context::epoch(ctx);
        if (current_time <= market.last_update_timestamp) {
            return
        };
        
        // Calculate time elapsed
        let time_elapsed = current_time - market.last_update_timestamp;
        
        // Calculate interest based on current rates
        if (market.total_borrows > 0) {
            // Calculate interest rate per second (scaled down)
            let interest_per_second = market.borrow_interest_rate / (365 * 24 * 60 * 60 * 100);
            
            // Calculate interest factor for elapsed time
            let interest_factor = interest_per_second * time_elapsed;
            
            // Update cumulative interest rate
            market.cumulative_interest_rate = market.cumulative_interest_rate + 
                (market.cumulative_interest_rate * interest_factor) / 1000000000000000000;
        };
        
        // Update interest rates based on current utilization
        update_interest_rates(market, config);
        
        // Update timestamp
        market.last_update_timestamp = current_time;
    }
    
    /// Update market interest rates based on utilization
    fun update_interest_rates<T>(
        market: &mut LendingMarket<T>,
        config: &ProtocolConfig
    ) {
        // Calculate borrow interest rate using the interest rate model
        if (market.utilization_rate <= config.optimal_utilization) {
            // Below optimal: base_rate + slope1 * utilization
            market.borrow_interest_rate = config.base_interest_rate + 
                (config.interest_rate_slope1 * market.utilization_rate) / 10000;
        } else {
            // Above optimal: base_rate + slope1 * optimal + slope2 * (utilization - optimal)
            let base_optimal_rate = config.base_interest_rate + 
                (config.interest_rate_slope1 * config.optimal_utilization) / 10000;
                
            let excess_utilization = market.utilization_rate - config.optimal_utilization;
            
            market.borrow_interest_rate = base_optimal_rate + 
                (config.interest_rate_slope2 * excess_utilization) / 10000;
        };
        
        // Calculate deposit interest rate based on borrow rate, utilization, and reserve factor
        market.deposit_interest_rate = (market.borrow_interest_rate * market.utilization_rate 
            * (10000 - market.reserve_factor)) / (10000 * 10000);
    }
    
    /// Update market utilization rate
    fun update_utilization_rate<T>(market: &mut LendingMarket<T>) {
        // Calculate total borrows in current value (not scaled)
        let current_borrows = (market.total_borrows * market.cumulative_interest_rate) / 1000000000000000000;
        
        // Calculate utilization rate as borrows / deposits (in basis points)
        if (balance::value(&market.total_deposits) > 0) {
            market.utilization_rate = (current_borrows * 10000) / balance::value(&market.total_deposits);
        } else {
            market.utilization_rate = 0;
        };
    }
    
    /// Adjust collateral factor based on risk score
    fun adjust_collateral_factor(base_cf: u64, risk_score: u8): u64 {
        // Higher risk means lower collateral factor
        if (risk_score <= 20) {
            // Very low risk - increase collateral factor by up to 5%
            return base_cf + 500;
        } else if (risk_score <= 40) {
            // Low risk - increase collateral factor by up to 2.5%
            return base_cf + 250;
        } else if (risk_score <= 60) {
            // Medium risk - use base collateral factor
            return base_cf;
        } else if (risk_score <= 80) {
            // High risk - decrease collateral factor by up to 5%
            return if (base_cf >= 500) { base_cf - 500 } else { base_cf / 2 };
        } else {
            // Very high risk - decrease collateral factor by up to 10%
            return if (base_cf >= 1000) { base_cf - 1000 } else { base_cf / 3 };
        }
    }
    
    /// Calculate personalized interest rate based on risk score
    fun calculate_personalized_interest_rate(base_rate: u64, risk_score: u8): u64 {
        // Higher risk means higher interest rate
        // Risk premium increases with risk score
        
        let risk_premium = if (risk_score <= 20) {
            // Very low risk - minimal premium
            0
        } else if (risk_score <= 40) {
            // Low risk - small premium
            100 // 1%
        } else if (risk_score <= 60) {
            // Medium risk - moderate premium
            300 // 3%
        } else if (risk_score <= 80) {
            // High risk - significant premium
            600 // 6%
        } else {
            // Very high risk - large premium
            1000 // 10%
        };
        
        base_rate + risk_premium
    }
    
    /// Update protocol parameters (governance function)
    public fun update_protocol_parameter(
        admin: &signer,
        config: &mut ProtocolConfig,
        parameter_name: String,
        new_value: u64,
        governance_cap: &GovernanceCap,
        ctx: &mut TxContext
    ) {
        // Verify admin has the governance capability
        assert!(object::id(governance_cap) == config.governance_cap, error::permission_denied(ENOT_AUTHORIZED));
        
        // Store old value for event
        let old_value = if (parameter_name == string::utf8(b"base_interest_rate")) {
            let old = config.base_interest_rate;
            config.base_interest_rate = new_value;
            old
        } else if (parameter_name == string::utf8(b"interest_rate_slope1")) {
            let old = config.interest_rate_slope1;
            config.interest_rate_slope1 = new_value;
            old
        } else if (parameter_name == string::utf8(b"interest_rate_slope2")) {
            let old = config.interest_rate_slope2;
            config.interest_rate_slope2 = new_value;
            old
        } else if (parameter_name == string::utf8(b"optimal_utilization")) {
            let old = config.optimal_utilization;
            config.optimal_utilization = new_value;
            old
        } else if (parameter_name == string::utf8(b"origination_fee")) {
            let old = config.origination_fee;
            config.origination_fee = new_value;
            old
        } else if (parameter_name == string::utf8(b"liquidation_incentive")) {
            let old = config.liquidation_incentive;
            config.liquidation_incentive = new_value;
            old
        } else if (parameter_name == string::utf8(b"collateral_factor")) {
            let old = config.collateral_factor;
            config.collateral_factor = new_value;
            old
        } else if (parameter_name == string::utf8(b"liquidation_threshold")) {
            let old = config.liquidation_threshold;
            config.liquidation_threshold = new_value;
            old
        } else if (parameter_name == string::utf8(b"min_loan_duration")) {
            let old = config.min_loan_duration;
            config.min_loan_duration = new_value;
            old
        } else {
            abort error::invalid_argument(EINVALID_PARAMETER)
        };
        
        // Emit parameter update event
        event::emit(ParameterUpdateEvent {
            config_id: object::id(config),
            parameter_name: parameter_name,
            old_value: old_value,
            new_value: new_value,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    /// Set protocol pause state (governance function)
    public fun set_protocol_pause(
        admin: &signer,
        config: &mut ProtocolConfig,
        paused: bool,
        governance_cap: &GovernanceCap,
        ctx: &mut TxContext
    ) {
        // Verify admin has the governance capability
        assert!(object::id(governance_cap) == config.governance_cap, error::permission_denied(ENOT_AUTHORIZED));
        
        // Update pause state
        config.paused = paused;
    }
    
    /// Set market active state (governance function)
    public fun set_market_active<T>(
        admin: &signer,
        market: &mut LendingMarket<T>,
        active: bool,
        governance_cap: &GovernanceCap,
        ctx: &mut TxContext
    ) {
        // Verify admin has the governance capability
        assert!(object::id(governance_cap) == market.config_id, error::permission_denied(ENOT_AUTHORIZED));
        
        // Update active state
        market.is_active = active;
    }
    
    /// Add an allowed message source to the processor
    public fun add_allowed_message_source(
        admin: &signer,
        processor: &mut MessageProcessor,
        source: vector<u8>,
        registry_cap: &RegistryAdminCap,
        ctx: &mut TxContext
    ) {
        // Verify admin has the registry capability
        assert!(object::id(registry_cap) == processor.registry_cap_id, error::permission_denied(ENOT_AUTHORIZED));
        
        // Add source if not already present
        let i = 0;
        let len = vector::length(&processor.allowed_message_sources);
        let exists = false;
        
        while (i < len) {
            if (*vector::borrow(&processor.allowed_message_sources, i) == source) {
                exists = true;
                break;
            };
            i = i + 1;
        };
        
        if (!exists) {
            vector::push_back(&mut processor.allowed_message_sources, source);
        };
    }
    
    /// Remove an allowed message source from the processor
    public fun remove_allowed_message_source(
        admin: &signer,
        processor: &mut MessageProcessor,
        source: vector<u8>,
        registry_cap: &RegistryAdminCap,
        ctx: &mut TxContext
    ) {
        // Verify admin has the registry capability
        assert!(object::id(registry_cap) == processor.registry_cap_id, error::permission_denied(ENOT_AUTHORIZED));
        
        // Remove source if present
        let i = 0;
        let len = vector::length(&processor.allowed_message_sources);
        
        while (i < len) {
            if (*vector::borrow(&processor.allowed_message_sources, i) == source) {
                vector::remove(&mut processor.allowed_message_sources, i);
                break;
            };
            i = i + 1;
        };
    }
    
    /// Set capability IDs for the processor
    public fun set_processor_capabilities(
        admin: &signer,
        processor: &mut MessageProcessor,
        registry_cap: &RegistryAdminCap,
        bridge_cap: &BridgeAdminCap,
        ctx: &mut TxContext
    ) {
        // Verify sender is owner of both capabilities
        assert!(object::is_owner(&registry_cap.id, signer::address_of(admin)), error::permission_denied(ENOT_AUTHORIZED));
        assert!(object::is_owner(&bridge_cap.id, signer::address_of(admin)), error::permission_denied(ENOT_AUTHORIZED));
        
        // Set capability IDs
        processor.registry_cap_id = object::id(registry_cap);
        processor.bridge_cap_id = object::id(bridge_cap);
    }
}
