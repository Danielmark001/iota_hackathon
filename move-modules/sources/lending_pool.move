module intellilend::lending_pool {
    use std::signer;
    use std::vector;
    use std::option::{Self, Option};
    use std::string::{Self, String};
    use iota_framework::coin::{Self, Coin};
    use iota_framework::object::{Self, UID};
    use iota_framework::tx_context::{Self, TxContext};
    use iota_framework::event;
    use iota_framework::transfer;
    use iota_framework::token::{Self, SMR};
    use iota_framework::identity;
    use iota_framework::timestamp;
    use iota_framework::transfer;
    use iota_framework::token::{Self, SMR};
    use iota_framework::identity;
    use iota_framework::timestamp;
    
    /// Error codes
    const E_NOT_AUTHORIZED: u64 = 0;
    const E_INSUFFICIENT_FUNDS: u64 = 1;
    const E_INSUFFICIENT_COLLATERAL: u64 = 2;
    const E_INVALID_RISK_SCORE: u64 = 3;
    const E_INVALID_AMOUNT: u64 = 4;
    const E_OVER_BORROWING: u64 = 5;
    const E_ALREADY_INITIALIZED: u64 = 6;
    
    /// LendingPool object that holds tokens and manages lending operations
    struct LendingPool has key {
        id: UID,
        admin: address,
        total_deposits: u64,
        total_borrows: u64,
        total_collateral: u64,
        liquidation_threshold: u64, // In basis points (e.g. 8300 = 83%)
        interest_rate_base: u64,    // Base interest rate in basis points
    }
    
    /// User account data
    struct UserAccount has key, store {
        id: UID,
        owner: address,
        deposits: u64,
        borrows: u64,
        collateral: u64,
        risk_score: u8,       // 0-100 risk score (lower is better)
        identity_verified: bool,
        last_update: u64,
    }
    
    /// Event emitted when a user's risk score is updated
    struct RiskScoreUpdated has copy, drop {
        user: address,
        old_score: u8,
        new_score: u8,
        timestamp: u64,
    }
    
    /// Event emitted when a user deposits funds
    struct Deposit has copy, drop {
        user: address,
        amount: u64,
        timestamp: u64,
    }
    
    /// Event emitted when a user borrows funds
    struct Borrow has copy, drop {
        user: address,
        amount: u64,
        timestamp: u64,
    }
    
    /// Event emitted when a user repays a loan
    struct Repay has copy, drop {
        user: address,
        amount: u64,
        timestamp: u64,
    }
    
    /// Event emitted when a user withdraws funds
    struct Withdraw has copy, drop {
        user: address,
        amount: u64,
        timestamp: u64,
    }
    
    /// Capability that grants admin access
    struct AdminCap has key {
        id: UID,
    }
    
    /// Initialize the lending pool
    fun init(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        
        // Create admin capability
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };
        
        // Create lending pool with initial settings
        let lending_pool = LendingPool {
            id: object::new(ctx),
            admin: sender,
            total_deposits: 0,
            total_borrows: 0,
            total_collateral: 0,
            liquidation_threshold: 8300, // 83%
            interest_rate_base: 300,     // 3%
        };
        
        // Transfer admin capability to sender
        transfer::transfer(admin_cap, sender);
        
        // Share lending pool as a shared object
        transfer::share_object(lending_pool);
    }
    
    /// Create a new user account
    public entry fun create_account(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        
        let user_account = UserAccount {
            id: object::new(ctx),
            owner: sender,
            deposits: 0,
            borrows: 0,
            collateral: 0,
            risk_score: 50,            // Default medium risk
            identity_verified: false,
            last_update: tx_context::epoch(ctx),
        };
        
        // Transfer the new account to the sender
        transfer::transfer(user_account, sender);
    }
    
    /// Deposit SMR tokens into the lending pool
    public entry fun deposit(
        pool: &mut LendingPool, 
        account: &mut UserAccount,
        coin: Coin<SMR>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Ensure account owner is the sender
        assert!(account.owner == sender, E_NOT_AUTHORIZED);
        
        // Get deposit amount
        let amount = coin::value(&coin);
        
        // Ensure amount is valid
        assert!(amount > 0, E_INVALID_AMOUNT);
        
        // Add deposit to pool and user account
        pool.total_deposits = pool.total_deposits + amount;
        account.deposits = account.deposits + amount;
        account.last_update = tx_context::epoch(ctx);
        
        // Create Tangle record of deposit using token module
        let tangle_record = token::create_deposit_record(&coin, sender, ctx);
        
        // Transfer the SMR token to the pool's balance
        let pool_id = object::id_address(&pool.id);
        token::transfer_to_address(coin, pool_id, ctx);
        
        // Emit deposit event with Tangle-compatible format
        event::emit(Deposit {
            user: sender,
            amount,
            timestamp: timestamp::now_seconds(ctx),
        });
    }
    
    /// Withdraw SMR tokens from the lending pool
    public entry fun withdraw(
        pool: &mut LendingPool,
        account: &mut UserAccount,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Ensure account owner is the sender
        assert!(account.owner == sender, E_NOT_AUTHORIZED);
        
        // Ensure amount is valid
        assert!(amount > 0, E_INVALID_AMOUNT);
        assert!(amount <= account.deposits, E_INSUFFICIENT_FUNDS);
        
        // Calculate available balance (excluding what's needed to secure borrows)
        let required_deposits = calculate_required_deposits(account);
        let available_to_withdraw = account.deposits - required_deposits;
        
        // Ensure user can withdraw the requested amount
        assert!(amount <= available_to_withdraw, E_OVER_BORROWING);
        
        // Update deposit balances
        pool.total_deposits = pool.total_deposits - amount;
        account.deposits = account.deposits - amount;
        account.last_update = tx_context::epoch(ctx);
        
        // Create and transfer SMR coin to user
        let pool_id = object::id_address(&pool.id);
        let withdraw_coin = token::withdraw_from_pool<SMR>(pool_id, amount, ctx);
        
        // Create Tangle record of withdrawal
        token::create_withdrawal_record(&withdraw_coin, sender, ctx);
        
        // Transfer the tokens to the user
        transfer::transfer(withdraw_coin, sender);
        
        // Emit withdraw event with Tangle-compatible format
        event::emit(Withdraw {
            user: sender,
            amount,
            timestamp: timestamp::now_seconds(ctx),
        });
    }
    
    /// Add collateral to secure a loan
    public entry fun add_collateral(
        pool: &mut LendingPool,
        account: &mut UserAccount,
        coin: Coin<SMR>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Ensure account owner is the sender
        assert!(account.owner == sender, E_NOT_AUTHORIZED);
        
        // Get collateral amount
        let amount = coin::value(&coin);
        
        // Ensure amount is valid
        assert!(amount > 0, E_INVALID_AMOUNT);
        
        // Add collateral to pool and user account
        pool.total_collateral = pool.total_collateral + amount;
        account.collateral = account.collateral + amount;
        account.last_update = tx_context::epoch(ctx);
        
        // Merge coin into pool's balance
        // Note: In a real implementation, this would transfer to a coin store
        // For simplicity, we're just updating the accounting
        coin::destroy_zero(coin);
    }
    
    /// Borrow SMR tokens from the lending pool
    public entry fun borrow(
        pool: &mut LendingPool,
        account: &mut UserAccount,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Ensure account owner is the sender
        assert!(account.owner == sender, E_NOT_AUTHORIZED);
        
        // Ensure amount is valid
        assert!(amount > 0, E_INVALID_AMOUNT);
        
        // Check if pool has enough funds
        assert!(amount <= pool.total_deposits - pool.total_borrows, E_INSUFFICIENT_FUNDS);
        
        // Calculate max borrow amount based on collateral and risk score
        let max_borrow = calculate_max_borrow(account, pool);
        
        // Ensure borrow is within limits
        assert!(account.borrows + amount <= max_borrow, E_INSUFFICIENT_COLLATERAL);
        
        // Update borrow balances
        pool.total_borrows = pool.total_borrows + amount;
        account.borrows = account.borrows + amount;
        account.last_update = tx_context::epoch(ctx);
        
        // Create and transfer SMR coin to user
        // Note: In a real implementation, this would transfer from a coin store
        // For simplicity, we're just updating the accounting
        
        // Emit borrow event
        event::emit(Borrow {
            user: sender,
            amount,
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }
    
    /// Repay borrowed SMR tokens
    public entry fun repay(
        pool: &mut LendingPool,
        account: &mut UserAccount,
        coin: Coin<SMR>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Ensure account owner is the sender
        assert!(account.owner == sender, E_NOT_AUTHORIZED);
        
        // Get repay amount
        let amount = coin::value(&coin);
        
        // Ensure amount is valid
        assert!(amount > 0, E_INVALID_AMOUNT);
        
        // Cap repayment at the borrowed amount
        let repay_amount = if (amount > account.borrows) { account.borrows } else { amount };
        
        // Update borrow balances
        pool.total_borrows = pool.total_borrows - repay_amount;
        account.borrows = account.borrows - repay_amount;
        account.last_update = tx_context::epoch(ctx);
        
        // Merge coin into pool's balance
        // Note: In a real implementation, this would transfer to a coin store
        // For simplicity, we're just updating the accounting
        coin::destroy_zero(coin);
        
        // Emit repay event
        event::emit(Repay {
            user: sender,
            amount: repay_amount,
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }
    
    /// Update a user's risk score (admin only)
    public entry fun update_risk_score(
        _: &AdminCap,
        account: &mut UserAccount,
        new_score: u8,
        ctx: &mut TxContext
    ) {
        // Validate risk score (0-100)
        assert!(new_score <= 100, E_INVALID_RISK_SCORE);
        
        // Store old score for event
        let old_score = account.risk_score;
        
        // Update risk score and timestamp
        account.risk_score = new_score;
        account.last_update = tx_context::epoch(ctx);
        
        // Emit risk score update event
        event::emit(RiskScoreUpdated {
            user: account.owner,
            old_score,
            new_score,
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }
    
    /// Verify a user's identity using IOTA Identity framework
    public entry fun verify_identity(
        _: &AdminCap,
        account: &mut UserAccount,
        identity_proof: vector<u8>,
        ctx: &mut TxContext
    ) {
        // Verify the identity proof using IOTA Identity Framework
        let verification_result = identity::verify_identity_proof(
            account.owner,
            identity_proof,
            ctx
        );
        
        // Update account only if verification was successful
        assert!(verification_result, E_NOT_AUTHORIZED);
        
        account.identity_verified = true;
        account.last_update = tx_context::epoch(ctx);
        
        // Emit identity verification event
        event::emit(IdentityVerified {
            user: account.owner,
            timestamp: timestamp::now_seconds(ctx),
        });
    }
    
    /// Event emitted when a user's identity is verified
    struct IdentityVerified has copy, drop {
        user: address,
        timestamp: u64,
    }
    
    /// Calculate maximum borrow amount based on collateral and risk score
    fun calculate_max_borrow(account: &UserAccount, pool: &LendingPool): u64 {
        // Calculate collateral value adjusted by liquidation threshold
        let collateral_value = (account.collateral as u128) * (pool.liquidation_threshold as u128) / 10000;
        
        // Adjust based on risk score (0-100, lower is better)
        // High risk scores reduce borrowing capacity
        let risk_multiplier = 10000 - ((account.risk_score as u128) * 50);
        
        // Apply risk adjustment
        let adjusted_value = collateral_value * risk_multiplier / 10000;
        
        // Cap at u64 max value
        if (adjusted_value > (18446744073709551615 as u128)) {
            18446744073709551615
        } else {
            (adjusted_value as u64)
        }
    }
    
    /// Calculate required deposits to secure current borrows
    fun calculate_required_deposits(account: &UserAccount): u64 {
        // Simple calculation - require 1:1 coverage for borrowed amounts
        account.borrows
    }
    
    /// Get user account information
    public fun get_user_info(account: &UserAccount): (u64, u64, u64, u8, bool, u64) {
        (
            account.deposits,
            account.borrows,
            account.collateral,
            account.risk_score,
            account.identity_verified,
            account.last_update
        )
    }
    
    /// Get lending pool information
    public fun get_pool_info(pool: &LendingPool): (u64, u64, u64, u64, u64) {
        (
            pool.total_deposits,
            pool.total_borrows,
            pool.total_collateral,
            pool.liquidation_threshold,
            pool.interest_rate_base
        )
    }
    
    /// Calculate health factor for an account (collateral value / borrowed value)
    public fun calculate_health_factor(account: &UserAccount, pool: &LendingPool): u64 {
        if (account.borrows == 0) {
            // No borrows, return maximum health factor
            return 1000000; // Represent infinity as a large number
        };
        
        // Calculate collateral value adjusted by liquidation threshold
        let collateral_value = (account.collateral as u128) * (pool.liquidation_threshold as u128) / 10000;
        
        // Calculate health factor (collateral / borrows) * 10000 for precision
        let health_factor = collateral_value * 10000 / (account.borrows as u128);
        
        // Cap at u64 max value
        if (health_factor > (18446744073709551615 as u128)) {
            18446744073709551615
        } else {
            (health_factor as u64)
        }
    }
}
