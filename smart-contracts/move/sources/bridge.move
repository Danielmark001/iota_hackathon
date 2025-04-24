module intellilend::bridge {
    use std::error;
    use std::signer;
    use std::vector;
    use std::bcs;
    use std::string::{Self, String};
    use aptos_std::event::{Self, EventHandle};
    use aptos_framework::account;
    use aptos_framework::timestamp;
    
    /// Resource representing the cross-layer bridge
    struct Bridge has key {
        /// Authorized oracles that can relay messages from L2
        oracles: vector<address>,
        /// Required signatures for a message to be processed
        required_signatures: u64,
        /// Counter for message IDs
        message_counter: u64,
        /// Events
        message_sent_events: EventHandle<MessageSentEvent>,
        message_received_events: EventHandle<MessageReceivedEvent>,
    }
    
    /// Message types
    const RISK_SCORE_UPDATE: vector<u8> = b"RISK_SCORE_UPDATE";
    const COLLATERAL_CHANGE: vector<u8> = b"COLLATERAL_CHANGE";
    const LIQUIDATION: vector<u8> = b"LIQUIDATION";
    
    /// Error codes
    const ENotAuthorized: u64 = 1;
    const EInvalidArgument: u64 = 2;
    const EBridgeNotInitialized: u64 = 3;
    const ENotEnoughSignatures: u64 = 4;
    const EMessageAlreadyProcessed: u64 = 5;
    
    /// Event emitted when a message is sent to L2
    struct MessageSentEvent has drop, store {
        message_id: vector<u8>,
        target_address: vector<u8>,
        message_type: String,
        timestamp: u64,
    }
    
    /// Event emitted when a message is received from L2
    struct MessageReceivedEvent has drop, store {
        message_id: vector<u8>,
        sender: vector<u8>,
        message_type: String,
        timestamp: u64,
    }
    
    /// Message with signatures from oracles
    struct SignedMessage has drop, store {
        message_id: vector<u8>,
        sender: vector<u8>,
        target_address: address,
        message_type: String,
        payload: vector<u8>,
        signatures: vector<vector<u8>>,
        signers: vector<address>,
    }
    
    /// Initialize the bridge (called once by the deployer)
    public fun initialize(
        account: &signer,
        initial_oracles: vector<address>,
        required_signatures: u64,
    ) {
        let sender = signer::address_of(account);
        
        // Ensure the required signatures is valid
        assert!(required_signatures > 0, error::invalid_argument(EInvalidArgument));
        assert!(required_signatures <= vector::length(&initial_oracles), error::invalid_argument(EInvalidArgument));
        
        // Create the bridge resource
        let bridge = Bridge {
            oracles: initial_oracles,
            required_signatures,
            message_counter: 0,
            message_sent_events: account::new_event_handle<MessageSentEvent>(account),
            message_received_events: account::new_event_handle<MessageReceivedEvent>(account),
        };
        
        // Move the bridge resource to the account
        move_to(account, bridge);
    }
    
    /// Send a message to Layer 2
    public fun send_message_to_l2(
        account: &signer,
        target_address: vector<u8>,
        message_type: String,
        payload: vector<u8>,
    ): vector<u8> acquires Bridge {
        let sender = signer::address_of(account);
        
        // Ensure the bridge is initialized
        assert!(exists<Bridge>(sender), error::not_found(EBridgeNotInitialized));
        
        let bridge = borrow_global_mut<Bridge>(sender);
        
        // Generate a message ID
        let message_counter = bridge.message_counter;
        bridge.message_counter = message_counter + 1;
        
        let timestamp_seconds = timestamp::now_seconds();
        
        // Create a unique message ID
        let message_id = bcs::to_bytes(&sender);
        vector::append(&mut message_id, bcs::to_bytes(&message_counter));
        vector::append(&mut message_id, bcs::to_bytes(&timestamp_seconds));
        
        // Emit event to notify oracles
        event::emit_event(
            &mut bridge.message_sent_events,
            MessageSentEvent {
                message_id: message_id,
                target_address,
                message_type: message_type,
                timestamp: timestamp_seconds,
            },
        );
        
        message_id
    }
    
    /// Receive a message from Layer 2 (called by oracles)
    public fun receive_message_from_l2(
        account: &signer,
        message: SignedMessage,
    ) acquires Bridge {
        let sender = signer::address_of(account);
        
        // Ensure the bridge is initialized
        assert!(exists<Bridge>(sender), error::not_found(EBridgeNotInitialized));
        
        let bridge = borrow_global_mut<Bridge>(sender);
        
        // Verify the signatures
        verify_signatures(&message, &bridge.oracles, bridge.required_signatures);
        
        // Process the message based on its type
        process_message(message);
        
        // Emit event
        event::emit_event(
            &mut bridge.message_received_events,
            MessageReceivedEvent {
                message_id: message.message_id,
                sender: message.sender,
                message_type: message.message_type,
                timestamp: timestamp::now_seconds(),
            },
        );
    }
    
    /// Verify signatures on a message
    fun verify_signatures(
        message: &SignedMessage,
        authorized_oracles: &vector<address>,
        required_signatures: u64,
    ) {
        let signatures = &message.signatures;
        let signers = &message.signers;
        
        // Ensure there are enough signatures
        let signature_count = vector::length(signatures);
        assert!(signature_count >= required_signatures, error::invalid_argument(ENotEnoughSignatures));
        
        // Ensure the number of signatures matches the number of signers
        assert!(signature_count == vector::length(signers), error::invalid_argument(EInvalidArgument));
        
        // Verify each signer is authorized
        let verified_count = 0;
        let i = 0;
        while (i < signature_count) {
            let signer_addr = *vector::borrow(signers, i);
            
            // Check if the signer is an authorized oracle
            let j = 0;
            let oracle_count = vector::length(authorized_oracles);
            let is_authorized = false;
            
            while (j < oracle_count) {
                if (signer_addr == *vector::borrow(authorized_oracles, j)) {
                    is_authorized = true;
                    break;
                };
                j = j + 1;
            };
            
            // Ensure the signer is authorized
            assert!(is_authorized, error::permission_denied(ENotAuthorized));
            
            // TODO: In a real implementation, we would verify the actual signature
            // against the message data. For the hackathon, we're just checking
            // if the signer is authorized.
            
            verified_count = verified_count + 1;
            i = i + 1;
        };
        
        // Ensure we have enough verified signatures
        assert!(verified_count >= required_signatures, error::invalid_argument(ENotEnoughSignatures));
    }
    
    /// Process a message based on its type
    fun process_message(message: SignedMessage) {
        let message_type_bytes = string::bytes(&message.message_type);
        
        if (message_type_bytes == RISK_SCORE_UPDATE) {
            process_risk_score_update(message);
        } else if (message_type_bytes == COLLATERAL_CHANGE) {
            process_collateral_change(message);
        } else if (message_type_bytes == LIQUIDATION) {
            process_liquidation(message);
        };
        // Additional message types can be handled here
    }
    
    /// Process a risk score update message
    fun process_risk_score_update(message: SignedMessage) {
        // For the hackathon, this is a simplified implementation
        // In a real implementation, we would:
        // 1. Decode the payload to extract user address and risk score
        // 2. Update the user's risk score in the appropriate module
        
        let target_address = message.target_address;
        let payload = message.payload;
        
        // Extract user address and risk score from payload
        // This is a placeholder implementation
        if (vector::length(&payload) >= 32) {
            // In a real implementation, we would call the appropriate module
            // to update the risk score, e.g.:
            // intellilend::risk::update_user_risk_score(target_address, risk_score);
        };
    }
    
    /// Process a collateral change message
    fun process_collateral_change(message: SignedMessage) {
        // Simplified implementation for hackathon
        let target_address = message.target_address;
        let payload = message.payload;
        
        // Extract user address and collateral amount from payload
        if (vector::length(&payload) >= 32) {
            // In a real implementation, we would call the appropriate module
            // to update the collateral, e.g.:
            // intellilend::collateral::update_user_collateral(target_address, collateral_amount);
        };
    }
    
    /// Process a liquidation message
    fun process_liquidation(message: SignedMessage) {
        // Simplified implementation for hackathon
        let target_address = message.target_address;
        let payload = message.payload;
        
        // Extract liquidation details from payload
        if (vector::length(&payload) >= 64) {
            // In a real implementation, we would call the appropriate module
            // to process the liquidation, e.g.:
            // intellilend::liquidation::process_liquidation(target_address, repay_amount, collateral_seized);
        };
    }
    
    /// Add an oracle (admin only)
    public fun add_oracle(
        account: &signer,
        oracle_address: address,
    ) acquires Bridge {
        let sender = signer::address_of(account);
        
        // Ensure sender is the bridge admin (simplified)
        assert!(exists<Bridge>(sender), error::not_found(EBridgeNotInitialized));
        
        let bridge = borrow_global_mut<Bridge>(sender);
        
        // Check if oracle already exists
        let i = 0;
        let oracle_count = vector::length(&bridge.oracles);
        
        while (i < oracle_count) {
            assert!(*vector::borrow(&bridge.oracles, i) != oracle_address, error::already_exists(EInvalidArgument));
            i = i + 1;
        };
        
        // Add the oracle
        vector::push_back(&mut bridge.oracles, oracle_address);
    }
    
    /// Remove an oracle (admin only)
    public fun remove_oracle(
        account: &signer,
        oracle_address: address,
    ) acquires Bridge {
        let sender = signer::address_of(account);
        
        // Ensure sender is the bridge admin (simplified)
        assert!(exists<Bridge>(sender), error::not_found(EBridgeNotInitialized));
        
        let bridge = borrow_global_mut<Bridge>(sender);
        
        // Find and remove the oracle
        let i = 0;
        let oracle_count = vector::length(&bridge.oracles);
        let found_index = oracle_count; // Invalid index
        
        while (i < oracle_count) {
            if (*vector::borrow(&bridge.oracles, i) == oracle_address) {
                found_index = i;
                break;
            };
            i = i + 1;
        };
        
        // Ensure oracle exists
        assert!(found_index < oracle_count, error::not_found(EInvalidArgument));
        
        // Ensure we'll still have enough oracles for required signatures
        assert!(oracle_count - 1 >= bridge.required_signatures, error::invalid_argument(EInvalidArgument));
        
        // Remove the oracle
        vector::remove(&mut bridge.oracles, found_index);
    }
    
    /// Update required signatures (admin only)
    public fun update_required_signatures(
        account: &signer,
        new_required_signatures: u64,
    ) acquires Bridge {
        let sender = signer::address_of(account);
        
        // Ensure sender is the bridge admin (simplified)
        assert!(exists<Bridge>(sender), error::not_found(EBridgeNotInitialized));
        
        let bridge = borrow_global_mut<Bridge>(sender);
        
        // Ensure new value is valid
        assert!(new_required_signatures > 0, error::invalid_argument(EInvalidArgument));
        assert!(new_required_signatures <= vector::length(&bridge.oracles), error::invalid_argument(EInvalidArgument));
        
        // Update required signatures
        bridge.required_signatures = new_required_signatures;
    }
    
    /// Get the list of authorized oracles
    public fun get_oracles(bridge_address: address): vector<address> acquires Bridge {
        assert!(exists<Bridge>(bridge_address), error::not_found(EBridgeNotInitialized));
        
        let bridge = borrow_global<Bridge>(bridge_address);
        *&bridge.oracles
    }
    
    /// Get the number of required signatures
    public fun get_required_signatures(bridge_address: address): u64 acquires Bridge {
        assert!(exists<Bridge>(bridge_address), error::not_found(EBridgeNotInitialized));
        
        let bridge = borrow_global<Bridge>(bridge_address);
        bridge.required_signatures
    }
    
    /// Create a new signed message (for testing or oracle use)
    public fun create_signed_message(
        message_id: vector<u8>,
        sender: vector<u8>,
        target_address: address,
        message_type: String,
        payload: vector<u8>,
        signatures: vector<vector<u8>>,
        signers: vector<address>,
    ): SignedMessage {
        SignedMessage {
            message_id,
            sender,
            target_address,
            message_type,
            payload,
            signatures,
            signers,
        }
    }
}
