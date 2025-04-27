# Wallet Connection Guide

This guide provides step-by-step instructions for connecting your IOTA and EVM wallets to the IntelliLend platform, enabling cross-layer functionality for lending and borrowing.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Connecting Your IOTA Wallet](#connecting-your-iota-wallet)
  - [Using Firefly Wallet](#using-firefly-wallet)
  - [Using Tanglepay Wallet](#using-tanglepay-wallet)
  - [Troubleshooting IOTA Wallet Connection](#troubleshooting-iota-wallet-connection)
- [Connecting Your EVM Wallet](#connecting-your-evm-wallet)
  - [Using MetaMask](#using-metamask)
  - [Using WalletConnect](#using-walletconnect)
  - [Troubleshooting EVM Wallet Connection](#troubleshooting-evm-wallet-connection)
- [Cross-Layer Authorization](#cross-layer-authorization)
- [Wallet Security Best Practices](#wallet-security-best-practices)
- [FAQ](#faq)

## Prerequisites

Before connecting your wallets to IntelliLend, ensure you have:

1. **IOTA Wallet**: Install [Firefly](https://firefly.iota.org/) (recommended) or [Tanglepay](https://tanglepay.com/)
2. **EVM Wallet**: Install [MetaMask](https://metamask.io/) or any WalletConnect-compatible wallet
3. **Testnet Tokens**: Get testnet tokens from the [Shimmer Testnet Faucet](https://faucet.testnet.shimmer.network/)
4. **Browser**: Latest version of Chrome, Firefox, or Brave
5. **Network Configuration**: Ensure your wallets are configured for the Shimmer Testnet

## Connecting Your IOTA Wallet

### Using Firefly Wallet

1. **Install Firefly Wallet**:
   - Download Firefly from [firefly.iota.org](https://firefly.iota.org/)
   - Install and set up your wallet following Firefly's instructions
   - Create a new profile and wallet if you don't have one

2. **Configure for Testnet**:
   - Open Firefly
   - Go to "Settings" > "Advanced settings"
   - Select "Shimmer Testnet" from the network dropdown
   - Restart Firefly

3. **Connect to IntelliLend**:
   - Log in to [IntelliLend](https://testnet.intellilend.io)
   - Navigate to the "Wallet" section
   - Click "Connect IOTA Wallet"
   - Select "Firefly" from the wallet options

4. **Authorize Connection**:
   - A popup will appear in Firefly asking for connection permission
   - Review the permission request
   - Click "Approve" to connect your wallet

5. **Verify Connection**:
   - Once connected, your IOTA address and balance will appear in the IntelliLend interface
   - The connection indicator will show "Connected" with a green dot

### Using Tanglepay Wallet

1. **Install Tanglepay**:
   - Download Tanglepay from [tanglepay.com](https://tanglepay.com/)
   - Follow the setup instructions to create a new wallet

2. **Connect to IntelliLend**:
   - Log in to [IntelliLend](https://testnet.intellilend.io)
   - Navigate to the "Wallet" section
   - Click "Connect IOTA Wallet"
   - Select "Tanglepay" from the wallet options

3. **Authorize Connection**:
   - Tanglepay will prompt you to authorize the connection
   - Review the permission request and approve it

4. **Verify Connection**:
   - Your IOTA address and balance will appear in the IntelliLend interface
   - The connection status indicator will show "Connected"

### Troubleshooting IOTA Wallet Connection

- **Connection Timeout**: Ensure Firefly is running and unlocked before attempting to connect
- **Network Mismatch**: Verify both IntelliLend and your wallet are using the Shimmer Testnet
- **Missing dApp Connector**: Update to the latest version of your wallet which supports dApp connections
- **Permission Error**: Restart your wallet and try connecting again

## Connecting Your EVM Wallet

### Using MetaMask

1. **Install MetaMask**:
   - Download MetaMask from [metamask.io](https://metamask.io/)
   - Follow the setup instructions to create a wallet

2. **Configure for IOTA EVM**:
   - Open MetaMask
   - Go to Settings > Networks > Add Network
   - Enter the following details:
     - Network Name: `Shimmer Testnet EVM`
     - RPC URL: `https://api.testnet.shimmer.network/evm`
     - Chain ID: `1072`
     - Currency Symbol: `SMR`
     - Block Explorer URL: `https://explorer.evm.testnet.shimmer.network`
   - Click "Save"

3. **Connect to IntelliLend**:
   - Log in to [IntelliLend](https://testnet.intellilend.io)
   - Click "Connect Wallet" in the top right corner
   - Select "MetaMask" from the options
   - Approve the connection request in MetaMask

4. **Verify Connection**:
   - Your EVM address and balance will appear in the header
   - The status will show "Connected" in the wallet section

### Using WalletConnect

1. **Install a WalletConnect-compatible Wallet**:
   - Install any wallet that supports WalletConnect protocol
   - Popular options include Trust Wallet, Rainbow, and Argent

2. **Connect to IntelliLend**:
   - Log in to [IntelliLend](https://testnet.intellilend.io)
   - Click "Connect Wallet" in the top right corner
   - Select "WalletConnect" from the options
   - Scan the QR code with your mobile wallet
   - Approve the connection request

3. **Verify Connection**:
   - Your EVM address and balance will appear in the interface
   - The status will show "Connected via WalletConnect"

### Troubleshooting EVM Wallet Connection

- **Wrong Network**: Ensure your wallet is set to the Shimmer Testnet EVM network
- **Connection Rejected**: Check your wallet's security settings and try again
- **Stuck Connection**: Disconnect by clicking your address and selecting "Disconnect"
- **Missing Network**: Add the Shimmer Testnet EVM network manually using the details provided

## Cross-Layer Authorization

For full platform functionality, you need to authorize cross-layer operations:

1. **Connect Both Wallets**:
   - Follow the steps above to connect both your IOTA and EVM wallets

2. **Link Wallets**:
   - Navigate to "Settings" > "Wallet Management"
   - Click "Link Wallets"
   - Sign the linking message with both wallets when prompted
   - This creates a cryptographic association between your IOTA and EVM addresses

3. **Authorize Cross-Layer Operations**:
   - Go to "Cross-Layer" section
   - Click "Authorize Cross-Layer Operations"
   - Sign the authorization message with both wallets
   - This permission allows the platform to initiate cross-layer transfers

4. **Verify Authorization**:
   - The Cross-Layer dashboard will show "Fully Authorized" status
   - Both wallets will be listed as linked in the Wallet Management section

## Wallet Security Best Practices

1. **Never Share Private Keys**: The platform will never ask for your seed phrase or private keys
2. **Verify Transaction Details**: Always check transaction details before signing
3. **Use Hardware Wallets**: For additional security, use hardware wallets when possible
4. **Limited Permissions**: Only grant the specific permissions needed
5. **Regular Checks**: Periodically review connected applications in your wallet
6. **Test Transactions**: Start with small test transactions before larger amounts

## FAQ

### General Questions

**Q: Do I need both IOTA and EVM wallets?**
A: Yes, to utilize the full cross-layer functionality of IntelliLend, you need both wallet types connected.

**Q: Are my funds safe when connecting my wallet?**
A: Yes, the platform never has direct access to your funds. All transactions require your explicit approval.

**Q: What if I don't have testnet tokens?**
A: You can get Shimmer Testnet tokens from the [Shimmer Testnet Faucet](https://faucet.testnet.shimmer.network/).

### IOTA Wallet Questions

**Q: Why does Firefly show a network error?**
A: Ensure you're connected to the internet and the Shimmer Testnet is operational. If issues persist, try switching to a different node in Firefly settings.

**Q: Can I use my mainnet IOTA wallet?**
A: No, the testnet platform requires a testnet wallet. Create a separate profile in Firefly for testnet.

**Q: Why can't I see my transaction history?**
A: Transaction history is fetched from the Tangle. If it's not visible, try refreshing or check your internet connection.

### EVM Wallet Questions

**Q: Why doesn't MetaMask connect to the Shimmer EVM?**
A: Ensure you've added the correct network details. Sometimes you need to restart your browser after adding a new network.

**Q: Can I use the same address for both IOTA and EVM?**
A: No, IOTA and EVM use different address formats and cryptographic systems.

**Q: How do I get SMR tokens in my EVM wallet?**
A: You can use the Cross-Layer Swap feature in IntelliLend to transfer tokens from your IOTA wallet to your EVM wallet.
