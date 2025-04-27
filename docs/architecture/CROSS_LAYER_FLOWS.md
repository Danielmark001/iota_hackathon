# Cross-Layer Transaction Flows

This document explains the architecture and flow of cross-layer transactions between IOTA Layer 1 (Tangle) and Layer 2 (EVM) in the IntelliLend platform.

## Table of Contents

- [Overview](#overview)
- [Architecture Components](#architecture-components)
- [Transaction Flow Diagrams](#transaction-flow-diagrams)
  - [L1 to L2 Transfer Flow](#l1-to-l2-transfer-flow)
  - [L2 to L1 Transfer Flow](#l2-to-l1-transfer-flow)
  - [Cross-Layer Risk Assessment Flow](#cross-layer-risk-assessment-flow)
  - [Identity Verification Cross-Layer Flow](#identity-verification-cross-layer-flow)
- [Transaction States and Status Tracking](#transaction-states-and-status-tracking)
- [Error Handling and Recovery](#error-handling-and-recovery)
- [Circuit Breaker Patterns](#circuit-breaker-patterns)
- [Performance Characteristics](#performance-characteristics)

## Overview

The cross-layer functionality in IntelliLend enables seamless interaction between IOTA's Layer 1 (the Tangle) and Layer 2 (the EVM-compatible smart contract layer). This integration allows users to:

- Transfer assets between layers
- Verify identity across layers
- Perform risk assessment using data from both layers
- Initiate lending operations that span both layers

The integration uses a bridge mechanism that maintains state consistency, ensures atomic operations, and provides reliable transaction verification between the layers.

## Architecture Components

The cross-layer architecture consists of the following key components:

```
+---------------------+       +---------------------+
|  IOTA Layer 1       |       |  IOTA Layer 2       |
|  (Tangle)           |       |  (EVM)              |
|                     |       |                     |
|  - IOTA Client      |       |  - Ethereum Client  |
|  - IOTA Wallet      |       |  - Smart Contracts  |
|  - IOTA Streams     |       |  - Bridge Contract  |
|  - IOTA Identity    |       |  - Lending Pool     |
+----------+----------+       +---------+-----------+
           |                            |
           |                            |
+----------v----------------------------v-----------+
|                                                   |
|               Cross-Layer Bridge                  |
|                                                   |
|  - Message Passing                                |
|  - Asset Transfers                                |
|  - State Synchronization                          |
|  - Transaction Monitoring                         |
|  - Circuit Breakers                               |
|                                                   |
+-------------------+-------------------------------+
                    |
                    |
+-------------------v-------------------------------+
|                                                   |
|               IntelliLend Backend                 |
|                                                   |
|  - API Services                                   |
|  - Aggregator Service                             |
|  - Transaction Processor                          |
|  - Risk Assessment Engine                         |
|  - Identity Management                            |
|                                                   |
+-------------------+-------------------------------+
                    |
                    |
+-------------------v-------------------------------+
|                                                   |
|               IntelliLend Frontend               |
|                                                   |
|  - Wallet Connection UI                           |
|  - Cross-Layer Dashboard                          |
|  - Transaction History                            |
|  - Risk Visualization                             |
|                                                   |
+---------------------------------------------------+
```

## Transaction Flow Diagrams

### L1 to L2 Transfer Flow

This diagram illustrates the process of transferring tokens from IOTA Layer 1 (Tangle) to Layer 2 (EVM).

```
┌─────────────┐          ┌───────────────┐          ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│   User      │          │  IOTA Wallet  │          │ Cross-Layer  │          │  EVM Bridge  │          │ User's EVM   │
│  Interface  │          │  (Layer 1)    │          │  Service     │          │  Contract    │          │  Account     │
└──────┬──────┘          └───────┬───────┘          └──────┬───────┘          └──────┬───────┘          └──────┬───────┘
       │                         │                         │                         │                         │
       │  1. Initiate L1->L2     │                         │                         │                         │
       │     Transfer            │                         │                         │                         │
       │─────────────────────────>                         │                         │                         │
       │                         │                         │                         │                         │
       │                         │  2. Sign & Submit       │                         │                         │
       │                         │     L1 Transaction      │                         │                         │
       │                         │─────────────────────────>                         │                         │
       │                         │                         │                         │                         │
       │                         │  3. Monitor for         │                         │                         │
       │                         │     Confirmation        │                         │                         │
       │                         │<─────────────────────────                         │                         │
       │                         │                         │                         │                         │
       │                         │  4. Transaction         │                         │                         │
       │                         │     Confirmed           │                         │                         │
       │                         │─────────────────────────>                         │                         │
       │                         │                         │                         │                         │
       │                         │                         │  5. Verify L1           │                         │
       │                         │                         │     Transaction         │                         │
       │                         │                         │                         │                         │
       │                         │                         │  6. Prepare Bridge      │                         │
       │                         │                         │     Transaction         │                         │
       │                         │                         │─────────────────────────>                         │
       │                         │                         │                         │                         │
       │                         │                         │                         │  7. Mint Equivalent     │
       │                         │                         │                         │     Tokens on L2        │
       │                         │                         │                         │─────────────────────────>
       │                         │                         │                         │                         │
       │                         │                         │                         │  8. L2 Transaction     │
       │                         │                         │                         │     Confirmed          │
       │                         │                         │                         │<─────────────────────────
       │                         │                         │                         │                         │
       │                         │                         │  9. Bridge              │                         │
       │                         │                         │     Transaction         │                         │
       │                         │                         │     Confirmed           │                         │
       │                         │                         │<─────────────────────────                         │
       │                         │                         │                         │                         │
       │  10. Update UI with     │                         │                         │                         │
       │      Completed Status   │                         │                         │                         │
       │<─────────────────────────────────────────────────────────────────────────────────────────────────────|
       │                         │                         │                         │                         │
```

**Process Steps:**

1. User initiates L1->L2 transfer via the IntelliLend interface
2. IOTA wallet signs and submits the L1 transaction to the Tangle
3. Cross-Layer Service monitors the transaction for confirmation
4. Once confirmed on L1, the Cross-Layer Service is notified
5. Cross-Layer Service verifies the L1 transaction details
6. Cross-Layer Service submits a bridge transaction to the EVM Bridge Contract
7. EVM Bridge Contract mints equivalent tokens to the user's EVM account
8. L2 transaction is confirmed on the EVM chain
9. Bridge confirms the successful completion
10. UI is updated with completed status

### L2 to L1 Transfer Flow

This diagram illustrates the process of transferring tokens from IOTA Layer 2 (EVM) to Layer 1 (Tangle).

```
┌─────────────┐          ┌───────────────┐          ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│   User      │          │  EVM Wallet   │          │ Cross-Layer  │          │  IOTA Bridge │          │ User's IOTA  │
│  Interface  │          │  (Layer 2)    │          │  Service     │          │  Service     │          │  Address     │
└──────┬──────┘          └───────┬───────┘          └──────┬───────┘          └──────┬───────┘          └──────┬───────┘
       │                         │                         │                         │                         │
       │  1. Initiate L2->L1     │                         │                         │                         │
       │     Transfer            │                         │                         │                         │
       │─────────────────────────>                         │                         │                         │
       │                         │                         │                         │                         │
       │                         │  2. Call Bridge         │                         │                         │
       │                         │     Contract            │                         │                         │
       │                         │─────────────────────────>                         │                         │
       │                         │                         │                         │                         │
       │                         │  3. Lock or Burn        │                         │                         │
       │                         │     L2 Tokens           │                         │                         │
       │                         │<─────────────────────────                         │                         │
       │                         │                         │                         │                         │
       │                         │  4. L2 Transaction      │                         │                         │
       │                         │     Confirmed           │                         │                         │
       │                         │─────────────────────────>                         │                         │
       │                         │                         │                         │                         │
       │                         │                         │  5. Verify L2           │                         │
       │                         │                         │     Transaction         │                         │
       │                         │                         │                         │                         │
       │                         │                         │  6. Initiate L1         │                         │
       │                         │                         │     Transaction         │                         │
       │                         │                         │─────────────────────────>                         │
       │                         │                         │                         │                         │
       │                         │                         │                         │  7. Send Tokens to      │
       │                         │                         │                         │     IOTA Address        │
       │                         │                         │                         │─────────────────────────>
       │                         │                         │                         │                         │
       │                         │                         │                         │  8. L1 Transaction      │
       │                         │                         │                         │     Confirmed           │
       │                         │                         │                         │<─────────────────────────
       │                         │                         │                         │                         │
       │                         │                         │  9. Bridge              │                         │
       │                         │                         │     Transaction         │                         │
       │                         │                         │     Confirmed           │                         │
       │                         │                         │<─────────────────────────                         │
       │                         │                         │                         │                         │
       │  10. Update UI with     │                         │                         │                         │
       │      Completed Status   │                         │                         │                         │
       │<─────────────────────────────────────────────────────────────────────────────────────────────────────|
       │                         │                         │                         │                         │
```

**Process Steps:**

1. User initiates L2->L1 transfer via the IntelliLend interface
2. EVM wallet calls the Bridge Contract
3. Bridge Contract locks or burns the L2 tokens
4. L2 transaction is confirmed
5. Cross-Layer Service verifies the L2 transaction details
6. Cross-Layer Service initiates an L1 transaction
7. IOTA Bridge Service sends tokens to the user's IOTA address
8. L1 transaction is confirmed on the Tangle
9. Bridge confirms the successful completion
10. UI is updated with completed status

### Cross-Layer Risk Assessment Flow

This diagram illustrates how risk assessment uses data from both layers.

```
┌─────────────┐          ┌───────────────┐          ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│   User      │          │  Risk API     │          │ IOTA Tangle  │          │ IOTA EVM     │          │ AI Risk      │
│  Interface  │          │  Endpoint     │          │ Data Fetcher │          │ Data Fetcher │          │ Model        │
└──────┬──────┘          └───────┬───────┘          └──────┬───────┘          └──────┬───────┘          └──────┬───────┘
       │                         │                         │                         │                         │
       │  1. Request Risk        │                         │                         │                         │
       │     Assessment          │                         │                         │                         │
       │─────────────────────────>                         │                         │                         │
       │                         │                         │                         │                         │
       │                         │  2. Fetch IOTA          │                         │                         │
       │                         │     Transaction Data    │                         │                         │
       │                         │─────────────────────────>                         │                         │
       │                         │                         │                         │                         │
       │                         │  3. Return L1           │                         │                         │
       │                         │     Transaction History │                         │                         │
       │                         │<─────────────────────────                         │                         │
       │                         │                         │                         │                         │
       │                         │  4. Fetch EVM           │                         │                         │
       │                         │     Transaction Data    │                         │                         │
       │                         │─────────────────────────────────────────────────>                         │
       │                         │                         │                         │                         │
       │                         │  5. Return L2           │                         │                         │
       │                         │     Transaction History │                         │                         │
       │                         │<─────────────────────────────────────────────────                         │
       │                         │                         │                         │                         │
       │                         │  6. Analyze             │                         │                         │
       │                         │     Cross-Layer Data    │                         │                         │
       │                         │─────────────────────────────────────────────────────────────────────────────>
       │                         │                         │                         │                         │
       │                         │  7. Return Risk         │                         │                         │
       │                         │     Assessment          │                         │                         │
       │                         │<─────────────────────────────────────────────────────────────────────────────
       │                         │                         │                         │                         │
       │                         │  8. Store Risk Score    │                         │                         │
       │                         │     on Tangle           │                         │                         │
       │                         │─────────────────────────>                         │                         │
       │                         │                         │                         │                         │
       │  9. Return Risk         │                         │                         │                         │
       │     Assessment Result   │                         │                         │                         │
       │<─────────────────────────                         │                         │                         │
       │                         │                         │                         │                         │
```

**Process Steps:**

1. User requests a risk assessment via the IntelliLend interface
2. Risk API requests IOTA transaction data from the Tangle
3. IOTA Tangle Data Fetcher returns L1 transaction history
4. Risk API requests EVM transaction data
5. EVM Data Fetcher returns L2 transaction history
6. Risk API sends combined cross-layer data to the AI Risk Model
7. AI Risk Model returns risk assessment results
8. Risk API stores the risk score on the Tangle for future reference
9. Risk assessment results are returned to the user interface

### Identity Verification Cross-Layer Flow

This diagram illustrates how identity verification works across layers.

```
┌─────────────┐          ┌───────────────┐          ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│   User      │          │  Identity     │          │ IOTA Identity │         │ Zero-Knowledge│         │ Smart Contract │
│  Interface  │          │  API          │          │ Service      │          │ Proof Service │         │ Verifier     │
└──────┬──────┘          └───────┬───────┘          └──────┬───────┘          └──────┬───────┘          └──────┬───────┘
       │                         │                         │                         │                         │
       │  1. Submit Identity     │                         │                         │                         │
       │     Documents           │                         │                         │                         │
       │─────────────────────────>                         │                         │                         │
       │                         │                         │                         │                         │
       │                         │  2. Create DID          │                         │                         │
       │                         │     on Tangle           │                         │                         │
       │                         │─────────────────────────>                         │                         │
       │                         │                         │                         │                         │
       │                         │  3. Return DID          │                         │                         │
       │                         │     Document            │                         │                         │
       │                         │<─────────────────────────                         │                         │
       │                         │                         │                         │                         │
       │                         │  4. Issue Verifiable    │                         │                         │
       │                         │     Credential          │                         │                         │
       │                         │─────────────────────────>                         │                         │
       │                         │                         │                         │                         │
       │                         │  5. Return              │                         │                         │
       │                         │     Credential          │                         │                         │
       │                         │<─────────────────────────                         │                         │
       │                         │                         │                         │                         │
       │                         │  6. Generate            │                         │                         │
       │                         │     ZK Proof            │                         │                         │
       │                         │─────────────────────────────────────────────────>                         │
       │                         │                         │                         │                         │
       │                         │  7. Return              │                         │                         │
       │                         │     ZK Proof            │                         │                         │
       │                         │<─────────────────────────────────────────────────                         │
       │                         │                         │                         │                         │
       │                         │  8. Submit Proof        │                         │                         │
       │                         │     to Smart Contract   │                         │                         │
       │                         │─────────────────────────────────────────────────────────────────────────────>
       │                         │                         │                         │                         │
       │                         │  9. Verify Proof        │                         │                         │
       │                         │     On-Chain            │                         │                         │
       │                         │<─────────────────────────────────────────────────────────────────────────────
       │                         │                         │                         │                         │
       │  10. Return Identity    │                         │                         │                         │
       │      Verification Result│                         │                         │                         │
       │<─────────────────────────                         │                         │                         │
       │                         │                         │                         │                         │
```

**Process Steps:**

1. User submits identity documents via the IntelliLend interface
2. Identity API creates a Decentralized Identifier (DID) on the Tangle
3. IOTA Identity Service returns the DID document
4. Identity API issues a Verifiable Credential
5. IOTA Identity Service returns the credential
6. Identity API requests a Zero-Knowledge Proof generation
7. ZK Proof Service returns the proof
8. Identity API submits the proof to the Smart Contract Verifier
9. Smart Contract verifies the proof on-chain
10. Identity verification result is returned to the user interface

## Transaction States and Status Tracking

Cross-layer transactions go through multiple states during their lifecycle:

1. **Initiated**: Transaction has been requested by the user
2. **L1 Pending**: Transaction has been submitted to Layer 1 but not yet confirmed
3. **L1 Confirmed**: Transaction is confirmed on Layer 1
4. **L2 Pending**: Transaction has been submitted to Layer 2 but not yet confirmed
5. **L2 Confirmed**: Transaction is confirmed on Layer 2
6. **Completed**: All transaction steps have been completed successfully
7. **Failed**: Transaction has failed at some stage
8. **Cancelled**: Transaction has been cancelled by the user or the system

Status tracking is maintained through the following mechanisms:

- **MessageIDs**: Unique identifiers for cross-layer messages
- **Block Monitoring**: Continuous monitoring of blocks on both L1 and L2
- **Transaction Linking**: Association of related transactions across layers
- **Status Updates**: Real-time status updates pushed to the user interface
- **Periodic Reconciliation**: Scheduled checks to reconcile transaction status

## Error Handling and Recovery

The system implements several error handling and recovery mechanisms:

1. **Automatic Retry**: Failed operations are automatically retried with exponential backoff
2. **Manual Retry**: Users can manually retry failed transactions
3. **Transaction Timeout**: Transactions that don't complete within a specified time are marked for review
4. **Partial Completion**: If a transaction completes on one layer but fails on another, the system records the state and offers recovery options
5. **Rollback**: In case of serious errors, transactions can be rolled back to maintain system consistency
6. **Error Logging**: Comprehensive error logging for analysis and debugging

## Circuit Breaker Patterns

Circuit breakers are implemented to prevent cascading failures:

1. **Transaction Volume Circuit Breaker**: Limits the number of transactions per time period
2. **Node Health Circuit Breaker**: Prevents transactions when node health is degraded
3. **Bridge Status Circuit Breaker**: Disables cross-layer operations when the bridge is not functioning properly
4. **Network Congestion Circuit Breaker**: Temporarily halts operations during network congestion
5. **Price Impact Circuit Breaker**: Prevents transactions that would cause significant price impact

## Performance Characteristics

Performance characteristics of cross-layer transactions:

| Operation | Average Time | Confirmation Blocks | Gas Usage (L2) |
|-----------|--------------|---------------------|----------------|
| L1 to L2 Transfer | 2-5 minutes | 1 L1, 2 L2 | ~100,000 gas |
| L2 to L1 Transfer | 3-7 minutes | 2 L2, 1 L1 | ~150,000 gas |
| Identity Verification | 5-10 minutes | 1 L1, 2 L2 | ~200,000 gas |
| Risk Score Update | 1-3 minutes | 1 L1 | N/A |

**Throughput Constraints:**
- IOTA Tangle: Up to 1,000 TPS
- IOTA EVM Layer: Up to 100 TPS
- Bridge Capacity: Up to 50 cross-layer transactions per minute

**Latency Factors:**
- Tangle confirmation time: 5-15 seconds
- EVM block time: 2 seconds
- Bridge processing: 10-30 seconds
- Cross-layer message propagation: 5-20 seconds
