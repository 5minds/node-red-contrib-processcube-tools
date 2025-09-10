const should = require('should');

describe('Email Receiver Node - Unit Tests', function() {
  // Set a reasonable timeout
  this.timeout(10000);

  // Module and mocking setup
  let emailReceiverNode;
  let originalLoad;
  let mockImap;
  let mockMailparser;

  before(function() {
    // Create mock modules with correct behavior
    mockImap = function(config) {
      this.config = config;
      this.connect = () => {
        // Simulate a successful connection by immediately emitting 'ready'
        if (this.events && this.events.ready) {
          this.events.ready();
        }
      };
      this.openBox = (folder, readOnly, callback) => { callback(null, { messages: { total: 1 } }); };
      this.search = (criteria, callback) => { callback(null, [123]); };
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

    mockMailparser = {
      simpleParser: function() {
        return Promise.resolve({
          subject: 'test',
          text: 'test body',
          html: '<p>test</p>',
          from: { text: 'test@test.com' },
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

    // Override require
    const Module = require('module');
    originalLoad = Module._load;
    Module._load = function(request, parent) {
      if (mockModules[request]) {
        return mockModules[request];
      }
      return originalLoad.apply(this, arguments);
    };

    // Load the node with mocked dependencies
    emailReceiverNode = require('../../email-receiver/email-receiver.js');
  });

  after(function() {
    // Restore original module loading
    if (originalLoad) {
      const Module = require('module');
      Module._load = originalLoad;
    }
  });

  describe('Module Export', function() {
    it('should export a function', function() {
      // ARRANGE: Node module is already loaded

      // ACT: Check the type of the exported module

      // ASSERT: Should be a function
      emailReceiverNode.should.be.type('function');
    });
  });

  describe('Node Registration', function() {
    it('should register node type without errors', function() {
      // ARRANGE: Set up mock RED object and capture registration calls
      let registeredType;
      let registeredConstructor;

      const mockRED = {
        nodes: {
          createNode: function(node, config) {
            node.id = config.id;
            node.type = config.type;
            node.name = config.name;
            node.on = function() {};
            node.status = function() {};
            node.error = function() {};
            node.send = function() {};
            return node;
          },
          registerType: function(type, constructor) {
            registeredType = type;
            registeredConstructor = constructor;
          }
        },
        util: {
          evaluateNodeProperty: function(value, type) {
            return value;
          },
          encrypt: function(value) {
            return 'encrypted:' + value;
          }
        }
      };

      // ACT: Call the node registration function
      emailReceiverNode(mockRED);

      // ASSERT: Verify registration was called correctly
      registeredType.should.equal('email-receiver');
      registeredConstructor.should.be.type('function');
    });
  });

  describe('Node Instantiation', function() {
    it('should handle node instantiation with valid config', function() {
      // ARRANGE: Set up mock RED object and node instance tracking
      let nodeInstance;

      const mockRED = {
        nodes: {
          createNode: function(node, config) {
            nodeInstance = node;
            node.id = config.id;
            node.type = config.type;
            node.name = config.name;
            node.on = function() {};
            node.status = function() {};
            node.error = function() {};
            node.send = function() {};
            return node;
          },
          registerType: function(type, NodeConstructor) {
            // Simulate creating a node instance with valid config
            const config = {
              id: 'test-node',
              type: 'email-receiver',
              name: 'Test Email Receiver',
              host: 'imap.test.com',
              hostType: 'str',
              port: 993,
              portType: 'num',
              user: 'test@test.com',
              userType: 'str',
              password: 'testpass',
              passwordType: 'str',
              folder: 'INBOX',
              folderType: 'str',
              markseen: true,
              markseenType: 'bool'
            };

            new NodeConstructor(config);
          }
        },
        util: {
          evaluateNodeProperty: function(value, type) {
            return value;
          },
          encrypt: function(value) {
            return 'encrypted:' + value;
          }
        }
      };

      // ACT: Register the node and create an instance
      emailReceiverNode(mockRED);

      // ASSERT: Verify the node instance was created with correct properties
      should.exist(nodeInstance);
      nodeInstance.should.have.property('name', 'Test Email Receiver');
    });
  });

  describe('Folder Configuration', function() {
    it('should handle an array of folders', function(done) {
      // ARRANGE: Mock the Node-RED environment
      let nodeInstance;
      let inputCallback;
      const mockRED = {
        nodes: {
          createNode: function(node, config) {
            nodeInstance = node;
            node.on = (event, callback) => { if (event === 'input') inputCallback = callback; };
            node.status = () => {};
            node.error = () => {};
            node.send = (msg) => {
              should.exist(msg);
              msg.payload.should.equal('test body');
              done();
            };
            return node;
          },
          registerType: (type, constructor) => {
            new constructor({
              host: "imap.test.com", hostType: "str",
              port: 993, portType: "num",
              user: "test@test.com", userType: "str",
              password: "testpass", passwordType: "str",
              folder: ["INBOX", "Junk"], folderType: 'json',
              markseen: true, markseenType: 'bool'
            });
          }
        },
        util: { evaluateNodeProperty: (value) => value },
      };

      // ACT: Register the node, then simulate input
      emailReceiverNode(mockRED);
      inputCallback({});
    });
  });

  describe('Error Handling', function() {
    it('should call node.error for invalid folder type', function(done) {
      // ARRANGE: Mock the node instance to capture errors
      let errorCalled = false;
      const nodeInstance = {
        config: { folder: 123, folderType: 'num' },
        on: (event, callback) => { if (event === 'input') nodeInstance.inputCallback = callback; },
        status: () => {},
        error: (err) => {
          errorCalled = true;
          err.should.containEql('The \'folders\' property must be an array of strings');
          done();
        },
        send: () => {},
      };
      const mockRED = {
        nodes: {
          createNode: (node, config) => Object.assign(node, { on: nodeInstance.on, status: nodeInstance.status, error: nodeInstance.error, send: nodeInstance.send }),
          registerType: (type, constructor) => new constructor(nodeInstance.config),
        },
        util: { evaluateNodeProperty: (value, type) => value },
      };

      // ACT: Register and instantiate the node, then simulate an input message
      emailReceiverNode(mockRED);
      nodeInstance.inputCallback({});
    });

    it('should call node.error for missing config', function(done) {
      // ARRANGE: Mock the node instance to capture errors
      let errorCalled = false;
      let statusCalled = false;
      const nodeInstance = {
        config: {
          host: "imap.test.com", hostType: "str",
          port: 993, portType: "num",
          user: "test@test.com", userType: "str",
          password: "", passwordType: "str", // Empty password should trigger error
          folder: "INBOX", folderType: "str"
        },
        on: (event, callback) => { if (event === 'input') nodeInstance.inputCallback = callback; },
        status: (s) => { statusCalled = true; s.fill.should.equal('red'); },
        error: (err) => {
          errorCalled = true;
          err.should.containEql('Missing required IMAP config');
          done();
        },
        send: () => {},
      };
      const mockRED = {
        nodes: {
          createNode: (node, config) => Object.assign(node, { on: nodeInstance.on, status: nodeInstance.status, error: nodeInstance.error, send: nodeInstance.send }),
          registerType: (type, constructor) => new constructor(nodeInstance.config),
        },
        util: { evaluateNodeProperty: (value, type) => value },
      };

      // ACT: Register and instantiate the node, then simulate an input message
      emailReceiverNode(mockRED);
      nodeInstance.inputCallback({});
    });
  });
});