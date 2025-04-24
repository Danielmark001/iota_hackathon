module intellilend::asset {
    use std::error;
    use std::signer;
    use std::string::{Self, String};
    
    /// Resource representing a lending asset
    struct LendingAsset has key {
        id: ID,
        token_name: String,
        value: u64,
        owner: address,
        risk_score: u8,
        is_collateral: bool,
    }
    
    /// Error codes
    const ENotAuthorized: u64 = 1;
    const EInvalidValue: u64 = 2;
    const EAssetNotFound: u64 = 3;
    
    /// Create a new lending asset
    public fun create_asset(
        account: &signer,
        token_name: String,
        value: u64,
    ) {
        let asset = LendingAsset {
            id: object::new(ctx),
            token_name,
            value,
            owner: signer::address_of(account),
            risk_score: 50, // Default risk score (0-100)
            is_collateral: false,
        };
        
        transfer::transfer(asset, signer::address_of(account));
    }
    
    /// Mark an asset as collateral
    public fun mark_as_collateral(
        account: &signer,
        asset_id: ID,
    ) acquires LendingAsset {
        let asset = borrow_global_mut<LendingAsset>(object::id_address(asset_id));
        
        // Check ownership
        assert!(asset.owner == signer::address_of(account), error::permission_denied(ENotAuthorized));
        
        asset.is_collateral = true;
    }
    
    /// Update the risk score of an asset
    public fun update_risk_score(
        account: &signer,
        asset_id: ID,
        new_score: u8,
    ) acquires LendingAsset {
        // Only authorized administrators can update risk scores
        // This would typically be controlled by a DAO or governance mechanism
        // For simplicity, we're just checking ownership here
        
        let asset = borrow_global_mut<LendingAsset>(object::id_address(asset_id));
        
        // Check authorization (simplified)
        assert!(asset.owner == signer::address_of(account), error::permission_denied(ENotAuthorized));
        
        // Ensure score is valid
        assert!(new_score <= 100, error::invalid_argument(EInvalidValue));
        
        asset.risk_score = new_score;
    }
    
    /// Get the current risk score of an asset
    public fun get_risk_score(asset_id: ID): u8 acquires LendingAsset {
        let asset = borrow_global<LendingAsset>(object::id_address(asset_id));
        asset.risk_score
    }
    
    /// Transfer ownership of an asset
    public fun transfer_asset(
        account: &signer,
        asset_id: ID,
        recipient: address,
    ) acquires LendingAsset {
        let asset = borrow_global_mut<LendingAsset>(object::id_address(asset_id));
        
        // Check ownership
        assert!(asset.owner == signer::address_of(account), error::permission_denied(ENotAuthorized));
        
        asset.owner = recipient;
    }
    
    // TODO: Implement cross-layer communication with EVM contracts
    // TODO: Implement asset liquidation mechanism
    // TODO: Implement asset valuation based on market data
}
