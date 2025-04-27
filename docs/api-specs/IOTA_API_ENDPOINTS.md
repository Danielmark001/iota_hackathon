# IOTA API Endpoints Documentation

This document provides detailed information about the IOTA integration endpoints in the IntelliLend platform. These endpoints allow interactions with the IOTA Tangle for wallet integration, risk assessment, cross-layer transfers, and identity verification.

## Table of Contents
- [Base URL Configuration](#base-url-configuration)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Wallet Integration](#wallet-integration)
- [Risk Assessment](#risk-assessment)
- [Identity Verification](#identity-verification)
- [Cross-Layer Operations](#cross-layer-operations)
- [IOTA Streams Messaging](#iota-streams-messaging)
- [Monitoring Endpoints](#monitoring-endpoints)

## Base URL Configuration

All API endpoints are relative to the base URL of the IntelliLend API server.

**Development**: `http://localhost:3001`  
**Testnet Deployment**: `https://api.testnet.intellilend.io`

## Authentication

Most endpoints require authentication using a JWT token. Include the token in the Authorization header:

```
Authorization: Bearer <your_token>
```

Authentication tokens can be obtained via the `/api/auth/login` endpoint.

## Error Handling

The API uses standard HTTP status codes to indicate the success or failure of requests:

- **200 OK**: The request was successful
- **400 Bad Request**: The request was malformed
- **401 Unauthorized**: Authentication failed
- **403 Forbidden**: Authorization failed
- **404 Not Found**: The requested resource was not found
- **500 Internal Server Error**: An error occurred on the server

Error responses include a JSON object with details:

```json
{
  "error": "Error title",
  "message": "Detailed error message",
  "code": "ERROR_CODE"
}
```

## Wallet Integration

### Get IOTA Address

Generates or retrieves an IOTA address for the user.

**Endpoint**: `GET /api/iota/address`  
**Authentication**: Required  
**Parameters**: None

**Response**:
```json
{
  "address": "smr1qrv74z9xxqc3rvux8u0h6hmhx6hzcecfsjguf7lrqvqk9ffkp7glfupf6dv",
  "explorerUrl": "https://explorer.shimmer.network/testnet/addr/smr1qrv74z9xxqc3rvux8u0h6hmhx6hzcecfsjguf7lrqvqk9ffkp7glfupf6dv"
}
```

### Get IOTA Balance

Gets the balance for a specific IOTA address.

**Endpoint**: `GET /api/iota/balance/:address`  
**Authentication**: Required  
**Parameters**: 
- `address` (path): IOTA address to check

**Response**:
```json
{
  "baseCoins": "1000000000",
  "baseCoinsFormatted": "1000 SMR",
  "nativeTokens": [
    {
      "id": "0x08e68f7d32278637bf30e4a19eaab03c7373d1b27d083a1589b7cb15ecc9ff3b2c0100000000",
      "amount": "100",
      "metadata": {
        "name": "ExampleToken",
        "symbol": "EXT",
        "decimals": 6
      }
    }
  ]
}
```

### Send IOTA Tokens

Send tokens from the user's IOTA address.

**Endpoint**: `POST /api/iota/send`  
**Authentication**: Required  
**Request Body**:
```json
{
  "recipientAddress": "smr1qrv74z9xxqc3rvux8u0h6hmhx6hzcecfsjguf7lrqvqk9ffkp7glfupf6dv",
  "amount": "10.5",
  "tag": "IntelliLend Payment",
  "monitor": true
}
```

**Response**:
```json
{
  "blockId": "0x3f5a9a7e49c9dc118155a14e0741e0a64b6ab388d972bea7c7e4b34e0eb822d3",
  "transactionId": "0x3f5a9a7e49c9dc118155a14e0741e0a64b6ab388d972bea7c7e4b34e0eb822d3",
  "amount": "10.5",
  "address": "smr1qrv74z9xxqc3rvux8u0h6hmhx6hzcecfsjguf7lrqvqk9ffkp7glfupf6dv",
  "formattedAmount": "10.5 SMR",
  "timestamp": 1713574378823,
  "status": "pending",
  "explorerUrl": "https://explorer.shimmer.network/testnet/block/0x3f5a9a7e49c9dc118155a14e0741e0a64b6ab388d972bea7c7e4b34e0eb822d3"
}
```

### Submit Data to IOTA Tangle

Submit arbitrary data to the IOTA Tangle.

**Endpoint**: `POST /api/iota/submit`  
**Authentication**: Required  
**Request Body**:
```json
{
  "data": {
    "key1": "value1",
    "key2": "value2"
  },
  "tag": "CUSTOM_TAG"
}
```

**Response**:
```json
{
  "success": true,
  "blockId": "0xdca5eea05c1fa14b9d3e3f0537c177fc1f72c2ba486e95c3df7b9aac8b35f43d",
  "timestamp": 1713574412867,
  "explorerUrl": "https://explorer.shimmer.network/testnet/block/0xdca5eea05c1fa14b9d3e3f0537c177fc1f72c2ba486e95c3df7b9aac8b35f43d"
}
```

### Connect Wallet

Connect to an IOTA wallet (like Firefly).

**Endpoint**: `POST /api/wallet/connect`  
**Authentication**: Required  
**Request Body**:
```json
{
  "walletType": "firefly",
  "parameters": {}
}
```

**Response**:
```json
{
  "connected": true,
  "address": "smr1qrv74z9xxqc3rvux8u0h6hmhx6hzcecfsjguf7lrqvqk9ffkp7glfupf6dv",
  "balance": "1000 SMR"
}
```

## Risk Assessment

### Assess Risk

Perform a risk assessment using IOTA data.

**Endpoint**: `POST /api/risk-assessment`  
**Authentication**: Required  
**Request Body**:
```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "iotaAddress": "smr1qrv74z9xxqc3rvux8u0h6hmhx6hzcecfsjguf7lrqvqk9ffkp7glfupf6dv",
  "includeIOTA": true
}
```

**Response**:
```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "riskScore": 45,
  "riskClass": "Medium Risk",
  "confidence": 0.85,
  "recommendations": [
    {
      "title": "Increase Cross-Layer Transactions",
      "description": "Increase activity between IOTA L1 and L2 to improve your risk profile",
      "impact": "medium",
      "type": "cross_layer"
    }
  ],
  "topFactors": [
    {
      "factor": "Cross-Layer Activity",
      "impact": "positive",
      "description": "Cross-layer activity demonstrates blockchain expertise",
      "value": 5
    }
  ],
  "iotaData": {
    "address": "smr1qrv74z9xxqc3rvux8u0h6hmhx6hzcecfsjguf7lrqvqk9ffkp7glfupf6dv",
    "hasIotaAddress": true,
    "transactionCount": 15
  },
  "analysisTimestamp": 1713574478328
}
```

### Update Risk Score On-Chain

Update a risk score on the IOTA Tangle.

**Endpoint**: `POST /api/risk-assessment/update`  
**Authentication**: Required (Admin)  
**Request Body**:
```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "iotaAddress": "smr1qrv74z9xxqc3rvux8u0h6hmhx6hzcecfsjguf7lrqvqk9ffkp7glfupf6dv",
  "score": 42,
  "confidence": 0.92,
  "factors": ["transaction_history", "collateral_ratio"]
}
```

**Response**:
```json
{
  "success": true,
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "newScore": 42,
  "transactionHash": "0xabc123...",
  "tangleBlockId": "0x3f5a9a7e49c9dc118155a14e0741e0a64b6ab388d972bea7c7e4b34e0eb822d3",
  "tangleExplorerUrl": "https://explorer.shimmer.network/testnet/block/0x3f5a9a7e49c9dc118155a14e0741e0a64b6ab388d972bea7c7e4b34e0eb822d3",
  "timestamp": 1713574623451
}
```

### Create Privacy-Preserving Risk Assessment

Create a zero-knowledge proof for risk assessment.

**Endpoint**: `POST /api/risk-assessment/zk-proof`  
**Authentication**: Required  
**Request Body**:
```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "revealedFactors": ["collateral_ratio", "activity_regularity"],
  "scheme": "pedersen"
}
```

**Response**:
```json
{
  "proofId": "0x43219876fedbca0987654321fedbca09876543210987654321fedbca",
  "riskClass": "Medium Risk",
  "revealedAttributes": {
    "collateral_ratio": 1.75,
    "activity_regularity": 0.82
  },
  "merkleRoot": "0x3f5a9a7e49c9dc118155a14e0741e0a64b6ab388d972bea7c7e4b34e0eb822d3",
  "blockId": "0x3f5a9a7e49c9dc118155a14e0741e0a64b6ab388d972bea7c7e4b34e0eb822d3",
  "timestamp": 1713574723589
}
```

## Identity Verification

### Verify Identity with IOTA

Verify a user's identity using IOTA Identity.

**Endpoint**: `POST /api/identity/verify`  
**Authentication**: Required  
**Request Body**:
```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "iotaAddress": "smr1qrv74z9xxqc3rvux8u0h6hmhx6hzcecfsjguf7lrqvqk9ffkp7glfupf6dv",
  "verificationLevel": "advanced",
  "documents": {
    "idType": "passport",
    "idNumber": "AB123456",
    "country": "US"
  }
}
```

**Response**:
```json
{
  "success": true,
  "verificationId": "ver_123456789",
  "did": "did:iota:test:123456789abcdefghijklmnopqrstuvwxyz",
  "verificationLevel": "advanced",
  "status": "pending",
  "timestamp": 1713574801728
}
```

### Get Identity Status

Get the status of a user's IOTA Identity verification.

**Endpoint**: `GET /api/identity/status/:address`  
**Authentication**: Required  
**Parameters**:
- `address` (path): Ethereum address or DID

**Response**:
```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "did": "did:iota:test:123456789abcdefghijklmnopqrstuvwxyz",
  "verificationLevel": "advanced",
  "status": "verified",
  "credentials": [
    {
      "id": "cred_123456789",
      "type": "KYCVerification",
      "issuer": "did:iota:issuer:123456789",
      "issuanceDate": "2023-04-27T12:34:56.789Z",
      "expirationDate": "2024-04-27T12:34:56.789Z"
    }
  ],
  "lastUpdated": "2023-04-27T12:34:56.789Z"
}
```

## Cross-Layer Operations

### Initiate Cross-Layer Swap

Initiate a token swap between IOTA L1 and L2 layers.

**Endpoint**: `POST /api/bridge/initiate`  
**Authentication**: Required  
**Request Body**:
```json
{
  "direction": "L1toL2",
  "amount": "10.5",
  "fromAddress": "smr1qrv74z9xxqc3rvux8u0h6hmhx6hzcecfsjguf7lrqvqk9ffkp7glfupf6dv",
  "toAddress": "0x1234567890abcdef1234567890abcdef12345678"
}
```

**Response**:
```json
{
  "swapId": "0xabc123def456ghi789jkl012mno345pqr678stu",
  "direction": "L1toL2",
  "amount": "10.5",
  "fromAddress": "smr1qrv74z9xxqc3rvux8u0h6hmhx6hzcecfsjguf7lrqvqk9ffkp7glfupf6dv",
  "toAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "status": "initiated",
  "messageId": "0x45f1a987bc23d456789012e345f67a8b9c0d1e2f3",
  "timestamp": 1713574901822
}
```

### Get Swap Status

Get the status of a cross-layer swap.

**Endpoint**: `GET /api/bridge/status/:messageId`  
**Authentication**: Required  
**Parameters**:
- `messageId` (path): Message ID of the swap

**Response**:
```json
{
  "swapId": "0xabc123def456ghi789jkl012mno345pqr678stu",
  "direction": "L1toL2",
  "status": "confirmed",
  "l1Status": "confirmed",
  "l2Status": "confirmed",
  "l1Transaction": {
    "blockId": "0x3f5a9a7e49c9dc118155a14e0741e0a64b6ab388d972bea7c7e4b34e0eb822d3",
    "timestamp": 1713574912387
  },
  "l2Transaction": {
    "transactionHash": "0xdca5eea05c1fa14b9d3e3f0537c177fc1f72c2ba486e95c3df7b9aac8b35f43d",
    "blockNumber": 12345678
  },
  "lastUpdated": "2023-04-27T12:45:12.387Z"
}
```

### Get User Messages

Get cross-layer messages for a user.

**Endpoint**: `GET /api/bridge/messages/:address`  
**Authentication**: Required  
**Parameters**:
- `address` (path): User's Ethereum or IOTA address

**Response**:
```json
{
  "messages": [
    {
      "messageId": "0x45f1a987bc23d456789012e345f67a8b9c0d1e2f3",
      "direction": 0,
      "status": "Confirmed",
      "timestamp": 1713574912387
    },
    {
      "messageId": "0x98a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9",
      "direction": 1,
      "status": "Pending",
      "timestamp": 1713574965142
    }
  ]
}
```

### Estimate Swap Fees and Time

Estimate fees and confirmation time for a cross-layer swap.

**Endpoint**: `POST /api/bridge/estimate`  
**Authentication**: Required  
**Request Body**:
```json
{
  "direction": "L1toL2",
  "amount": "10.5",
  "fromAddress": "smr1qrv74z9xxqc3rvux8u0h6hmhx6hzcecfsjguf7lrqvqk9ffkp7glfupf6dv",
  "toAddress": "0x1234567890abcdef1234567890abcdef12345678"
}
```

**Response**:
```json
{
  "estimatedFee": 0.1,
  "estimatedTime": 120,
  "gasPrice": "5000000000",
  "bridgeFee": "0.005",
  "totalCost": "10.605",
  "timestamp": 1713575012389
}
```

## IOTA Streams Messaging

### Create Message Channel

Create a secure communication channel using IOTA Streams.

**Endpoint**: `POST /api/streams/channels`  
**Authentication**: Required  
**Request Body**:
```json
{
  "channelId": "lending-channel-123",
  "participants": [
    "0x1234567890abcdef1234567890abcdef12345678",
    "0x5678901234abcdef5678901234abcdef56789012"
  ]
}
```

**Response**:
```json
{
  "channelId": "lending-channel-123",
  "author": "0x1234567890abcdef1234567890abcdef12345678",
  "participants": [
    "0x1234567890abcdef1234567890abcdef12345678",
    "0x5678901234abcdef5678901234abcdef56789012"
  ],
  "blockId": "0x3f5a9a7e49c9dc118155a14e0741e0a64b6ab388d972bea7c7e4b34e0eb822d3",
  "tangleExplorerUrl": "https://explorer.shimmer.network/testnet/block/0x3f5a9a7e49c9dc118155a14e0741e0a64b6ab388d972bea7c7e4b34e0eb822d3",
  "created": "2023-04-27T12:50:12.389Z"
}
```

### Send Message

Send a message on a Streams channel.

**Endpoint**: `POST /api/streams/messages`  
**Authentication**: Required  
**Request Body**:
```json
{
  "channelId": "lending-channel-123",
  "message": {
    "type": "loan_offer",
    "data": {
      "amount": 1000,
      "interestRate": 5.5,
      "term": 30
    }
  },
  "messageType": "loan_document"
}
```

**Response**:
```json
{
  "messageId": "msg_123456789",
  "channelId": "lending-channel-123",
  "sender": "0x1234567890abcdef1234567890abcdef12345678",
  "type": "loan_document",
  "timestamp": "2023-04-27T12:52:34.567Z",
  "blockId": "0xdca5eea05c1fa14b9d3e3f0537c177fc1f72c2ba486e95c3df7b9aac8b35f43d"
}
```

### Get Messages

Get messages from a channel.

**Endpoint**: `GET /api/streams/channels/:channelId/messages`  
**Authentication**: Required  
**Parameters**:
- `channelId` (path): ID of the channel
- `limit` (query, optional): Maximum number of messages to return (default: 20)

**Response**:
```json
{
  "channelId": "lending-channel-123",
  "messages": [
    {
      "messageId": "msg_123456789",
      "sender": "0x1234567890abcdef1234567890abcdef12345678",
      "type": "loan_document",
      "content": {
        "type": "loan_offer",
        "data": {
          "amount": 1000,
          "interestRate": 5.5,
          "term": 30
        }
      },
      "timestamp": "2023-04-27T12:52:34.567Z",
      "blockId": "0xdca5eea05c1fa14b9d3e3f0537c177fc1f72c2ba486e95c3df7b9aac8b35f43d"
    }
  ]
}
```

## Monitoring Endpoints

### Health Check

Check the health of the IOTA connection.

**Endpoint**: `GET /health`  
**Authentication**: None  
**Parameters**: None

**Response**:
```json
{
  "status": "healthy",
  "services": {
    "iota": {
      "status": "healthy",
      "network": "testnet",
      "node": "https://api.testnet.shimmer.network"
    },
    "database": {
      "status": "healthy"
    },
    "api": {
      "status": "healthy",
      "version": "1.2.0"
    }
  },
  "timestamp": 1713575112389
}
```

### IOTA Network Status

Get detailed IOTA network information.

**Endpoint**: `GET /api/iota/network-status`  
**Authentication**: None  
**Parameters**: None

**Response**:
```json
{
  "network": "testnet",
  "nodeUrl": "https://api.testnet.shimmer.network",
  "isHealthy": true,
  "nodeVersion": "2.0.0-rc.6",
  "protocolVersion": "1",
  "latestMilestoneIndex": 3924115,
  "confirmedMilestoneIndex": 3924113,
  "pruningIndex": 3424115,
  "features": [
    "pow",
    "zero-message-queue"
  ],
  "metrics": {
    "blocksPerSecond": 12.5,
    "referencedRate": 98.2,
    "referencedBlocksPerSecond": 12.3
  },
  "timestamp": 1713575212389
}
```
