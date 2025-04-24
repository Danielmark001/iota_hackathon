module intellilend::asset {
    use std::error;
    use std::signer;
    use std::string::{Self, String};
    use std::vector;
    
    // Add imports for object and transfer modules
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::table::{Self, Table};
    use sui::coin::{Self, Coin};
    
    /// Resource representing a lending asset
    struct LendingAsset has key, store {
        id: UID,
        token_name: String,
        value: u64,
        owner: address,
        risk_score: u8,
        is_collateral: bool,
        creation_time: u64,
        last_updated: u64
    }
    
    /// Cross-layer message from EVM
    struct CrossLayerMessage has key, store {
        id: UID,
        sender: vector<u8>, // EVM address in bytes
        message_type: String,
        payload: vector<u8>,
        timestamp: u64,
        processed: bool
    }
    
    /// Asset Registry to track all assets
    struct AssetRegistry has key {
        id: UID,
        assets: Table<ID, address>,
        user_assets: Table<address, vector<ID>>,
        total_assets: u64,
        total_collateral_value: u64
    }
    
    /// Capability to manage the registry
    struct RegistryAdminCap has key {
        id: UID
    }
    
    /// Bridge capability for cross-layer operations
    struct BridgeAdminCap has key {
        id: UID
    }
    
    /// Events
    struct AssetCreated has copy, drop {
        asset_id: ID,
        owner: address,
        token_name: String,
        value: u64,
        timestamp: u64
    }
    
    struct RiskScoreUpdated has copy, drop {
        asset_id: ID,
        old_score: u8,
        new_score: u8,
        timestamp: u64
    }
    
    struct CollateralStatusChanged has copy, drop {
        asset_id: ID,
        is_collateral: bool,
        timestamp: u64
    }
    
    struct MessageReceived has copy, drop {
        message_id: ID,
        sender: vector<u8>,
        message_type: String,
        timestamp: u64
    }
    
    /// Error codes
    const ENotAuthorized: u64 = 1;
    const EInvalidValue: u64 = 2;
    const EAssetNotFound: u64 = 3;
    const ERegistryNotInitialized: u64 = 4;
    const EInvalidRiskScore: u64 = 5;
    const EMessageAlreadyProcessed: u64 = 6;
    
    /// Initialize the asset registry
    fun init(ctx: &mut TxContext) {
        // Create registry with empty tables
        let registry = AssetRegistry {
            id: object::new(ctx),
            assets: table::new(ctx),
            user_assets: table::new(ctx),
            total_assets: 0,
            total_collateral_value: 0
        };
        
        // Create admin capability
        let admin_cap = RegistryAdminCap {
            id: object::new(ctx)
        };
        
        // Create bridge admin capability
        let bridge_cap = BridgeAdminCap {
            id: object::new(ctx)
        };
        
        // Transfer registry to shared object
        transfer::share_object(registry);
        
        // Transfer admin capability to transaction sender
        transfer::transfer(admin_cap, tx_context::sender(ctx));
        
        // Transfer bridge capability to transaction sender
        transfer::transfer(bridge_cap, tx_context::sender(ctx));
    }
    
    /// Create a new lending asset
    public fun create_asset(
        account: &signer,
        registry: &mut AssetRegistry,
        token_name: String,
        value: u64,
        ctx: &mut TxContext
    ) {
        let sender = signer::address_of(account);
        
        // Create the asset
        let asset = LendingAsset {
            id: object::new(ctx),
            token_name,
            value,
            owner: sender,
            risk_score: 50, // Default risk score (0-100)
            is_collateral: false,
            creation_time: tx_context::epoch(ctx),
            last_updated: tx_context::epoch(ctx)
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
        
        // Update registry stats
        registry.total_assets = registry.total_assets + 1;
        
        // Emit event
        event::emit(AssetCreated {
            asset_id,
            owner: sender,
            token_name: token_name,
            value,
            timestamp: tx_context::epoch(ctx)
        });
        
        // Transfer asset to sender
        transfer::transfer(asset, sender);
    }
    
    /// Mark an asset as collateral
    public fun mark_as_collateral(
        account: &signer,
        registry: &mut AssetRegistry,
        asset: &mut LendingAsset,
        ctx: &mut TxContext
    ) {
        // Check ownership
        assert!(asset.owner == signer::address_of(account), error::permission_denied(ENotAuthorized));
        
        // Update collateral status
        let old_status = asset.is_collateral;
        asset.is_collateral = true;
        asset.last_updated = tx_context::epoch(ctx);
        
        // Update registry stats if status changed
        if (!old_status) {
            registry.total_collateral_value = registry.total_collateral_value + asset.value;
        };
        
        // Emit event
        event::emit(CollateralStatusChanged {
            asset_id: object::id(asset),
            is_collateral: true,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    /// Unmark an asset as collateral
    public fun unmark_as_collateral(
        account: &signer,
        registry: &mut AssetRegistry,
        asset: &mut LendingAsset,
        ctx: &mut TxContext
    ) {
        // Check ownership
        assert!(asset.owner == signer::address_of(account), error::permission_denied(ENotAuthorized));
        
        // Update collateral status
        let old_status = asset.is_collateral;
        asset.is_collateral = false;
        asset.last_updated = tx_context::epoch(ctx);
        
        // Update registry stats if status changed
        if (old_status) {
            registry.total_collateral_value = registry.total_collateral_value - asset.value;
        };
        
        // Emit event
        event::emit(CollateralStatusChanged {
            asset_id: object::id(asset),
            is_collateral: false,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    /// Update the risk score of an asset
    public fun update_risk_score(
        asset: &mut LendingAsset,
        new_score: u8,
        _cap: &BridgeAdminCap,
        ctx: &mut TxContext
    ) {
        // Ensure score is valid
        assert!(new_score <= 100, error::invalid_argument(EInvalidRiskScore));
        
        let old_score = asset.risk_score;
        asset.risk_score = new_score;
        asset.last_updated = tx_context::epoch(ctx);
        
        // Emit event
        event::emit(RiskScoreUpdated {
            asset_id: object::id(asset),
            old_score,
            new_score,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    /// Get the current risk score of an asset
    public fun get_risk_score(asset: &LendingAsset): u8 {
        asset.risk_score
    }
    
    /// Transfer ownership of an asset
    public fun transfer_asset(
        account: &signer,
        registry: &mut AssetRegistry,
        asset: &mut LendingAsset,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let sender = signer::address_of(account);
        
        // Check ownership
        assert!(asset.owner == sender, error::permission_denied(ENotAuthorized));
        
        // Update asset
        asset.owner = recipient;
        asset.last_updated = tx_context::epoch(ctx);
        
        // Update registry
        let asset_id = object::id(asset);
        *table::borrow_mut(&mut registry.assets, asset_id) = recipient;
        
        // Remove from sender's assets
        let sender_assets = table::borrow_mut(&mut registry.user_assets, sender);
        let (found, index) = vector::index_of(sender_assets, &asset_id);
        if (found) {
            vector::remove(sender_assets, index);
        };
        
        // Add to recipient's assets
        if (!table::contains(&registry.user_assets, recipient)) {
            table::add(&mut registry.user_assets, recipient, vector::empty<ID>());
        };
        
        let recipient_assets = table::borrow_mut(&mut registry.user_assets, recipient);
        vector::push_back(recipient_assets, asset_id);
    }
    
    /// Process a message from Layer 2 (EVM)
    public fun process_cross_layer_message(
        message: &mut CrossLayerMessage,
        registry: &mut AssetRegistry,
        cap: &BridgeAdminCap,
        ctx: &mut TxContext
    ) {
        // Check if already processed
        assert!(!message.processed, error::invalid_argument(EMessageAlreadyProcessed));
        
        // Mark as processed
        message.processed = true;
        
        // Process different message types
        if (string::to_ascii(message.message_type) == string::to_ascii(string::utf8(b"RISK_SCORE_UPDATE"))) {
            process_risk_score_update(message, registry, cap, ctx);
        } else if (string::to_ascii(message.message_type) == string::to_ascii(string::utf8(b"COLLATERAL_CHANGE"))) {
            process_collateral_change(message, registry, cap, ctx);
        } else if (string::to_ascii(message.message_type) == string::to_ascii(string::utf8(b"LIQUIDATION"))) {
            process_liquidation(message, registry, cap, ctx);
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
        // In a real implementation, we would use proper deserialization
        // For simplicity, we're assuming the payload format:
        // [address (20 bytes), score (1 byte)]
        
        let payload = message.payload;
        assert!(vector::length(&payload) >= 21, error::invalid_argument(EInvalidValue));
        
        // Extract address (first 20 bytes)
        let address_bytes = vector::empty<u8>();
        let i = 0;
        while (i < 20) {
            vector::push_back(&mut address_bytes, *vector::borrow(&payload, i));
            i = i + 1;
        };
        
        // Convert to address
        let user_address = convert_bytes_to_address(address_bytes);
        
        // Extract risk score (byte 21)
        let risk_score = *vector::borrow(&payload, 20);
        
        // Update risk scores for all user assets
        // In a real implementation, we would have more sophisticated targeting
        if (table::contains(&registry.user_assets, user_address)) {
            let user_assets = table::borrow(&registry.user_assets, user_address);
            let i = 0;
            let len = vector::length(user_assets);
            
            while (i < len) {
                let asset_id = *vector::borrow(user_assets, i);
                // In a real implementation, this would be more efficient with direct asset lookup
                // For simplicity, we're assuming the asset exists and is accessible
                // update_risk_score(asset, risk_score, cap, ctx);
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
        // Extract user address, collateral flag from payload
        // Similar to risk_score_update but with different payload format
        // Implementation details omitted for brevity
    }
    
    /// Process a liquidation message
    fun process_liquidation(
        message: &CrossLayerMessage,
        registry: &mut AssetRegistry,
        cap: &BridgeAdminCap,
        ctx: &mut TxContext
    ) {
        // Extract borrower address, repay amount, collateral amount from payload
        // Implementation details omitted for brevity
    }
    
    /// Create a cross-layer message (for testing)
    public fun create_test_message(
        sender_bytes: vector<u8>,
        message_type: String,
        payload: vector<u8>,
        ctx: &mut TxContext
    ): CrossLayerMessage {
        CrossLayerMessage {
            id: object::new(ctx),
            sender: sender_bytes,
            message_type,
            payload,
            timestamp: tx_context::epoch(ctx),
            processed: false
        }
    }
    
    /// Utility: Convert bytes to address
    fun convert_bytes_to_address(bytes: vector<u8>): address {
        // In a real implementation, this would properly convert bytes to address
        // For simplicity, we're returning a dummy address
        @0x1
    }
    
    /// Return all assets for a user
    public fun get_user_assets(registry: &AssetRegistry, user: address): vector<ID> {
        if (table::contains(&registry.user_assets, user)) {
            *table::borrow(&registry.user_assets, user)
        } else {
            vector::empty<ID>()
        }
    }
    
    /// Get total collateral value in the registry
    public fun get_total_collateral(registry: &AssetRegistry): u64 {
        registry.total_collateral_value
    }
    
    /// Get total assets count in the registry
    public fun get_total_assets(registry: &AssetRegistry): u64 {
        registry.total_assets
    }
}
