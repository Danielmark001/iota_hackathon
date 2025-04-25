/**
 * Unit Tests for IOTA Streams Module
 * 
 * This file contains tests for the IOTA Streams functionality,
 * including channel creation, messaging, and document sharing.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const crypto = require('crypto');

// Import our IOTA Streams module
const IOTAStreams = require('../../iota-sdk/streams');

// Import test configuration
const config = require('./test-config');

describe('IOTA Streams Tests', function() {
  // Increase timeouts for IOTA network operations
  this.timeout(config.TIMEOUTS.MEDIUM);
  
  let mockClient;
  let mockAccount;
  let streams;
  
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
    
    // Mock submitBlock function to simulate Tangle submission
    mockClient.submitBlock = sinon.stub().resolves({
      blockId: '0xmockblockhash'
    });
    
    // Mock getAddressTransactions for finding messages
    mockClient.getAddressTransactions = sinon.stub();
    
    // Create mock account
    mockAccount = {
      alias: () => 'MockAccount',
      addresses: () => [
        { address: 'rms1mockaddress123456789abcdefghijklmnopqrstuvwxyz' }
      ],
      client: () => mockClient
    };
    
    // Create streams instance
    streams = new IOTAStreams(mockClient, mockAccount);
  });
  
  describe('Channel Creation and Joining', function() {
    it('should create a new channel', async function() {
      const channelId = 'test-channel-' + Date.now();
      const author = '0x1234567890abcdef1234567890abcdef12345678';
      const participants = [
        '0xabcdef1234567890abcdef1234567890abcdef12',
        '0x9876543210fedcba9876543210fedcba98765432'
      ];
      
      const result = await streams.createChannel(channelId, author, participants);
      
      expect(result).to.be.an('object');
      expect(result.channel).to.be.an('object');
      expect(result.channel.id).to.equal(channelId);
      expect(result.channel.author).to.equal(author);
      expect(result.channel.participants).to.be.an('array');
      expect(result.channel.participants).to.include(author);
      expect(result.channel.participants).to.include(participants[0]);
      expect(result.channel.participants).to.include(participants[1]);
      expect(result.blockId).to.be.a('string');
      expect(result.tangleExplorerUrl).to.be.a('string');
      
      // Verify that the channel was stored in memory
      const storedChannel = streams.channels.get(channelId);
      expect(storedChannel).to.exist;
      expect(storedChannel.encryptionKey).to.be.a('string');
      
      // Verify that the encryption key was stored
      const encryptionKey = streams.keys.get(channelId);
      expect(encryptionKey).to.be.a('string');
      expect(encryptionKey.length).to.be.at.least(32);
      
      // Verify that submitBlock was called
      expect(mockClient.submitBlock.called).to.be.true;
    });
    
    it('should join an existing channel', async function() {
      const channelId = 'existing-channel-' + Date.now();
      const participant = '0xabcdef1234567890abcdef1234567890abcdef12';
      const joinKey = 'mock-join-key-' + crypto.randomBytes(16).toString('hex');
      
      // Mock findChannelAnnouncements to return a channel
      streams.findChannelAnnouncements = sinon.stub().resolves([
        {
          channel: {
            id: channelId,
            author: '0x1234567890abcdef1234567890abcdef12345678',
            participants: [
              '0x1234567890abcdef1234567890abcdef12345678',
              participant
            ],
            created: new Date().toISOString()
          },
          blockId: '0xmockblockhash'
        }
      ]);
      
      const result = await streams.joinChannel(channelId, participant, joinKey);
      
      expect(result).to.be.true;
      
      // Verify that the channel was stored in memory
      const storedChannel = streams.channels.get(channelId);
      expect(storedChannel).to.exist;
      expect(storedChannel.encryptionKey).to.equal(joinKey);
      
      // Verify that the encryption key was stored
      const encryptionKey = streams.keys.get(channelId);
      expect(encryptionKey).to.equal(joinKey);
      
      // Verify that submitBlock was called for join confirmation
      expect(mockClient.submitBlock.called).to.be.true;
    });
    
    it('should reject joining a channel if not authorized', async function() {
      const channelId = 'restricted-channel-' + Date.now();
      const unauthorizedParticipant = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
      const joinKey = 'mock-join-key-' + crypto.randomBytes(16).toString('hex');
      
      // Mock findChannelAnnouncements to return a channel without the unauthorized participant
      streams.findChannelAnnouncements = sinon.stub().resolves([
        {
          channel: {
            id: channelId,
            author: '0x1234567890abcdef1234567890abcdef12345678',
            participants: [
              '0x1234567890abcdef1234567890abcdef12345678',
              '0xabcdef1234567890abcdef1234567890abcdef12'
            ],
            created: new Date().toISOString()
          },
          blockId: '0xmockblockhash'
        }
      ]);
      
      try {
        await streams.joinChannel(channelId, unauthorizedParticipant, joinKey);
        expect.fail('Should have thrown an error for unauthorized participant');
      } catch (error) {
        expect(error.message).to.include('not authorized');
      }
    });
  });
  
  describe('Messaging and Encryption', function() {
    let testChannelId;
    let testAuthor;
    let testParticipant;
    
    beforeEach(function() {
      // Set up a test channel for message testing
      testChannelId = 'message-test-channel-' + Date.now();
      testAuthor = '0x1234567890abcdef1234567890abcdef12345678';
      testParticipant = '0xabcdef1234567890abcdef1234567890abcdef12';
      
      // Create a test channel in memory
      const encryptionKey = crypto.randomBytes(32).toString('hex');
      
      streams.channels.set(testChannelId, {
        id: testChannelId,
        author: testAuthor,
        participants: [testAuthor, testParticipant],
        created: new Date().toISOString(),
        encryptionKey,
        messages: []
      });
      
      streams.keys.set(testChannelId, encryptionKey);
    });
    
    it('should encrypt and decrypt data correctly', function() {
      const originalData = JSON.stringify({
        secret: 'This is a test secret message',
        timestamp: Date.now()
      });
      
      const encryptionKey = streams.keys.get(testChannelId);
      
      // Encrypt the data
      const encrypted = streams.encryptData(originalData, encryptionKey);
      expect(encrypted).to.be.a('string');
      
      // Should contain IV and ciphertext separated by a colon
      const parts = encrypted.split(':');
      expect(parts.length).to.equal(2);
      
      // Decrypt the data
      const decrypted = streams.decryptData(encrypted, encryptionKey);
      expect(decrypted).to.equal(originalData);
      
      // Trying to decrypt with wrong key should fail
      const wrongKey = crypto.randomBytes(32).toString('hex');
      try {
        streams.decryptData(encrypted, wrongKey);
        expect.fail('Should have thrown an error for wrong decryption key');
      } catch (error) {
        expect(error.message).to.include('Failed to decrypt');
      }
    });
    
    it('should send a message on a channel', async function() {
      const message = {
        content: 'Hello, this is a test message',
        timestamp: Date.now()
      };
      
      const result = await streams.sendMessage(testChannelId, testAuthor, message);
      
      expect(result).to.be.an('object');
      expect(result.messageId).to.be.a('string');
      expect(result.channelId).to.equal(testChannelId);
      expect(result.sender).to.equal(testAuthor);
      expect(result.type).to.equal('text');
      expect(result.blockId).to.be.a('string');
      expect(result.tangleExplorerUrl).to.be.a('string');
      
      // Verify that the message was stored in memory
      const channel = streams.channels.get(testChannelId);
      expect(channel.messages.length).to.equal(1);
      expect(channel.messages[0].content).to.deep.equal(message);
      
      // Verify that submitBlock was called
      expect(mockClient.submitBlock.called).to.be.true;
    });
    
    it('should reject sending a message if sender is not a participant', async function() {
      const unauthorizedSender = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
      const message = {
        content: 'Unauthorized message',
        timestamp: Date.now()
      };
      
      try {
        await streams.sendMessage(testChannelId, unauthorizedSender, message);
        expect.fail('Should have thrown an error for unauthorized sender');
      } catch (error) {
        expect(error.message).to.include('not a participant');
      }
    });
    
    it('should share a document on a channel', async function() {
      const document = {
        title: 'Test Document',
        content: 'This is a test document content',
        version: '1.0',
        timestamp: Date.now()
      };
      
      // Mock sendMessage for document sharing
      const sendMessageStub = sinon.stub(streams, 'sendMessage').resolves({
        messageId: 'msg-' + Date.now(),
        channelId: testChannelId,
        sender: testAuthor,
        type: 'document:text',
        timestamp: new Date().toISOString(),
        blockId: '0xmockblockhash',
        tangleExplorerUrl: 'https://explorer.example.com/0xmockblockhash'
      });
      
      const result = await streams.shareDocument(testChannelId, testAuthor, document, 'text');
      
      // Restore original method
      sendMessageStub.restore();
      
      expect(result).to.be.an('object');
      expect(result.messageId).to.be.a('string');
      expect(result.channelId).to.equal(testChannelId);
      expect(result.sender).to.equal(testAuthor);
      expect(result.type).to.equal('document:text');
      
      // Verify that sendMessage was called with the document and right type
      expect(sendMessageStub.calledOnce).to.be.true;
      expect(sendMessageStub.firstCall.args[0]).to.equal(testChannelId);
      expect(sendMessageStub.firstCall.args[1]).to.equal(testAuthor);
      expect(sendMessageStub.firstCall.args[2]).to.deep.equal(document);
      expect(sendMessageStub.firstCall.args[3]).to.equal('document:text');
    });
  });
  
  describe('Message Fetching and Subscriptions', function() {
    let testChannelId;
    let testAuthor;
    let testParticipant;
    
    beforeEach(function() {
      // Set up a test channel for message testing
      testChannelId = 'fetch-test-channel-' + Date.now();
      testAuthor = '0x1234567890abcdef1234567890abcdef12345678';
      testParticipant = '0xabcdef1234567890abcdef1234567890abcdef12';
      
      // Create a test channel in memory
      const encryptionKey = crypto.randomBytes(32).toString('hex');
      
      streams.channels.set(testChannelId, {
        id: testChannelId,
        author: testAuthor,
        participants: [testAuthor, testParticipant],
        created: new Date().toISOString(),
        encryptionKey,
        messages: []
      });
      
      streams.keys.set(testChannelId, encryptionKey);
    });
    
    it('should fetch messages from a channel', async function() {
      const encryptionKey = streams.keys.get(testChannelId);
      
      // Mock findChannelMessages to return encrypted messages
      streams.findChannelMessages = sinon.stub().resolves([
        {
          type: 'encrypted_message',
          channelId: testChannelId,
          sender: testAuthor,
          messageType: 'text',
          encryptedContent: streams.encryptData(JSON.stringify({
            id: 'msg1',
            channelId: testChannelId,
            sender: testAuthor,
            type: 'text',
            content: { text: 'Message 1' },
            timestamp: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
          }), encryptionKey),
          messageId: 'msg1',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          blockId: '0xmockblockhash1'
        },
        {
          type: 'encrypted_message',
          channelId: testChannelId,
          sender: testParticipant,
          messageType: 'text',
          encryptedContent: streams.encryptData(JSON.stringify({
            id: 'msg2',
            channelId: testChannelId,
            sender: testParticipant,
            type: 'text',
            content: { text: 'Message 2' },
            timestamp: new Date(Date.now() - 1800000).toISOString() // 30 mins ago
          }), encryptionKey),
          messageId: 'msg2',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          blockId: '0xmockblockhash2'
        }
      ]);
      
      const messages = await streams.fetchMessages(testChannelId, testParticipant);
      
      expect(messages).to.be.an('array');
      expect(messages.length).to.equal(2);
      
      // Messages should be sorted by timestamp, newest first
      expect(messages[0].id).to.equal('msg2');
      expect(messages[1].id).to.equal('msg1');
      
      // Verify message content was properly decrypted
      expect(messages[0].content).to.deep.equal({ text: 'Message 2' });
      expect(messages[1].content).to.deep.equal({ text: 'Message 1' });
      
      // Verify message metadata
      expect(messages[0].sender).to.equal(testParticipant);
      expect(messages[1].sender).to.equal(testAuthor);
      expect(messages[0].blockId).to.equal('0xmockblockhash2');
      expect(messages[1].blockId).to.equal('0xmockblockhash1');
    });
    
    it('should handle message decryption failures gracefully', async function() {
      const encryptionKey = streams.keys.get(testChannelId);
      
      // Mock findChannelMessages to return a valid message and an invalid one
      streams.findChannelMessages = sinon.stub().resolves([
        {
          type: 'encrypted_message',
          channelId: testChannelId,
          sender: testAuthor,
          messageType: 'text',
          encryptedContent: streams.encryptData(JSON.stringify({
            id: 'msg1',
            channelId: testChannelId,
            sender: testAuthor,
            type: 'text',
            content: { text: 'Valid Message' },
            timestamp: new Date(Date.now() - 3600000).toISOString()
          }), encryptionKey),
          messageId: 'msg1',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          blockId: '0xmockblockhash1'
        },
        {
          type: 'encrypted_message',
          channelId: testChannelId,
          sender: testParticipant,
          messageType: 'text',
          encryptedContent: 'invalid-encrypted-content', // This will fail to decrypt
          messageId: 'msg2',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          blockId: '0xmockblockhash2'
        }
      ]);
      
      const messages = await streams.fetchMessages(testChannelId, testParticipant);
      
      // Should only return the valid message
      expect(messages).to.be.an('array');
      expect(messages.length).to.equal(1);
      expect(messages[0].id).to.equal('msg1');
      expect(messages[0].content).to.deep.equal({ text: 'Valid Message' });
    });
    
    it('should subscribe to channel updates', async function() {
      const callback = sinon.spy();
      
      const subscription = await streams.subscribeToChannel(testChannelId, testParticipant, callback);
      
      expect(subscription).to.be.an('object');
      expect(subscription.subscriptionId).to.be.a('string');
      expect(subscription.channelId).to.equal(testChannelId);
      expect(subscription.participant).to.equal(testParticipant);
      expect(subscription.cancel).to.be.a('function');
      
      // Verify that the subscription was stored
      const storedSubscription = streams.subscriptions.get(subscription.subscriptionId);
      expect(storedSubscription).to.exist;
      expect(storedSubscription.channelId).to.equal(testChannelId);
      expect(storedSubscription.participant).to.equal(testParticipant);
      expect(storedSubscription.callback).to.equal(callback);
      expect(storedSubscription.active).to.be.true;
      
      // Test cancelling the subscription
      subscription.cancel();
      
      // Subscription should be removed
      expect(streams.subscriptions.has(subscription.subscriptionId)).to.be.false;
    });
    
    it('should send notifications to channel participants', async function() {
      const notificationType = 'loan_approved';
      const notificationData = {
        loanId: '12345',
        amount: '1000',
        term: '12 months',
        approvalDate: new Date().toISOString()
      };
      
      // Mock sendMessage for notification
      const sendMessageStub = sinon.stub(streams, 'sendMessage').resolves({
        messageId: 'msg-' + Date.now(),
        channelId: testChannelId,
        sender: testAuthor,
        type: 'notification',
        timestamp: new Date().toISOString(),
        blockId: '0xmockblockhash',
        tangleExplorerUrl: 'https://explorer.example.com/0xmockblockhash'
      });
      
      const result = await streams.sendNotification(
        testChannelId,
        testAuthor,
        notificationType,
        notificationData
      );
      
      // Restore original method
      sendMessageStub.restore();
      
      expect(result).to.be.an('object');
      expect(result.messageId).to.be.a('string');
      expect(result.type).to.equal('notification');
      
      // Verify that sendMessage was called with the correct parameters
      expect(sendMessageStub.calledOnce).to.be.true;
      expect(sendMessageStub.firstCall.args[0]).to.equal(testChannelId);
      expect(sendMessageStub.firstCall.args[1]).to.equal(testAuthor);
      expect(sendMessageStub.firstCall.args[2]).to.deep.equal({
        type: notificationType,
        data: notificationData,
        isNotification: true
      });
      expect(sendMessageStub.firstCall.args[3]).to.equal('notification');
    });
  });
  
  describe('Channel Discovery and Monitoring', function() {
    it('should find channel announcements on the Tangle', async function() {
      const channelId = 'discovery-test-channel-' + Date.now();
      
      // Mock getAddressTransactions to return channel announcements
      mockClient.getAddressTransactions = sinon.stub().resolves([
        {
          blockId: '0xmockblockhash1',
          data: Buffer.from(JSON.stringify({
            type: 'channel_announcement',
            channel: {
              id: channelId,
              author: '0x1234567890abcdef1234567890abcdef12345678',
              participants: [
                '0x1234567890abcdef1234567890abcdef12345678',
                '0xabcdef1234567890abcdef1234567890abcdef12'
              ],
              created: new Date(Date.now() - 86400000).toISOString() // 1 day ago
            },
            encryptedParticipants: {},
            announcedBy: '0x1234567890abcdef1234567890abcdef12345678',
            timestamp: new Date(Date.now() - 86400000).toISOString()
          })).toString('hex')
        },
        {
          blockId: '0xmockblockhash2',
          data: Buffer.from(JSON.stringify({
            type: 'channel_announcement',
            channel: {
              id: 'other-channel-id',
              author: '0x9876543210fedcba9876543210fedcba98765432',
              participants: [
                '0x9876543210fedcba9876543210fedcba98765432',
                '0xfedcba9876543210fedcba9876543210fedcba98'
              ],
              created: new Date(Date.now() - 172800000).toISOString() // 2 days ago
            },
            encryptedParticipants: {},
            announcedBy: '0x9876543210fedcba9876543210fedcba98765432',
            timestamp: new Date(Date.now() - 172800000).toISOString()
          })).toString('hex')
        }
      ]);
      
      const announcements = await streams.findChannelAnnouncements(channelId);
      
      expect(announcements).to.be.an('array');
      expect(announcements.length).to.equal(1);
      expect(announcements[0].channel.id).to.equal(channelId);
      expect(announcements[0].blockId).to.equal('0xmockblockhash1');
    });
    
    it('should poll for new messages in a subscription', async function() {
      // Mock necessary components for polling test
      const clock = sinon.useFakeTimers();
      const channelId = 'polling-test-channel-' + Date.now();
      const participant = '0xabcdef1234567890abcdef1234567890abcdef12';
      const callback = sinon.spy();
      
      // Create test channel
      const encryptionKey = crypto.randomBytes(32).toString('hex');
      streams.channels.set(channelId, {
        id: channelId,
        author: '0x1234567890abcdef1234567890abcdef12345678',
        participants: ['0x1234567890abcdef1234567890abcdef12345678', participant],
        created: new Date().toISOString(),
        encryptionKey,
        messages: []
      });
      streams.keys.set(channelId, encryptionKey);
      
      // Create subscription
      const subscriptionId = `sub-${channelId}-${participant}-${Date.now()}`;
      streams.subscriptions.set(subscriptionId, {
        id: subscriptionId,
        channelId,
        participant,
        lastChecked: new Date(Date.now() - 20000), // 20 seconds ago
        callback,
        active: true
      });
      
      // Mock findChannelMessages to return a new message
      streams.findChannelMessages = sinon.stub().resolves([
        {
          type: 'encrypted_message',
          channelId,
          sender: '0x1234567890abcdef1234567890abcdef12345678',
          messageType: 'text',
          encryptedContent: streams.encryptData(JSON.stringify({
            id: 'newmsg',
            channelId,
            sender: '0x1234567890abcdef1234567890abcdef12345678',
            type: 'text',
            content: { text: 'New Message' },
            timestamp: new Date().toISOString()
          }), encryptionKey),
          messageId: 'newmsg',
          timestamp: new Date().toISOString(),
          blockId: '0xmockblockhash'
        }
      ]);
      
      // Start polling
      streams.startSubscriptionPolling(subscriptionId);
      
      // Advance clock by 10 seconds to trigger poll
      clock.tick(10000);
      
      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Callback should have been called with the new message
      expect(callback.calledOnce).to.be.true;
      expect(callback.firstCall.args[0]).to.be.an('array');
      expect(callback.firstCall.args[0].length).to.equal(1);
      expect(callback.firstCall.args[0][0].content.text).to.equal('New Message');
      
      // Clean up
      clock.restore();
      
      // Manually remove the interval that was created during the test
      const subscription = streams.subscriptions.get(subscriptionId);
      if (subscription && subscription.pollingInterval) {
        clearInterval(subscription.pollingInterval);
      }
    });
  });
});
