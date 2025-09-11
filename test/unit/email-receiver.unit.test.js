const should = require('should');
const {
  createMockImap,
  createMockMailparser,
  createMockNodeRED,
  setupModuleMocks,
  testConfigs,
  testUtils
} = require('../helpers/email-receiver.mocks.js');

describe('Email Receiver Node - Unit Tests with Helpers', function() {
  this.timeout(10000);

  let emailReceiverNode;
  let cleanupMocks;

  before(function() {
    // Set up module mocks using helper
    cleanupMocks = setupModuleMocks();

    // Load the node with mocked dependencies
    emailReceiverNode = require('../../email-receiver/email-receiver.js');
  });

  after(function() {
    // Clean up mocks
    if (cleanupMocks) {
      cleanupMocks();
    }
  });

  describe('Module Export', function() {
    it('should export a function', function() {
      emailReceiverNode.should.be.type('function');
    });
  });

  describe('Node Registration', function() {
    it('should register node type without errors', function() {
      // ARRANGE: Create mock Node-RED with tracking
      const mockRED = createMockNodeRED();

      // ACT: Register the node
      emailReceiverNode(mockRED);

      // ASSERT: Verify registration
      mockRED.nodes.lastRegisteredType.should.equal('email-receiver');
      mockRED.nodes.lastRegisteredConstructor.should.be.type('function');
    });
  });

  describe('Node Instantiation', function() {
    it('should handle node instantiation with valid config', function() {
      // ARRANGE: Track node creation
      let createdNode = null;
      const mockRED = createMockNodeRED({
        onHandler: function(event, callback) {
          createdNode = this;
        }
      });

      // ACT: Register and create node instance
      emailReceiverNode(mockRED);
      new mockRED.nodes.lastRegisteredConstructor(testConfigs.valid);

      // ASSERT: Verify node was created with correct properties
      should.exist(createdNode);
      createdNode.should.have.property('name', testConfigs.valid.name);
      createdNode.should.have.property('id', testConfigs.valid.id);
    });

    it('should handle minimal config', function() {
      // ARRANGE: Use minimal test config
      let createdNode = null;
      const mockRED = createMockNodeRED({
        onHandler: function(event, callback) {
          createdNode = this;
        }
      });

      // ACT: Register and create node with minimal config
      emailReceiverNode(mockRED);
      new mockRED.nodes.lastRegisteredConstructor(testConfigs.minimal);

      // ASSERT: Verify node creation
      should.exist(createdNode);
      createdNode.should.have.property('id', testConfigs.minimal.id);
    });
  });

  describe('Folder Configuration', function() {
    it('should handle array of folders', async function() {
      // ARRANGE: Set up message tracking
      let sentMessage = null;
      const mockRED = createMockNodeRED({
        sendHandler: function(msg) {
          sentMessage = msg;
        }
      });

      // ACT: Register node and create instance with array folders
      emailReceiverNode(mockRED);
      const nodeConstructor = mockRED.nodes.lastRegisteredConstructor;
      const nodeInstance = new nodeConstructor(testConfigs.arrayFolders);

      // Wait for processing
      await testUtils.wait(50);

      // ASSERT: Should handle array folders without error
      should.exist(nodeInstance);
      nodeInstance.should.have.property('name', testConfigs.arrayFolders.name);
    });
  });

  describe('Error Handling', function() {
    it('should call node.error for invalid folder type', function(done) {
      // ARRANGE: Set up error tracking
      const mockRED = createMockNodeRED({
        onHandler: function(event, callback) {
          if (event === 'input') {
            this.inputCallback = callback;
          }
        },
        errorHandler: function(err) {
          // ASSERT: Should receive appropriate error message
          err.should.containEql("The 'folders' property must be an array of strings.");
          done();
        }
      });

      // ACT: Register node and create instance with invalid config
      emailReceiverNode(mockRED);
      const nodeConstructor = mockRED.nodes.lastRegisteredConstructor;
      const nodeInstance = new nodeConstructor(testConfigs.invalidFolderType);

      // Trigger the error by sending an input message
      // Use a small delay to ensure the constructor has completed
      setTimeout(() => {
        if (nodeInstance.inputCallback) {
          nodeInstance.inputCallback({ payload: "test" });
        } else {
          done(new Error('inputCallback was not set on the node instance'));
        }
      }, 10);
    });

    it('should call node.error for missing config', function(done) {
      // ARRANGE: Set up error and status tracking
      let statusCalled = false;
      const mockRED = createMockNodeRED({
        onHandler: function(event, callback) {
          if (event === 'input') {
            this.inputCallback = callback;
          }
        },
        statusHandler: function(status) {
          statusCalled = true;
          if (status.fill) {
            status.fill.should.equal('red');
          }
        },
        errorHandler: function(err) {
          // ASSERT: Should receive config error
          err.should.containEql('Missing required IMAP config');
          statusCalled.should.be.true();
          done();
        }
      });

      // ACT: Register node and create instance with invalid config
      emailReceiverNode(mockRED);
      const nodeConstructor = mockRED.nodes.lastRegisteredConstructor;
      const nodeInstance = new nodeConstructor(testConfigs.invalidConfig);

      // Trigger the error by sending an input message
      // Use a small delay to ensure the constructor has completed
      setTimeout(() => {
        if (nodeInstance.inputCallback) {
          nodeInstance.inputCallback({ payload: "test" });
        } else {
          done(new Error('inputCallback was not set on the node instance'));
        }
      }, 10);
    });

    it('should handle connection errors gracefully', function(done) {
      // ARRANGE: Set up connection error scenario
      const mockRED = createMockNodeRED({
        onHandler: function(event, callback) {
          if (event === 'input') {
            this.inputCallback = callback;
          }
        },
        statusHandler: function(status) {
          if (status.fill === 'red' && status.text && status.text.includes('error')) {
            done(); // Success - error status was set
          }
        },
        errorHandler: function(err) {
          // Also accept errors as valid completion
          should.exist(err);
          done();
        }
      });

      // ACT: Create node and trigger connection attempt
      emailReceiverNode(mockRED);
      const nodeConstructor = mockRED.nodes.lastRegisteredConstructor;

      // Use a config that should cause connection issues
      const badConfig = {
        ...testConfigs.valid,
        host: 'nonexistent.invalid.host.com',
        port: 12345 // Invalid port
      };

      const nodeInstance = new nodeConstructor(badConfig);

      // Trigger the error by sending an input message
      // Use a small delay to ensure the constructor has completed
      setTimeout(() => {
        if (nodeInstance.inputCallback) {
          nodeInstance.inputCallback({ payload: "test" });
        } else {
          done(new Error('inputCallback was not set on the node instance'));
        }
      }, 10);
    });
  });

  describe('IMAP Connection', function() {
    it('should handle connection success', function(done) {
      // ARRANGE: Set up connection tracking
      const mockRED = createMockNodeRED({
        statusHandler: function(status) {
          if (status.fill === 'green') {
            // ASSERT: Should show connected status
            status.text.should.containEql('connected');
            done();
          }
        }
      });

      // ACT: Create node which should attempt connection
      emailReceiverNode(mockRED);
      const nodeConstructor = mockRED.nodes.lastRegisteredConstructor;
      new nodeConstructor(testConfigs.valid);
    });

    it('should handle connection errors', function(done) {
      // ARRANGE: Set up error tracking
      const mockRED = createMockNodeRED({
        errorHandler: function(err) {
          // ASSERT: Should handle connection errors gracefully
          should.exist(err);
          done();
        },
        statusHandler: function(status) {
          if (status.fill === 'red') {
            // Connection failed status
            status.text.should.containEql('error');
          }
        }
      });

      // ACT: Create node with config that should fail
      emailReceiverNode(mockRED);
      const nodeConstructor = mockRED.nodes.lastRegisteredConstructor;

      // Use invalid config to trigger connection error
      const invalidConfig = { ...testConfigs.valid, host: 'invalid.host.com' };
      new nodeConstructor(invalidConfig);
    });
  });

  describe('Message Verification Utilities', function() {
    it('should verify message properties using testUtils', function() {
      // ARRANGE: Create a test message
      const testMessage = {
        payload: 'test content',
        topic: 'email/received',
        from: 'test@example.com'
      };

      // ACT & ASSERT: Use helper to verify message properties
      testUtils.verifyMessage(testMessage, {
        payload: 'test content',
        topic: 'email/received'
      });

      // Should not throw any errors if verification passes
      testMessage.should.have.property('from', 'test@example.com');
    });

    it('should use wait utility for async operations', async function() {
      // ARRANGE: Record start time
      const startTime = Date.now();

      // ACT: Use the wait utility
      await testUtils.wait(100);

      // ASSERT: Should have waited approximately the right amount of time
      const elapsed = Date.now() - startTime;
      elapsed.should.be.approximately(100, 50); // Allow 50ms tolerance
    });
  });
});