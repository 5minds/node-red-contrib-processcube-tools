/**
 * Shared mock objects and utilities for Email Receiver Node tests
 */

/**
 * Mock IMAP implementation for testing
 */
function createMockImap() {
  return function MockImap(config) {
    this.config = config;
    this.events = {};

    // Simulate connection behavior
    this.connect = () => {
      // Check if we should simulate a connection error
      if (this.config.host && this.config.host.includes('invalid')) {
        // Simulate connection error
        if (this.events && this.events.error) {
          setTimeout(() => {
            const error = new Error('Connection failed');
            error.code = 'ENOTFOUND';
            this.events.error(error);
          }, 10);
        }
      } else {
        // Simulate successful connection by emitting 'ready' event
        if (this.events && this.events.ready) {
          setTimeout(() => this.events.ready(), 10);
        }
      }
    };

    // Simulate opening a mailbox
    this.openBox = (folder, readOnly, callback) => {
      setTimeout(() => {
        callback(null, {
          messages: { total: 1 },
          name: folder,
          readOnly: readOnly
        });
      }, 10);
    };

    // Simulate searching for emails
    this.search = (criteria, callback) => {
      setTimeout(() => {
        // Return mock message IDs
        callback(null, [123, 456, 789]);
      }, 10);
    };

    // Simulate fetching email messages
    this.fetch = (results, options) => {
      return {
        on: (event, callback) => {
          if (event === 'message') {
            setTimeout(() => {
              const mockMessage = {
                on: (messageEvent, messageCallback) => {
                  if (messageEvent === 'body') {
                    setTimeout(() => {
                      messageCallback(Buffer.from('mock email body'));
                    }, 5);
                  } else if (messageEvent === 'attributes') {
                    setTimeout(() => {
                      messageCallback({
                        uid: 123,
                        flags: ['\\Seen'],
                        date: new Date(),
                        size: 1024
                      });
                    }, 5);
                  }
                },
                once: (messageEvent, messageCallback) => {
                  if (messageEvent === 'end') {
                    setTimeout(() => messageCallback(), 15);
                  }
                }
              };
              callback(mockMessage);
            }, 10);
          }
        },
        once: (event, callback) => {
          if (event === 'end') {
            setTimeout(() => callback(), 20);
          } else if (event === 'error') {
            // Store error callback for potential use
            this.errorCallback = callback;
          }
        }
      };
    };

    // Simulate closing connection
    this.end = () => {
      if (this.events && this.events.end) {
        setTimeout(() => this.events.end(), 5);
      }
    };

    // Event listener setup
    this.once = (event, callback) => {
      if (!this.events) this.events = {};
      this.events[event] = callback;
    };

    // Additional IMAP methods that might be used
    this.addFlags = (source, flags, callback) => {
      setTimeout(() => callback(null), 5);
    };

    this.removeFlags = (source, flags, callback) => {
      setTimeout(() => callback(null), 5);
    };

    return this;
  };
}

/**
 * Mock Mailparser implementation for testing
 */
function createMockMailparser() {
  return {
    simpleParser: function(source, options = {}) {
      return Promise.resolve({
        subject: options.subject || 'Mock Email Subject',
        text: options.text || 'This is a mock email body for testing purposes.',
        html: options.html || '<p>This is a mock email body for testing purposes.</p>',
        from: {
          text: options.from || 'sender@test.com',
          value: [{ address: options.from || 'sender@test.com', name: 'Test Sender' }]
        },
        to: {
          text: options.to || 'recipient@test.com',
          value: [{ address: options.to || 'recipient@test.com', name: 'Test Recipient' }]
        },
        date: options.date || new Date(),
        messageId: options.messageId || '<mock-message-id@test.com>',
        headers: new Map([
          ['message-id', '<mock-message-id@test.com>'],
          ['subject', options.subject || 'Mock Email Subject'],
          ['from', options.from || 'sender@test.com'],
          ['to', options.to || 'recipient@test.com']
        ]),
        attachments: options.attachments || []
      });
    }
  };
}

/**
 * Create mock Node-RED object for unit testing
 */
function createMockNodeRED(options = {}) {
  // Store input callback in the mock RED context
  let storedInputCallback = null;
  let nodeInstance = null;

  const mockRED = {
    nodes: {
      createNode: function(node, config) {
        nodeInstance = node; // Capture the node instance

        // Apply config properties to node
        Object.assign(node, {
          id: config.id || 'mock-node-id',
          type: config.type || 'email-receiver',
          name: config.name || 'Mock Node',
          on: function(event, callback) {
            if (event === 'input') {
              storedInputCallback = callback;
              // Store the callback on the node instance for easy access
              node.inputCallback = callback;
            }
            // Call the original onHandler if provided
            if (options.onHandler) {
              options.onHandler.call(node, event, callback);
            }
          },
          status: options.statusHandler || function() {},
          error: options.errorHandler || function() {},
          send: options.sendHandler || function() {},
          log: options.logHandler || function() {},
          warn: options.warnHandler || function() {},
          debug: options.debugHandler || function() {}
        });
        return node;
      },
      registerType: function(type, constructor) {
        // Store registration for verification in tests
        this.lastRegisteredType = type;
        this.lastRegisteredConstructor = constructor;
      },
      // Helper method to get the stored input callback
      getInputCallback: function() {
        return storedInputCallback;
      },
      // Helper method to get the node instance
      getNodeInstance: function() {
        return nodeInstance;
      }
    },
    util: {
      evaluateNodeProperty: function(value, type, node, msg, callback) {
        if (type === 'json') {
          try {
            // Simulate parsing a JSON string into an object
            return JSON.parse(JSON.stringify(value));
          } catch (e) {
            if (callback) {
              callback(e, null);
            }
            return null;
          }
        }

        // Simple mock implementation
        if (callback) {
          callback(null, value);
        }
        return value;
      },
      encrypt: function(value) {
        return 'encrypted:' + value;
      },
      decrypt: function(value) {
        return value.replace('encrypted:', '');
      }
    },
    log: {
      info: options.logInfo || function() {},
      warn: options.logWarn || function() {},
      error: options.logError || function() {},
      debug: options.logDebug || function() {}
    }
  };

  return mockRED;
}

/**
 * Set up module mocks for require() calls
 */
function setupModuleMocks() {
  const mockModules = {
    'node-imap': createMockImap(),
    'mailparser': createMockMailparser()
  };

  const Module = require('module');
  const originalLoad = Module._load;

  Module._load = function(request, parent) {
    if (mockModules[request]) {
      return mockModules[request];
    }
    return originalLoad.apply(this, arguments);
  };

  // Return cleanup function
  return function cleanup() {
    Module._load = originalLoad;
  };
}

/**
 * Create test configurations for different scenarios
 */
const testConfigs = {
  valid: {
    id: 'test-node-1',
    type: 'email-receiver',
    name: 'Test Email Receiver',
    host: 'imap.test.com',
    hostType: 'str',
    port: 993,
    portType: 'num',
    tls: true,
    tlsType: 'bool',
    user: 'test@test.com',
    userType: 'str',
    password: 'testpass',
    passwordType: 'str',
    folder: ['INBOX'],
    folderType: 'str',
    markseen: true,
    markseenType: 'bool'
  },

  arrayFolders: {
    id: 'test-node-3',
    type: 'email-receiver',
    name: 'Array Folders Test',
    host: 'imap.test.com',
    hostType: 'str',
    port: 993,
    portType: 'num',
    user: 'test@test.com',
    userType: 'str',
    password: 'testpass',
    passwordType: 'str',
    folder: ['INBOX', 'Junk', 'Drafts'],
    folderType: 'json',
    markseen: false,
    markseenType: 'bool'
  },

  invalidFolderType: {
    id: 'test-node-4',
    type: 'email-receiver',
    name: 'Invalid Config Test',
    host: '',  // Missing host
    hostType: 'str',
    port: 993,
    portType: 'num',
    user: 'test@test.com',
    userType: 'str',
    password: '',  // Missing password
    passwordType: 'str',
    folder: 123,
    folderType: 'num'
  },

  invalidConfig: {
    id: 'test-node-4',
    type: 'email-receiver',
    name: 'Invalid Config Test',
    host: '',  // Missing host
    hostType: 'str',
    port: 993,
    portType: 'num',
    user: 'test@test.com',
    userType: 'str',
    password: '',  // Missing password
    passwordType: 'str',
    folder: ["Inbox"],
    folderType: 'num'
  },

  minimal: {
    id: 'test-node-5',
    type: 'email-receiver',
    host: 'imap.minimal.com',
    hostType: 'str',
    port: 993,
    portType: 'num',
    user: 'minimal@test.com',
    userType: 'str',
    password: 'minimalpass',
    passwordType: 'str',
    folder: 'INBOX',
    folderType: 'str'
  }
};

/**
 * Create test flows for Node-RED integration tests
 */
const testFlows = {
  single: [
    testConfigs.valid
  ],

  withHelper: [
    testConfigs.valid,
    { id: 'h1', type: 'helper' }
  ],

  connected: [
    { ...testConfigs.valid, wires: [['h1']] },
    { id: 'h1', type: 'helper' }
  ],

  multiOutput: [
    { ...testConfigs.valid, wires: [['h1', 'h2']] },
    { id: 'h1', type: 'helper' },
    { id: 'h2', type: 'helper' }
  ]
};

/**
 * Utility functions for test assertions
 */
const testUtils = {
  /**
   * Wait for a specified amount of time
   */
  wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Create a promise that resolves when a node receives a message
   */
  waitForMessage: (node, timeout = 1000) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timeout waiting for message'));
      }, timeout);

      node.on('input', (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
    });
  },

  /**
   * Verify that a message has expected properties
   */
  verifyMessage: (msg, expectedProps = {}) => {
    const should = require('should');
    should.exist(msg);

    Object.keys(expectedProps).forEach(prop => {
      if (expectedProps[prop] !== undefined) {
        msg.should.have.property(prop, expectedProps[prop]);
      }
    });
  }
};

module.exports = {
  createMockImap,
  createMockMailparser,
  createMockNodeRED,
  setupModuleMocks,
  testConfigs,
  testFlows,
  testUtils
};