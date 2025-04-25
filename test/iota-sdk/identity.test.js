/**
 * Unit Tests for IOTA Identity Module
 * 
 * This file contains tests for the IOTA Identity functionality,
 * including DIDs, Verifiable Credentials, and zero-knowledge proofs.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const crypto = require('crypto');

// Mock the identity-wasm module
const identityWasmMock = {
  Identity: {
    generateEd25519VerificationKey: sinon.stub().resolves({
      type: 'Ed25519VerificationKey2018',
      publicKey: 'mockPublicKey',
      privateKey: 'mockPrivateKey'
    }),
    createIdentity: sinon.stub().resolves({
      id: 'did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz',
      authentication: [],
      service: []
    }),
    createVerificationMethod: sinon.stub().resolves({
      id: 'did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz#auth',
      type: 'Ed25519VerificationKey2018',
      controller: 'did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz',
      publicKeyMultibase: 'mockPublicKeyMultibase'
    }),
    signDocument: sinon.stub().resolves({
      id: 'did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz',
      authentication: ['did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz#auth'],
      service: [
        {
          id: 'did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz#kyc',
          type: 'KYCVerificationService',
          serviceEndpoint: 'https://intellilend.io/api/verify',
          description: 'KYC/AML verification service'
        }
      ],
      proof: {
        type: 'Ed25519Signature2018',
        created: new Date().toISOString(),
        verificationMethod: 'did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz#auth',
        proofValue: 'mockProofValue'
      }
    })
  },
  Resolver: class MockResolver {
    constructor() {}
    
    resolve(did) {
      return Promise.resolve({
        id: did,
        authentication: [`${did}#auth`],
        service: [
          {
            id: `${did}#kyc`,
            type: 'KYCVerificationService',
            serviceEndpoint: 'https://intellilend.io/api/verify',
            description: 'KYC/AML verification service'
          }
        ],
        proof: {
          type: 'Ed25519Signature2018',
          created: new Date().toISOString(),
          verificationMethod: `${did}#auth`,
          proofValue: 'mockProofValue'
        }
      });
    }
  },
  VerifiableCredential: {
    create: sinon.stub().resolves({
      id: 'did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz#kyc-credential',
      type: ['VerifiableCredential', 'KYCVerification'],
      issuer: 'did:iota:smr:issuer1234567890',
      subject: 'did:iota:smr:subject1234567890',
      issuanceDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      credentialSubject: {
        id: 'did:iota:smr:subject1234567890',
        kycVerified: true,
        verificationLevel: 'basic'
      },
      sign: sinon.stub().resolves({
        id: 'did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz#kyc-credential',
        type: ['VerifiableCredential', 'KYCVerification'],
        issuer: 'did:iota:smr:issuer1234567890',
        subject: 'did:iota:smr:subject1234567890',
        issuanceDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        credentialSubject: {
          id: 'did:iota:smr:subject1234567890',
          kycVerified: true,
          verificationLevel: 'basic'
        },
        proof: {
          type: 'Ed25519Signature2018',
          created: new Date().toISOString(),
          verificationMethod: 'did:iota:smr:issuer1234567890#auth',
          proofValue: 'mockCredentialProofValue'
        }
      })
    }),
    verify: sinon.stub().resolves({
      verified: true,
      checks: ['signature', 'expiration']
    })
  },
  VerifiablePresentation: {
    create: sinon.stub().resolves({
      id: 'did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz#presentation',
      holder: 'did:iota:smr:holder1234567890',
      verifiableCredential: [],
      created: new Date().toISOString(),
      sign: sinon.stub().resolves({
        id: 'did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz#presentation',
        holder: 'did:iota:smr:holder1234567890',
        verifiableCredential: [],
        created: new Date().toISOString(),
        proof: {
          type: 'Ed25519Signature2018',
          created: new Date().toISOString(),
          verificationMethod: 'did:iota:smr:holder1234567890#auth',
          proofValue: 'mockPresentationProofValue'
        }
      })
    }),
    verify: sinon.stub().resolves({
      verified: true,
      checks: ['signature']
    })
  }
};

// Mock the modules
jest.mock('@iota/identity-wasm', () => identityWasmMock, { virtual: true });

// Import our IOTA Identity module
const IOTAIdentity = require('../../iota-sdk/identity');

// Import test configuration
const config = require('./test-config');

describe('IOTA Identity Tests', function() {
  // Increase timeouts for IOTA network operations
  this.timeout(config.TIMEOUTS.MEDIUM);
  
  let mockClient;
  let mockAccount;
  let identity;
  
  before(function() {
    // Create mock client
    mockClient = {
      getInfo: sinon.stub().resolves({
        nodeInfo: {
          name: 'HORNET',
          version: '2.0.0',
          status: { isHealthy: true },
          protocol: { networkName: 'testnet' }
        }
      })
    };
    
    // Mock submitBlock function
    mockClient.submitBlock = sinon.stub().resolves({
      blockId: '0xmockblockhash'
    });
    
    // Create mock account
    mockAccount = {
      alias: () => 'MockAccount',
      addresses: () => [
        { address: 'rms1mockaddress123456789abcdefghijklmnopqrstuvwxyz' }
      ],
      client: () => mockClient
    };
    
    // Create identity instance
    identity = new IOTAIdentity(mockClient, mockAccount);
  });
  
  describe('DID Creation and Resolution', function() {
    it('should create a new DID', async function() {
      const userAddress = '0x1234567890abcdef1234567890abcdef12345678';
      const metadata = {
        name: 'John Doe',
        serviceEndpoint: 'https://intellilend.io/api/verify'
      };
      
      const result = await identity.createDID(userAddress, metadata);
      
      expect(result).to.be.an('object');
      expect(result.did).to.be.a('string');
      expect(result.did).to.include('did:iota:');
      expect(result.document).to.be.an('object');
      expect(result.key).to.be.an('object');
      expect(result.tangleExplorerUrl).to.be.a('string');
    });
    
    it('should resolve a DID', async function() {
      const did = 'did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz';
      
      const result = await identity.resolveDID(did);
      
      expect(result).to.be.an('object');
      expect(result.id).to.equal(did);
      expect(result.authentication).to.be.an('array');
      expect(result.service).to.be.an('array');
    });
    
    it('should use cache for DID resolution if available', async function() {
      const did = 'did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz';
      
      // First call should resolve
      await identity.resolveDID(did);
      
      // Second call should use cache
      const resolverSpy = sinon.spy(identity.resolver, 'resolve');
      await identity.resolveDID(did);
      
      expect(resolverSpy.called).to.be.false;
    });
  });
  
  describe('Verifiable Credentials', function() {
    it('should create a KYC credential', async function() {
      const issuerDID = 'did:iota:smr:issuer1234567890';
      const issuerKey = { privateKey: 'mockIssuerPrivateKey' };
      const subjectDID = 'did:iota:smr:subject1234567890';
      const claims = {
        kycVerified: true,
        verificationLevel: 'basic'
      };
      
      const result = await identity.createKYCCredential(issuerDID, issuerKey, subjectDID, claims);
      
      expect(result).to.be.an('object');
      expect(result.id).to.be.a('string');
      expect(result.credential).to.be.an('object');
      expect(result.credential.type).to.include('VerifiableCredential');
      expect(result.credential.type).to.include('KYCVerification');
      expect(result.issuer).to.equal(issuerDID);
      expect(result.subject).to.equal(subjectDID);
    });
    
    it('should verify a credential', async function() {
      const credential = {
        id: 'did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz#kyc-credential',
        type: ['VerifiableCredential', 'KYCVerification'],
        issuer: 'did:iota:smr:issuer1234567890',
        credentialSubject: {
          id: 'did:iota:smr:subject1234567890',
          kycVerified: true
        },
        issuanceDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        proof: {
          type: 'Ed25519Signature2018',
          created: new Date().toISOString(),
          verificationMethod: 'did:iota:smr:issuer1234567890#auth',
          proofValue: 'mockCredentialProofValue'
        }
      };
      
      const result = await identity.verifyCredential(credential);
      
      expect(result).to.be.an('object');
      expect(result.verified).to.be.true;
      expect(result.checks).to.be.an('object');
      expect(result.issuer).to.equal(credential.issuer);
      expect(result.subject).to.equal(credential.credentialSubject.id);
    });
    
    it('should detect expired credentials', async function() {
      const credential = {
        id: 'did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz#kyc-credential',
        type: ['VerifiableCredential', 'KYCVerification'],
        issuer: 'did:iota:smr:issuer1234567890',
        credentialSubject: {
          id: 'did:iota:smr:subject1234567890',
          kycVerified: true
        },
        issuanceDate: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString(), // 2 years ago
        expirationDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year ago (expired)
        proof: {
          type: 'Ed25519Signature2018',
          created: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString(),
          verificationMethod: 'did:iota:smr:issuer1234567890#auth',
          proofValue: 'mockCredentialProofValue'
        }
      };
      
      const result = await identity.verifyCredential(credential);
      
      expect(result.verified).to.be.false;
      expect(result.checks.expiration).to.be.false;
    });
  });
  
  describe('Zero-Knowledge Proofs', function() {
    it('should create a ZK proof from a credential', async function() {
      const credential = {
        id: 'did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz#kyc-credential',
        type: ['VerifiableCredential', 'KYCVerification'],
        issuer: 'did:iota:smr:issuer1234567890',
        credentialSubject: {
          id: 'did:iota:smr:subject1234567890',
          kycVerified: true,
          fullName: 'John Doe',
          dateOfBirth: '1980-01-01',
          country: 'US',
          verificationLevel: 'advanced'
        },
        issuanceDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        proof: {
          type: 'Ed25519Signature2018',
          created: new Date().toISOString(),
          verificationMethod: 'did:iota:smr:issuer1234567890#auth',
          proofValue: 'mockCredentialProofValue'
        }
      };
      
      const revealedAttributes = ['kycVerified', 'verificationLevel'];
      
      const result = await identity.createZKProof(credential, revealedAttributes);
      
      expect(result).to.be.an('object');
      expect(result.proof).to.be.an('object');
      expect(result.proof.revealedAttributes).to.be.an('object');
      expect(result.proof.revealedAttributes).to.have.property('kycVerified');
      expect(result.proof.revealedAttributes).to.have.property('verificationLevel');
      expect(result.proof.revealedAttributes).to.not.have.property('fullName');
      expect(result.proof.revealedAttributes).to.not.have.property('dateOfBirth');
      expect(result.proof.credentialHash).to.be.a('string');
    });
    
    it('should verify a ZK proof', async function() {
      // Create a proof object
      const proof = {
        id: 'proof-123456',
        type: 'SimpleZKProof',
        credentialId: 'did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz#kyc-credential',
        issuer: 'did:iota:smr:issuer1234567890',
        credentialType: ['VerifiableCredential', 'KYCVerification'],
        revealedAttributes: {
          kycVerified: true,
          verificationLevel: 'advanced'
        },
        credentialHash: crypto.createHash('sha256').update('test-credential').digest('hex'),
        created: new Date().toISOString()
      };
      
      const result = await identity.verifyZKProof(proof);
      
      expect(result).to.be.an('object');
      expect(result.verified).to.be.true;
      expect(result.proofId).to.equal(proof.id);
      expect(result.credentialId).to.equal(proof.credentialId);
      expect(result.revealedAttributes).to.deep.equal(proof.revealedAttributes);
    });
  });
  
  describe('Verification Status', function() {
    it('should store verification status on the Tangle', async function() {
      const userDID = 'did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz';
      const verificationType = 'KYC';
      const status = true;
      
      const result = await identity.storeVerificationStatus(userDID, verificationType, status);
      
      expect(result).to.be.an('object');
      expect(result.did).to.equal(userDID);
      expect(result.type).to.equal(verificationType);
      expect(result.status).to.equal(status);
      expect(result.blockId).to.be.a('string');
      expect(result.tangleExplorerUrl).to.be.a('string');
    });
    
    it('should retrieve verification status from the Tangle', async function() {
      const userDID = 'did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz';
      const verificationType = 'KYC';
      
      // Mock getAddressTransactions to return verification status
      const getAddressTransactions = sinon.stub().resolves([
        {
          blockId: '0xmockblockhash1',
          data: Buffer.from(JSON.stringify({
            did: userDID,
            type: verificationType,
            status: true,
            timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            id: `verification-${userDID}-${verificationType}-${Date.now() - 3600000}`
          })).toString('hex')
        },
        {
          blockId: '0xmockblockhash2',
          data: Buffer.from(JSON.stringify({
            did: userDID,
            type: verificationType,
            status: false,
            timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
            id: `verification-${userDID}-${verificationType}-${Date.now() - 7200000}`
          })).toString('hex')
        }
      ]);
      
      // Temporarily replace the function
      const original = identity.getAddressTransactions;
      identity.getAddressTransactions = getAddressTransactions;
      
      const result = await identity.getVerificationStatus(userDID, verificationType);
      
      // Restore original function
      identity.getAddressTransactions = original;
      
      expect(result).to.be.an('object');
      expect(result.did).to.equal(userDID);
      expect(result.type).to.equal(verificationType);
      expect(result.status).to.be.true; // Should get the most recent status
      expect(result.blockId).to.equal('0xmockblockhash1');
      expect(result.tangleExplorerUrl).to.be.a('string');
    });
  });
  
  describe('Verifiable Presentations', function() {
    it('should create a verifiable presentation', async function() {
      const credentials = [
        {
          id: 'did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz#kyc-credential',
          type: ['VerifiableCredential', 'KYCVerification'],
          issuer: 'did:iota:smr:issuer1234567890',
          credentialSubject: {
            id: 'did:iota:smr:subject1234567890',
            kycVerified: true
          },
          issuanceDate: new Date().toISOString(),
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          proof: {
            type: 'Ed25519Signature2018',
            created: new Date().toISOString(),
            verificationMethod: 'did:iota:smr:issuer1234567890#auth',
            proofValue: 'mockCredentialProofValue'
          }
        }
      ];
      
      const holderDID = 'did:iota:smr:holder1234567890';
      const holderKey = { privateKey: 'mockHolderPrivateKey' };
      
      const result = await identity.createPresentation(credentials, holderDID, holderKey);
      
      expect(result).to.be.an('object');
      expect(result.id).to.be.a('string');
      expect(result.presentation).to.be.an('object');
      expect(result.holder).to.equal(holderDID);
      expect(result.credentials).to.be.an('array');
      expect(result.credentials[0]).to.equal(credentials[0].id);
      expect(result.tangleExplorerUrl).to.be.a('string');
    });
    
    it('should verify a presentation', async function() {
      const presentation = {
        id: 'did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz#presentation',
        holder: 'did:iota:smr:holder1234567890',
        verifiableCredential: [
          {
            id: 'did:iota:smr:1234567890abcdefghijklmnopqrstuvwxyz#kyc-credential',
            type: ['VerifiableCredential', 'KYCVerification'],
            issuer: 'did:iota:smr:issuer1234567890',
            credentialSubject: {
              id: 'did:iota:smr:subject1234567890',
              kycVerified: true
            },
            issuanceDate: new Date().toISOString(),
            expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            proof: {
              type: 'Ed25519Signature2018',
              created: new Date().toISOString(),
              verificationMethod: 'did:iota:smr:issuer1234567890#auth',
              proofValue: 'mockCredentialProofValue'
            }
          }
        ],
        created: new Date().toISOString(),
        proof: {
          type: 'Ed25519Signature2018',
          created: new Date().toISOString(),
          verificationMethod: 'did:iota:smr:holder1234567890#auth',
          proofValue: 'mockPresentationProofValue'
        }
      };
      
      const result = await identity.verifyPresentation(presentation);
      
      expect(result).to.be.an('object');
      expect(result.verified).to.be.true;
      expect(result.presentationVerified).to.be.true;
      expect(result.allCredentialsVerified).to.be.true;
      expect(result.holder).to.equal(presentation.holder);
      expect(result.credentials).to.be.an('array');
      expect(result.credentials.length).to.equal(1);
    });
  });
});
