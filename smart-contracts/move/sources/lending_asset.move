module intellilend::lending_asset {
    use std::error;
    use std::signer;
    use std::string::{Self, String};
    use std::vector;
    
    use iota_framework::object::{Self, ID, UID};
    use iota_framework::transfer;
    use iota_framework::tx_context::{Self, TxContext};
    use iota_framework::event;
    use iota_framework::table::{Self, Table};
    use iota_framework::coin::{Self, Coin};
    use iota_framework::balance::{Self, Balance};
    use iota_framework::clock::{Self, Clock};
    
    /// Error codes
    const ENotAuthorized: u64 = 1;
    const EInvalidValue: u64 = 2;
    const EAssetNotFound: u64 = 3;
    const EInsufficientCollateral: u64 = 4;
    const EInvalidRiskScore: u64 = 5;
    const EZeroValue: u64 = 6;
    const EInvalidProof: u64 = 7;
    const ELiquidationNotEligible: u64 = 8;
    
    /// Capability for managing lending assets
    struct LendingAdminCap has key {
        id: UID
    }
    
    /// Lending asset that can be used as collateral
    struct LendingAsset has key, store {
        id: UID,
        token_name: String,
        value: u64,
        owner: address,
        risk_score: u8,
        is_collateral: bool,
        frozen: bool,
        creation_time: u64,
        last_updated: u64,
        identity_verified: bool,
        credit_score: u16
    }
    
    /// Wrapper for a lending asset to track collateral
    struct CollateralizedAsset has key, store {
        id: UID,
        asset_id: ID,
        collateral_value: u64,
        loan_value: u64,
        liquidation_threshold: u64, // in basis points (e.g., 8300 = 83%)
        liquidation_penalty: u64,   // in basis points (e.g., 800 = 8%)
        last_interest_update: u64,
        interest_rate: u64         // in basis points (e.g., 500 = 5%)
    }
    
    /// Registry for all lending assets
    struct LendingRegistry has key {
        id: UID,
        assets: Table<ID, address>,
        collateralized_assets: Table<ID, ID>,
        user_assets: Table<address, vector<ID>>,
        user_collaterals: Table<address, vector<ID>>,
        total_assets: u64,
        total_collateral_value: u64,
        total_loan_value: u64
    }
    
    /// Protocol stats
    struct LendingStats has key {
        id: UID,
        total_borrowed: u64,
        total_deposited: u64,
        total_collateral: u64,
        user_count: u64,
        last_updated: u64,
        protocol_fee_balance: Balance<iota_framework::iota::IOTA>
    }
    
    /// Events
    struct AssetCreated has copy, drop {
        asset_id: ID,
        owner: address,
        token_name: String,
        value: u64,
        timestamp: u64
    }
    
    struct CollateralAdded has copy, drop {
        asset_id: ID,
        collateral_id: ID,
        owner: address,
        value: u64,
        timestamp: u64
    }
    
    struct LoanIssued has copy, drop {
        collateral_id: ID,
        recipient: address,
        amount: u64,
        interest_rate: u64,
        timestamp: u64
    }
    
    struct LoanRepaid has copy, drop {
        collateral_id: ID,
        payer: address,
        amount: u64,
        timestamp: u64
    }
    
    struct AssetLiquidated has copy, drop {
        collateral_id: ID,
        borrower: address,
        liquidator: address,
        loan_amount: u64,
        collateral_amount: u64,
        timestamp: u64
    }
    
    struct RiskScoreUpdated has copy, drop {
        asset_id: ID,
        old_score: u8,
        new_score: u8,
        timestamp: u64
    }
    
    /// Initialize module
    fun init(ctx: &mut TxContext) {
        // Create registry
        let registry = LendingRegistry {
            id: object::new(ctx),
            assets: table::new(ctx),
            collateralized_assets: table::new(ctx),
            user_assets: table::new(ctx),
            user_collaterals: table::new(ctx),
            total_assets: 0,
            total_collateral_value: 0,
            total_loan_value: 0
        };
        
        // Create stats
        let stats = LendingStats {
            id: object::new(ctx),
            total_borrowed: 0,
            total_deposited: 0,
            total_collateral: 0,
            user_count: 0,
            last_updated: tx_context::epoch(ctx),
            protocol_fee_balance: balance::zero()
        };
        
        // Create admin capability
        let admin_cap = LendingAdminCap {
            id: object::new(ctx)
        };
        
        // Share registry and stats, transfer admin cap to transaction sender
        transfer::share_object(registry);
        transfer::share_object(stats);
        transfer::transfer(admin_cap, tx_context::sender(ctx));
    }
    
    /// Create a new lending asset
    public fun create_asset(
        account: &signer,
        registry: &mut LendingRegistry,
        token_name: String,
        value: u64,
        ctx: &mut TxContext
    ) {
        let sender = signer::address_of(account);
        
        // Ensure value is valid
        assert!(value > 0, error::invalid_argument(EZeroValue));
        
        // Create the asset
        let asset = LendingAsset {
            id: object::new(ctx),
            token_name,
            value,
            owner: sender,
            risk_score: 50, // Default risk score (0-100)
            is_collateral: false,
            frozen: false,
            creation_time: tx_context::epoch(ctx),
            last_updated: tx_context::epoch(ctx),
            identity_verified: false,
            credit_score: 650 // Default credit score
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
            token_name,
            value,
            timestamp: tx_context::epoch(ctx)
        });
        
        // Transfer asset to sender
        transfer::transfer(asset, sender);
    }
    
    /// Use asset as collateral to get a loan
    public fun collateralize_asset(
        account: &signer,
        registry: &mut LendingRegistry,
        stats: &mut LendingStats,
        asset: LendingAsset,
        loan_value: u64,
        ctx: &mut TxContext
    ) {
        let sender = signer::address_of(account);
        
        // Ensure sender is the owner
        assert!(asset.owner == sender, error::permission_denied(ENotAuthorized));
        
        // Ensure asset is not frozen
        assert!(!asset.frozen, error::permission_denied(ENotAuthorized));
        
        // Calculate collateral requirements based on risk score
        let collateral_value = asset.value;
        
        // Lower risk scores get better terms (lower collateral requirements)
        let collateral_factor = if (asset.risk_score < 25) {
            8000 // 80% for very low risk
        } else if (asset.risk_score < 50) {
            7500 // 75% for low risk
        } else if (asset.risk_score < 75) {
            7000 // 70% for medium risk
        } else {
            6500 // 65% for high risk
        };
        
        // Calculate max loan value based on collateral factor
        let max_loan_value = (collateral_value * collateral_factor) / 10000;
        
        // Ensure requested loan is within limits
        assert!(loan_value <= max_loan_value, error::invalid_argument(EInsufficientCollateral));
        
        // Calculate interest rate based on risk score
        let interest_rate = 300 + (asset.risk_score * 10); // Base 3% + up to 10% based on risk
        
        // Calculate liquidation threshold (typically higher than collateral factor)
        let liquidation_threshold = collateral_factor + 500; // 5% buffer above collateral factor
        
        // Calculate liquidation penalty
        let liquidation_penalty = 800; // 8% penalty
        
        // Create collateralized asset
        let collateral = CollateralizedAsset {
            id: object::new(ctx),
            asset_id: object::id(&asset),
            collateral_value,
            loan_value,
            liquidation_threshold,
            liquidation_penalty,
            last_interest_update: tx_context::epoch(ctx),
            interest_rate
        };
        
        let collateral_id = object::id(&collateral);
        
        // Register collateral in registry
        table::add(&mut registry.collateralized_assets, object::id(&asset), collateral_id);
        
        // Add to user's collaterals
        if (!table::contains(&registry.user_collaterals, sender)) {
            table::add(&mut registry.user_collaterals, sender, vector::empty<ID>());
        };
        
        let user_collaterals = table::borrow_mut(&mut registry.user_collaterals, sender);
        vector::push_back(user_collaterals, collateral_id);
        
        // Update registry stats
        registry.total_collateral_value = registry.total_collateral_value + collateral_value;
        registry.total_loan_value = registry.total_loan_value + loan_value;
        
        // Update lending stats
        stats.total_borrowed = stats.total_borrowed + loan_value;
        stats.total_collateral = stats.total_collateral + collateral_value;
        stats.last_updated = tx_context::epoch(ctx);
        
        // Freeze the asset
        let frozen_asset = asset;
        frozen_asset.frozen = true;
        frozen_asset.is_collateral = true;
        frozen_asset.last_updated = tx_context::epoch(ctx);
        
        // Emit events
        event::emit(CollateralAdded {
            asset_id: object::id(&frozen_asset),
            collateral_id,
            owner: sender,
            value: collateral_value,
            timestamp: tx_context::epoch(ctx)
        });
        
        event::emit(LoanIssued {
            collateral_id,
            recipient: sender,
            amount: loan_value,
            interest_rate,
            timestamp: tx_context::epoch(ctx)
        });
        
        // Transfer frozen asset to sender (it's now locked as collateral)
        transfer::transfer(frozen_asset, sender);
        
        // Transfer collateralized asset record to sender
        transfer::transfer(collateral, sender);
        
        // In a real implementation, we would also mint and transfer loan tokens here
    }
    
    /// Repay a loan and reclaim collateral
    public fun repay_loan(
        account: &signer,
        registry: &mut LendingRegistry,
        stats: &mut LendingStats,
        collateral: CollateralizedAsset,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = signer::address_of(account);
        
        // Calculate accrued interest
        let (total_repayment, _interest) = calculate_repayment_with_interest(
            &collateral,
            clock::timestamp_ms(clock) / 1000 // Convert ms to seconds
        );
        
        // In a real implementation, we would verify the repayment token amount here
        
        // Update registry stats
        registry.total_loan_value = registry.total_loan_value - collateral.loan_value;
        
        // Update lending stats
        stats.total_borrowed = stats.total_borrowed - collateral.loan_value;
        stats.last_updated = tx_context::epoch(ctx);
        
        // Emit event
        event::emit(LoanRepaid {
            collateral_id: object::id(&collateral),
            payer: sender,
            amount: total_repayment,
            timestamp: tx_context::epoch(ctx)
        });
        
        // Delete the collateralized asset record
        let CollateralizedAsset {
            id,
            asset_id: _,
            collateral_value: _,
            loan_value: _,
            liquidation_threshold: _,
            liquidation_penalty: _,
            last_interest_update: _,
            interest_rate: _
        } = collateral;
        
        object::delete(id);
        
        // In a real implementation, we would:
        // 1. Transfer the loan tokens from the user to the protocol
        // 2. Unfreeze the collateral asset
        // 3. Remove the collateral from the registry
    }
    
    /// Liquidate an undercollateralized position
    public fun liquidate(
        account: &signer,
        registry: &mut LendingRegistry,
        stats: &mut LendingStats,
        collateral: &CollateralizedAsset,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let liquidator = signer::address_of(account);
        
        // Calculate current loan value with interest
        let (current_debt, _) = calculate_repayment_with_interest(
            collateral,
            clock::timestamp_ms(clock) / 1000
        );
        
        // Calculate health factor
        let health_factor = calculate_health_factor(collateral, current_debt);
        
        // Check if position is eligible for liquidation
        assert!(health_factor < 10000, error::invalid_argument(ELiquidationNotEligible)); // Health factor < 1.0
        
        // Calculate liquidation values
        let liquidation_value = current_debt;
        let collateral_to_seize = (liquidation_value * (10000 + collateral.liquidation_penalty)) / 10000;
        
        // Ensure collateral to seize doesn't exceed the total collateral
        let collateral_to_seize = if (collateral_to_seize > collateral.collateral_value) {
            collateral.collateral_value
        } else {
            collateral_to_seize
        };
        
        // Update registry stats
        registry.total_loan_value = registry.total_loan_value - current_debt;
        registry.total_collateral_value = registry.total_collateral_value - collateral_to_seize;
        
        // Update lending stats
        stats.total_borrowed = stats.total_borrowed - current_debt;
        stats.total_collateral = stats.total_collateral - collateral_to_seize;
        stats.last_updated = tx_context::epoch(ctx);
        
        // Emit event
        event::emit(AssetLiquidated {
            collateral_id: object::id(collateral),
            borrower: get_asset_owner(registry, collateral.asset_id),
            liquidator,
            loan_amount: current_debt,
            collateral_amount: collateral_to_seize,
            timestamp: tx_context::epoch(ctx)
        });
        
        // In a real implementation, we would:
        // 1. Transfer the loan tokens from the liquidator to the protocol
        // 2. Transfer a portion of the collateral to the liquidator
        // 3. Update or delete the collateralized asset record
    }
    
    /// Update risk score for an asset
    public fun update_risk_score(
        admin: &signer,
        admin_cap: &LendingAdminCap,
        asset: &mut LendingAsset,
        new_score: u8,
        ctx: &mut TxContext
    ) {
        // Verify admin has the capability
        assert!(object::is_owner(&admin_cap.id, signer::address_of(admin)), error::permission_denied(ENotAuthorized));
        
        // Ensure score is valid
        assert!(new_score <= 100, error::invalid_argument(EInvalidRiskScore));
        
        // Store old score for event
        let old_score = asset.risk_score;
        
        // Update score
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
    
    /// Calculate total repayment amount with interest
    fun calculate_repayment_with_interest(
        collateral: &CollateralizedAsset,
        current_time: u64
    ): (u64, u64) {
        // Calculate time elapsed in seconds
        let time_elapsed = current_time - collateral.last_interest_update;
        
        // Convert time to years (approximation: seconds / seconds in a year)
        let years_elapsed = (time_elapsed as u128) * 10000 / 31536000; // Scale up for precision
        
        // Calculate interest: principal * rate * time
        let interest = ((collateral.loan_value as u128) * (collateral.interest_rate as u128) * years_elapsed) / 1000000;
        
        // Total repayment is principal + interest
        let total_repayment = collateral.loan_value + (interest as u64);
        
        (total_repayment, (interest as u64))
    }
    
    /// Calculate health factor for a collateralized position
    fun calculate_health_factor(
        collateral: &CollateralizedAsset,
        current_debt: u64
    ): u64 {
        // Health factor = (collateral_value * liquidation_threshold) / (current_debt * 10000)
        // Result is scaled by 10000 (e.g., 12000 = 1.2)
        if (current_debt == 0) {
            // If no debt, health factor is maximum
            return 100000; // 10.0
        };
        
        (collateral.collateral_value * collateral.liquidation_threshold) / current_debt
    }
    
    /// Get owner of an asset
    fun get_asset_owner(registry: &LendingRegistry, asset_id: ID): address {
        *table::borrow(&registry.assets, asset_id)
    }
    
    /// Get collateralized asset ID for an asset
    public fun get_collateral_id(registry: &LendingRegistry, asset_id: ID): ID {
        *table::borrow(&registry.collateralized_assets, asset_id)
    }
    
    /// Check if asset is used as collateral
    public fun is_collateral(registry: &LendingRegistry, asset_id: ID): bool {
        table::contains(&registry.collateralized_assets, asset_id)
    }
    
    /// Get all assets owned by a user
    public fun get_user_assets(registry: &LendingRegistry, user: address): vector<ID> {
        if (table::contains(&registry.user_assets, user)) {
            *table::borrow(&registry.user_assets, user)
        } else {
            vector::empty<ID>()
        }
    }
    
    /// Get all collaterals owned by a user
    public fun get_user_collaterals(registry: &LendingRegistry, user: address): vector<ID> {
        if (table::contains(&registry.user_collaterals, user)) {
            *table::borrow(&registry.user_collaterals, user)
        } else {
            vector::empty<ID>()
        }
    }
    
    /// Get lending statistics
    public fun get_lending_stats(stats: &LendingStats): (u64, u64, u64, u64, u64) {
        (
            stats.total_borrowed,
            stats.total_deposited,
            stats.total_collateral,
            stats.user_count,
            stats.last_updated
        )
    }
}
