module intellilend::enhanced_asset_v2 {
    use std::error;
    use std::signer;
    use std::string::{Self, String};
    use std::vector;
    use std::option::{Self, Option};
    
    // Add imports for object and transfer modules
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::table::{Self, Table};
    use sui::coin::{Self, Coin};
    use sui::url::{Self, Url};
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use sui::package;
    use sui::dynamic_field as df;
    use sui::dynamic_object_field as dof;
    use sui::hash::{Self, sha3_256};
    
    /// Advanced resource representing an enhanced lending asset with identity integration
    /// and quantum resistance features
    struct EnhancedLendingAssetV2 has key, store {
        id: UID,
        token_name: String,
        value: u64,
        owner: address,
        risk_score: u8,
        is_collateral: bool,
        creation_time: u64,
        last_updated: u64,
        identity_verified: bool,
        identity_score: u8,
        credit_score: u16,
        zero_knowledge_proof: vector<u8>,
        metadata: String,
        // Enhanced fields for V2
        cross_chain_origins: vector<CrossChainOrigin>,
        ai_risk_assessment: AiRiskAssessment,
        quantum_resistant_signature: QuantumResistantSignature,
        collateral_health_index: u8,
        historical_performance: HistoricalPerformance,
        lending_constraints: Option<LendingConstraints>
    }
    
    /// Cross-chain origin information
    struct CrossChainOrigin has store, copy, drop {
        chain_id: u64,
        origin_address: vector<u8>,
        bridge_transaction_id: vector<u8>,
        timestamp: u64,
        verification_status: u8 // 0: unverified, 1: pending, 2: verified, 3: rejected
    }
    
    /// AI-based risk assessment data
    struct AiRiskAssessment has store, copy, drop {
        overall_score: u8,
        repayment_score: u8,
        collateral_score: u8,
        volatility_score: u8,
        activity_score: u8,
        cross_chain_score: u8,
        identity_confidence: u8,
        market_correlation: u8,
        assessment_timestamp: u64,
        model_version: String,
        confidence_score: u8,
        explainability_data: vector<FeatureImportance>
    }
    
    /// Feature importance for AI explainability
    struct FeatureImportance has store, copy, drop {
        feature_name: String,
        importance_value: u8, // 0-100
        direction: bool // true = positive, false = negative impact
    }
    
    /// Quantum-resistant signature 
    struct QuantumResistantSignature has store, copy, drop {
        algorithm: String, // e.g., "Dilithium", "Falcon", "SPHINCS+"
        public_key: vector<u8>,
        signature: vector<u8>,
        timestamp: u64,
        valid_until: u64,
        verification_status: u8 // 0: unverified, 1: pending, 2: verified, 3: rejected
    }
    
    /// Historical performance metrics
    struct HistoricalPerformance has store, copy, drop {
        repayments_on_time: u64,
        repayments_late: u64,
        defaults: u64,
        liquidations: u64,
        average_loan_duration: u64, // in seconds
        total_borrowed: u64,
        total_repaid: u64,
        last_updated: u64
    }
    
    /// Lending constraints to limit risk
    struct LendingConstraints has store, copy, drop {
        max_borrow_amount: u64,
        min_collateral_ratio: u8, // Percentage multiplied by 100 (e.g., 150%)
        interest_rate_cap: u8, // Maximum interest rate in percentage
        max_loan_duration: u64, // in seconds
        allowed_liquidation_chains: vector<u64>, // chain IDs
        restricted_usage: bool,
        cooldown_period: u64 // in seconds
    }
    
    /// Privacy-preserving identity verification
    struct EnhancedIdentityProof has key, store {
        id: UID,
        owner: address,
        verification_level: u8, // 0: None, 1: Basic, 2: Advanced, 3: Full
        issuer: address,
        issuance_time: u64,
        expiration_time: u64,
        proof_hash: vector<u8>,
        revoked: bool,
        // Enhanced fields for V2
        verification_method: String, // e.g., "ZKP", "ECDSA", "Dilithium"
        credential_schema: String,
        trust_anchors: vector<address>,
        revocation_registry: Option<vector<u8>>,
        biometric_verification: bool,
        verification_context: vector<u8>
    }
    
    /// Cross-layer message with enhanced security
    struct EnhancedCrossLayerMessageV2 has key, store {
        id: UID,
        sender: vector<u8>, // EVM address in bytes
        message_type: String,
        payload: vector<u8>,
        timestamp: u64,
        processed: bool,
        signature: vector<u8>,
        nonce: u64,
        // Enhanced fields for V2
        source_chain_id: u64,
        destination_chain_id: u64,
        gas_price: u64,
        priority: u8, // 0-255 with higher being higher priority
        expiration: u64,
        merkle_proof: Option<vector<u8>>,
        zk_proof: Option<vector<u8>>,
        required_confirmations: u8,
        current_confirmations: u8,
        validators: vector<address>,
        execution_status: u8 // 0: pending, 1: executed, 2: failed, 3: reverted
    }
    
    /// Enhanced Asset Registry to track all assets with advanced features
    struct EnhancedAssetRegistryV2 has key {
        id: UID,
        assets: Table<ID, address>,
        user_assets: Table<address, vector<ID>>,
        total_assets: u64,
        total_collateral_value: u64,
        verified_assets: Table<ID, bool>,
        risk_assessment_data: Table<address, vector<u8>>,
        // Enhanced fields for V2
        asset_types: Table<ID, String>,
        asset_ratings: Table<ID, u8>, // 0-100 rating
        cross_chain_assets: Table<ID, vector<CrossChainOrigin>>,
        quantum_resistant_assets: Table<ID, bool>,
        user_risk_profiles: Table<address, AiRiskAssessment>,
        historical_data: Table<address, HistoricalPerformance>,
        lending_constraints: Table<address, LendingConstraints>,
        trusted_issuers: vector<address>,
        trust_score_thresholds: vector<u8>,
        interoperability_config: InteroperabilityConfig
    }
    
    /// Interoperability configuration for cross-chain functionality
    struct InteroperabilityConfig has store, copy, drop {
        supported_chains: vector<SupportedChain>,
        bridge_contracts: vector<BridgeContract>,
        min_confirmations: u8,
        fee_model: u8, // 0: fixed, 1: percentage, 2: dynamic
        fee_amount: u64,
        protocol_version: String,
        last_updated: u64
    }
    
    /// Configuration for a supported chain
    struct SupportedChain has store, copy, drop {
        chain_id: u64,
        chain_name: String,
        bridge_address: vector<u8>,
        asset_mapping_table: u64, // ID of asset mapping table
        trust_score: u8, // 0-100
        active: bool
    }
    
    /// Bridge contract configuration
    struct BridgeContract has store, copy, drop {
        chain_id: u64,
        contract_address: vector<u8>,
        interface_version: String,
        last_heartbeat: u64,
        message_count: u64,
        success_rate: u8, // Percentage of successful operations
        active: bool
    }
    
    /// Enhanced Lending protocol statistics with historical data
    struct EnhancedLendingStatsV2 has key {
        id: UID,
        total_borrowed: u64,
        total_deposited: u64,
        protocol_fee_balance: Balance<sui::sui::SUI>,
        user_count: u64,
        last_updated: u64,
        // Enhanced fields for V2
        total_borrowers: u64,
        total_lenders: u64,
        total_defaults: u64,
        total_liquidations: u64,
        cross_chain_volume: u64,
        average_loan_duration: u64,
        average_interest_rate: u64, // Basis points (1/100 of a percent)
        asset_distribution: Table<String, u64>, // Asset type => amount
        risk_band_distribution: Table<u8, u64>, // Risk band => amount
        historical_tvl: vector<TimeValue>,
        historical_borrow_volume: vector<TimeValue>,
        historical_repayment_volume: vector<TimeValue>,
        historical_default_rate: vector<TimeValue>,
        last_optimization_time: u64,
        optimization_results: OptimizationResults
    }
    
    /// Time-value pair for historical data
    struct TimeValue has store, copy, drop {
        timestamp: u64,
        value: u64
    }
    
    /// Results from the last protocol optimization
    struct OptimizationResults has store, copy, drop {
        timestamp: u64,
        optimal_interest_rate: u64, // Basis points
        optimal_collateral_factor: u64, // Percentage multiplied by 100
        expected_default_rate: u64, // Percentage multiplied by 100
        expected_utilization: u64, // Percentage multiplied by 100
        confidence_score: u8, // 0-100
        model_version: String,
        applied: bool
    }
    
    /// Advanced admin capability with delegated authorities
    struct EnhancedAdminCapV2 has key {
        id: UID,
        admin_address: address,
        created_at: u64,
        last_used: u64,
        permissions: u16, // Bitfield of permissions
        delegates: Table<address, u16>, // Delegate => permissions
        delegation_history: vector<DelegationEvent>,
        max_delegates: u8,
        emergency_controls: EmergencyControls
    }
    
    /// Delegation event for admin cap history
    struct DelegationEvent has store, copy, drop {
        delegate: address,
        permissions: u16,
        granted_at: u64,
        granted_by: address,
        revoked_at: Option<u64>,
        revoked_by: Option<address>
    }
    
    /// Emergency controls for protocol safety
    struct EmergencyControls has store, copy, drop {
        pause_threshold: u8, // Number of delegates required to pause
        unpause_threshold: u8, // Number of delegates required to unpause
        emergency_admins: vector<address>,
        emergency_timelock: u64, // Timelock for emergency actions in seconds
        last_emergency: u64,
        emergency_actions: vector<EmergencyAction>
    }
    
    /// Record of emergency actions
    struct EmergencyAction has store, copy, drop {
        action_type: u8, // 0: pause, 1: unpause, 2: parameter change, 3: admin change
        timestamp: u64,
        initiated_by: address,
        executed_at: Option<u64>,
        executed: bool,
        parameters: vector<u8>
    }
    
    /// Enhanced bridge capability with multi-signature requirements
    struct EnhancedBridgeCapV2 has key {
        id: UID,
        authorized_evm_contracts: vector<vector<u8>>,
        // Enhanced fields for V2
        chain_configs: vector<ChainConfig>,
        threshold_signatures: vector<ThresholdKey>,
        message_nonces: Table<vector<u8>, u64>, // Chain ID => next nonce
        message_verification_methods: vector<u8>, // Bitfield of supported verification methods
        trusted_relayers: vector<address>,
        required_confirmations: Table<u64, u8>, // Chain ID => required confirmations
        max_message_size: u64,
        emergency_pause: bool
    }
    
    /// Configuration for a specific chain
    struct ChainConfig has store, copy, drop {
        chain_id: u64,
        bridge_address: vector<u8>,
        finality_blocks: u16,
        gas_price_oracle: vector<u8>,
        message_execution_gas_limit: u64,
        status: u8, // 0: inactive, 1: active, 2: paused, 3: deprecated
        supported_message_types: vector<u8>
    }
    
    /// Threshold signature key
    struct ThresholdKey has store, copy, drop {
        key_id: vector<u8>,
        public_key: vector<u8>,
        threshold: u8,
        participants: vector<address>,
        algorithm: String,
        created_at: u64,
        expires_at: u64,
        status: u8 // 0: pending, 1: active, 2: revoked, 3: expired
    }
    
    /// Enhanced identity verifier capability with multiple verification methods
    struct EnhancedIdentityVerifierCapV2 has key {
        id: UID,
        verifier_name: String,
        verification_count: u64,
        // Enhanced fields for V2
        supported_methods: vector<VerificationMethod>,
        trusted_issuers: vector<address>,
        verification_schemas: vector<VerificationSchema>,
        trust_anchors: vector<address>,
        revocation_registries: vector<RevocationRegistry>,
        selective_disclosure_templates: vector<SelectiveDisclosureTemplate>,
        delegation_chains: vector<DelegationChain>
    }
    
    /// Verification method supported by the verifier
    struct VerificationMethod has store, copy, drop {
        method_id: String,
        method_type: String, // "ZKP", "ECDSA", "Dilithium", etc.
        parameters: vector<u8>,
        active: bool,
        trust_level: u8 // 0-100
    }
    
    /// Schema for credential verification
    struct VerificationSchema has store, copy, drop {
        schema_id: String,
        schema_type: String,
        required_fields: vector<String>,
        optional_fields: vector<String>,
        version: String,
        active: bool
    }
    
    /// Registry for credential revocation
    struct RevocationRegistry has store, copy, drop {
        registry_id: String,
        registry_type: String, // "MerkleTree", "Accumulator", etc.
        issuer: address,
        last_updated: u64,
        registry_pointer: vector<u8>,
        active: bool
    }
    
    /// Template for selective disclosure proofs
    struct SelectiveDisclosureTemplate has store, copy, drop {
        template_id: String,
        schema_id: String,
        mandatory_disclosures: vector<String>,
        optional_disclosures: vector<String>,
        active: bool
    }
    
    /// Chain of delegated trust for verification
    struct DelegationChain has store, copy, drop {
        chain_id: String,
        root_authority: address,
        intermediaries: vector<address>,
        max_depth: u8,
        valid_until: u64,
        active: bool
    }
    
    /// Events
    struct EnhancedAssetCreatedV2 has copy, drop {
        asset_id: ID,
        owner: address,
        token_name: String,
        value: u64,
        identity_verified: bool,
        cross_chain_origins: vector<CrossChainOrigin>,
        risk_assessment: AiRiskAssessment,
        quantum_resistant: bool,
        timestamp: u64
    }
    
    struct AdvancedRiskScoreUpdated has copy, drop {
        asset_id: ID,
        old_score: u8,
        new_score: u8,
        risk_assessment: AiRiskAssessment,
        explanation: vector<FeatureImportance>,
        confidence: u8,
        timestamp: u64
    }
    
    struct EnhancedIdentityVerified has copy, drop {
        owner: address,
        verification_level: u8,
        method: String,
        trust_anchors: vector<address>,
        biometric_verified: bool,
        issuer: address,
        timestamp: u64
    }
    
    struct CollateralHealthChanged has copy, drop {
        asset_id: ID,
        old_health_index: u8,
        new_health_index: u8,
        is_collateral: bool,
        risk_factors: vector<FeatureImportance>,
        timestamp: u64
    }
    
    struct CrossChainMessageProcessed has copy, drop {
        message_id: ID,
        sender_chain: u64,
        receiver_chain: u64,
        sender: vector<u8>,
        message_type: String,
        nonce: u64,
        execution_status: u8,
        gas_used: u64,
        confirmations: u8,
        timestamp: u64
    }
    
    struct QuantumResistantProofVerified has copy, drop {
        asset_id: ID,
        algorithm: String,
        verification_status: u8,
        timestamp: u64
    }
    
    struct ProtocolOptimizationApplied has copy, drop {
        optimization_results: OptimizationResults,
        applied_by: address,
        previous_interest_rate: u64,
        previous_collateral_factor: u64,
        timestamp: u64
    }
    
    struct EmergencyActionTriggered has copy, drop {
        action_type: u8,
        triggered_by: address,
        reason: String,
        parameters: vector<u8>,
        timestamp: u64,
        timelock_ends: u64
    }
    
    /// Error codes
    const ENotAuthorized: u64 = 1;
    const EInvalidValue: u64 = 2;
    const EAssetNotFound: u64 = 3;
    const ERegistryNotInitialized: u64 = 4;
    const EInvalidRiskScore: u64 = 5;
    const EMessageAlreadyProcessed: u64 = 6;
    const EInvalidIdentityProof: u64 = 7;
    const EIdentityExpired: u64 = 8;
    const EIdentityRevoked: u64 = 9;
    const EInvalidSignature: u64 = 10;
    const EUnauthorizedEVMContract: u64 = 11;
    const ENonceReused: u64 = 12;
    const EInsufficientConfirmations: u64 = 13;
    const ECrossChainOriginNotVerified: u64 = 14;
    const EQuantumProofVerificationFailed: u64 = 15;
    const ELendingConstraintViolation: u64 = 16;
    const EThresholdSignatureInvalid: u64 = 17;
    const EInsufficientPermissions: u64 = 18;
    const EEmergencyPaused: u64 = 19;
    const ETimelockActive: u64 = 20;
    const EUnsupportedVerificationMethod: u64 = 21;
    const EBiometricVerificationRequired: u64 = 22;
    const EInvalidChainConfig: u64 = 23;
    
    // Permission constants for admin cap
    const PERMISSION_FULL_ADMIN: u16 = 0xFFFF;
    const PERMISSION_MANAGE_ASSETS: u16 = 0x0001;
    const PERMISSION_MANAGE_IDENTITY: u16 = 0x0002;
    const PERMISSION_MANAGE_BRIDGE: u16 = 0x0004;
    const PERMISSION_MANAGE_RISK: u16 = 0x0008;
    const PERMISSION_MANAGE_DELEGATES: u16 = 0x0010;
    const PERMISSION_EMERGENCY_PAUSE: u16 = 0x0020;
    const PERMISSION_PROTOCOL_PARAMS: u16 = 0x0040;
    const PERMISSION_FEE_MANAGEMENT: u16 = 0x0080;
    const PERMISSION_VIEW_ANALYTICS: u16 = 0x0100;
    
    /// Initialize the enhanced asset registry with advanced features
    fun init(ctx: &mut TxContext) {
        // Create enhanced registry with empty tables
        let registry = EnhancedAssetRegistryV2 {
            id: object::new(ctx),
            assets: table::new(ctx),
            user_assets: table::new(ctx),
            total_assets: 0,
            total_collateral_value: 0,
            verified_assets: table::new(ctx),
            risk_assessment_data: table::new(ctx),
            // Initialize enhanced fields
            asset_types: table::new(ctx),
            asset_ratings: table::new(ctx),
            cross_chain_assets: table::new(ctx),
            quantum_resistant_assets: table::new(ctx),
            user_risk_profiles: table::new(ctx),
            historical_data: table::new(ctx),
            lending_constraints: table::new(ctx),
            trusted_issuers: vector::empty<address>(),
            trust_score_thresholds: vector::empty<u8>(),
            interoperability_config: InteroperabilityConfig {
                supported_chains: vector::empty<SupportedChain>(),
                bridge_contracts: vector::empty<BridgeContract>(),
                min_confirmations: 5,
                fee_model: 1, // Percentage-based fees
                fee_amount: 25, // 0.25%
                protocol_version: string::utf8(b"1.0.0"),
                last_updated: tx_context::epoch(ctx)
            }
        };
        
        // Create enhanced lending stats
        let lending_stats = EnhancedLendingStatsV2 {
            id: object::new(ctx),
            total_borrowed: 0,
            total_deposited: 0,
            protocol_fee_balance: balance::zero(),
            user_count: 0,
            last_updated: tx_context::epoch(ctx),
            // Initialize enhanced fields
            total_borrowers: 0,
            total_lenders: 0,
            total_defaults: 0,
            total_liquidations: 0,
            cross_chain_volume: 0,
            average_loan_duration: 0,
            average_interest_rate: 500, // 5% in basis points
            asset_distribution: table::new(ctx),
            risk_band_distribution: table::new(ctx),
            historical_tvl: vector::empty<TimeValue>(),
            historical_borrow_volume: vector::empty<TimeValue>(),
            historical_repayment_volume: vector::empty<TimeValue>(),
            historical_default_rate: vector::empty<TimeValue>(),
            last_optimization_time: tx_context::epoch(ctx),
            optimization_results: OptimizationResults {
                timestamp: tx_context::epoch(ctx),
                optimal_interest_rate: 500, // 5% in basis points
                optimal_collateral_factor: 7500, // 75%
                expected_default_rate: 200, // 2%
                expected_utilization: 8000, // 80%
                confidence_score: 80,
                model_version: string::utf8(b"1.0.0"),
                applied: true
            }
        };
        
        // Create enhanced admin capability
        let admin_cap = EnhancedAdminCapV2 {
            id: object::new(ctx),
            admin_address: tx_context::sender(ctx),
            created_at: tx_context::epoch(ctx),
            last_used: tx_context::epoch(ctx),
            permissions: PERMISSION_FULL_ADMIN,
            delegates: table::new(ctx),
            delegation_history: vector::empty<DelegationEvent>(),
            max_delegates: 5,
            emergency_controls: EmergencyControls {
                pause_threshold: 2,
                unpause_threshold: 3,
                emergency_admins: vector::singleton(tx_context::sender(ctx)),
                emergency_timelock: 24 * 60 * 60, // 24 hours
                last_emergency: 0,
                emergency_actions: vector::empty<EmergencyAction>()
            }
        };
        
        // Create enhanced bridge capability
        let bridge_cap = EnhancedBridgeCapV2 {
            id: object::new(ctx),
            authorized_evm_contracts: vector::empty<vector<u8>>(),
            // Initialize enhanced fields
            chain_configs: vector::empty<ChainConfig>(),
            threshold_signatures: vector::empty<ThresholdKey>(),
            message_nonces: table::new(ctx),
            message_verification_methods: vector::singleton(1), // Default to ECDSA
            trusted_relayers: vector::singleton(tx_context::sender(ctx)),
            required_confirmations: table::new(ctx),
            max_message_size: 8192, // 8KB
            emergency_pause: false
        };
        
        // Create enhanced identity verifier capability
        let verifier_cap = EnhancedIdentityVerifierCapV2 {
            id: object::new(ctx),
            verifier_name: string::utf8(b"IOTA Advanced Protocol Verifier"),
            verification_count: 0,
            // Initialize enhanced fields
            supported_methods: vector::singleton(VerificationMethod {
                method_id: string::utf8(b"zkp_1"),
                method_type: string::utf8(b"ZKP"),
                parameters: vector::empty<u8>(),
                active: true,
                trust_level: 90
            }),
            trusted_issuers: vector::singleton(tx_context::sender(ctx)),
            verification_schemas: vector::empty<VerificationSchema>(),
            trust_anchors: vector::singleton(tx_context::sender(ctx)),
            revocation_registries: vector::empty<RevocationRegistry>(),
            selective_disclosure_templates: vector::empty<SelectiveDisclosureTemplate>(),
            delegation_chains: vector::empty<DelegationChain>()
        };
        
        // Transfer registry to shared object
        transfer::share_object(registry);
        
        // Transfer lending stats to shared object
        transfer::share_object(lending_stats);
        
        // Transfer admin capability to transaction sender
        transfer::transfer(admin_cap, tx_context::sender(ctx));
        
        // Transfer bridge capability to transaction sender
        transfer::transfer(bridge_cap, tx_context::sender(ctx));
        
        // Transfer verifier capability to transaction sender
        transfer::transfer(verifier_cap, tx_context::sender(ctx));
    }
    
    /// Create a new enhanced lending asset with advanced features
    public fun create_enhanced_asset_v2(
        account: &signer,
        registry: &mut EnhancedAssetRegistryV2,
        token_name: String,
        value: u64,
        asset_type: String,
        metadata: String,
        initial_risk_assessment: Option<AiRiskAssessment>,
        cross_chain_origins: Option<vector<CrossChainOrigin>>,
        quantum_resistant_data: Option<QuantumResistantSignature>,
        ctx: &mut TxContext
    ) {
        let sender = signer::address_of(account);
        
        // Default risk assessment if none provided
        let risk_assessment = if (option::is_some(&initial_risk_assessment)) {
            *option::borrow(&initial_risk_assessment)
        } else {
            AiRiskAssessment {
                overall_score: 50,
                repayment_score: 50,
                collateral_score: 50,
                volatility_score: 50,
                activity_score: 50,
                cross_chain_score: 50,
                identity_confidence: 50,
                market_correlation: 50,
                assessment_timestamp: tx_context::epoch(ctx),
                model_version: string::utf8(b"1.0.0"),
                confidence_score: 70,
                explainability_data: vector::empty<FeatureImportance>()
            }
        };
        
        // Default historical performance
        let default_history = HistoricalPerformance {
            repayments_on_time: 0,
            repayments_late: 0,
            defaults: 0,
            liquidations: 0,
            average_loan_duration: 0,
            total_borrowed: 0,
            total_repaid: 0,
            last_updated: tx_context::epoch(ctx)
        };
        
        // Create the enhanced asset
        let asset = EnhancedLendingAssetV2 {
            id: object::new(ctx),
            token_name,
            value,
            owner: sender,
            risk_score: risk_assessment.overall_score,
            is_collateral: false,
            creation_time: tx_context::epoch(ctx),
            last_updated: tx_context::epoch(ctx),
            identity_verified: false,
            identity_score: 0,
            credit_score: 650, // Default credit score
            zero_knowledge_proof: vector::empty<u8>(),
            metadata,
            // Enhanced fields
            cross_chain_origins: if (option::is_some(&cross_chain_origins)) {
                *option::borrow(&cross_chain_origins)
            } else {
                vector::empty<CrossChainOrigin>()
            },
            ai_risk_assessment: risk_assessment,
            quantum_resistant_signature: if (option::is_some(&quantum_resistant_data)) {
                *option::borrow(&quantum_resistant_data)
            } else {
                QuantumResistantSignature {
                    algorithm: string::utf8(b"None"),
                    public_key: vector::empty<u8>(),
                    signature: vector::empty<u8>(),
                    timestamp: 0,
                    valid_until: 0,
                    verification_status: 0
                }
            },
            collateral_health_index: 75, // Default good health
            historical_performance: default_history,
            lending_constraints: option::none()
        };
        
        let asset_id = object::id(&asset);
        
        // Register asset in registry
        table::add(&mut registry.assets, asset_id, sender);
        
        // Add to asset types table
        table::add(&mut registry.asset_types, asset_id, asset_type);
        
        // Add to ratings table (use risk score as initial rating)
        table::add(&mut registry.asset_ratings, asset_id, risk_assessment.overall_score);
        
        // Add to verified assets table (initially false)
        table::add(&mut registry.verified_assets, asset_id, false);
        
        // Add cross-chain data if provided
        if (!vector::is_empty(&asset.cross_chain_origins)) {
            table::add(&mut registry.cross_chain_assets, asset_id, asset.cross_chain_origins);
        };
        
        // Add quantum resistance status
        let is_quantum_resistant = asset.quantum_resistant_signature.verification_status == 2;
        table::add(&mut registry.quantum_resistant_assets, asset_id, is_quantum_resistant);
        
        // Add to user's assets
        if (!table::contains(&registry.user_assets, sender)) {
            table::add(&mut registry.user_assets, sender, vector::empty<ID>());
        };
        
        let user_assets = table::borrow_mut(&mut registry.user_assets, sender);
        vector::push_back(user_assets, asset_id);
        
        // Update user risk profile if needed
        if (!table::contains(&registry.user_risk_profiles, sender)) {
            table::add(&mut registry.user_risk_profiles, sender, risk_assessment);
        };
        
        // Update registry stats
        registry.total_assets = registry.total_assets + 1;
        
        // Emit event
        event::emit(EnhancedAssetCreatedV2 {
            asset_id,
            owner: sender,
            token_name: token_name,
            value,
            identity_verified: false,
            cross_chain_origins: asset.cross_chain_origins,
            risk_assessment: risk_assessment,
            quantum_resistant: is_quantum_resistant,
            timestamp: tx_context::epoch(ctx)
        });
        
        // Transfer asset to sender
        transfer::transfer(asset, sender);
    }
    
    /// Update AI risk assessment for an asset
    public fun update_risk_assessment(
        verifier: &signer,
        registry: &mut EnhancedAssetRegistryV2,
        asset: &mut EnhancedLendingAssetV2,
        new_assessment: AiRiskAssessment,
        verifier_cap: &EnhancedIdentityVerifierCapV2,
        ctx: &mut TxContext
    ) {
        // Check that the verifier has the capability
        assert!(object::is_owner(&verifier_cap.id, signer::address_of(verifier)), error::permission_denied(ENotAuthorized));
        
        // Store old values for event
        let old_score = asset.risk_score;
        
        // Update the asset risk data
        asset.risk_score = new_assessment.overall_score;
        asset.last_updated = tx_context::epoch(ctx);
        
        // Replace the entire risk assessment
        asset.ai_risk_assessment = new_assessment;
        
        // Update registry data
        if (table::contains(&registry.user_risk_profiles, asset.owner)) {
            *table::borrow_mut(&mut registry.user_risk_profiles, asset.owner) = new_assessment;
        } else {
            table::add(&mut registry.user_risk_profiles, asset.owner, new_assessment);
        };
        
        // Update asset rating in registry
        if (table::contains(&registry.asset_ratings, object::id(asset))) {
            *table::borrow_mut(&mut registry.asset_ratings, object::id(asset)) = new_assessment.overall_score;
        };
        
        // Emit event
        event::emit(AdvancedRiskScoreUpdated {
            asset_id: object::id(asset),
            old_score,
            new_score: new_assessment.overall_score,
            risk_assessment: new_assessment,
            explanation: new_assessment.explainability_data,
            confidence: new_assessment.confidence_score,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    /// Enhanced identity verification with multiple verification methods
    public fun verify_identity_enhanced(
        verifier: &signer,
        registry: &mut EnhancedAssetRegistryV2,
        asset: &mut EnhancedLendingAssetV2,
        identity_level: u8,
        verification_method: String,
        proof_hash: vector<u8>,
        biometric_verified: bool,
        trust_anchors: vector<address>,
        expiration_time: u64,
        verifier_cap: &mut EnhancedIdentityVerifierCapV2,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Check that the verifier has the capability
        assert!(object::is_owner(&verifier_cap.id, signer::address_of(verifier)), error::permission_denied(ENotAuthorized));
        
        // Check verification method is supported
        let method_supported = false;
        let i = 0;
        let methods_len = vector::length(&verifier_cap.supported_methods);
        
        while (i < methods_len) {
            let method = vector::borrow(&verifier_cap.supported_methods, i);
            if (method.method_id == verification_method && method.active) {
                method_supported = true;
                break;
            };
            i = i + 1;
        };
        
        assert!(method_supported, error::invalid_argument(EUnsupportedVerificationMethod));
        
        // Update the asset with identity verification
        asset.identity_verified = true;
        asset.zero_knowledge_proof = proof_hash;
        asset.identity_score = identity_level * 25; // Scale to 0-100
        asset.last_updated = tx_context::epoch(ctx);
        
        // Update AI risk assessment identity confidence
        let mut_assessment = &mut asset.ai_risk_assessment;
        mut_assessment.identity_confidence = identity_level * 25;
        mut_assessment.assessment_timestamp = tx_context::epoch(ctx);
        
        // Update registry's verified assets table
        let asset_id = object::id(asset);
        *table::borrow_mut(&mut registry.verified_assets, asset_id) = true;
        
        // Create an enhanced identity proof
        let identity_proof = EnhancedIdentityProof {
            id: object::new(ctx),
            owner: asset.owner,
            verification_level: identity_level,
            issuer: signer::address_of(verifier),
            issuance_time: clock::timestamp_ms(clock) / 1000, // Convert to seconds
            expiration_time,
            proof_hash,
            revoked: false,
            // Enhanced fields
            verification_method,
            credential_schema: string::utf8(b"standard_identity_v2"),
            trust_anchors,
            revocation_registry: option::none(),
            biometric_verification: biometric_verified,
            verification_context: vector::empty<u8>()
        };
        
        // Increment verification count
        verifier_cap.verification_count = verifier_cap.verification_count + 1;
        
        // Emit event
        event::emit(EnhancedIdentityVerified {
            owner: asset.owner,
            verification_level: identity_level,
            method: verification_method,
            trust_anchors,
            biometric_verified,
            issuer: signer::address_of(verifier),
            timestamp: tx_context::epoch(ctx)
        });
        
        // Transfer identity proof to the asset owner
        transfer::transfer(identity_proof, asset.owner);
    }
    
    /// Update collateral health with enhanced risk factors
    public fun update_collateral_health(
        account: &signer,
        registry: &mut EnhancedAssetRegistryV2,
        asset: &mut EnhancedLendingAssetV2,
        new_health_index: u8,
        is_collateral: bool,
        risk_factors: vector<FeatureImportance>,
        ctx: &mut TxContext
    ) {
        // Check ownership
        assert!(asset.owner == signer::address_of(account), error::permission_denied(ENotAuthorized));
        
        // Update collateral status
        let old_health_index = asset.collateral_health_index;
        asset.collateral_health_index = new_health_index;
        asset.is_collateral = is_collateral;
        asset.last_updated = tx_context::epoch(ctx);
        
        // Update the AI risk assessment
        let mut_assessment = &mut asset.ai_risk_assessment;
        mut_assessment.collateral_score = new_health_index;
        mut_assessment.assessment_timestamp = tx_context::epoch(ctx);
        
        // Update risk explanation data
        mut_assessment.explainability_data = risk_factors;
        
        // Update registry stats if status changed
        if (!asset.is_collateral && is_collateral) {
            registry.total_collateral_value = registry.total_collateral_value + asset.value;
        } else if (asset.is_collateral && !is_collateral) {
            // Ensure we don't underflow
            if (registry.total_collateral_value >= asset.value) {
                registry.total_collateral_value = registry.total_collateral_value - asset.value;
            } else {
                registry.total_collateral_value = 0;
            };
        };
        
        // Emit event
        event::emit(CollateralHealthChanged {
            asset_id: object::id(asset),
            old_health_index,
            new_health_index,
            is_collateral,
            risk_factors,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    /// Process cross-chain message with enhanced security
    public fun process_cross_chain_message(
        message: &mut EnhancedCrossLayerMessageV2,
        registry: &mut EnhancedAssetRegistryV2,
        bridge_cap: &EnhancedBridgeCapV2,
        lending_stats: &mut EnhancedLendingStatsV2,
        ctx: &mut TxContext
    ) {
        // Check if already processed
        assert!(!message.processed, error::invalid_argument(EMessageAlreadyProcessed));
        
        // Verify the sender is an authorized contract for the source chain
        let is_authorized = false;
        let found_chain_config = false;
        let i = 0;
        let len = vector::length(&bridge_cap.chain_configs);
        
        while (i < len) {
            let config = vector::borrow(&bridge_cap.chain_configs, i);
            if (config.chain_id == message.source_chain_id && config.status == 1) {
                found_chain_config = true;
                
                // Check if the sender contract is authorized
                let j = 0;
                let contract_len = vector::length(&bridge_cap.authorized_evm_contracts);
                
                while (j < contract_len) {
                    if (*vector::borrow(&bridge_cap.authorized_evm_contracts, j) == message.sender) {
                        is_authorized = true;
                        break;
                    };
                    j = j + 1;
                };
                
                break;
            };
            i = i + 1;
        };
        
        assert!(found_chain_config, error::invalid_argument(EInvalidChainConfig));
        assert!(is_authorized, error::permission_denied(EUnauthorizedEVMContract));
        
        // Check if emergency paused
        assert!(!bridge_cap.emergency_pause, error::permission_denied(EEmergencyPaused));
        
        // Check confirmations
        if (table::contains(&bridge_cap.required_confirmations, message.source_chain_id)) {
            let required = *table::borrow(&bridge_cap.required_confirmations, message.source_chain_id);
            assert!(message.current_confirmations >= required, error::invalid_argument(EInsufficientConfirmations));
        } else {
            // Use default minimum confirmations
            assert!(message.current_confirmations >= registry.interoperability_config.min_confirmations, 
                   error::invalid_argument(EInsufficientConfirmations));
        };
        
        // Verify signature (in a real implementation, this would use proper signature verification)
        // Here we just check it's not empty
        assert!(!vector::is_empty(&message.signature), error::invalid_argument(EInvalidSignature));
        
        // Mark as processed
        message.processed = true;
        message.execution_status = 1; // Set to executed
        
        // Process different message types
        if (string::to_ascii(message.message_type) == string::to_ascii(string::utf8(b"RISK_SCORE_UPDATE"))) {
            process_risk_score_update(message, registry, bridge_cap, ctx);
        } else if (string::to_ascii(message.message_type) == string::to_ascii(string::utf8(b"COLLATERAL_CHANGE"))) {
            process_collateral_change(message, registry, bridge_cap, ctx);
        } else if (string::to_ascii(message.message_type) == string::to_ascii(string::utf8(b"LIQUIDATION"))) {
            process_liquidation(message, registry, bridge_cap, lending_stats, ctx);
        } else if (string::to_ascii(message.message_type) == string::to_ascii(string::utf8(b"CROSS_CHAIN_ASSET"))) {
            process_cross_chain_asset(message, registry, bridge_cap, ctx);
        } else if (string::to_ascii(message.message_type) == string::to_ascii(string::utf8(b"IDENTITY_VERIFICATION"))) {
            process_identity_verification(message, registry, bridge_cap, ctx);
        };
        
        // Track cross-chain volume in stats
        lending_stats.cross_chain_volume = lending_stats.cross_chain_volume + 1;
        
        // Update last updated timestamp
        lending_stats.last_updated = tx_context::epoch(ctx);
        
        // Emit event
        event::emit(CrossChainMessageProcessed {
            message_id: object::id(message),
            sender_chain: message.source_chain_id,
            receiver_chain: message.destination_chain_id,
            sender: message.sender,
            message_type: message.message_type,
            nonce: message.nonce,
            execution_status: message.execution_status,
            gas_used: 0, // Would be calculated in a real implementation
            confirmations: message.current_confirmations,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    /// Process a risk score update message
    fun process_risk_score_update(
        message: &EnhancedCrossLayerMessageV2,
        registry: &mut EnhancedAssetRegistryV2,
        bridge_cap: &EnhancedBridgeCapV2,
        ctx: &mut TxContext
    ) {
        // In a real implementation, we would properly parse the payload
        // For this example, we extract basic information
        
        // Extract user address bytes (first 20 bytes)
        let payload = message.payload;
        let address_bytes = extract_bytes(&payload, 0, 20);
        
        // Extract risk score (byte 21)
        let risk_score = if (vector::length(&payload) > 20) {
            *vector::borrow(&payload, 20)
        } else {
            50 // Default score
        };
        
        // Extract assessment data if available (remaining bytes)
        let assessment_data = if (vector::length(&payload) > 21) {
            let mut_data = vector::empty<u8>();
            let i = 21;
            let len = vector::length(&payload);
            while (i < len) {
                vector::push_back(&mut mut_data, *vector::borrow(&payload, i));
                i = i + 1;
            };
            mut_data
        } else {
            vector::empty<u8>()
        };
        
        // Convert address bytes to address
        let user_address = convert_bytes_to_address(address_bytes);
        
        // Update user risk profile if it exists
        if (table::contains(&registry.user_risk_profiles, user_address)) {
            let risk_profile = table::borrow_mut(&mut registry.user_risk_profiles, user_address);
            risk_profile.overall_score = risk_score;
            risk_profile.assessment_timestamp = tx_context::epoch(ctx);
            
            // In a real implementation, we would parse and update more fields here
            // based on the detailed assessment data
        };
    }
    
    /// Process a collateral change message
    fun process_collateral_change(
        message: &EnhancedCrossLayerMessageV2,
        registry: &mut EnhancedAssetRegistryV2,
        bridge_cap: &EnhancedBridgeCapV2,
        ctx: &mut TxContext
    ) {
        // Similar to risk_score_update, but handling collateral data
        // Implementation would extract and process collateral information
    }
    
    /// Process a liquidation message
    fun process_liquidation(
        message: &EnhancedCrossLayerMessageV2,
        registry: &mut EnhancedAssetRegistryV2,
        bridge_cap: &EnhancedBridgeCapV2,
        lending_stats: &mut EnhancedLendingStatsV2,
        ctx: &mut TxContext
    ) {
        // Extract borrower address bytes (first 20 bytes)
        let payload = message.payload;
        let address_bytes = extract_bytes(&payload, 0, 20);
        
        // Convert address bytes to address
        let borrower_address = convert_bytes_to_address(address_bytes);
        
        // Update user risk profile if it exists - increase risk score after liquidation
        if (table::contains(&registry.user_risk_profiles, borrower_address)) {
            let risk_profile = table::borrow_mut(&mut registry.user_risk_profiles, borrower_address);
            // Increase risk after liquidation (capped at 100)
            risk_profile.overall_score = min(risk_profile.overall_score + 15, 100);
            risk_profile.assessment_timestamp = tx_context::epoch(ctx);
        };
        
        // Update historical performance if it exists
        if (table::contains(&registry.historical_data, borrower_address)) {
            let history = table::borrow_mut(&mut registry.historical_data, borrower_address);
            history.liquidations = history.liquidations + 1;
            history.last_updated = tx_context::epoch(ctx);
        };
        
        // Update lending stats
        lending_stats.total_liquidations = lending_stats.total_liquidations + 1;
        
        // Update default rate history
        let current_default_rate = calculate_default_rate(lending_stats.total_liquidations, lending_stats.total_borrowers);
        vector::push_back(&mut lending_stats.historical_default_rate, TimeValue {
            timestamp: tx_context::epoch(ctx),
            value: current_default_rate
        });
    }
    
    /// Process a cross-chain asset message
    fun process_cross_chain_asset(
        message: &EnhancedCrossLayerMessageV2,
        registry: &mut EnhancedAssetRegistryV2,
        bridge_cap: &EnhancedBridgeCapV2,
        ctx: &mut TxContext
    ) {
        // Implementation would handle cross-chain asset transfers
        // - Creating or updating cross-chain asset records
        // - Verifying asset provenance
        // - Managing cross-chain state
    }
    
    /// Process an identity verification message
    fun process_identity_verification(
        message: &EnhancedCrossLayerMessageV2,
        registry: &mut EnhancedAssetRegistryV2,
        bridge_cap: &EnhancedBridgeCapV2,
        ctx: &mut TxContext
    ) {
        // Implementation would handle identity verification updates from other chains
        // - Updating verification status
        // - Managing trust anchors
        // - Handling revocations
    }
    
    /// Utility function to extract a slice of bytes
    fun extract_bytes(bytes: &vector<u8>, start: u64, len: u64): vector<u8> {
        let result = vector::empty<u8>();
        let i = 0;
        let end = min(start + len, vector::length(bytes));
        
        while (start + i < end) {
            vector::push_back(&mut result, *vector::borrow(bytes, start + i));
            i = i + 1;
        };
        
        result
    }
    
    /// Calculate default rate as a percentage (multiplied by 100)
    fun calculate_default_rate(liquidations: u64, total_borrowers: u64): u64 {
        if (total_borrowers == 0) {
            return 0
        };
        
        // Multiply by 10000 for precision, then divide by total
        (liquidations * 10000) / total_borrowers
    }
    
    /// Verify quantum-resistant proof
    public fun verify_quantum_resistant_proof(
        asset: &mut EnhancedLendingAssetV2,
        verification_status: u8,
        ctx: &mut TxContext
    ): bool {
        // In a real implementation, this would perform actual cryptographic verification
        // For this example, we just update the status
        
        let signature = &mut asset.quantum_resistant_signature;
        signature.verification_status = verification_status;
        
        let is_valid = verification_status == 2; // 2 means verified
        
        // Emit verification event
        event::emit(QuantumResistantProofVerified {
            asset_id: object::id(asset),
            algorithm: signature.algorithm,
            verification_status,
            timestamp: tx_context::epoch(ctx)
        });
        
        is_valid
    }
    
    /// Set lending constraints for an asset
    public fun set_lending_constraints(
        admin: &signer,
        asset: &mut EnhancedLendingAssetV2,
        max_borrow_amount: u64,
        min_collateral_ratio: u8,
        interest_rate_cap: u8,
        max_loan_duration: u64,
        allowed_liquidation_chains: vector<u64>,
        restricted_usage: bool,
        cooldown_period: u64,
        admin_cap: &EnhancedAdminCapV2
    ) {
        // Check that the admin has the capability
        assert!(object::is_owner(&admin_cap.id, signer::address_of(admin)), error::permission_denied(ENotAuthorized));
        assert!(has_permission(admin_cap, signer::address_of(admin), PERMISSION_MANAGE_RISK), error::permission_denied(EInsufficientPermissions));
        
        // Set constraints
        let constraints = LendingConstraints {
            max_borrow_amount,
            min_collateral_ratio,
            interest_rate_cap,
            max_loan_duration,
            allowed_liquidation_chains,
            restricted_usage,
            cooldown_period
        };
        
        // Update the asset
        asset.lending_constraints = option::some(constraints);
    }
    
    /// Check if an address has a specific permission
    fun has_permission(admin_cap: &EnhancedAdminCapV2, addr: address, permission: u16): bool {
        if (addr == admin_cap.admin_address) {
            // Admin has all permissions
            return true
        };
        
        // Check delegate permissions
        if (table::contains(&admin_cap.delegates, addr)) {
            let perms = *table::borrow(&admin_cap.delegates, addr);
            return (perms & permission) == permission
        };
        
        false
    }
    
    /// Apply protocol optimization results
    public fun apply_optimization_results(
        admin: &signer,
        lending_stats: &mut EnhancedLendingStatsV2,
        admin_cap: &EnhancedAdminCapV2,
        ctx: &mut TxContext
    ) {
        // Check admin permissions
        assert!(object::is_owner(&admin_cap.id, signer::address_of(admin)), error::permission_denied(ENotAuthorized));
        assert!(has_permission(admin_cap, signer::address_of(admin), PERMISSION_PROTOCOL_PARAMS), error::permission_denied(EInsufficientPermissions));
        
        // Store previous values
        let previous_interest_rate = lending_stats.average_interest_rate;
        let previous_collateral_factor = 7500; // Placeholder - would come from protocol params
        
        // Mark as applied
        lending_stats.optimization_results.applied = true;
        
        // Update average interest rate
        lending_stats.average_interest_rate = lending_stats.optimization_results.optimal_interest_rate;
        
        // Update timestamps
        lending_stats.last_optimization_time = tx_context::epoch(ctx);
        lending_stats.last_updated = tx_context::epoch(ctx);
        
        // Emit event
        event::emit(ProtocolOptimizationApplied {
            optimization_results: lending_stats.optimization_results,
            applied_by: signer::address_of(admin),
            previous_interest_rate,
            previous_collateral_factor,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    /// Trigger emergency action
    public fun trigger_emergency_action(
        admin: &signer,
        action_type: u8,
        reason: String,
        parameters: vector<u8>,
        admin_cap: &mut EnhancedAdminCapV2,
        ctx: &mut TxContext
    ) {
        // Check if admin is an emergency admin
        let admin_addr = signer::address_of(admin);
        let is_emergency_admin = false;
        let i = 0;
        let len = vector::length(&admin_cap.emergency_controls.emergency_admins);
        
        while (i < len) {
            if (*vector::borrow(&admin_cap.emergency_controls.emergency_admins, i) == admin_addr) {
                is_emergency_admin = true;
                break;
            };
            i = i + 1;
        };
        
        assert!(is_emergency_admin, error::permission_denied(ENotAuthorized));
        
        // Create emergency action
        let emergency_action = EmergencyAction {
            action_type,
            timestamp: tx_context::epoch(ctx),
            initiated_by: admin_addr,
            executed_at: option::none(),
            executed: false,
            parameters
        };
        
        // Add to emergency actions
        vector::push_back(&mut admin_cap.emergency_controls.emergency_actions, emergency_action);
        
        // Update last emergency time
        admin_cap.emergency_controls.last_emergency = tx_context::epoch(ctx);
        
        // Emit event
        event::emit(EmergencyActionTriggered {
            action_type,
            triggered_by: admin_addr,
            reason,
            parameters,
            timestamp: tx_context::epoch(ctx),
            timelock_ends: tx_context::epoch(ctx) + admin_cap.emergency_controls.emergency_timelock
        });
    }
    
    /// Add a chain configuration
    public fun add_chain_config(
        admin: &signer,
        bridge_cap: &mut EnhancedBridgeCapV2,
        chain_id: u64,
        bridge_address: vector<u8>,
        finality_blocks: u16,
        gas_price_oracle: vector<u8>,
        gas_limit: u64,
        status: u8,
        message_types: vector<u8>,
        required_confirmations: u8,
        admin_cap: &EnhancedAdminCapV2
    ) {
        // Check admin permissions
        assert!(object::is_owner(&admin_cap.id, signer::address_of(admin)), error::permission_denied(ENotAuthorized));
        assert!(has_permission(admin_cap, signer::address_of(admin), PERMISSION_MANAGE_BRIDGE), error::permission_denied(EInsufficientPermissions));
        
        // Add chain config
        let config = ChainConfig {
            chain_id,
            bridge_address,
            finality_blocks,
            gas_price_oracle,
            message_execution_gas_limit: gas_limit,
            status,
            supported_message_types: message_types
        };
        
        // Check if config already exists
        let i = 0;
        let len = vector::length(&bridge_cap.chain_configs);
        let exists = false;
        
        while (i < len) {
            let existing_config = vector::borrow(&bridge_cap.chain_configs, i);
            if (existing_config.chain_id == chain_id) {
                exists = true;
                break;
            };
            i = i + 1;
        };
        
        if (exists) {
            // Replace existing config
            *vector::borrow_mut(&mut bridge_cap.chain_configs, i) = config;
        } else {
            // Add new config
            vector::push_back(&mut bridge_cap.chain_configs, config);
        };
        
        // Add required confirmations
        if (table::contains(&bridge_cap.required_confirmations, chain_id)) {
            *table::borrow_mut(&mut bridge_cap.required_confirmations, chain_id) = required_confirmations;
        } else {
            table::add(&mut bridge_cap.required_confirmations, chain_id, required_confirmations);
        };
    }
    
    /// Utility: Convert bytes to address
    fun convert_bytes_to_address(bytes: vector<u8>): address {
        // In a real implementation, this would properly convert bytes to address
        // For simplicity, we're using a dummy address
        @0x1
    }
    
    /// Utility: Get minimum of two u64s
    fun min(a: u64, b: u64): u64 {
        if (a < b) { a } else { b }
    }
    
    /// Calculate credit risk score with enhanced features
    public fun calculate_credit_risk_score_enhanced(
        asset: &EnhancedLendingAssetV2,
        on_chain_data: vector<u8>,
        risk_assessment: AiRiskAssessment,
        cross_chain_data: Option<vector<CrossChainOrigin>>,
        identity_confidence: u8
    ): u16 {
        // Base credit score
        let credit_score = asset.credit_score;
        
        // Apply AI risk assessment
        let risk_adjustment = 0;
        
        // Lower is better for risk score
        if (risk_assessment.overall_score < 30) {
            risk_adjustment = 50; // Big boost for very low risk
        } else if (risk_assessment.overall_score < 50) {
            risk_adjustment = 25; // Moderate boost for low risk
        } else if (risk_assessment.overall_score > 80) {
            risk_adjustment = -50; // Big penalty for very high risk
        } else if (risk_assessment.overall_score > 60) {
            risk_adjustment = -25; // Moderate penalty for high risk
        };
        
        // Apply cross-chain data if available
        let cross_chain_adjustment = 0;
        if (option::is_some(&cross_chain_data)) {
            let origins = option::borrow(&cross_chain_data);
            let verified_origins = 0;
            let i = 0;
            let len = vector::length(origins);
            
            while (i < len) {
                let origin = vector::borrow(origins, i);
                if (origin.verification_status == 2) { // 2 = verified
                    verified_origins = verified_origins + 1;
                };
                i = i + 1;
            };
            
            // Bonus for verified cross-chain history
            if (verified_origins > 0) {
                cross_chain_adjustment = 15;
            };
        };
        
        // Apply identity confidence
        let identity_adjustment = 0;
        if (identity_confidence > 80) {
            identity_adjustment = 25; // Strong identity verification
        } else if (identity_confidence > 50) {
            identity_adjustment = 10; // Moderate identity verification
        };
        
        // Apply historical performance
        let history_adjustment = 0;
        if (asset.historical_performance.defaults > 0) {
            history_adjustment = -50 * (asset.historical_performance.defaults as u16); // Severe penalty for defaults
        } else if (asset.historical_performance.repayments_on_time > 5) {
            history_adjustment = 20; // Bonus for consistent repayments
        };
        
        // Calculate collateral health adjustment
        let collateral_adjustment = 0;
        if (asset.is_collateral && asset.collateral_health_index > 80) {
            collateral_adjustment = 15; // Bonus for high-quality collateral
        } else if (asset.is_collateral && asset.collateral_health_index < 50) {
            collateral_adjustment = -15; // Penalty for low-quality collateral
        };
        
        // Apply quantum resistance bonus
        let quantum_bonus = 0;
        if (asset.quantum_resistant_signature.verification_status == 2) { // 2 = verified
            quantum_bonus = 10; // Bonus for quantum resistance
        };
        
        // Combine all adjustments
        let total_adjustment = (risk_adjustment as u16) + 
                            (cross_chain_adjustment as u16) + 
                            (identity_adjustment as u16) + 
                            history_adjustment + 
                            (collateral_adjustment as u16) + 
                            (quantum_bonus as u16);
        
        // Apply adjustment to credit score with bounds checking
        let new_score = if (total_adjustment > 0) {
            if (credit_score > 850 - (total_adjustment as u16)) {
                850
            } else {
                credit_score + (total_adjustment as u16)
            }
        } else {
            let abs_adjustment = if (total_adjustment < 0) {
                (0 - total_adjustment) as u16
            } else {
                0
            };
            
            if (credit_score < 300 + abs_adjustment) {
                300
            } else {
                credit_score - abs_adjustment
            }
        };
        
        new_score
    }
    
    /// Get enhanced asset data by ID
    public fun get_enhanced_asset_data(
        registry: &EnhancedAssetRegistryV2,
        asset_id: ID
    ): (
        address, // owner
        bool,    // is_verified
        u8,      // asset_rating
        String,  // asset_type
        bool,    // is_quantum_resistant
        vector<CrossChainOrigin> // cross_chain_origins
    ) {
        let owner = *table::borrow(&registry.assets, asset_id);
        let is_verified = *table::borrow(&registry.verified_assets, asset_id);
        let asset_rating = *table::borrow(&registry.asset_ratings, asset_id);
        let asset_type = *table::borrow(&registry.asset_types, asset_id);
        let is_quantum_resistant = *table::borrow(&registry.quantum_resistant_assets, asset_id);
        
        let cross_chain_origins = if (table::contains(&registry.cross_chain_assets, asset_id)) {
            *table::borrow(&registry.cross_chain_assets, asset_id)
        } else {
            vector::empty<CrossChainOrigin>()
        };
        
        (
            owner,
            is_verified,
            asset_rating,
            asset_type,
            is_quantum_resistant,
            cross_chain_origins
        )
    }
    
    /// Get user risk profile
    public fun get_user_risk_profile(
        registry: &EnhancedAssetRegistryV2,
        user: address
    ): AiRiskAssessment {
        if (table::contains(&registry.user_risk_profiles, user)) {
            *table::borrow(&registry.user_risk_profiles, user)
        } else {
            // Return default profile
            AiRiskAssessment {
                overall_score: 50,
                repayment_score: 50,
                collateral_score: 50,
                volatility_score: 50,
                activity_score: 50,
                cross_chain_score: 50,
                identity_confidence: 50,
                market_correlation: 50,
                assessment_timestamp: 0,
                model_version: string::utf8(b"default"),
                confidence_score: 70,
                explainability_data: vector::empty<FeatureImportance>()
            }
        }
    }
    
    /// Get user historical performance
    public fun get_user_historical_performance(
        registry: &EnhancedAssetRegistryV2,
        user: address
    ): HistoricalPerformance {
        if (table::contains(&registry.historical_data, user)) {
            *table::borrow(&registry.historical_data, user)
        } else {
            // Return default history
            HistoricalPerformance {
                repayments_on_time: 0,
                repayments_late: 0,
                defaults: 0,
                liquidations: 0,
                average_loan_duration: 0,
                total_borrowed: 0,
                total_repaid: 0,
                last_updated: 0
            }
        }
    }
    
    /// Get protocol optimization results
    public fun get_protocol_optimization_results(
        lending_stats: &EnhancedLendingStatsV2
    ): (
        u64, // timestamp
        u64, // optimal interest rate
        u64, // optimal collateral factor
        u64, // expected default rate
        u64, // expected utilization
        u8,  // confidence score
        bool // applied
    ) {
        let results = &lending_stats.optimization_results;
        (
            results.timestamp,
            results.optimal_interest_rate,
            results.optimal_collateral_factor,
            results.expected_default_rate,
            results.expected_utilization,
            results.confidence_score,
            results.applied
        )
    }
    
    /// Get supported chains for cross-chain operations
    public fun get_supported_chains(
        registry: &EnhancedAssetRegistryV2
    ): vector<SupportedChain> {
        registry.interoperability_config.supported_chains
    }
}
