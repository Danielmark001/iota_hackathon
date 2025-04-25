module intellilend::enhanced_asset {
    use std::error;
    use std::signer;
    use std::string::{Self, String};
    use std::vector;
    use std::option::{Self, Option};
    
    // Core Sui modules
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::table::{Self, Table};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::bcs;
    use sui::hash;
    
    // ZK verification modules
    use intellilend::zk_verifier;
    
    /// Asset types supported in the protocol
    enum AssetType {
        Collateral,
        Debt,
        Reserve,
        Staked
    }
    
    /// Risk levels for credit scoring
    enum RiskLevel {
        Low,
        Medium,
        High,
        VeryHigh
    }
    
    /// Verification levels for user identity
    enum VerificationLevel {
        None,
        Basic,
        Advanced,
        Full
    }
    
    /// Resource representing a lending asset with enhanced properties
    struct LendingAsset has key, store {
        id: UID,
        token_name: String,
        token_symbol: String,
        value: u64,
        owner: address,
        risk_score: u8,
        asset_type: AssetType,
        creation_time: u64,
        last_updated: u64,
        loan_to_value_ratio: u64, // LTV ratio in basis points (e.g., 7500 = 75%)
        liquidation_threshold: u64, // Threshold in basis points
        liquidation_bonus: u64, // Bonus in basis points
        interest_rate_model: ID, // Reference to interest rate model
        oracle_price_id: ID, // Reference to price oracle
        // Asset metadata (can be extended)
        metadata: Table<String, vector<u8>>
    }
    
    /// Tokenized representation of credit score (privacy-preserving)
    struct CreditScoreToken has key, store {
        id: UID,
        owner: address,
        // Only store the commitment, not the actual score
        score_commitment: vector<u8>,
        verified_by: vector<address>,
        verification_time: u64,
        expiration_time: u64,
        // Zero-knowledge proof verification result
        has_valid_proof: bool,
        // Range proof that score is within valid bounds
        proof_reference: Option<ID>
    }
    
    /// User profile with identity verification
    struct UserProfile has key, store {
        id: UID,
        owner: address,
        verification_level: VerificationLevel,
        // Identity commitments (privacy-preserving)
        identity_commitment: vector<u8>,
        // Aggregated reputation score (from cross-chain activity)
        reputation_score: u64,
        // Cross-chain account links (hashed)
        linked_accounts: Table<String, vector<u8>>,
        last_updated: u64
    }
    
    /// Cross-layer message with enhanced security
    struct CrossLayerMessage has key, store {
        id: UID,
        sender: vector<u8>, // EVM address in bytes
        message_type: String,
        payload: vector<u8>,
        // For private messages
        encrypted_payload: Option<vector<u8>>,
        timestamp: u64,
        processed: bool,
        // Signatures from multiple oracles for consensus
        oracle_signatures: Table<address, vector<u8>>,
        // Minimum number of oracle signatures required
        min_signatures: u64,
        // Nonce for replay protection
        nonce: u64
    }
    
    /// Asset Registry to track all assets with enhanced features
    struct AssetRegistry has key {
        id: UID,
        assets: Table<ID, address>,
        user_assets: Table<address, vector<ID>>,
        // Track assets by type for efficient queries
        assets_by_type: Table<u8, vector<ID>>,
        // Global protocol parameters
        total_assets: u64,
        total_collateral_value: u64,
        total_debt_value: u64,
        total_reserve_value: u64,
        // Protocol health metrics
        collateralization_ratio: u64, // In basis points
        reserve_factor: u64, // In basis points
        // Cross-chain assets mapping (chain ID -> asset ID -> amount)
        cross_chain_assets: Table<u64, Table<vector<u8>, u64>>
    }
    
    /// Protocol configuration for governance
    struct ProtocolConfig has key {
        id: UID,
        // Fee parameters
        origination_fee: u64, // In basis points
        protocol_fee: u64, // In basis points
        liquidation_fee: u64, // In basis points
        // Risk parameters
        min_collateralization_ratio: u64, // In basis points
        max_ltv: u64, // In basis points
        // Oracle configuration
        price_oracle_address: address,
        min_oracle_consensus: u64,
        // Cross-layer bridge configuration
        bridge_address: address,
        // Supported chains for cross-chain operations
        supported_chains: vector<u64>,
        // Governance parameters
        gov_timelocks: Table<String, u64>
    }
    
    /// Interest Rate Model
    struct InterestRateModel has key, store {
        id: UID,
        base_rate: u64, // In basis points
        slope1: u64, // In basis points
        slope2: u64, // In basis points
        optimal_utilization: u64, // In basis points
        last_updated: u64
    }
    
    /// Bridge admin capability
    struct BridgeAdminCap has key {
        id: UID
    }
    
    /// Registry admin capability
    struct RegistryAdminCap has key {
        id: UID
    }
    
    /// Liquidity provider capability
    struct LiquidityProviderCap has key {
        id: UID,
        provider: address,
        assets_provided: Table<String, u64>
    }
    
    /// Zero-knowledge verifier capability
    struct ZKVerifierCap has key {
        id: UID
    }
    
    /// Events
    struct AssetCreated has copy, drop {
        asset_id: ID,
        owner: address,
        token_name: String,
        token_symbol: String,
        asset_type: u8,
        value: u64,
        timestamp: u64
    }
    
    struct RiskScoreUpdated has copy, drop {
        asset_id: ID,
        old_score: u8,
        new_score: u8,
        timestamp: u64
    }
    
    struct AssetTypeChanged has copy, drop {
        asset_id: ID,
        old_type: u8,
        new_type: u8,
        timestamp: u64
    }
    
    struct CreditScoreVerified has copy, drop {
        user: address,
        score_commitment: vector<u8>,
        verified_by: address,
        timestamp: u64
    }
    
    struct MessageReceived has copy, drop {
        message_id: ID,
        sender: vector<u8>,
        message_type: String,
        timestamp: u64
    }
    
    struct CrossChainAssetReceived has copy, drop {
        chain_id: u64,
        asset_id: vector<u8>,
        amount: u64,
        recipient: address,
        timestamp: u64
    }
    
    struct ZKProofVerified has copy, drop {
        proof_id: ID,
        user: address,
        proof_type: String,
        timestamp: u64
    }
    
    /// Error codes
    const ENotAuthorized: u64 = 1;
    const EInvalidValue: u64 = 2;
    const EAssetNotFound: u64 = 3;
    const ERegistryNotInitialized: u64 = 4;
    const EInvalidRiskScore: u64 = 5;
    const EMessageAlreadyProcessed: u64 = 6;
    const EInsufficientOracles: u64 = 7;
    const EInvalidChainId: u64 = 8;
    const EInvalidProof: u64 = 9;
    const EExpiredCreditScore: u64 = 10;
    const EInsufficientCollateral: u64 = 11;
    const EInvalidLTV: u64 = 12;
    const EUnsupportedAssetType: u64 = 13;
    
    /// Initialize the protocol
    fun init(ctx: &mut TxContext) {
        // Create registry with empty tables
        let registry = AssetRegistry {
            id: object::new(ctx),
            assets: table::new(ctx),
            user_assets: table::new(ctx),
            assets_by_type: table::new(ctx),
            total_assets: 0,
            total_collateral_value: 0,
            total_debt_value: 0,
            total_reserve_value: 0,
            collateralization_ratio: 15000, // 150%
            reserve_factor: 1000, // 10%
            cross_chain_assets: table::new(ctx)
        };
        
        // Initialize asset types
        table::add(&mut registry.assets_by_type, 0, vector::empty<ID>()); // Collateral
        table::add(&mut registry.assets_by_type, 1, vector::empty<ID>()); // Debt
        table::add(&mut registry.assets_by_type, 2, vector::empty<ID>()); // Reserve
        table::add(&mut registry.assets_by_type, 3, vector::empty<ID>()); // Staked
        
        // Create protocol configuration
        let config = ProtocolConfig {
            id: object::new(ctx),
            origination_fee: 50, // 0.5%
            protocol_fee: 100, // 1%
            liquidation_fee: 500, // 5%
            min_collateralization_ratio: 12000, // 120%
            max_ltv: 8000, // 80%
            price_oracle_address: tx_context::sender(ctx),
            min_oracle_consensus: 2,
            bridge_address: tx_context::sender(ctx),
            supported_chains: vector::singleton(1), // IOTA EVM chain ID
            gov_timelocks: table::new(ctx)
        };
        
        // Add governance timelock defaults
        table::add(&mut config.gov_timelocks, string::utf8(b"fee_change"), 86400); // 1 day
        table::add(&mut config.gov_timelocks, string::utf8(b"risk_param_change"), 259200); // 3 days
        
        // Create admin capabilities
        let registry_admin_cap = RegistryAdminCap {
            id: object::new(ctx)
        };
        
        let bridge_admin_cap = BridgeAdminCap {
            id: object::new(ctx)
        };
        
        let zk_verifier_cap = ZKVerifierCap {
            id: object::new(ctx)
        };
        
        // Create default interest rate model
        let interest_model = InterestRateModel {
            id: object::new(ctx),
            base_rate: 200, // 2%
            slope1: 1000, // 10%
            slope2: 10000, // 100%
            optimal_utilization: 8000, // 80%
            last_updated: tx_context::epoch(ctx)
        };
        
        // Transfer objects
        transfer::share_object(registry);
        transfer::share_object(config);
        transfer::share_object(interest_model);
        transfer::transfer(registry_admin_cap, tx_context::sender(ctx));
        transfer::transfer(bridge_admin_cap, tx_context::sender(ctx));
        transfer::transfer(zk_verifier_cap, tx_context::sender(ctx));
    }
    
    /// Create a new lending asset with enhanced properties
    public fun create_asset(
        account: &signer,
        registry: &mut AssetRegistry,
        token_name: String,
        token_symbol: String,
        value: u64,
        asset_type: u8,
        ctx: &mut TxContext
    ) {
        let sender = signer::address_of(account);
        
        // Validate asset type
        assert!(asset_type <= 3, error::invalid_argument(EUnsupportedAssetType));
        
        // Create the asset
        let asset = LendingAsset {
            id: object::new(ctx),
            token_name,
            token_symbol,
            value,
            owner: sender,
            risk_score: 50, // Default risk score (0-100)
            asset_type: if (asset_type == 0) AssetType::Collateral 
                       else if (asset_type == 1) AssetType::Debt
                       else if (asset_type == 2) AssetType::Reserve
                       else AssetType::Staked,
            creation_time: tx_context::epoch(ctx),
            last_updated: tx_context::epoch(ctx),
            loan_to_value_ratio: 7500, // 75% default
            liquidation_threshold: 8250, // 82.5% default
            liquidation_bonus: 500, // 5% default
            interest_rate_model: object::id_from_address(@0x1), // Placeholder, should be set later
            oracle_price_id: object::id_from_address(@0x1), // Placeholder, should be set later
            metadata: table::new(ctx)
        };
        
        let asset_id = object::id(&asset);
        
        // Register asset in registry
        table::add(&mut registry.assets, asset_id, sender);
        
        // Add to user's assets
        if (!table::contains(&registry.user_assets, sender)) {
            table::add(&mut registry.user_assets, sender, vector::empty<ID>());
        };
        
        let user_assets = table::borrow_mut(&mut registry.user_assets, sender);
        vector::push_back(user_assets, asset_id);
        
        // Add to assets by type
        let type_assets = table::borrow_mut(&mut registry.assets_by_type, asset_type);
        vector::push_back(type_assets, asset_id);
        
        // Update registry stats
        registry.total_assets = registry.total_assets + 1;
        
        // Update type-specific totals
        if (asset_type == 0) { // Collateral
            registry.total_collateral_value = registry.total_collateral_value + value;
        } else if (asset_type == 1) { // Debt
            registry.total_debt_value = registry.total_debt_value + value;
        } else if (asset_type == 2) { // Reserve
            registry.total_reserve_value = registry.total_reserve_value + value;
        };
        
        // Emit event
        event::emit(AssetCreated {
            asset_id,
            owner: sender,
            token_name: token_name,
            token_symbol: token_symbol,
            asset_type,
            value,
            timestamp: tx_context::epoch(ctx)
        });
        
        // Transfer asset to sender
        transfer::transfer(asset, sender);
    }
    
    /// Create a credit score token with zero-knowledge proof
    public fun create_credit_score(
        account: &signer,
        score_commitment: vector<u8>,
        expiration_time: u64,
        ctx: &mut TxContext
    ): CreditScoreToken {
        let sender = signer::address_of(account);
        
        let credit_score = CreditScoreToken {
            id: object::new(ctx),
            owner: sender,
            score_commitment,
            verified_by: vector::empty<address>(),
            verification_time: tx_context::epoch(ctx),
            expiration_time,
            has_valid_proof: false,
            proof_reference: option::none()
        };
        
        credit_score
    }
    
    /// Register a user profile with the protocol
    public fun register_user(
        account: &signer,
        identity_commitment: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = signer::address_of(account);
        
        let profile = UserProfile {
            id: object::new(ctx),
            owner: sender,
            verification_level: VerificationLevel::None,
            identity_commitment,
            reputation_score: 50, // Default middle score
            linked_accounts: table::new(ctx),
            last_updated: tx_context::epoch(ctx)
        };
        
        transfer::transfer(profile, sender);
    }
    
    /// Update the risk score of an asset with improved validation
    public fun update_risk_score(
        asset: &mut LendingAsset,
        new_score: u8,
        cap: &BridgeAdminCap,
        ctx: &mut TxContext
    ) {
        // Ensure score is valid
        assert!(new_score <= 100, error::invalid_argument(EInvalidRiskScore));
        
        let old_score = asset.risk_score;
        asset.risk_score = new_score;
        asset.last_updated = tx_context::epoch(ctx);
        
        // Adjust LTV based on risk score
        // Higher risk = lower LTV
        if (new_score < 25) {
            asset.loan_to_value_ratio = 8000; // 80%
        } else if (new_score < 50) {
            asset.loan_to_value_ratio = 7500; // 75%
        } else if (new_score < 75) {
            asset.loan_to_value_ratio = 7000; // 70%
        } else {
            asset.loan_to_value_ratio = 6500; // 65%
        };
        
        // Adjust liquidation threshold similarly
        asset.liquidation_threshold = asset.loan_to_value_ratio + 750; // 7.5% buffer
        
        // Emit event
        event::emit(RiskScoreUpdated {
            asset_id: object::id(asset),
            old_score,
            new_score,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    /// Change asset type (e.g., from collateral to debt)
    public fun change_asset_type(
        account: &signer,
        registry: &mut AssetRegistry,
        asset: &mut LendingAsset,
        new_type: u8,
        ctx: &mut TxContext
    ) {
        // Validate owner and asset type
        assert!(asset.owner == signer::address_of(account), error::permission_denied(ENotAuthorized));
        assert!(new_type <= 3, error::invalid_argument(EUnsupportedAssetType));
        
        // Get current asset type as u8
        let old_type = asset_type_to_u8(asset.asset_type);
        
        // Skip if no change
        if (old_type == new_type) return;
        
        // Remove from old type collection
        let old_type_assets = table::borrow_mut(&mut registry.assets_by_type, old_type);
        let (found, index) = vector::index_of(old_type_assets, &object::id(asset));
        if (found) {
            vector::remove(old_type_assets, index);
        };
        
        // Add to new type collection
        let new_type_assets = table::borrow_mut(&mut registry.assets_by_type, new_type);
        vector::push_back(new_type_assets, object::id(asset));
        
        // Update registry stats
        if (old_type == 0) { // Removing from collateral
            registry.total_collateral_value = registry.total_collateral_value - asset.value;
        } else if (old_type == 1) { // Removing from debt
            registry.total_debt_value = registry.total_debt_value - asset.value;
        } else if (old_type == 2) { // Removing from reserve
            registry.total_reserve_value = registry.total_reserve_value - asset.value;
        };
        
        if (new_type == 0) { // Adding to collateral
            registry.total_collateral_value = registry.total_collateral_value + asset.value;
        } else if (new_type == 1) { // Adding to debt
            registry.total_debt_value = registry.total_debt_value + asset.value;
        } else if (new_type == 2) { // Adding to reserve
            registry.total_reserve_value = registry.total_reserve_value + asset.value;
        };
        
        // Update asset type
        asset.asset_type = if (new_type == 0) AssetType::Collateral 
                          else if (new_type == 1) AssetType::Debt
                          else if (new_type == 2) AssetType::Reserve
                          else AssetType::Staked;
        
        asset.last_updated = tx_context::epoch(ctx);
        
        // Emit event
        event::emit(AssetTypeChanged {
            asset_id: object::id(asset),
            old_type,
            new_type,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    /// Verify a credit score with a zero-knowledge proof
    public fun verify_credit_score(
        score_token: &mut CreditScoreToken,
        verifier: address,
        zk_proof: vector<u8>,
        proof_id: ID,
        zk_cap: &ZKVerifierCap,
        ctx: &mut TxContext
    ) {
        // Verify the proof using ZK verifier module
        let is_valid = zk_verifier::verify_score_proof(
            score_token.score_commitment,
            zk_proof,
            verifier
        );
        
        assert!(is_valid, error::invalid_argument(EInvalidProof));
        
        // Update credit score token
        score_token.has_valid_proof = true;
        score_token.proof_reference = option::some(proof_id);
        score_token.verification_time = tx_context::epoch(ctx);
        
        // Add verifier to verified_by list
        if (!vector::contains(&score_token.verified_by, &verifier)) {
            vector::push_back(&mut score_token.verified_by, verifier);
        };
        
        // Emit event
        event::emit(CreditScoreVerified {
            user: score_token.owner,
            score_commitment: score_token.score_commitment,
            verified_by: verifier,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    /// Process a cross-layer message with enhanced security
    public fun process_cross_layer_message(
        message: &mut CrossLayerMessage,
        registry: &mut AssetRegistry,
        config: &ProtocolConfig,
        cap: &BridgeAdminCap,
        ctx: &mut TxContext
    ) {
        // Check if already processed
        assert!(!message.processed, error::invalid_argument(EMessageAlreadyProcessed));
        
        // Verify sufficient oracle signatures
        assert!(
            table::length(&message.oracle_signatures) >= message.min_signatures,
            error::invalid_argument(EInsufficientOracles)
        );
        
        // Mark as processed
        message.processed = true;
        
        // Process different message types
        if (string::to_ascii(message.message_type) == string::to_ascii(string::utf8(b"RISK_SCORE_UPDATE"))) {
            process_risk_score_update(message, registry, cap, ctx);
        } else if (string::to_ascii(message.message_type) == string::to_ascii(string::utf8(b"COLLATERAL_CHANGE"))) {
            process_collateral_change(message, registry, cap, ctx);
        } else if (string::to_ascii(message.message_type) == string::to_ascii(string::utf8(b"LIQUIDATION"))) {
            process_liquidation(message, registry, cap, ctx);
        } else if (string::to_ascii(message.message_type) == string::to_ascii(string::utf8(b"CROSS_CHAIN_DEPOSIT"))) {
            process_cross_chain_deposit(message, registry, config, cap, ctx);
        };
        
        // Emit event
        event::emit(MessageReceived {
            message_id: object::id(message),
            sender: message.sender,
            message_type: message.message_type,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    /// Process a risk score update message
    fun process_risk_score_update(
        message: &CrossLayerMessage,
        registry: &mut AssetRegistry,
        cap: &BridgeAdminCap,
        ctx: &mut TxContext
    ) {
        // Extract user address and risk score from payload
        let user_address = extract_address(message.payload, 0);
        let risk_score = extract_u8(message.payload, 20);
        
        // Update risk scores for all user assets
        if (table::contains(&registry.user_assets, user_address)) {
            let user_assets = table::borrow(&registry.user_assets, user_address);
            let i = 0;
            let len = vector::length(user_assets);
            
            while (i < len) {
                let asset_id = *vector::borrow(user_assets, i);
                // In a real implementation, we'd have a more efficient way
                // to get and update the asset directly
                i = i + 1;
            }
        }
    }
    
    /// Process a collateral change message
    fun process_collateral_change(
        message: &CrossLayerMessage,
        registry: &mut AssetRegistry,
        cap: &BridgeAdminCap,
        ctx: &mut TxContext
    ) {
        // Extract user address and collateral amount from payload
        let user_address = extract_address(message.payload, 0);
        let collateral_amount = extract_u64(message.payload, 20);
        
        // Update collateral in registry (simplified)
        if (table::contains(&registry.user_assets, user_address)) {
            // This would update the collateral for the user in a real implementation
        }
    }
    
    /// Process a liquidation message
    fun process_liquidation(
        message: &CrossLayerMessage,
        registry: &mut AssetRegistry,
        cap: &BridgeAdminCap,
        ctx: &mut TxContext
    ) {
        // Extract liquidation details from payload
        let borrower = extract_address(message.payload, 0);
        let repay_amount = extract_u64(message.payload, 20);
        let collateral_seized = extract_u64(message.payload, 28);
        
        // Update registry data for liquidation
        if (table::contains(&registry.user_assets, borrower)) {
            // Update collateral and debt values
            registry.total_collateral_value = registry.total_collateral_value - collateral_seized;
            registry.total_debt_value = registry.total_debt_value - repay_amount;
            
            // In a real implementation, we would move assets between users
        }
    }
    
    /// Process a cross-chain deposit
    fun process_cross_chain_deposit(
        message: &CrossLayerMessage,
        registry: &mut AssetRegistry,
        config: &ProtocolConfig,
        cap: &BridgeAdminCap,
        ctx: &mut TxContext
    ) {
        // Extract deposit details
        let chain_id = extract_u64(message.payload, 0);
        let recipient = extract_address(message.payload, 8);
        let asset_id_bytes = extract_bytes(message.payload, 28, 32);
        let amount = extract_u64(message.payload, 60);
        
        // Verify chain ID is supported
        assert!(
            chain_is_supported(config, chain_id),
            error::invalid_argument(EInvalidChainId)
        );
        
        // Update cross-chain assets tracking
        if (!table::contains(&registry.cross_chain_assets, chain_id)) {
            table::add(&mut registry.cross_chain_assets, chain_id, table::new(ctx));
        };
        
        let chain_assets = table::borrow_mut(&mut registry.cross_chain_assets, chain_id);
        
        if (!table::contains(chain_assets, asset_id_bytes)) {
            table::add(chain_assets, asset_id_bytes, 0);
        };
        
        let current_amount = table::borrow_mut(chain_assets, asset_id_bytes);
        *current_amount = *current_amount + amount;
        
        // Emit event
        event::emit(CrossChainAssetReceived {
            chain_id,
            asset_id: asset_id_bytes,
            amount,
            recipient,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    /// Calculate interest for an asset based on its interest rate model
    public fun calculate_interest(
        asset: &LendingAsset,
        interest_model: &InterestRateModel,
        registry: &AssetRegistry,
        time_elapsed: u64
    ): u64 {
        // Calculate utilization rate
        let utilization_rate = if (registry.total_collateral_value > 0) {
            (registry.total_debt_value * 10000) / registry.total_collateral_value
        } else {
            0
        };
        
        // Calculate interest rate based on utilization
        let interest_rate = if (utilization_rate <= interest_model.optimal_utilization) {
            // Below optimal: base_rate + slope1 * utilization
            interest_model.base_rate + (interest_model.slope1 * utilization_rate) / 10000
        } else {
            // Above optimal: base_rate + slope1 * optimal + slope2 * (utilization - optimal)
            let base_interest = interest_model.base_rate + 
                               (interest_model.slope1 * interest_model.optimal_utilization) / 10000;
            let excess_utilization = utilization_rate - interest_model.optimal_utilization;
            base_interest + (interest_model.slope2 * excess_utilization) / 10000
        };
        
        // Calculate interest amount: principal * rate * time / year
        let interest_amount = (asset.value * interest_rate * time_elapsed) / (365 * 86400 * 10000);
        
        interest_amount
    }
    
    /// Verify user has sufficient collateral
    public fun verify_collateral(
        user: address,
        registry: &AssetRegistry,
        config: &ProtocolConfig
    ): bool {
        if (!table::contains(&registry.user_assets, user)) {
            return false;
        };
        
        // Get user's assets
        let user_assets = table::borrow(&registry.user_assets, user);
        
        // Calculate collateral and debt values
        let total_collateral = 0u64;
        let total_debt = 0u64;
        
        let i = 0;
        let len = vector::length(user_assets);
        
        // This is a simplified implementation
        // In a real system, we would need to properly fetch the assets and calculate values
        
        // Check if collateral ratio is sufficient
        if (total_debt == 0) {
            return true; // No debt, so always sufficient
        };
        
        let collateral_ratio = (total_collateral * 10000) / total_debt;
        
        collateral_ratio >= config.min_collateralization_ratio
    }
    
    /// Link a cross-chain account to a user profile
    public fun link_cross_chain_account(
        account: &signer,
        profile: &mut UserProfile,
        chain_id: u64,
        external_address: vector<u8>,
        proof: vector<u8>,
        ctx: &mut TxContext
    ) {
        // Verify the caller is the profile owner
        assert!(
            signer::address_of(account) == profile.owner,
            error::permission_denied(ENotAuthorized)
        );
        
        // Create a key for the chain
        let chain_key = string::utf8(bcs::to_bytes(&chain_id));
        
        // Hash the external address for privacy
        let hashed_address = hash::sha3_256(external_address);
        
        // Store the link
        if (!table::contains(&profile.linked_accounts, chain_key)) {
            table::add(&mut profile.linked_accounts, chain_key, hashed_address);
        } else {
            *table::borrow_mut(&mut profile.linked_accounts, chain_key) = hashed_address;
        };
        
        profile.last_updated = tx_context::epoch(ctx);
    }
    
    /// Calculate health factor for a user (collateral-to-debt ratio)
    public fun calculate_health_factor(
        user: address,
        registry: &AssetRegistry
    ): u64 {
        // This is a simplified implementation
        // In a real system, we would properly calculate the health factor
        // based on all assets, their prices, and risk parameters
        
        // Return a very high value if no debt
        if (registry.total_debt_value == 0) {
            return 10000;
        };
        
        // Return the global collateralization ratio as fallback
        registry.collateralization_ratio
    }
    
    // Utility functions
    
    /// Convert AssetType enum to u8
    fun asset_type_to_u8(asset_type: AssetType): u8 {
        if (asset_type == AssetType::Collateral) {
            0
        } else if (asset_type == AssetType::Debt) {
            1
        } else if (asset_type == AssetType::Reserve) {
            2
        } else {
            3 // Staked
        }
    }
    
    /// Extract address from payload at specific offset
    fun extract_address(payload: vector<u8>, offset: u64): address {
        let addr_bytes = vector::empty<u8>();
        let i = 0;
        
        while (i < 32 && (offset + i) < vector::length(&payload)) {
            vector::push_back(&mut addr_bytes, *vector::borrow(&payload, offset + i));
            i = i + 1;
        };
        
        // In a real implementation, we would properly convert bytes to address
        @0x1
    }
    
    /// Extract u8 from payload at specific offset
    fun extract_u8(payload: vector<u8>, offset: u64): u8 {
        if (offset < vector::length(&payload)) {
            *vector::borrow(&payload, offset)
        } else {
            0
        }
    }
    
    /// Extract u64 from payload at specific offset
    fun extract_u64(payload: vector<u8>, offset: u64): u64 {
        let result = 0u64;
        let i = 0;
        
        while (i < 8 && (offset + i) < vector::length(&payload)) {
            let byte_val = (*vector::borrow(&payload, offset + i) as u64);
            result = result | (byte_val << (i * 8));
            i = i + 1;
        };
        
        result
    }
    
    /// Extract arbitrary bytes from payload at specific offset and length
    fun extract_bytes(payload: vector<u8>, offset: u64, length: u64): vector<u8> {
        let result = vector::empty<u8>();
        let i = 0;
        
        while (i < length && (offset + i) < vector::length(&payload)) {
            vector::push_back(&mut result, *vector::borrow(&payload, offset + i));
            i = i + 1;
        };
        
        result
    }
    
    /// Check if a chain ID is supported
    fun chain_is_supported(config: &ProtocolConfig, chain_id: u64): bool {
        vector::contains(&config.supported_chains, &chain_id)
    }
    
    // Public getters
    
    /// Return all assets for a user
    public fun get_user_assets(registry: &AssetRegistry, user: address): vector<ID> {
        if (table::contains(&registry.user_assets, user)) {
            *table::borrow(&registry.user_assets, user)
        } else {
            vector::empty<ID>()
        }
    }
    
    /// Get assets by type
    public fun get_assets_by_type(registry: &AssetRegistry, asset_type: u8): vector<ID> {
        if (table::contains(&registry.assets_by_type, asset_type)) {
            *table::borrow(&registry.assets_by_type, asset_type)
        } else {
            vector::empty<ID>()
        }
    }
    
    /// Get total protocol values
    public fun get_protocol_totals(registry: &AssetRegistry): (u64, u64, u64, u64, u64) {
        (
            registry.total_assets,
            registry.total_collateral_value,
            registry.total_debt_value,
            registry.total_reserve_value,
            registry.collateralization_ratio
        )
    }
}

/// Module for ZK-proof verification for privacy-preserving credit scoring
module intellilend::zk_verifier {
    use std::vector;
    
    /// Verify a zero-knowledge proof for a credit score
    public fun verify_score_proof(
        commitment: vector<u8>,
        proof: vector<u8>,
        verifier: address
    ): bool {
        // This is a placeholder implementation for the hackathon
        // In a real implementation, this would call actual ZK proof verification logic
        
        // For now, we'll just do a simple check on the proof format
        if (vector::length(&proof) < 64) {
            return false;
        };
        
        // Pretend to verify the proof...
        true
    }
    
    /// Verify a zero-knowledge proof for identity verification
    public fun verify_identity_proof(
        commitment: vector<u8>,
        proof: vector<u8>,
        verifier: address
    ): bool {
        // This is a placeholder implementation for the hackathon
        // In a real implementation, this would call actual ZK proof verification logic
        
        // For now, we'll just do a simple check on the proof format
        if (vector::length(&proof) < 128) {
            return false;
        };
        
        // Pretend to verify the proof...
        true
    }
}
