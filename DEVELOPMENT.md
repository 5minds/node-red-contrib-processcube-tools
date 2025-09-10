# HowTo develop this package

## What you need?

- docker
- node
- npm

## Get Started?

1. Clone this repository
2. Run `npm install`
3. docker compose build
4. docker compose up
5. Connect to app via vscode launch.json (Attach to Node-RED)
6. Happy coding

## Want to run some tests
1. Run  `npm install`
2. Run `npm run test:debug` to run integration and unit tests. To just run one type of them use `npm run test:unit` or `npm run test:integration`
3. If you want to debug your own unit tests you can do so by selecting run and debug icon on the left side in Visual Studio code, select the ***Debug npm test*** and press the run button.
