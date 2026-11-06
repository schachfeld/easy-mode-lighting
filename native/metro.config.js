// The app shares Glow's lighting core and live-light layer with the web app
// and add-on, so Metro also watches ../packages/core and ../src. Packages
// imported by those shared files resolve from this app, so they never pick up
// the web app's copy of React.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [
  path.resolve(__dirname, "../packages/core"),
  path.resolve(__dirname, "../src"),
];
const app = __dirname + path.sep;
config.resolver.resolveRequest = (context, moduleName, platform) =>
  context.resolveRequest(
    !context.originModulePath.startsWith(app) && !moduleName.startsWith(".")
      ? { ...context, originModulePath: path.join(app, "package.json") }
      : context,
    moduleName,
    platform,
  );
module.exports = config;
