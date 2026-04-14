const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withAdiRegistration(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const assetsDir = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "assets"
      );

      // Ensure the assets directory exists
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      // Copy the adi-registration.properties file
      const sourceFile = path.join(
        config.modRequest.projectRoot,
        "assets",
        "adi-registration.properties"
      );
      const destFile = path.join(assetsDir, "adi-registration.properties");

      fs.copyFileSync(sourceFile, destFile);

      return config;
    },
  ]);
}

module.exports = withAdiRegistration;
