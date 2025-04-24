# Getting IOTA Testnet Tokens for Deployment

To deploy the IntelliLend contracts to the IOTA EVM Testnet, you'll need to fund your wallet with testnet tokens. Here's how to do it:

## Your Wallet Address

Your wallet address is: `0x3c0d9184692b1E34852d0F0be7adC3bd1Dbf0e15`

## Steps to Get Testnet Tokens

1. **Visit the IOTA Testnet Faucet**
   - Go to: https://faucet.testnet.iotaledger.net
   - This official faucet provides free testnet tokens for development purposes

2. **Request Tokens**
   - Enter your wallet address: `0x3c0d9184692b1E34852d0F0be7adC3bd1Dbf0e15`
   - Complete any CAPTCHA or verification steps
   - Submit the request

3. **Wait for Confirmation**
   - Testnet tokens should be credited to your account within a few minutes
   - You can check your balance using the IOTA EVM Testnet Explorer

4. **Verify Your Balance**
   - Go to: https://explorer.evm.testnet.iotaledger.net/address/0x3c0d9184692b1E34852d0F0be7adC3bd1Dbf0e15
   - Your balance should show the received testnet tokens

## Alternative Faucet Method

If the primary faucet isn't working, try these alternatives:

1. **EVM Toolkit Faucet**
   - Go to: https://evm-toolkit.evm.testnet.iotaledger.net
   - Connect your wallet and request tokens through their interface

2. **IOTA Discord Community**
   - Join the IOTA Discord: https://discord.gg/iota-builders
   - Ask for testnet tokens in the appropriate developer channel

## After Receiving Tokens

Once your wallet is funded with testnet tokens, you can run the deployment script again to deploy the actual contracts:

```bash
node scripts/deploy-iota-testnet.js
```

The script will detect your balance and proceed with the real deployment instead of using mock addresses.

## Testnet Deployment vs. Production

Remember that the testnet deployment:
- Uses tokens with no real value
- May be reset occasionally by the IOTA foundation
- Is perfect for development and testing
- Doesn't require real funds

For a production deployment to IOTA EVM Mainnet, you would need real IOTA tokens.