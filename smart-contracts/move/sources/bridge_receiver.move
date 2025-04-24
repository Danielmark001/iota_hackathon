module intellilend::bridge_receiver {
    use std::error;
    use std::signer;
    use std::string::{Self, String};
    use std::vector;
    
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::table::{Self, Table};
    
    use intellilend::asset::{Self, AssetRegistry, BridgeAdminCap, LendingAsset};
    
    /// Message from Layer 2 (EVM)
    struct L2Message has key, store {
        id: UID,
        sender: vector<u8>, // EVM address in bytes
        message_type: String,
        payload: vector<u8>,
        timestamp: u64,
        processed: bool
    }
    
    /// Bridge receiver capability
    struct ReceiverCap has key {
        id: UID
    }
    
    /// Message processor registry
    struct MessageRegistry has key {
        id: UID,
        processors: Table<String, address>,
        message_count: u64,
        pending_count: u64
    }
    
    /// Events
    struct MessageReceived has copy, drop {
        message_id: ID,
        sender: vector<u8>,
        message_type: String,
        timestamp: u64
    }
    
    struct MessageProcessed has copy, drop {
        message_id: ID,
        processor: address,
        success: bool,
        timestamp: u64
    }
    
    /// Error codes
    const ENotAuthorized: u64 = 1;
    const EMessageAlreadyProcessed: u64 = 2;
    const EProcessorNotFound: u64 = 3;
    const EInvalidMessageType: u64 = 4;
    
    /// Initialize the bridge receiver
    fun init(ctx: &mut TxContext) {
        // Create receiver capability
        let receiver_cap = ReceiverCap {
            id: object::new(ctx)
        };
        
        // Create message registry
        let registry = MessageRegistry {
            id: object::new(ctx),
            processors: table::new(ctx),
            message_count: 0,
            pending_count: 0
        };
        
        // Transfer receiver capability to transaction sender
        transfer::transfer(receiver_cap, tx_context::sender(ctx));
        
        // Share message registry
        transfer::share_object(registry);
    }
    
    /// Register a message processor for a specific message type
    public fun register_processor(
        registry: &mut MessageRegistry,
        message_type: String,
        processor: address,
        cap: &ReceiverCap,
        ctx: &mut TxContext
    ) {
        // Verify capability
        assert!(tx_context::sender(ctx) == signer::address_of(cap), error::permission_denied(ENotAuthorized));
        
        // Register processor
        table::add(&mut registry.processors, message_type, processor);
    }
    
    /// Receive a message from Layer 2 (EVM)
    public fun receive_message(
        registry: &mut MessageRegistry,
        sender: vector<u8>,
        message_type: String,
        payload: vector<u8>,
        cap: &ReceiverCap,
        ctx: &mut TxContext
    ): ID {
        // Create message
        let message = L2Message {
            id: object::new(ctx),
            sender,
            message_type: message_type,
            payload,
            timestamp: tx_context::epoch(ctx),
            processed: false
        };
        
        let message_id = object::id(&message);
        
        // Update registry
        registry.message_count = registry.message_count + 1;
        registry.pending_count = registry.pending_count + 1;
        
        // Emit event
        event::emit(MessageReceived {
            message_id,
            sender,
            message_type,
            timestamp: tx_context::epoch(ctx)
        });
        
        // Store message as a shared object
        transfer::share_object(message);
        
        message_id
    }
    
    /// Process a message
    public fun process_message(
        registry: &mut MessageRegistry,
        message: &mut L2Message,
        asset_registry: &mut AssetRegistry,
        bridge_cap: &BridgeAdminCap,
        ctx: &mut TxContext
    ) {
        // Check if message is already processed
        assert!(!message.processed, error::invalid_argument(EMessageAlreadyProcessed));
        
        // Check if there's a processor for this message type
        assert!(
            table::contains(&registry.processors, message.message_type),
            error::not_found(EProcessorNotFound)
        );
        
        // Mark as processed
        message.processed = true;
        registry.pending_count = registry.pending_count - 1;
        
        // Process based on message type
        let success = false;
        
        if (string::to_ascii(message.message_type) == string::to_ascii(string::utf8(b"RISK_SCORE_UPDATE"))) {
            success = process_risk_score_update(message, asset_registry, bridge_cap, ctx);
        } else if (string::to_ascii(message.message_type) == string::to_ascii(string::utf8(b"COLLATERAL_CHANGE"))) {
            success = process_collateral_change(message, asset_registry, bridge_cap, ctx);
        } else if (string::to_ascii(message.message_type) == string::to_ascii(string::utf8(b"LIQUIDATION"))) {
            success = process_liquidation(message, asset_registry, bridge_cap, ctx);
        } else {
            abort error::invalid_argument(EInvalidMessageType)
        };
        
        // Emit event
        event::emit(MessageProcessed {
            message_id: object::id(message),
            processor: tx_context::sender(ctx),
            success,
            timestamp: tx_context::epoch(ctx)
        });
    }
    
    /// Process a risk score update message
    fun process_risk_score_update(
        message: &L2Message,
        asset_registry: &mut AssetRegistry,
        bridge_cap: &BridgeAdminCap,
        ctx: &mut TxContext
    ): bool {
        // Extract user address and risk score from payload
        // In a real implementation, we would use proper deserialization
        // For simplicity, we're assuming the payload format:
        // [address (20 bytes), score (1 byte)]
        
        let payload = message.payload;
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
        let user_address = convert_bytes_to_address(address_bytes);
        
        // Extract risk score (byte 21)
        let risk_score = *vector::borrow(&payload, 20);
        
        // Update risk scores for all user assets
        // In a real implementation, we would get the assets directly
        let user_assets = asset::get_user_assets(asset_registry, user_address);
        let success = !vector::is_empty(&user_assets);
        
        // Return success status
        success
    }
    
    /// Process a collateral change message
    fun process_collateral_change(
        message: &L2Message,
        asset_registry: &mut AssetRegistry,
        bridge_cap: &BridgeAdminCap,
        ctx: &mut TxContext
    ): bool {
        // Implementation details omitted for brevity
        true
    }
    
    /// Process a liquidation message
    fun process_liquidation(
        message: &L2Message,
        asset_registry: &mut AssetRegistry,
        bridge_cap: &BridgeAdminCap,
        ctx: &mut TxContext
    ): bool {
        // Implementation details omitted for brevity
        true
    }
    
    /// Get pending message count
    public fun get_pending_count(registry: &MessageRegistry): u64 {
        registry.pending_count
    }
    
    /// Get total message count
    public fun get_total_count(registry: &MessageRegistry): u64 {
        registry.message_count
    }
    
    /// Utility: Convert bytes to address
    fun convert_bytes_to_address(bytes: vector<u8>): address {
        // In a real implementation, this would properly convert bytes to address
        // For simplicity, we're returning a dummy address
        @0x1
    }
}
