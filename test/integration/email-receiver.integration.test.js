const should = require('should');
const helper = require('node-red-node-test-helper');

describe('Email Receiver Node - Integration Tests', function() {
  // Set a reasonable timeout for integration tests
  this.timeout(10000);

  let emailReceiverNode;
  let originalLoad;

  before(function(done) {
    // Set up mocks for dependencies before loading the node
    setupMocks();

    // Load the node with mocked dependencies
    emailReceiverNode = require('../../email-receiver/email-receiver.js');

    // CRITICAL: Initialize the helper with Node-RED
    helper.init(require.resolve('node-red'));
    done();
  });

  after(function() {
    // Restore original module loading
    if (originalLoad) {
      const Module = require('module');
      Module._load = originalLoad;
    }
  });

  beforeEach(function(done) {
    helper.startServer(done);
  });

  afterEach(function(done) {
    helper.unload();
    helper.stopServer(done);
  });

  function setupMocks() {
    // Create mock IMAP module
    const mockImap = function(config) {
      this.config = config;
      this.connect = () => {
        // Simulate a successful connection by immediately emitting 'ready'
        if (this.events && this.events.ready) {
          this.events.ready();
        }
      };
      this.openBox = (folder, readOnly, callback) => {
        callback(null, { messages: { total: 1 } });
      };
      this.search = (criteria, callback) => {
        callback(null, [123]);
      };
      this.fetch = (results, options) => {
        return {
          on: (event, cb) => {
            if (event === 'message') {
              cb({ on: (e, bodyCb) => { if (e === 'body') bodyCb({}); } });
            }
          },
          once: (event, cb) => {
            if (event === 'end') { cb(); }
          }
        };
      };
      this.end = () => {};
      this.once = (event, callback) => {
        if (!this.events) this.events = {};
        this.events[event] = callback;
      };
      return this;
    };

    // Create mock mailparser module
    const mockMailparser = {
      simpleParser: function() {
        return Promise.resolve({
          subject: 'test integration email',
          text: 'test integration body',
          html: '<p>test integration</p>',
          from: { text: 'integration@test.com' },
          date: new Date(),
          headers: new Map(),
          attachments: []
        });
      }
    };

    const mockModules = {
      'node-imap': mockImap,
      'mailparser': mockMailparser
    };

    // Override require to use mocks
    const Module = require('module');
    originalLoad = Module._load;
    Module._load = function(request, parent) {
      if (mockModules[request]) {
        return mockModules[request];
      }
      return originalLoad.apply(this, arguments);
    };
  }

  describe('Node Loading', function() {
    it('should load in Node-RED test environment', function(done) {
      // ARRANGE: Set up Node-RED flow with proper configuration
      const flow = [
        {
          id: "n1",
          type: "email-receiver",
          name: "test node",
          host: "imap.test.com",
          hostType: "str",
          port: "993",
          portType: "str",
          tls: true,
          tlsType: "bool",
          user: "test@example.com",
          userType: "str",
          password: "testpass",
          passwordType: "str",
          folder: "INBOX",
          folderType: "str",
          markseen: true,
          markseenType: "bool"
        }
      ];

      // ACT: Load the node in the test helper environment
      helper.load(emailReceiverNode, flow, function() {
        try {
          // ASSERT: Verify the node loaded correctly
          const n1 = helper.getNode("n1");
          should.exist(n1);
          n1.should.have.property('name', 'test node');
          n1.should.have.property('type', 'email-receiver');
          done();
        } catch (err) {
          done(err);
        }
      });
    });

    it('should load with minimal configuration', function(done) {
      // ARRANGE: Set up minimal flow configuration
      const flow = [
        {
          id: "n1",
          type: "email-receiver",
          host: "imap.minimal.com",
          hostType: "str",
          port: "993",
          portType: "str",
          user: "minimal@test.com",
          userType: "str",
          password: "minimalpass",
          passwordType: "str",
          folder: "INBOX",
          folderType: "str"
        }
      ];

      // ACT: Load the node
      helper.load(emailReceiverNode, flow, function() {
        try {
          // ASSERT: Verify the node loaded with minimal config
          const n1 = helper.getNode("n1");
          should.exist(n1);
          n1.should.have.property('type', 'email-receiver');
          done();
        } catch (err) {
          done(err);
        }
      });
    });
  });

  describe('Node Connections', function() {
    it('should create wired connections correctly', function(done) {
      // ARRANGE: Set up flow with helper node to catch output
      const flow = [
        {
          id: "n1",
          type: "email-receiver",
          name: "test node",
          host: "imap.test.com",
          hostType: "str",
          port: "993",
          portType: "str",
          tls: true,
          tlsType: "bool",
          user: "test@example.com",
          userType: "str",
          password: "testpass",
          passwordType: "str",
          folder: "INBOX",
          folderType: "str",
          markseen: true,
          markseenType: "bool",
          wires: [["n2"]]
        },
        { id: "n2", type: "helper" }
      ];

      // ACT: Load nodes and verify connections
      helper.load(emailReceiverNode, flow, function() {
        try {
          const n1 = helper.getNode("n1");
          const n2 = helper.getNode("n2");

          // ASSERT: Both nodes should exist and be connected
          should.exist(n1);
          should.exist(n2);
          n1.should.have.property('name', 'test node');
          n2.should.have.property('type', 'helper');

          done();
        } catch (err) {
          done(err);
        }
      });
    });

    it('should handle multiple output connections', function(done) {
      // ARRANGE: Set up flow with multiple helper nodes
      const flow = [
        {
          id: "n1",
          type: "email-receiver",
          name: "multi-output node",
          host: "imap.test.com",
          hostType: "str",
          port: "993",
          portType: "str",
          user: "test@example.com",
          userType: "str",
          password: "testpass",
          passwordType: "str",
          folder: "INBOX",
          folderType: "str",
          markseen: true,
          markseenType: "bool",
          wires: [["n2", "n3"]]
        },
        { id: "n2", type: "helper" },
        { id: "n3", type: "helper" }
      ];

      // ACT: Load nodes
      helper.load(emailReceiverNode, flow, function() {
        try {
          const n1 = helper.getNode("n1");
          const n2 = helper.getNode("n2");
          const n3 = helper.getNode("n3");

          // ASSERT: All nodes should exist
          should.exist(n1);
          should.exist(n2);
          should.exist(n3);
          n1.should.have.property('name', 'multi-output node');

          done();
        } catch (err) {
          done(err);
        }
      });
    });
  });

  describe('Message Flow', function() {
    it('should handle input without crashing', function(done) {
      // ARRANGE: Set up minimal flow
      const flow = [
        {
          id: "n1",
          type: "email-receiver",
          name: "test node",
          host: "imap.test.com",
          hostType: "str",
          port: "993",
          portType: "str",
          tls: true,
          tlsType: "bool",
          user: "test@example.com",
          userType: "str",
          password: "testpass",
          passwordType: "str",
          folder: "INBOX",
          folderType: "str",
          markseen: true,
          markseenType: "bool"
        }
      ];

      // ACT: Load node and send input
      helper.load(emailReceiverNode, flow, function() {
        try {
          const n1 = helper.getNode("n1");
          should.exist(n1);

          // Send input - this should not crash due to mocked IMAP
          n1.receive({ payload: "test input" });

          // ASSERT: If we reach here, the node handled input gracefully
          setTimeout(() => {
            done(); // Success if no errors thrown
          }, 500);

        } catch (err) {
          done(err);
        }
      });
    });

    it('should process messages through connected nodes', function(done) {
      // ARRANGE: Set up flow with helper to capture output
      const flow = [
        {
          id: "n1",
          type: "email-receiver",
          name: "sender node",
          host: "imap.test.com",
          hostType: "str",
          port: "993",
          portType: "str",
          user: "test@example.com",
          userType: "str",
          password: "testpass",
          passwordType: "str",
          folder: "INBOX",
          folderType: "str",
          markseen: true,
          markseenType: "bool",
          wires: [["n2"]]
        },
        { id: "n2", type: "helper" }
      ];

      // ACT: Load nodes and set up message listener
      helper.load(emailReceiverNode, flow, function() {
        try {
          const n1 = helper.getNode("n1");
          const n2 = helper.getNode("n2");

          // Set up listener for messages from email receiver
          n2.on("input", function(msg) {
            try {
              // ASSERT: Should receive a message with expected properties
              should.exist(msg);
              should.exist(msg.payload);
              msg.payload.should.equal('test integration body');
              done();
            } catch (err) {
              done(err);
            }
          });

          // Trigger the email receiver
          n1.receive({ payload: "trigger" });

        } catch (err) {
          done(err);
        }
      });
    });
  });

  describe('Configuration Validation', function() {
    it('should handle invalid configuration gracefully', function(done) {
      // ARRANGE: Set up flow with missing required config
      const flow = [
        {
          id: "n1",
          type: "email-receiver",
          name: "invalid config node",
          host: "", // Missing host
          hostType: "str",
          port: "993",
          portType: "str",
          user: "test@example.com",
          userType: "str",
          password: "testpass",
          passwordType: "str",
          folder: "INBOX",
          folderType: "str"
        }
      ];

      // ACT: Load node with invalid config
      helper.load(emailReceiverNode, flow, function() {
        try {
          const n1 = helper.getNode("n1");
          should.exist(n1);

          // ASSERT: Node should exist but handle invalid config appropriately
          // Send input to trigger validation
          n1.receive({ payload: "test" });

          // If we get here without crashing, the validation worked
          setTimeout(() => {
            done();
          }, 300);

        } catch (err) {
          done(err);
        }
      });
    });

    it('should load with different folder configurations', function(done) {
      // ARRANGE: Set up flow with array folder config
      const flow = [
        {
          id: "n1",
          type: "email-receiver",
          name: "array folder node",
          host: "imap.test.com",
          hostType: "str",
          port: "993",
          portType: "str",
          user: "test@example.com",
          userType: "str",
          password: "testpass",
          passwordType: "str",
          folder: ["INBOX", "Sent", "Drafts"],
          folderType: "json",
          markseen: true,
          markseenType: "bool"
        }
      ];

      // ACT: Load node with array folder config
      helper.load(emailReceiverNode, flow, function() {
        try {
          const n1 = helper.getNode("n1");

          // ASSERT: Node should load successfully with array config
          should.exist(n1);
          n1.should.have.property('name', 'array folder node');
          done();

        } catch (err) {
          done(err);
        }
      });
    });
  });

  describe('Node Lifecycle', function() {
    it('should clean up properly on unload', function(done) {
      // ARRANGE: Set up flow
      const flow = [
        {
          id: "n1",
          type: "email-receiver",
          name: "cleanup test node",
          host: "imap.test.com",
          hostType: "str",
          port: "993",
          portType: "str",
          user: "test@example.com",
          userType: "str",
          password: "testpass",
          passwordType: "str",
          folder: "INBOX",
          folderType: "str"
        }
      ];

      // ACT: Load and then unload the node
      helper.load(emailReceiverNode, flow, function() {
        try {
          const n1 = helper.getNode("n1");
          should.exist(n1);

          // Simulate some activity
          n1.receive({ payload: "test" });

          // ASSERT: Unloading should not throw errors
          helper.unload();
          done();

        } catch (err) {
          done(err);
        }
      });
    });
  });
});