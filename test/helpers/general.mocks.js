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


module.exports = {
  createMockNodeRED
};