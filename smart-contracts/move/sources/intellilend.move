module intellilend::lending_asset {
    use std::error;
    use std::signer;
    use std::string::{Self, String};
    use std::option::{Self, Option};
    use std::vector;
    
    /// Constants for error codes
    const ENOT_AUTHORIZED: u64 = 1;
    const EINVALID_RISK_SCORE: u64 = 2;
    const EINVALID_ASSET_VALUE: u64 = 3;
    const EASSET_NOT_FOUND: u64 = 4;
    const EASSET_ALREADY_EXISTS: u64 = 5;
    const EINVALID_COLLATERAL_FACTOR: u64 = 6;
    const EINVALID_INTEREST_RATE: u64 = 7;
    const ENOT_ENOUGH_COLLATERAL: u64 = 8;
    const EASSET_FROZEN: u64 = 9;
    
    /// Constants for configuration
    const MAX_RISK_SCORE: u8 = 100;
    const DEFAULT_RISK_SCORE: u8 = 50;
    const DEFAULT_COLLATERAL_FACTOR: u8 = 75; // 75% LTV ratio
    const MAX_COLLATERAL_FACTOR: u8 = 90; // Maximum 90% LTV ratio
    const LIQUIDATION_THRESHOLD: u8 = 80; // 80% of collateral factor
    const LIQUIDATION_BONUS: u8 = 10; // 10% bonus for liquidators
    
    /// Represents a cross-chain message from Layer 2 EVM
    struct CrossChainMessage has key {
        id: ID,
        sender: address,
        message_type: String,
        payload: vector<u8>,
        processed: bool,
        timestamp: u64,
    }
    
    /// Struct representing a risk profile for a user
    struct RiskProfile has key {
        id: ID,
        owner: address,
        risk_score: u8,
        risk_factors: vector<RiskFactor>,
        last_updated: u64,
        credit_limit: u64,
        recommended_interest_rate: u64,
        recommended_collateral_factor: u8,
    }
    
    /// Struct representing an individual risk factor
    struct RiskFactor has store, drop {
        factor_type: String,
        score: u8,
        weight: u8,
        description: Option<String>,
    }
    
    /// Struct representing a lending asset
    struct LendingAsset has key {
        id: ID,
        asset_type: String, // e.g., "IOTA", "USD", "EUR", etc.
        symbol: String,
        value: u64,
        owner: address,
        is_collateral: bool,
        collateral_factor: u8, // percentage (0-100)
        interest_rate: u64, // basis points (0-10000)
        risk_adjusted_rate: u64, // basis points (0-10000)
        origination_timestamp: u64,
        last_updated_timestamp: u64,
        is_frozen: bool,
    }
    
    /// Struct representing a borrow position
    struct BorrowPosition has key {
        id: ID,
        borrower: address,
        asset_type: String,
        principal_amount: u64,
        interest_accumulated: u64,
        collateral_asset_ids: vector<ID>,
        interest_rate: u64, // basis points
        origination_timestamp: u64,
        last_updated_timestamp: u64,
        repayment_deadline: Option<u64>,
        liquidation_threshold_crossed: bool,
    }
    
    /// Registry for all lending assets in the system
    struct AssetRegistry has key {
        id: ID,
        assets: vector<ID>,
        asset_count: u64,
        supported_asset_types: vector<String>,
    }
    
    /// Registry for all borrow positions in the system
    struct BorrowRegistry has key {
        id: ID,
        borrow_positions: vector<ID>,
        position_count: u64,
        total_borrowed_value: u64,
    }
    
    /// Protocol configuration object
    struct ProtocolConfig has key {
        id: ID,
        admin: address,
        pause_guardian: address,
        treasury: address,
        is_paused: bool,
        protocol_fee: u64, // basis points
        liquidation_incentive: u8, // percentage
        cross_chain_bridge_address: address,
        risk_model_version: u64,
        last_config_update: u64,
    }
    
    /// Events emitted by the protocol
    
    /// Event emitted when a new lending asset is created
    struct AssetCreatedEvent has drop, store {
        asset_id: ID,
        asset_type: String,
        owner: address,
        value: u64,
        timestamp: u64,
    }
    
    /// Event emitted when an asset is used as collateral
    struct CollateralMarkedEvent has drop, store {
        asset_id: ID,
        owner: address,
        value: u64,
        collateral_factor: u8,
        timestamp: u64,
    }
    
    /// Event emitted when a borrow position is created
    struct BorrowPositionCreatedEvent has drop, store {
        position_id: ID,
        borrower: address,
        asset_type: String,
        amount: u64,
        interest_rate: u64,
        timestamp: u64,
    }
    
    /// Event emitted when a risk score is updated
    struct RiskScoreUpdatedEvent has drop, store {
        user: address,
        old_score: u8,
        new_score: u8,
        timestamp: u64,
    }
    
    /// Event emitted when a loan is repaid
    struct LoanRepaidEvent has drop, store {
        position_id: ID,
        borrower: address,
        amount_repaid: u64,
        remaining_debt: u64,
        timestamp: u64,
    }
    
    /// Event emitted when a position is liquidated
    struct LiquidationEvent has drop, store {
        position_id: ID,
        borrower: address,
        liquidator: address,
        debt_asset_type: String,
        debt_amount: u64,
        collateral_asset_id: ID,
        collateral_amount: u64,
        timestamp: u64,
    }
    
    /// Initialize the protocol configuration
    public fun initialize(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        
        // Create protocol config
        let config = ProtocolConfig {
            id: object::new(ctx),
            admin: admin_addr,
            pause_guardian: admin_addr,
            treasury: admin_addr,
            is_paused: false,
            protocol_fee: 50, // 0.5% protocol fee
            liquidation_incentive: LIQUIDATION_BONUS,
            cross_chain_bridge_address: admin_addr, // Temporary
            risk_model_version: 1,
            last_config_update: timestamp::now_seconds(),
        };
        
        // Create asset registry
        let asset_registry = AssetRegistry {
            id: object::new(ctx),
            assets: vector::empty<ID>(),
            asset_count: 0,
            supported_asset_types: vector::empty<String>(),
        };
        
        // Add supported asset types
        vector::push_back(&mut asset_registry.supported_asset_types, string::utf8(b"IOTA"));
        vector::push_back(&mut asset_registry.supported_asset_types, string::utf8(b"USD"));
        vector::push_back(&mut asset_registry.supported_asset_types, string::utf8(b"EUR"));
        
        // Create borrow registry
        let borrow_registry = BorrowRegistry {
            id: object::new(ctx),
            borrow_positions: vector::empty<ID>(),
            position_count: 0,
            total_borrowed_value: 0,
        };
        
        // Move resources to admin account
        transfer::transfer(config, admin_addr);
        transfer::transfer(asset_registry, admin_addr);
        transfer::transfer(borrow_registry, admin_addr);
    }
    
    /// Create a new lending asset
    public fun create_asset(
        account: &signer,
        asset_type: String,
        symbol: String,
        value: u64,
    ): ID {
        let owner = signer::address_of(account);
        
        // Validate input
        assert!(value > 0, error::invalid_argument(EINVALID_ASSET_VALUE));
        
        // Create the asset
        let asset = LendingAsset {
            id: object::new(ctx),
            asset_type,
            symbol,
            value,
            owner,
            is_collateral: false,
            collateral_factor: DEFAULT_COLLATERAL_FACTOR,
            interest_rate: 0, // Not applicable for an asset until borrowed
            risk_adjusted_rate: 0, // Will be calculated when borrowed
            origination_timestamp: timestamp::now_seconds(),
            last_updated_timestamp: timestamp::now_seconds(),
            is_frozen: false,
        };
        
        let asset_id = object::id(&asset);
        
        // Update the asset registry
        let registry = borrow_global_mut<AssetRegistry>(get_registry_address());
        vector::push_back(&mut registry.assets, asset_id);
        registry.asset_count = registry.asset_count + 1;
        
        // Emit asset created event
        event::emit(AssetCreatedEvent {
            asset_id,
            asset_type: asset.asset_type,
            owner,
            value,
            timestamp: timestamp::now_seconds(),
        });
        
        // Transfer asset to owner
        transfer::transfer(asset, owner);
        
        asset_id
    }
    
    /// Mark an asset as collateral
    public fun mark_as_collateral(
        account: &signer,
        asset_id: ID,
        collateral_factor: Option<u8>
    ) acquires LendingAsset {
        let owner = signer::address_of(account);
        
        // Get asset
        let asset = borrow_global_mut<LendingAsset>(object::id_address(&asset_id));
        
        // Verify ownership
        assert!(asset.owner == owner, error::permission_denied(ENOT_AUTHORIZED));
        
        // Check if asset is frozen
        assert!(!asset.is_frozen, error::invalid_state(EASSET_FROZEN));
        
        // Mark as collateral
        asset.is_collateral = true;
        
        // Set collateral factor if provided, otherwise use default
        if (option::is_some(&collateral_factor)) {
            let factor = option::extract(&mut collateral_factor);
            assert!(factor <= MAX_COLLATERAL_FACTOR, error::invalid_argument(EINVALID_COLLATERAL_FACTOR));
            asset.collateral_factor = factor;
        };
        
        // Update timestamp
        asset.last_updated_timestamp = timestamp::now_seconds();
        
        // Emit event
        event::emit(CollateralMarkedEvent {
            asset_id,
            owner,
            value: asset.value,
            collateral_factor: asset.collateral_factor,
            timestamp: timestamp::now_seconds(),
        });
    }
    
    /// Create a risk profile for a user
    public fun create_risk_profile(
        admin: &signer,
        user: address,
        risk_score: u8,
    ) {
        // Verify admin
        let config = borrow_global<ProtocolConfig>(get_config_address());
        assert!(signer::address_of(admin) == config.admin, error::permission_denied(ENOT_AUTHORIZED));
        
        // Validate risk score
        assert!(risk_score <= MAX_RISK_SCORE, error::invalid_argument(EINVALID_RISK_SCORE));
        
        // Create risk factors vector
        let risk_factors = vector::empty<RiskFactor>();
        
        // Add default risk factors
        vector::push_back(&mut risk_factors, RiskFactor {
            factor_type: string::utf8(b"REPAYMENT_HISTORY"),
            score: 50,
            weight: 35,
            description: option::some(string::utf8(b"History of loan repayments")),
        });
        
        vector::push_back(&mut risk_factors, RiskFactor {
            factor_type: string::utf8(b"COLLATERAL_QUALITY"),
            score: 50,
            weight: 25,
            description: option::some(string::utf8(b"Quality and stability of collateral assets")),
        });
        
        vector::push_back(&mut risk_factors, RiskFactor {
            factor_type: string::utf8(b"WALLET_ACTIVITY"),
            score: 50,
            weight: 20,
            description: option::some(string::utf8(b"On-chain wallet activity patterns")),
        });
        
        vector::push_back(&mut risk_factors, RiskFactor {
            factor_type: string::utf8(b"CROSS_CHAIN_PRESENCE"),
            score: 50,
            weight: 10,
            description: option::some(string::utf8(b"Activity across multiple blockchains")),
        });
        
        vector::push_back(&mut risk_factors, RiskFactor {
            factor_type: string::utf8(b"DEFI_EXPERIENCE"),
            score: 50,
            weight: 10,
            description: option::some(string::utf8(b"Experience using DeFi protocols")),
        });
        
        // Calculate recommendations based on risk score
        let recommended_collateral_factor = calculate_recommended_collateral_factor(risk_score);
        let recommended_interest_rate = calculate_recommended_interest_rate(risk_score);
        let credit_limit = calculate_credit_limit(risk_score);
        
        // Create profile
        let profile = RiskProfile {
            id: object::new(ctx),
            owner: user,
            risk_score,
            risk_factors,
            last_updated: timestamp::now_seconds(),
            credit_limit,
            recommended_interest_rate,
            recommended_collateral_factor,
        };
        
        // Emit event
        event::emit(RiskScoreUpdatedEvent {
            user,
            old_score: DEFAULT_RISK_SCORE, // Default starting point
            new_score: risk_score,
            timestamp: timestamp::now_seconds(),
        });
        
        // Transfer profile to user
        transfer::transfer(profile, user);
    }
    
    /// Update a user's risk score
    public fun update_risk_score(
        admin: &signer,
        user: address,
        new_score: u8,
    ) acquires RiskProfile {
        // Verify admin
        let config = borrow_global<ProtocolConfig>(get_config_address());
        assert!(signer::address_of(admin) == config.admin, error::permission_denied(ENOT_AUTHORIZED));
        
        // Validate risk score
        assert!(new_score <= MAX_RISK_SCORE, error::invalid_argument(EINVALID_RISK_SCORE));
        
        // Get user profile
        let profile = borrow_global_mut<RiskProfile>(user);
        let old_score = profile.risk_score;
        
        // Update risk score
        profile.risk_score = new_score;
        
        // Update recommendations
        profile.recommended_collateral_factor = calculate_recommended_collateral_factor(new_score);
        profile.recommended_interest_rate = calculate_recommended_interest_rate(new_score);
        profile.credit_limit = calculate_credit_limit(new_score);
        profile.last_updated = timestamp::now_seconds();
        
        // Emit event
        event::emit(RiskScoreUpdatedEvent {
            user,
            old_score,
            new_score,
            timestamp: timestamp::now_seconds(),
        });
    }
    
    /// Process a cross-chain message from Layer 2 EVM
    public fun process_cross_chain_message(
        admin: &signer,
        message_id: vector<u8>,
        sender: address,
        message_type: String,
        payload: vector<u8>,
    ) {
        // Verify admin
        let config = borrow_global<ProtocolConfig>(get_config_address());
        assert!(signer::address_of(admin) == config.admin, error::permission_denied(ENOT_AUTHORIZED));
        
        // Create message object
        let message = CrossChainMessage {
            id: object::new(ctx),
            sender,
            message_type,
            payload,
            processed: false,
            timestamp: timestamp::now_seconds(),
        };
        
        // If message is a risk score update, process it immediately
        if (string::utf8(b"RISK_SCORE_UPDATE") == message.message_type) {
            // Extract user address and risk score from payload
            // In a real implementation, this would properly deserialize the payload
            // For simplicity, we're not implementing the full deserialization here
            
            // Mark as processed
            message.processed = true;
        };
        
        // Store message
        transfer::transfer(message, config.admin);
    }
    
    /// Create a borrow position
    public fun create_borrow_position(
        account: &signer,
        asset_type: String,
        amount: u64,
        collateral_asset_ids: vector<ID>,
    ) acquires LendingAsset, RiskProfile, BorrowRegistry, ProtocolConfig {
        let borrower = signer::address_of(account);
        
        // Check if protocol is paused
        let config = borrow_global<ProtocolConfig>(get_config_address());
        assert!(!config.is_paused, error::invalid_state(EASSET_FROZEN));
        
        // Verify collateral is sufficient
        let total_collateral_value = calculate_collateral_value(collateral_asset_ids, borrower);
        let risk_profile = borrow_global<RiskProfile>(borrower);
        
        // Calculate maximum borrowable amount based on collateral and risk
        let max_borrow = (total_collateral_value * (risk_profile.recommended_collateral_factor as u64)) / 100;
        assert!(amount <= max_borrow, error::invalid_argument(ENOT_ENOUGH_COLLATERAL));
        
        // Calculate interest rate based on risk score
        let interest_rate = risk_profile.recommended_interest_rate;
        
        // Create borrow position
        let position = BorrowPosition {
            id: object::new(ctx),
            borrower,
            asset_type,
            principal_amount: amount,
            interest_accumulated: 0,
            collateral_asset_ids,
            interest_rate,
            origination_timestamp: timestamp::now_seconds(),
            last_updated_timestamp: timestamp::now_seconds(),
            repayment_deadline: option::none(), // No fixed deadline
            liquidation_threshold_crossed: false,
        };
        
        let position_id = object::id(&position);
        
        // Update borrow registry
        let registry = borrow_global_mut<BorrowRegistry>(get_registry_address());
        vector::push_back(&mut registry.borrow_positions, position_id);
        registry.position_count = registry.position_count + 1;
        registry.total_borrowed_value = registry.total_borrowed_value + amount;
        
        // Mark collateral assets as frozen
        for (i in 0..vector::length(&collateral_asset_ids)) {
            let asset_id = *vector::borrow(&collateral_asset_ids, i);
            let asset = borrow_global_mut<LendingAsset>(object::id_address(&asset_id));
            asset.is_frozen = true;
        };
        
        // Emit event
        event::emit(BorrowPositionCreatedEvent {
            position_id,
            borrower,
            asset_type,
            amount,
            interest_rate,
            timestamp: timestamp::now_seconds(),
        });
        
        // Transfer position to borrower
        transfer::transfer(position, borrower);
    }
    
    /// Repay a loan (partial or full)
    public fun repay_loan(
        account: &signer,
        position_id: ID,
        repay_amount: u64,
    ) acquires BorrowPosition, BorrowRegistry {
        let user = signer::address_of(account);
        
        // Get borrow position
        let position = borrow_global_mut<BorrowPosition>(object::id_address(&position_id));
        
        // Verify ownership
        assert!(position.borrower == user, error::permission_denied(ENOT_AUTHORIZED));
        
        // Calculate total debt (principal + interest)
        let total_debt = position.principal_amount + position.interest_accumulated;
        
        // Ensure repay amount is valid
        assert!(repay_amount <= total_debt, error::invalid_argument(EINVALID_ASSET_VALUE));
        
        // Update position
        position.principal_amount = 
            if (repay_amount >= position.principal_amount) 
                0 
            else 
                position.principal_amount - repay_amount;
                
        position.interest_accumulated = 
            if (repay_amount > position.principal_amount) 
                position.interest_accumulated - (repay_amount - position.principal_amount)
            else 
                position.interest_accumulated;
                
        position.last_updated_timestamp = timestamp::now_seconds();
        
        // Update remaining debt
        let remaining_debt = position.principal_amount + position.interest_accumulated;
        
        // Update registry
        let registry = borrow_global_mut<BorrowRegistry>(get_registry_address());
        registry.total_borrowed_value = registry.total_borrowed_value - repay_amount;
        
        // If fully repaid, release collateral
        if (remaining_debt == 0) {
            // In a real implementation, this would release the collateral
            // For simplicity, we're not implementing the full collateral release here
        };
        
        // Emit event
        event::emit(LoanRepaidEvent {
            position_id,
            borrower: user,
            amount_repaid: repay_amount,
            remaining_debt,
            timestamp: timestamp::now_seconds(),
        });
    }
    
    /// Calculate collateral value for a list of asset IDs
    fun calculate_collateral_value(
        asset_ids: vector<ID>,
        owner: address,
    ): u64 acquires LendingAsset {
        let total_value = 0u64;
        
        for (i in 0..vector::length(&asset_ids)) {
            let asset_id = *vector::borrow(&asset_ids, i);
            let asset = borrow_global<LendingAsset>(object::id_address(&asset_id));
            
            // Verify ownership
            assert!(asset.owner == owner, error::permission_denied(ENOT_AUTHORIZED));
            
            // Add value to total
            total_value = total_value + asset.value;
        };
        
        total_value
    }
    
    /// Calculate recommended collateral factor based on risk score
    fun calculate_recommended_collateral_factor(risk_score: u8): u8 {
        // Higher risk score means lower collateral factor
        // 0 risk = 90% collateral factor, 100 risk = 50% collateral factor
        MAX_COLLATERAL_FACTOR - ((risk_score as u8) * (MAX_COLLATERAL_FACTOR - 50) / 100)
    }
    
    /// Calculate recommended interest rate based on risk score
    fun calculate_recommended_interest_rate(risk_score: u8): u64 {
        // Higher risk score means higher interest rate
        // Base rate of 500 basis points (5%) plus risk premium
        // 0 risk = 5% APR, 100 risk = 15% APR
        500u64 + ((risk_score as u64) * 1000 / 100)
    }
    
    /// Calculate credit limit based on risk score
    fun calculate_credit_limit(risk_score: u8): u64 {
        // Higher risk score means lower credit limit
        // Base limit of 10,000 units
        // 0 risk = 10,000, 100 risk = 1,000
        10000u64 - ((risk_score as u64) * 9000 / 100)
    }
    
    /// Get the address where the registry is stored
    fun get_registry_address(): address {
        @intellilend
    }
    
    /// Get the address where the config is stored
    fun get_config_address(): address {
        @intellilend
    }
}
