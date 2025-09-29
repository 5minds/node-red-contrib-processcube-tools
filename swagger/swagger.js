/**
 * Copyright 2015, 2016 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

const DEFAULT_TEMPLATE = {
    openapi: '3.0.0',
    info: {
        title: 'My Node-RED API',
        version: '1.0.0',
        description: 'A sample API',
    },
    servers: [
        {
            url: 'http://localhost:1880/',
            description: 'Local server',
        },
    ],
    paths: {},
    components: {
        schemas: {},
        responses: {},
        parameters: {},
        securitySchemes: {},
    },
    tags: [],
};

module.exports = function (RED) {
    'use strict';

    const path = require('path');

    const convToSwaggerPath = (x) => `/{${x.substring(2)}}`;
    const trimAll = (ary) => ary.map((x) => x.trim());
    const csvStrToArray = (csvStr) => (csvStr ? trimAll(csvStr.split(',')) : []);
    const ensureLeadingSlash = (url) => (url.startsWith('/') ? url : '/' + url);
    const stripTerminalSlash = (url) => (url.length > 1 && url.endsWith('/') ? url.slice(0, -1) : url);
    const regexColons = /\/:\w*/g;

    // Helper function to convert collection format to OpenAPI 3.0 style
    const getStyleFromCollectionFormat = (collectionFormat) => {
        const formatMap = {
            csv: 'simple',
            ssv: 'spaceDelimited',
            tsv: 'pipeDelimited',
            pipes: 'pipeDelimited',
            multi: 'form',
        };
        return formatMap[collectionFormat] || 'simple';
    };

    RED.httpNode.get('/http-api/swagger.json', (req, res) => {
        try {
            const { httpNodeRoot, openapi: { template = {}, parameters: additionalParams = [] } = {} } = RED.settings;

            const resp = { ...DEFAULT_TEMPLATE, ...template };
            resp.paths = {};

            // Update server URL to include the httpNodeRoot
            if (httpNodeRoot && httpNodeRoot !== '/') {
                resp.servers = resp.servers.map((server) => ({
                    ...server,
                    url: server.url.replace(/\/$/, '') + httpNodeRoot,
                }));
            }

            RED.nodes.eachNode((node) => {
                const { name, type, method, swaggerDoc, url } = node;

                if (type === 'http in' && swaggerDoc) {
                    const swaggerDocNode = RED.nodes.getNode(swaggerDoc);

                    if (swaggerDocNode) {
                        // Convert Node-RED path parameters to OpenAPI format
                        const endPoint = stripTerminalSlash(
                            ensureLeadingSlash(url.replace(regexColons, convToSwaggerPath)),
                        );

                        if (!resp.paths[endPoint]) resp.paths[endPoint] = {};

                        const {
                            summary = name || `${method.toUpperCase()} ${endPoint}`,
                            description = '',
                            tags = '',
                            deprecated = false,
                            parameters = [],
                            requestBody = null,
                            responses = {},
                        } = swaggerDocNode;

                        const aryTags = csvStrToArray(tags);

                        const operation = {
                            summary,
                            description,
                            tags: aryTags,
                            deprecated,
                            parameters: [...parameters, ...additionalParams].map((param) => {
                                const paramDef = {
                                    name: param.name,
                                    in: param.in,
                                    required: param.required || false,
                                    description: param.description || '',
                                };

                                // Handle parameter schema - preserve the original schema structure
                                if (param.schema) {
                                    // If there's already a schema object, use it
                                    paramDef.schema = param.schema;
                                } else if (param.type) {
                                    // Build schema from individual type properties
                                    paramDef.schema = { type: param.type };
                                    if (param.format) {
                                        paramDef.schema.format = param.format;
                                    }
                                    if (param.type === 'array' && param.items) {
                                        paramDef.schema.items = param.items;
                                    }
                                    if (param.collectionFormat && param.type === 'array') {
                                        paramDef.style = getStyleFromCollectionFormat(param.collectionFormat);
                                        paramDef.explode = param.collectionFormat === 'multi';
                                    }
                                }

                                return paramDef;
                            }),
                            responses: {},
                        };

                        // Add request body if it exists
                        if (requestBody && Object.keys(requestBody.content || {}).length > 0) {
                            const content = requestBody.content;
                            Object.keys(content).forEach(contentType => {
                                if (contentType.includes('xml') && content[contentType].example) {
                                    content['text/plain'] = {
                                        schema: { type: 'string' },
                                        example: content[contentType].example.replace(/\\n/g, '\n')
                                    };
                                    delete content[contentType];
                                }
                            });
                            operation.requestBody = requestBody;
                        }

                        // Process responses
                        if (responses && typeof responses === 'object') {
                            Object.keys(responses).forEach((status) => {
                                const responseDetails = responses[status];
                                operation.responses[status] = {
                                    description: responseDetails.description || 'No description',
                                };

                                // Add content if schema exists
                                if (responseDetails.schema) {
                                    operation.responses[status].content = {
                                        'application/json': {
                                            schema: responseDetails.schema,
                                        },
                                    };
                                }
                            });
                        }

                        // Ensure at least one response exists
                        if (Object.keys(operation.responses).length === 0) {
                            operation.responses['200'] = {
                                description: 'Successful response',
                            };
                        }

                        resp.paths[endPoint][method.toLowerCase()] = operation;
                    }
                }
            });

            // Clean up empty sections
            cleanupOpenAPISpec(resp);
            res.json(resp);
        } catch (error) {
            console.error('Error generating Swagger JSON:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    function cleanupOpenAPISpec(spec) {
        // Clean up components
        if (spec.components) {
            ['schemas', 'responses', 'parameters', 'securitySchemes'].forEach((key) => {
                if (spec.components[key] && Object.keys(spec.components[key]).length === 0) {
                    delete spec.components[key];
                }
            });

            // If all components are empty, remove the components object itself
            if (Object.keys(spec.components).length === 0) {
                delete spec.components;
            }
        }

        // Clean up empty tags array
        if (Array.isArray(spec.tags) && spec.tags.length === 0) {
            delete spec.tags;
        }
    }

    function SwaggerDoc(n) {
        RED.nodes.createNode(this, n);
        this.summary = n.summary;
        this.description = n.description;
        this.tags = n.tags;
        this.parameters = n.parameters || [];
        this.responses = n.responses || {};
        this.requestBody = n.requestBody || null;
        this.deprecated = n.deprecated || false;
    }
    RED.nodes.registerType('swagger-doc', SwaggerDoc);

    // Serve the main Swagger UI HTML file
    RED.httpAdmin.get('/swagger-ui/swagger-ui.html', (req, res) => {
        const filename = path.join(__dirname, 'swagger-ui', 'swagger-ui.html');
        sendFile(res, filename);
    });

    // Serve Swagger UI assets
    RED.httpAdmin.get('/swagger-ui/*', (req, res, next) => {
        let filename = req.params[0];

        // Skip if it's the HTML file (handled by specific route above)
        if (filename === 'swagger-ui.html') {
            return next();
        }

        try {
            const swaggerUiPath = require('swagger-ui-dist').getAbsoluteFSPath();
            const filePath = path.join(swaggerUiPath, filename);
            sendFile(res, filePath);
        } catch (err) {
            console.error('Error serving Swagger UI asset:', err);
            res.status(404).send('File not found');
        }
    });

    // Serve localization files
    RED.httpAdmin.get('/swagger-ui/nls/*', (req, res) => {
        const filename = path.join(__dirname, 'locales', req.params[0]);
        sendFile(res, filename);
    });

    // Generic function to send files
    function sendFile(res, filePath) {
        const fs = require('fs');

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).send('File not found');
        }

        res.sendFile(path.resolve(filePath), (err) => {
            if (err) {
                console.error('Error sending file:', err);
                res.status(err.status || 500).send('Error sending file');
            }
        });
    }
};
