# HowTo develop this package

## What you need?

- docker
- node
- npm

## Get Started?

1. Clone this repository
2. Run `npm install`
3. Run `npm run build`to have the typescript code compiled
4. docker compose build
5. docker compose up
6. Connect to app via vscode launch.json (Attach to Node-RED) if you want to debug
7. Happy coding

## Want to create your own custom node?

Copy the custom-node-template folder, rename it to the name of your custom node. Do the same for the files inside and make sure the .template at the end and you are ready to go. Create a small example of a test inside of the Node-RED flows.
Make sure to have previously run npm install, or else your node might node show up, because of a missing used package inside of it. Don't forget to add some test in the test folder. Happy Coding!

## Want to run some tests

1. You can use the Macha Test Explorer extension to run them or use `npm run test`.
