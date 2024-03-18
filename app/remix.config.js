/** @type {import('@remix-run/dev').AppConfig} */
export default {
  ignoredRouteFiles: ["**/*.css"],
  browserNodeBuiltinsPolyfill: {
    modules: {
      buffer: true,
      stream: true,
      crypto: true,
      events: true,
      assert: true,
      fs: true,
    },
  },
  serverDependenciesToBundle: ["lodash", "js-sha3", "react-dropzone"],
  // appDirectory: "app",
  // assetsBuildDirectory: "public/build",
  // publicPath: "/build/",
  // serverBuildPath: "build/index.js",
}
