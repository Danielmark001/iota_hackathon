/// Advanced collateral management module for IntelliLend on IOTA Move Layer 1
module intellilend::enhanced_collateral {
    use std::error;
    use std::signer;
    use std::string::{Self, String};
    use std::vector;
    
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::dynamic_field as df;
    use sui::clock::{Self, Clock};
    use sui::package;
    use sui::url::{Self, Url};
    use sui::table::{Self, Table};
    
    use intellilend::enhanced_asset::{Self, EnhancedLendingAsset, EnhancedAssetRegistry};

    // Error codes
    const EInsufficientCollateral: u64 = 1;
    const EInvalidCollateralType: u64 = 2;
    const ERegistryNotInitialized: u64 = 3;
    const ENotAuthorized: u64 = 4;
    const ECollateralNotLocked: u64 = 5;
    const ECollateralLocked: u64 = 6;
    const ECollateralExpired: u64 = 7;
    const ECollateralVersionMismatch: u64 = 8;
    const EInvalidOracleData: u64 = 9;
    const ECollateralAlreadyLiquidated: u64 = 10;
    const EUnderLiquidationThreshold: u64 = 11;
    const EInvalidRiskScore: u64 = 12;

    // Collateral token types
    const COLLATERAL_TYPE_IOTA: u8 = 1;
    const COLLATERAL_TYPE_MIOTA: u8 = 2;
    const COLLATERAL_TYPE_SMR: u8 = 3;
    const COLLATERAL_TYPE_NFT: u8 = 4;
    const COLLATERAL_TYPE_LP_TOKEN: u8 = 5;

    // Collateral status
    const COLLATERAL_STATUS_ACTIVE: u8 = 1;
    const COLLATERAL_STATUS_LOCKED: u8 = 2;
    const COLLATERAL_STATUS_LIQUIDATING: u8 = 3;
    const COLLATERAL_STATUS_LIQUIDATED: u8 = 4;
    const COLLATERAL_STATUS_RELEASED: u8 = 5;
    const COLLATERAL_STATUS_EXPIRED: u8 = 6;

    /// EnhancedCollateral represents a collateral asset with advanced features
    struct EnhancedCollateral has key, store {
        id: UID,
        collateral_type: u8,
        collateral_value: u64,
        owner: address,
        lender: address,
        token_address: address,
        token_id: ID,
        status: u8,
        risk_factor: u8,
        liquidation_threshold: u64,
        creation_time: u64,
        lock_expiration: u64,
        interest_rate_premium: u64,
        health_factor: u64,
        last_updated: u64,
        version: u64,
        oracle_price: u64,
        metadata: String,
        // Advanced features
        cross_chain_origin: vector<u8>,
        multi_collateral_group_id: vector<u8>,
        liquidation_penalty: u64,
        diversification_score: u8,
        price_feed_id: vector<u8>,
        collateral_quality_score: u8
    }

    /// Capability to manage collateral
    struct CollateralManagerCap has key {
        id: UID,
        allowed_token_types: vector<u8>,
        last_price_update: u64,
        oracle_addresses: vector<address>,
        active_liquidators: vector<address>,
        risk_model_version: u64,
        supported_chains: vector<vector<u8>>
    }
    
    /// Cross-chain collateral commitment for Layer 2 integration
    struct CrossChainCollateralCommitment has key, store {
        id: UID,
        collateral_id: ID,
        target_chain: vector<u8>,
        commitment_hash: vector<u8>,
        bridge_address: address,
        timestamp: u64,
        expiration: u64,
        status: u8,
        confirmation_signatures: vector<vector<u8>>
    }
    
    /// Collateral price oracle data
    struct CollateralPriceData has key, store {
        id: UID,
        asset_type: u8,
        price: u64,
        timestamp: u64,
        source: address,
        confidence: u8,
        next_update: u64,
        volatility: u64
    }
    
    /// Registry for collateral assets
    struct CollateralRegistry has key {
        id: UID,
        collaterals: Table<ID, address>,
        collateral_by_owner: Table<address, vector<ID>>,
        total_collateral_value: u64,
        token_type_count: Table<u8, u64>,
        liquidation_thresholds: Table<u8, u64>,
        price_data: Table<u8, CollateralPriceData>,
        risk_parameters: Table<u8, u64>
    }
    
    /// Events
    struct CollateralCreated has copy, drop {
        collateral_id: ID,
        owner: address,
        collateral_type: u8,
        collateral_value: u64,
        timestamp: u64
    }
    
    struct CollateralStatusChanged has copy, drop {
        collateral_id: ID,
        old_status: u8,
        new_status: u8,
        timestamp: u64
    }
    
    struct CollateralLiquidated has copy, drop {
        collateral_id: ID,
        owner: address,
        liquidator: address,
        collateral_value: u64,
        timestamp: u64
    }
    
    struct CollateralRiskUpdated has copy, drop {
        collateral_id: ID,
        old_risk: u8,
        new_risk: u8,
        health_factor: u64,
        timestamp: u64
    }
    
    struct CrossChainCommitmentCreated has copy, drop {
        commitment_id: ID,
        collateral_id: ID,
        target_chain: vector<u8>,
        timestamp: u64
    }
    
    struct PriceDataUpdated has copy, drop {
        asset_type: u8,
        old_price: u64,
        new_price: u64,
        change_percentage: u64,
        timestamp: u64
    }

    /// Initialize the collateral registry
    fun init(ctx: &mut TxContext) {
        // Create collateral registry
        let registry = CollateralRegistry {
            id: object::new(ctx),
            collaterals: table::new(ctx),
            collateral_by_owner: table::new(ctx),
            total_collateral_value: 0,
            token_type_count: table::new(ctx),
            liquidation_thresholds: table::new(ctx),
            price_data: table::new(ctx),
            risk_parameters: table::new(ctx)
        };
        
        // Initialize token type counts
        table::add(&mut registry.token_type_count, COLLATERAL_TYPE_IOTA, 0);
        table::add(&mut registry.token_type_count, COLLATERAL_TYPE_MIOTA, 0);
        table::add(&mut registry.token_type_count, COLLATERAL_TYPE_SMR, 0);
        table::add(&mut registry.token_type_count, COLLATERAL_TYPE_NFT, 0);
        table::add(&mut registry.token_type_count, COLLATERAL_TYPE_LP_TOKEN, 0);
        
        // Initialize liquidation thresholds (as percentage, 8300 = 83%)
        table::add(&mut registry.liquidation_thresholds, COLLATERAL_TYPE_IOTA, 8300);
        table::add(&mut registry.liquidation_thresholds, COLLATERAL_TYPE_MIOTA, 8000);
        table::add(&mut registry.liquidation_thresholds, COLLATERAL_TYPE_SMR, 7500);
        table::add(&mut registry.liquidation_thresholds, COLLATERAL_TYPE_NFT, 5000);
        table::add(&mut registry.liquidation_thresholds, COLLATERAL_TYPE_LP_TOKEN, 7000);
        
        // Initialize risk parameters (higher is riskier)
        table::add(&mut registry.risk_parameters, COLLATERAL_TYPE_IOTA, 100);
        table::add(&mut registry.risk_parameters, COLLATERAL_TYPE_MIOTA, 120);
        table::add(&mut registry.risk_parameters, COLLATERAL_TYPE_SMR, 150);
        table::add(&mut registry.risk_parameters, COLLATERAL_TYPE_NFT, 300);
        table::add(&mut registry.risk_parameters, COLLATERAL_TYPE_LP_TOKEN, 180);
        
        // Create manager capability
        let manager_cap = CollateralManagerCap {
            id: object::new(ctx),
            allowed_token_types: vector[
                COLLATERAL_TYPE_IOTA,
                COLLATERAL_TYPE_MIOTA,
                COLLATERAL_TYPE_SMR,
                COLLATERAL_TYPE_NFT,
                COLLATERAL_TYPE_LP_TOKEN
            ],
            last_price_update: tx_context::epoch(ctx),
            oracle_addresses: vector::empty<address>(),
            active_liquidators: vector::empty<address>(),
            risk_model_version: 1,
            supported_chains: vector::empty<vector<u8>>()
        };
        
        // Transfer registry to shared object
        transfer::share_object(registry);
        
        // Transfer manager capability to transaction sender
        transfer::transfer(manager_cap, tx_context::sender(ctx));
    }

    /// Create a new enhanced collateral asset
    public fun create_enhanced_collateral(
        account: &signer,
        registry: &mut CollateralRegistry,
        collateral_type: u8,
        collateral_value: u64,
        token_address: address,
        token_id: ID,
        lock_duration: u64,
        metadata: String,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = signer::address_of(account);
        
        // Validate collateral type
        assert!(is_valid_collateral_type(registry, collateral_type), error::invalid_argument(EInvalidCollateralType));
        
        // Get current timestamp
        let current_time = clock::timestamp_ms(clock) / 1000; // Convert to seconds
        
        // Calculate expiration time
        let expiration_time = current_time + lock_duration;
        
        // Calculate liquidation threshold
        let liquidation_threshold = *table::borrow(&registry.liquidation_thresholds, collateral_type);
        
        // Get risk parameter for the collateral type
        let risk_parameter = *table::borrow(&registry.risk_parameters, collateral_type);
        
        // Default risk factor is 50 (scale 0-100, where 100 is highest risk)
        let risk_factor: u8 = 50;
        
        // Calculate health factor (10000 = 100% healthy, below 10000 is less healthy)
        let health_factor = calculate_health_factor(collateral_value, liquidation_threshold, risk_factor);
        
        // Calculate interest rate premium based on risk (in basis points)
        let interest_rate_premium = calculate_interest_premium(risk_factor, collateral_type);
        
        // Create the enhanced collateral object
        let collateral = EnhancedCollateral {
            id: object::new(ctx),
            collateral_type,
            collateral_value,
            owner: sender,
            lender: @0x0,  // No lender yet
            token_address,
            token_id,
            status: COLLATERAL_STATUS_ACTIVE,
            risk_factor,
            liquidation_threshold,
            creation_time: current_time,
            lock_expiration: expiration_time,
            interest_rate_premium,
            health_factor,
            last_updated: current_time,
            version: 1,
            oracle_price: 0,  // Will be updated by price feed
            metadata,
            cross_chain_origin: vector::empty<u8>(),
            multi_collateral_group_id: vector::empty<u8>(),
            liquidation_penalty: 800,  // 8% penalty
            diversification_score: 0,
            price_feed_id: vector::empty<u8>(),
            collateral_quality_score: 0
        };
        
        let collateral_id = object::id(&collateral);
        
        // Register collateral in registry
        table::add(&mut registry.collaterals, collateral_id, sender);
        
        // Add to user's collaterals
        if (!table::contains(&registry.collateral_by_owner, sender)) {
            table::add(&mut registry.collateral_by_owner, sender, vector::empty<ID>());
        };
        
        let user_collaterals = table::borrow_mut(&mut registry.collateral_by_owner, sender);
        vector::push_back(user_collaterals, collateral_id);
        
        // Update token type count
        let type_count = table::borrow_mut(&mut registry.token_type_count, collateral_type);
        *type_count = *type_count + 1;
        
        // Update total collateral value
        registry.total_collateral_value = registry.total_collateral_value + collateral_value;
        
        // Emit event
        event::emit(CollateralCreated {
            collateral_id,
            owner: sender,
            collateral_type,
            collateral_value,
            timestamp: current_time
        });
        
        // Transfer collateral to sender
        transfer::transfer(collateral, sender);
    }

    /// Lock collateral for a loan
    public fun lock_collateral(
        account: &signer,
        registry: &mut CollateralRegistry,
        collateral: &mut EnhancedCollateral,
        lender: address,
        asset_registry: &mut EnhancedAssetRegistry,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = signer::address_of(account);
        
        // Verify ownership
        assert!(collateral.owner == sender, error::permission_denied(ENotAuthorized));
        
        // Verify collateral is active
        assert!(collateral.status == COLLATERAL_STATUS_ACTIVE, error::invalid_state(ECollateralLocked));
        
        // Verify not expired
        assert!(clock::timestamp_ms(clock) / 1000 < collateral.lock_expiration, error::invalid_state(ECollateralExpired));
        
        // Update collateral status
        let old_status = collateral.status;
        collateral.status = COLLATERAL_STATUS_LOCKED;
        collateral.lender = lender;
        collateral.last_updated = clock::timestamp_ms(clock) / 1000;
        
        // Emit event
        event::emit(CollateralStatusChanged {
            collateral_id: object::id(collateral),
            old_status,
            new_status: COLLATERAL_STATUS_LOCKED,
            timestamp: clock::timestamp_ms(clock) / 1000
        });
        
        // Update asset registry to reflect collateral change
        enhanced_asset::register_collateral_change(
            sender,
            collateral.collateral_value,
            true, // locked
            asset_registry,
            ctx
        );
    }

    /// Release collateral after loan repayment
    public fun release_collateral(
        lender: &signer,
        registry: &mut CollateralRegistry,
        collateral: &mut EnhancedCollateral,
        asset_registry: &mut EnhancedAssetRegistry,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let lender_address = signer::address_of(lender);
        
        // Verify lender
        assert!(collateral.lender == lender_address, error::permission_denied(ENotAuthorized));
        
        // Verify collateral is locked
        assert!(collateral.status == COLLATERAL_STATUS_LOCKED, error::invalid_state(ECollateralNotLocked));
        
        // Update collateral status
        let old_status = collateral.status;
        collateral.status = COLLATERAL_STATUS_RELEASED;
        collateral.lender = @0x0; // Reset lender
        collateral.last_updated = clock::timestamp_ms(clock) / 1000;
        
        // Emit event
        event::emit(CollateralStatusChanged {
            collateral_id: object::id(collateral),
            old_status,
            new_status: COLLATERAL_STATUS_RELEASED,
            timestamp: clock::timestamp_ms(clock) / 1000
        });
        
        // Update asset registry to reflect collateral change
        enhanced_asset::register_collateral_change(
            collateral.owner,
            collateral.collateral_value,
            false, // released
            asset_registry,
            ctx
        );
    }

    /// Liquidate collateral that has fallen below threshold
    public fun liquidate_collateral(
        liquidator: &signer,
        registry: &mut CollateralRegistry,
        collateral: &mut EnhancedCollateral,
        asset_registry: &mut EnhancedAssetRegistry,
        manager_cap: &CollateralManagerCap,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let liquidator_address = signer::address_of(liquidator);
        
        // Verify liquidator is authorized
        assert!(is_authorized_liquidator(liquidator_address, manager_cap), error::permission_denied(ENotAuthorized));
        
        // Verify collateral is locked
        assert!(collateral.status == COLLATERAL_STATUS_LOCKED, error::invalid_state(ECollateralNotLocked));
        
        // Verify collateral can be liquidated
        assert!(!is_collateral_healthy(collateral, clock), error::invalid_state(EUnderLiquidationThreshold));
        
        // Update collateral status
        let old_status = collateral.status;
        collateral.status = COLLATERAL_STATUS_LIQUIDATING;
        collateral.last_updated = clock::timestamp_ms(clock) / 1000;
        
        // Emit status change event
        event::emit(CollateralStatusChanged {
            collateral_id: object::id(collateral),
            old_status,
            new_status: COLLATERAL_STATUS_LIQUIDATING,
            timestamp: clock::timestamp_ms(clock) / 1000
        });
        
        // Complete liquidation
        collateral.status = COLLATERAL_STATUS_LIQUIDATED;
        
        // Emit liquidation event
        event::emit(CollateralLiquidated {
            collateral_id: object::id(collateral),
            owner: collateral.owner,
            liquidator: liquidator_address,
            collateral_value: collateral.collateral_value,
            timestamp: clock::timestamp_ms(clock) / 1000
        });
        
        // Update asset registry to reflect liquidation
        enhanced_asset::register_liquidation(
            collateral.owner,
            collateral.lender,
            collateral.collateral_value,
            asset_registry,
            ctx
        );
        
        // Transfer collateral to liquidator
        // In a real implementation, this would involve transferring the underlying asset
        // For this demo, we just update ownership
        collateral.owner = liquidator_address;
    }

    /// Update collateral risk assessment
    public fun update_collateral_risk(
        admin: &signer,
        registry: &mut CollateralRegistry,
        collateral: &mut EnhancedCollateral,
        new_risk_factor: u8,
        manager_cap: &CollateralManagerCap,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let admin_address = signer::address_of(admin);
        
        // Verify admin is authorized
        assert!(object::is_owner(&manager_cap.id, admin_address), error::permission_denied(ENotAuthorized));
        
        // Validate risk factor
        assert!(new_risk_factor <= 100, error::invalid_argument(EInvalidRiskScore));
        
        // Update risk factor
        let old_risk = collateral.risk_factor;
        collateral.risk_factor = new_risk_factor;
        
        // Recalculate health factor
        collateral.health_factor = calculate_health_factor(
            collateral.collateral_value,
            collateral.liquidation_threshold,
            new_risk_factor
        );
        
        // Update interest rate premium
        collateral.interest_rate_premium = calculate_interest_premium(new_risk_factor, collateral.collateral_type);
        
        // Update timestamp
        collateral.last_updated = clock::timestamp_ms(clock) / 1000;
        
        // Emit event
        event::emit(CollateralRiskUpdated {
            collateral_id: object::id(collateral),
            old_risk,
            new_risk: new_risk_factor,
            health_factor: collateral.health_factor,
            timestamp: clock::timestamp_ms(clock) / 1000
        });
    }

    /// Update price data for a collateral type
    public fun update_price_data(
        oracle: &signer,
        registry: &mut CollateralRegistry,
        collateral_type: u8,
        new_price: u64,
        confidence: u8,
        volatility: u64,
        manager_cap: &mut CollateralManagerCap,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let oracle_address = signer::address_of(oracle);
        
        // Verify oracle is authorized
        assert!(is_authorized_oracle(oracle_address, manager_cap), error::permission_denied(ENotAuthorized));
        
        // Validate collateral type
        assert!(is_valid_collateral_type(registry, collateral_type), error::invalid_argument(EInvalidCollateralType));
        
        let current_time = clock::timestamp_ms(clock) / 1000;
        
        // Get old price if exists
        let old_price: u64 = 0;
        
        if (table::contains(&registry.price_data, collateral_type)) {
            let price_data = table::borrow(&registry.price_data, collateral_type);
            old_price = price_data.price;
            
            // Verify price data is not too recent (prevent oracle spam)
            assert!(current_time > price_data.next_update, error::invalid_state(EInvalidOracleData));
        };
        
        // Calculate price change percentage (10000 = 100%)
        let change_percentage = if (old_price > 0) {
            if (new_price > old_price) {
                ((new_price - old_price) * 10000) / old_price
            } else {
                ((old_price - new_price) * 10000) / old_price
            }
        } else {
            0
        };
        
        // Create or update price data
        let price_data = CollateralPriceData {
            id: object::new(ctx),
            asset_type: collateral_type,
            price: new_price,
            timestamp: current_time,
            source: oracle_address,
            confidence,
            next_update: current_time + 300, // 5 minutes minimum between updates
            volatility
        };
        
        // Store in registry
        if (table::contains(&registry.price_data, collateral_type)) {
            let old_data = table::remove(&mut registry.price_data, collateral_type);
            let CollateralPriceData { id, asset_type: _, price: _, timestamp: _, source: _, confidence: _, next_update: _, volatility: _ } = old_data;
            object::delete(id);
        };
        
        table::add(&mut registry.price_data, collateral_type, price_data);
        
        // Update manager cap
        manager_cap.last_price_update = current_time;
        
        // Emit event
        event::emit(PriceDataUpdated {
            asset_type: collateral_type,
            old_price,
            new_price,
            change_percentage,
            timestamp: current_time
        });
    }

    /// Create a cross-chain collateral commitment
    public fun create_cross_chain_commitment(
        account: &signer,
        registry: &mut CollateralRegistry,
        collateral: &EnhancedCollateral,
        target_chain: vector<u8>,
        bridge_address: address,
        expiration: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): CrossChainCollateralCommitment {
        let sender = signer::address_of(account);
        
        // Verify ownership
        assert!(collateral.owner == sender, error::permission_denied(ENotAuthorized));
        
        // Verify collateral is active
        assert!(collateral.status == COLLATERAL_STATUS_ACTIVE, error::invalid_state(ECollateralLocked));
        
        let current_time = clock::timestamp_ms(clock) / 1000;
        
        // Create commitment hash
        let commitment_hash = generate_commitment_hash(
            collateral,
            target_chain,
            current_time,
            sender
        );
        
        // Create cross-chain commitment
        let commitment = CrossChainCollateralCommitment {
            id: object::new(ctx),
            collateral_id: object::id(collateral),
            target_chain,
            commitment_hash,
            bridge_address,
            timestamp: current_time,
            expiration: current_time + expiration,
            status: 1, // Active
            confirmation_signatures: vector::empty<vector<u8>>()
        };
        
        // Emit event
        event::emit(CrossChainCommitmentCreated {
            commitment_id: object::id(&commitment),
            collateral_id: object::id(collateral),
            target_chain,
            timestamp: current_time
        });
        
        commitment
    }

    /// Helper function: Calculate health factor
    fun calculate_health_factor(
        collateral_value: u64,
        liquidation_threshold: u64,
        risk_factor: u8
    ): u64 {
        // Base health calculation (10000 = 100%)
        let base_health = 10000;
        
        // Risk adjustment (higher risk = lower health)
        let risk_adjustment = (risk_factor as u64) * 50; // Each risk point reduces health by 0.5%
        
        // Liquidation threshold adjustment
        let threshold_adjustment = liquidation_threshold * 10000 / 10000;
        
        // Final health factor
        let health = base_health - risk_adjustment + threshold_adjustment;
        
        // Ensure health factor is positive
        if (health < 1000) {
            1000 // Minimum 10% health
        } else {
            health
        }
    }

    /// Helper function: Calculate interest rate premium
    fun calculate_interest_premium(risk_factor: u8, collateral_type: u8): u64 {
        // Base premium based on risk factor (in basis points, 100 = 1%)
        let base_premium = (risk_factor as u64) * 5; // Each risk point adds 0.05% (5 basis points)
        
        // Adjustment based on collateral type
        let type_adjustment = if (collateral_type == COLLATERAL_TYPE_IOTA) {
            0 // No additional premium for IOTA
        } else if (collateral_type == COLLATERAL_TYPE_MIOTA) {
            25 // 0.25% additional premium
        } else if (collateral_type == COLLATERAL_TYPE_SMR) {
            50 // 0.5% additional premium
        } else if (collateral_type == COLLATERAL_TYPE_NFT) {
            300 // 3% additional premium
        } else if (collateral_type == COLLATERAL_TYPE_LP_TOKEN) {
            100 // 1% additional premium
        } else {
            200 // Default 2% premium for unknown types
        };
        
        base_premium + type_adjustment
    }

    /// Helper function: Check if collateral type is valid
    fun is_valid_collateral_type(registry: &CollateralRegistry, collateral_type: u8): bool {
        table::contains(&registry.token_type_count, collateral_type)
    }

    /// Helper function: Check if collateral is healthy
    fun is_collateral_healthy(collateral: &EnhancedCollateral, clock: &Clock): bool {
        // Consider collateral healthy if health factor is above 10000 (100%)
        // or if it's not expired
        let current_time = clock::timestamp_ms(clock) / 1000;
        
        (collateral.health_factor >= 10000) || 
        (current_time <= collateral.lock_expiration)
    }

    /// Helper function: Check if address is authorized liquidator
    fun is_authorized_liquidator(liquidator: address, manager_cap: &CollateralManagerCap): bool {
        // Check if in active liquidators list
        let i = 0;
        let len = vector::length(&manager_cap.active_liquidators);
        
        let is_authorized = false;
        while (i < len) {
            if (*vector::borrow(&manager_cap.active_liquidators, i) == liquidator) {
                is_authorized = true;
                break;
            };
            i = i + 1;
        };
        
        // Also allow the owner of the manager cap
        is_authorized || object::is_owner(&manager_cap.id, liquidator)
    }

    /// Helper function: Check if address is authorized oracle
    fun is_authorized_oracle(oracle: address, manager_cap: &CollateralManagerCap): bool {
        // Check if in oracle addresses list
        let i = 0;
        let len = vector::length(&manager_cap.oracle_addresses);
        
        let is_authorized = false;
        while (i < len) {
            if (*vector::borrow(&manager_cap.oracle_addresses, i) == oracle) {
                is_authorized = true;
                break;
            };
            i = i + 1;
        };
        
        // Also allow the owner of the manager cap
        is_authorized || object::is_owner(&manager_cap.id, oracle)
    }

    /// Helper function: Generate commitment hash for cross-chain operations
    fun generate_commitment_hash(
        collateral: &EnhancedCollateral,
        target_chain: vector<u8>,
        timestamp: u64,
        sender: address
    ): vector<u8> {
        // In a real implementation, this would use cryptographic primitives
        // For demo purposes, we'll create a simple hash
        let hash_input = vector::empty<u8>();
        
        // Add collateral ID bytes
        let id_bytes = object::uid_to_bytes(&collateral.id);
        vector::append(&mut hash_input, id_bytes);
        
        // Add target chain
        vector::append(&mut hash_input, target_chain);
        
        // Add timestamp bytes (simplified)
        let timestamp_bytes = vector::empty<u8>();
        let i = 0;
        while (i < 8) {
            vector::push_back(&mut timestamp_bytes, ((timestamp >> (i * 8)) & 0xFF as u8));
            i = i + 1;
        };
        vector::append(&mut hash_input, timestamp_bytes);
        
        // Add sender address bytes
        let sender_bytes = bcs::to_bytes(&sender);
        vector::append(&mut hash_input, sender_bytes);
        
        // Return hash bytes (in real implementation, would use cryptographic hash)
        hash_input
    }

    /// Add a liquidator to the authorized list
    public fun add_liquidator(
        admin: &signer,
        manager_cap: &mut CollateralManagerCap,
        liquidator: address
    ) {
        let admin_address = signer::address_of(admin);
        
        // Verify admin is authorized
        assert!(object::is_owner(&manager_cap.id, admin_address), error::permission_denied(ENotAuthorized));
        
        // Add to active liquidators if not already there
        let i = 0;
        let len = vector::length(&manager_cap.active_liquidators);
        
        let already_added = false;
        while (i < len) {
            if (*vector::borrow(&manager_cap.active_liquidators, i) == liquidator) {
                already_added = true;
                break;
            };
            i = i + 1;
        };
        
        if (!already_added) {
            vector::push_back(&mut manager_cap.active_liquidators, liquidator);
        };
    }

    /// Add an oracle to the authorized list
    public fun add_oracle(
        admin: &signer,
        manager_cap: &mut CollateralManagerCap,
        oracle: address
    ) {
        let admin_address = signer::address_of(admin);
        
        // Verify admin is authorized
        assert!(object::is_owner(&manager_cap.id, admin_address), error::permission_denied(ENotAuthorized));
        
        // Add to oracle addresses if not already there
        let i = 0;
        let len = vector::length(&manager_cap.oracle_addresses);
        
        let already_added = false;
        while (i < len) {
            if (*vector::borrow(&manager_cap.oracle_addresses, i) == oracle) {
                already_added = true;
                break;
            };
            i = i + 1;
        };
        
        if (!already_added) {
            vector::push_back(&mut manager_cap.oracle_addresses, oracle);
        };
    }

    /// Add a supported cross-chain destination
    public fun add_supported_chain(
        admin: &signer,
        manager_cap: &mut CollateralManagerCap,
        chain_id: vector<u8>
    ) {
        let admin_address = signer::address_of(admin);
        
        // Verify admin is authorized
        assert!(object::is_owner(&manager_cap.id, admin_address), error::permission_denied(ENotAuthorized));
        
        // Add to supported chains if not already there
        let i = 0;
        let len = vector::length(&manager_cap.supported_chains);
        
        let already_added = false;
        while (i < len) {
            if (*vector::borrow(&manager_cap.supported_chains, i) == chain_id) {
                already_added = true;
                break;
            };
            i = i + 1;
        };
        
        if (!already_added) {
            vector::push_back(&mut manager_cap.supported_chains, chain_id);
        };
    }

    /// Get collateral details
    public fun get_collateral_details(collateral: &EnhancedCollateral): (
        u8, // collateral_type
        u64, // collateral_value
        address, // owner
        address, // lender
        u8, // status
        u8, // risk_factor
        u64, // liquidation_threshold
        u64, // health_factor
        u64  // interest_rate_premium
    ) {
        (
            collateral.collateral_type,
            collateral.collateral_value,
            collateral.owner,
            collateral.lender,
            collateral.status,
            collateral.risk_factor,
            collateral.liquidation_threshold,
            collateral.health_factor,
            collateral.interest_rate_premium
        )
    }

    /// Get collateral status
    public fun get_collateral_status(collateral: &EnhancedCollateral): u8 {
        collateral.status
    }

    /// Get collateral health factor
    public fun get_collateral_health_factor(collateral: &EnhancedCollateral): u64 {
        collateral.health_factor
    }

    /// Get total collateral value in the registry
    public fun get_total_collateral(registry: &CollateralRegistry): u64 {
        registry.total_collateral_value
    }

    /// Get token type count
    public fun get_token_type_count(registry: &CollateralRegistry, token_type: u8): u64 {
        *table::borrow(&registry.token_type_count, token_type)
    }

    /// Get price data for a collateral type
    public fun get_price_data(
        registry: &CollateralRegistry,
        collateral_type: u8
    ): (u64, u64, u64) {
        assert!(table::contains(&registry.price_data, collateral_type), error::not_found(EInvalidCollateralType));
        
        let price_data = table::borrow(&registry.price_data, collateral_type);
        
        (
            price_data.price,
            price_data.timestamp,
            price_data.volatility
        )
    }
}
