module intellilend::risk_bridge {
    use std::signer;
    use std::vector;
    use std::ascii::{Self, String};
    use iota_framework::coin::{Self, Coin};
    use iota_framework::object::{Self, UID};
    use iota_framework::tx_context::{Self, TxContext};
    use iota_framework::event;
    use iota_framework::crypto;
    use iota_framework::streams::{Self, Channel, Message};
    use iota_framework::identity::{Self, DID, VerificationMethod};
    use iota_framework::timestamp;
    
    use intellilend::lending_pool::{Self, LendingPool, UserAccount};
    
    /// Error codes
    const E_NOT_AUTHORIZED: u64 = 0;
    const E_INVALID_MESSAGE: u64 = 1;
    const E_INVALID_SIGNATURE: u64 = 2;
    const E_INVALID_RISK_SCORE: u64 = 3;
    
    /// Bridge for cross-layer risk score updates integrated with IOTA Streams
    struct RiskBridge has key {
        id: UID,
        admin: address,
        oracle_public_key: vector<u8>,
        last_update: u64,
        stream_channel: Option<Channel>,       // IOTA Streams channel for cross-layer messaging
        identity_did: Option<DID>,             // IOTA Identity DID for verification
        verification_methods: vector<VerificationMethod>, // Verification methods for bridge
    }
    
    /// AdminCap for the risk bridge
    struct BridgeAdminCap has key {
        id: UID,
    }
    
    /// Message from L2 to update risk score
    struct RiskScoreMessage has drop, copy {
        user_address: address,
        risk_score: u8,
        timestamp: u64,
    }
    
    /// Event emitted when a risk score message is processed
    struct RiskScoreMessageProcessed has drop, copy {
        user_address: address,
        risk_score: u8,
        timestamp: u64,
        source: String, // "L2" or "IOTA"
    }
    
    /// Initialize the risk bridge with IOTA Streams and Identity
    fun init(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        
        // Create admin capability
        let admin_cap = BridgeAdminCap {
            id: object::new(ctx),
        };
        
        // Create a new IOTA Identity DID for the bridge
        let (bridge_did, verification_methods) = identity::create_did(sender, ctx);
        
        // Create risk bridge with initial settings and IOTA integrations
        let risk_bridge = RiskBridge {
            id: object::new(ctx),
            admin: sender,
            oracle_public_key: vector::empty(), // Will be set by admin later
            last_update: timestamp::now_seconds(ctx),
            stream_channel: option::none(), // Will be initialized separately
            identity_did: option::some(bridge_did),
            verification_methods,
        };
        
        // Transfer admin capability to sender
        transfer::transfer(admin_cap, sender);
        
        // Share risk bridge as a shared object
        transfer::share_object(risk_bridge);
    }
    
    /// Set the oracle public key for message verification
    public entry fun set_oracle_public_key(
        _: &BridgeAdminCap,
        bridge: &mut RiskBridge,
        public_key: vector<u8>,
        ctx: &mut TxContext
    ) {
        bridge.oracle_public_key = public_key;
        bridge.last_update = timestamp::now_seconds(ctx);
    }
    
    /// Initialize IOTA Streams channel for cross-layer communication
    public entry fun initialize_streams_channel(
        _: &BridgeAdminCap,
        bridge: &mut RiskBridge,
        seed: vector<u8>, // Seed for channel creation
        ctx: &mut TxContext
    ) {
        // Create a new IOTA Streams channel
        let channel = streams::create_channel(seed, ctx);
        
        // Set the channel in the bridge
        bridge.stream_channel = option::some(channel);
        bridge.last_update = timestamp::now_seconds(ctx);
        
        // Emit event for channel creation
        event::emit(StreamsChannelCreated {
            channel_address: streams::get_channel_address(&channel),
            timestamp: timestamp::now_seconds(ctx)
        });
    }
    
    /// Event emitted when a Streams channel is created
    struct StreamsChannelCreated has copy, drop {
        channel_address: vector<u8>,
        timestamp: u64
    }
    
    /// Process a risk score update message from L2 using IOTA Streams
    public entry fun process_risk_message(
        bridge: &RiskBridge,
        user_account: &mut UserAccount,
        lending_pool: &mut LendingPool,
        admin_cap: &lending_pool::AdminCap,
        message_id: vector<u8>,
        signature: vector<u8>,
        ctx: &mut TxContext
    ) {
        // Fetch message from IOTA Streams if channel exists
        let message_content = if (option::is_some(&bridge.stream_channel)) {
            let channel = option::borrow(&bridge.stream_channel);
            let stream_message = streams::fetch_message(channel, message_id);
            streams::get_message_payload(&stream_message)
        } else {
            // Fallback to direct message if no channel is set up
            message_id
        };
        
        // Verify signature using bridge's oracle public key and IOTA cryptography
        assert!(
            crypto::ed25519_verify(signature, bridge.oracle_public_key, message_content),
            E_INVALID_SIGNATURE
        );
        
        // Verify with DID if available
        if (option::is_some(&bridge.identity_did)) {
            let did = option::borrow(&bridge.identity_did);
            let verification_result = identity::verify_signature(
                did,
                &bridge.verification_methods,
                message_content,
                signature
            );
            assert!(verification_result, E_INVALID_SIGNATURE);
        };
        
        // Decode message using IOTA's message format
        let decoded = streams::decode_message(message_content);
        
        // Extract the risk score data
        let user_address = streams::extract_address(&decoded);
        let risk_score = streams::extract_risk_score(&decoded);
        let timestamp = streams::extract_timestamp(&decoded);
        
        // Validate risk score
        assert!(risk_score <= 100, E_INVALID_RISK_SCORE);
        
        // Update user's risk score in lending pool
        lending_pool::update_risk_score(admin_cap, user_account, risk_score, ctx);
        
        // Send confirmation back to L2 via IOTA Streams
        if (option::is_some(&bridge.stream_channel)) {
            let channel = option::borrow(&bridge.stream_channel);
            let confirmation_message = streams::create_confirmation_message(
                user_address,
                risk_score,
                timestamp::now_seconds(ctx)
            );
            streams::send_message(channel, confirmation_message, ctx);
        };
        
        // Emit event for tracking with Tangle-compatible format
        event::emit(RiskScoreMessageProcessed {
            user_address,
            risk_score,
            timestamp,
            source: ascii::string(b"L2")
        });
    }
    
    /// Submit a risk score update directly on L1
    public entry fun submit_risk_update(
        _: &BridgeAdminCap,
        user_account: &mut UserAccount,
        lending_pool: &mut LendingPool,
        admin_cap: &lending_pool::AdminCap,
        risk_score: u8,
        ctx: &mut TxContext
    ) {
        // Validate risk score
        assert!(risk_score <= 100, E_INVALID_RISK_SCORE);
        
        // Get user address
        let user_address = lending_pool::get_user_address(user_account);
        
        // Update user's risk score in lending pool
        lending_pool::update_risk_score(admin_cap, user_account, risk_score, ctx);
        
        // Emit event for tracking
        event::emit(RiskScoreMessageProcessed {
            user_address,
            risk_score,
            timestamp: tx_context::epoch_timestamp_ms(ctx),
            source: ascii::string(b"IOTA")
        });
    }
    
    /// Helper function to convert bytes to address
    fun address_from_bytes(bytes: vector<u8>): address {
        // Ensure we have enough bytes for an address
        assert!(vector::length(&bytes) >= 32, E_INVALID_MESSAGE);
        
        // Convert bytes to address
        let addr: address = @0x0; // Initialize default value
        
        if (vector::length(&bytes) >= 32) {
            // Extract first 32 bytes and convert to address
            let mut i = 0;
            let mut result = 0u128;
            
            // Process first 16 bytes (high part of address)
            while (i < 16 && i < vector::length(&bytes)) {
                let byte_val = (*vector::borrow(&bytes, i) as u128);
                result = result << 8;
                result = result | byte_val;
                i = i + 1;
            }
            
            let high = result;
            result = 0u128;
            
            // Process next 16 bytes (low part of address)
            while (i < 32 && i < vector::length(&bytes)) {
                let byte_val = (*vector::borrow(&bytes, i) as u128);
                result = result << 8;
                result = result | byte_val;
                i = i + 1;
            }
            
            let low = result;
            
            // Combine high and low parts to form address
            addr = @0x0; // Default value if conversion fails
            
            // Use iota_framework's address conversion utility if available
            if (exists<iota_framework::address::AddressUtil>(@0x1)) {
                let util = borrow_global<iota_framework::address::AddressUtil>(@0x1);
                addr = iota_framework::address::from_bytes(util, high, low);
            } else {
                // Fallback implementation for testing
                let addr_bytes = vector::empty<u8>();
                let j = 0;
                while (j < 32 && j < vector::length(&bytes)) {
                    vector::push_back(&mut addr_bytes, *vector::borrow(&bytes, j));
                    j = j + 1;
                };
                
                addr = iota_framework::crypto::hash::keccak256_address(&addr_bytes);
            }
        }
        
        addr
    }
    
    /// Helper function to convert bytes to u64
    fun u64_from_bytes(bytes: vector<u8>): u64 {
        // Ensure we have enough bytes
        assert!(vector::length(&bytes) >= 8, E_INVALID_MESSAGE);
        
        // Extract 8 bytes and convert to u64 (big-endian)
        let mut result: u64 = 0;
        let mut i = 0;
        
        while (i < 8 && i < vector::length(&bytes)) {
            let byte_val = (*vector::borrow(&bytes, i) as u64);
            result = result << 8;
            result = result | byte_val;
            i = i + 1;
        }
        
        result
    }
}
