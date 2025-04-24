module intellilend::risk_assessment {
    use std::error;
    use std::signer;
    use std::vector;
    use std::string::{Self, String};
    use aptos_framework::account;
    use aptos_framework::event::{Self, EventHandle};
    use aptos_framework::timestamp;
    
    /// Resource representing the risk assessment system
    struct RiskAssessmentSystem has key {
        /// Authorized risk assessors
        assessors: vector<address>,
        /// Risk model identifier
        model_id: vector<u8>,
        /// Risk model version
        model_version: u64,
        /// Last model update timestamp
        last_model_update: u64,
        /// Events
        risk_score_updated_events: EventHandle<RiskScoreUpdatedEvent>,
        risk_model_updated_events: EventHandle<RiskModelUpdatedEvent>,
    }
    
    /// Resource representing a user's risk profile
    struct RiskProfile has key {
        /// Overall risk score (0-100)
        risk_score: u64,
        /// Repayment history score (0-100)
        repayment_score: u64,
        /// Collateral quality score (0-100)
        collateral_score: u64,
        /// Wallet volatility score (0-100)
        volatility_score: u64,
        /// On-chain activity score (0-100)
        activity_score: u64,
        /// Last update timestamp
        last_updated: u64,
        /// Recommended interest rate adjustment (basis points, can be negative)
        rate_adjustment: i64,
        /// Recommended collateral factor (0-100)
        collateral_factor: u64,
    }
    
    /// Event emitted when a risk score is updated
    struct RiskScoreUpdatedEvent has drop, store {
        user: address,
        old_score: u64,
        new_score: u64,
        timestamp: u64,
    }
    
    /// Event emitted when the risk model is updated
    struct RiskModelUpdatedEvent has drop, store {
        model_id: vector<u8>,
        model_version: u64,
        timestamp: u64,
    }
    
    /// Error codes
    const ENotAuthorized: u64 = 1;
    const EInvalidArgument: u64 = 2;
    const ESystemNotInitialized: u64 = 3;
    
    /// Initialize the risk assessment system
    public fun initialize(
        account: &signer,
        initial_assessors: vector<address>,
        model_id: vector<u8>,
        model_version: u64,
    ) {
        let sender = signer::address_of(account);
        
        // Create the risk assessment system resource
        let system = RiskAssessmentSystem {
            assessors: initial_assessors,
            model_id,
            model_version,
            last_model_update: timestamp::now_seconds(),
            risk_score_updated_events: account::new_event_handle<RiskScoreUpdatedEvent>(account),
            risk_model_updated_events: account::new_event_handle<RiskModelUpdatedEvent>(account),
        };
        
        // Move the system resource to the account
        move_to(account, system);
    }
    
    /// Update a user's risk score (called by authorized assessors)
    public fun update_risk_score(
        account: &signer,
        user: address,
        risk_score: u64,
        repayment_score: u64,
        collateral_score: u64,
        volatility_score: u64,
        activity_score: u64,
        rate_adjustment: i64,
        collateral_factor: u64,
    ) acquires RiskAssessmentSystem, RiskProfile {
        let sender = signer::address_of(account);
        
        // Ensure the system is initialized
        assert!(exists<RiskAssessmentSystem>(sender), error::not_found(ESystemNotInitialized));
        
        let system = borrow_global_mut<RiskAssessmentSystem>(sender);
        
        // Ensure sender is an authorized assessor
        let is_authorized = false;
        let i = 0;
        let assessor_count = vector::length(&system.assessors);
        
        while (i < assessor_count) {
            if (*vector::borrow(&system.assessors, i) == sender) {
                is_authorized = true;
                break;
            };
            i = i + 1;
        };
        
        assert!(is_authorized, error::permission_denied(ENotAuthorized));
        
        // Validate inputs
        assert!(risk_score <= 100, error::invalid_argument(EInvalidArgument));
        assert!(repayment_score <= 100, error::invalid_argument(EInvalidArgument));
        assert!(collateral_score <= 100, error::invalid_argument(EInvalidArgument));
        assert!(volatility_score <= 100, error::invalid_argument(EInvalidArgument));
        assert!(activity_score <= 100, error::invalid_argument(EInvalidArgument));
        assert!(collateral_factor <= 90, error::invalid_argument(EInvalidArgument));
        
        // Get old score for event
        let old_score = 0;
        if (exists<RiskProfile>(user)) {
            let profile = borrow_global<RiskProfile>(user);
            old_score = profile.risk_score;
        };
        
        // Create or update risk profile
        if (!exists<RiskProfile>(user)) {
            let profile = RiskProfile {
                risk_score,
                repayment_score,
                collateral_score,
                volatility_score,
                activity_score,
                last_updated: timestamp::now_seconds(),
                rate_adjustment,
                collateral_factor,
            };
            move_to_sender_for_user(account, user, profile);
        } else {
            let profile = borrow_global_mut<RiskProfile>(user);
            profile.risk_score = risk_score;
            profile.repayment_score = repayment_score;
            profile.collateral_score = collateral_score;
            profile.volatility_score = volatility_score;
            profile.activity_score = activity_score;
            profile.last_updated = timestamp::now_seconds();
            profile.rate_adjustment = rate_adjustment;
            profile.collateral_factor = collateral_factor;
        };
        
        // Emit event
        event::emit_event(
            &mut system.risk_score_updated_events,
            RiskScoreUpdatedEvent {
                user,
                old_score,
                new_score: risk_score,
                timestamp: timestamp::now_seconds(),
            },
        );
    }
    
    /// Update the risk model (admin only)
    public fun update_risk_model(
        account: &signer,
        new_model_id: vector<u8>,
        new_model_version: u64,
    ) acquires RiskAssessmentSystem {
        let sender = signer::address_of(account);
        
        // Ensure the system is initialized and sender is admin (simplified)
        assert!(exists<RiskAssessmentSystem>(sender), error::not_found(ESystemNotInitialized));
        
        let system = borrow_global_mut<RiskAssessmentSystem>(sender);
        
        // Update model information
        system.model_id = new_model_id;
        system.model_version = new_model_version;
        system.last_model_update = timestamp::now_seconds();
        
        // Emit event
        event::emit_event(
            &mut system.risk_model_updated_events,
            RiskModelUpdatedEvent {
                model_id: new_model_id,
                model_version: new_model_version,
                timestamp: timestamp::now_seconds(),
            },
        );
    }
    
    /// Add an assessor (admin only)
    public fun add_assessor(
        account: &signer,
        assessor_address: address,
    ) acquires RiskAssessmentSystem {
        let sender = signer::address_of(account);
        
        // Ensure the system is initialized and sender is admin (simplified)
        assert!(exists<RiskAssessmentSystem>(sender), error::not_found(ESystemNotInitialized));
        
        let system = borrow_global_mut<RiskAssessmentSystem>(sender);
        
        // Check if assessor already exists
        let i = 0;
        let assessor_count = vector::length(&system.assessors);
        
        while (i < assessor_count) {
            assert!(*vector::borrow(&system.assessors, i) != assessor_address, error::already_exists(EInvalidArgument));
            i = i + 1;
        };
        
        // Add the assessor
        vector::push_back(&mut system.assessors, assessor_address);
    }
    
    /// Remove an assessor (admin only)
    public fun remove_assessor(
        account: &signer,
        assessor_address: address,
    ) acquires RiskAssessmentSystem {
        let sender = signer::address_of(account);
        
        // Ensure the system is initialized and sender is admin (simplified)
        assert!(exists<RiskAssessmentSystem>(sender), error::not_found(ESystemNotInitialized));
        
        let system = borrow_global_mut<RiskAssessmentSystem>(sender);
        
        // Find and remove the assessor
        let i = 0;
        let assessor_count = vector::length(&system.assessors);
        let found_index = assessor_count; // Invalid index
        
        while (i < assessor_count) {
            if (*vector::borrow(&system.assessors, i) == assessor_address) {
                found_index = i;
                break;
            };
            i = i + 1;
        };
        
        // Ensure assessor exists
        assert!(found_index < assessor_count, error::not_found(EInvalidArgument));
        
        // Remove the assessor
        vector::remove(&mut system.assessors, found_index);
    }
    
    /// Get a user's risk profile
    public fun get_risk_profile(user: address): (u64, u64, u64, u64, u64, u64, i64, u64) acquires RiskProfile {
        assert!(exists<RiskProfile>(user), error::not_found(EInvalidArgument));
        
        let profile = borrow_global<RiskProfile>(user);
        
        (
            profile.risk_score,
            profile.repayment_score,
            profile.collateral_score,
            profile.volatility_score,
            profile.activity_score,
            profile.last_updated,
            profile.rate_adjustment,
            profile.collateral_factor,
        )
    }
    
    /// Get risk model information
    public fun get_risk_model_info(system_address: address): (vector<u8>, u64, u64) acquires RiskAssessmentSystem {
        assert!(exists<RiskAssessmentSystem>(system_address), error::not_found(ESystemNotInitialized));
        
        let system = borrow_global<RiskAssessmentSystem>(system_address);
        
        (
            *&system.model_id,
            system.model_version,
            system.last_model_update,
        )
    }
    
    /// Helper function to create a risk profile for a user
    fun move_to_sender_for_user<T: key>(sender: &signer, user: address, value: T) {
        // In a real implementation, we would need to use a resource account
        // or another pattern to store the resource in the user's account.
        // For simplicity in this hackathon example, we're assuming the sender
        // has the authority to create resources in the user's account.
        move_to(sender, value);
    }
}
