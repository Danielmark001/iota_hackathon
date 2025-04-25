module intellilend::risk_bridge {
    use std::signer;
    use std::vector;
    use std::ascii::{Self, String};
    use iota_framework::coin::{Self, Coin};
    use iota_framework::object::{Self, UID};
    use iota_framework::tx_context::{Self, TxContext};
    use iota_framework::event;
    use iota_framework::crypto;
    
    use intellilend::lending_pool::{Self, LendingPool, UserAccount};
    
    /// Error codes
    const E_NOT_AUTHORIZED: u64 = 0;
    const E_INVALID_MESSAGE: u64 = 1;
    const E_INVALID_SIGNATURE: u64 = 2;
    const E_INVALID_RISK_SCORE: u64 = 3;
    
    /// Bridge for cross-layer risk score updates
    struct RiskBridge has key {
        id: UID,
        admin: address,
        oracle_public_key: vector<u8>,
        last_update: u64,
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
    
    /// Initialize the risk bridge
    fun init(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        
        // Create admin capability
        let admin_cap = BridgeAdminCap {
            id: object::new(ctx),
        };
        
        // Create risk bridge with initial settings
        let risk_bridge = RiskBridge {
            id: object::new(ctx),
            admin: sender,
            oracle_public_key: vector::empty(), // Will be set by admin later
            last_update: tx_context::epoch(ctx),
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
        bridge.last_update = tx_context::epoch(ctx);
    }
    
    /// Process a risk score update message from L2
    public entry fun process_risk_message(
        bridge: &RiskBridge,
        user_account: &mut UserAccount,
        lending_pool: &mut LendingPool,
        admin_cap: &lending_pool::AdminCap,
        message: vector<u8>,
        signature: vector<u8>,
        ctx: &mut TxContext
    ) {
        // Verify signature using bridge's oracle public key
        assert!(
            crypto::ed25519_verify(signature, bridge.oracle_public_key, message),
            E_INVALID_SIGNATURE
        );
        
        // Decode message
        let user_address: address;
        let risk_score: u8;
        let timestamp: u64;
        
        // Deserialize message (simplified - in reality would need proper BCS deserialization)
        // For demonstration purposes, this is a placeholder
        // We assume message format is: [address (32 bytes), risk_score (1 byte), timestamp (8 bytes)]
        assert!(vector::length(&message) >= 41, E_INVALID_MESSAGE);
        
        // Extract user address (first 32 bytes)
        let addr_bytes = vector::empty<u8>();
        let i = 0;
        while (i < 32) {
            vector::push_back(&mut addr_bytes, *vector::borrow(&message, i));
            i = i + 1;
        };
        user_address = address_from_bytes(addr_bytes);
        
        // Extract risk score (next byte)
        risk_score = *vector::borrow(&message, 32);
        
        // Extract timestamp (next 8 bytes)
        timestamp = u64_from_bytes(vector::slice(&message, 33, 41));
        
        // Validate risk score
        assert!(risk_score <= 100, E_INVALID_RISK_SCORE);
        
        // Update user's risk score in lending pool
        lending_pool::update_risk_score(admin_cap, user_account, risk_score, ctx);
        
        // Emit event for tracking
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
