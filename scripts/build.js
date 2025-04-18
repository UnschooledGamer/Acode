const { execSync, exec } = require("child_process");
const path = require("path");

// Input arguments
const appFreePaid = process.argv[2] || "paid";
const mode = process.argv[3] || "d";

// Terminal colors
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32;1m",
  blue: "\x1b[34;1m",
  yellow: "\x1b[33;1m",
  red: "\x1b[31;1m",
  white: "\x1b[37m",
};

// Log functions
function success(msg) {
  console.log(`${colors.green}[+] ${colors.white}${msg}${colors.reset}`);
}

function info(msg) {
  console.log(`${colors.blue}[*] ${colors.white}${msg}${colors.reset}`);
}

function warn(msg) {
  console.log(`${colors.yellow}[~] ${colors.white}${msg}${colors.reset}`);
}

function error(msg) {
  console.error(`${colors.red}[!] ${colors.white}${msg}${colors.reset}`);
  process.exit(1);
}

// Check JAVA_HOME and ANDROID_HOME
if (!process.env.JAVA_HOME) {
  warn("JAVA_HOME is not set. Please set it to your Java installation path.");
} else {
  info(`JAVA_HOME is set to ${process.env.JAVA_HOME}`);
}

if (!process.env.ANDROID_HOME) {
  warn(
    "ANDROID_HOME is not set. Please set it to your Android SDK installation path."
  );
} else {
  info(`ANDROID_HOME is set to ${process.env.ANDROID_HOME}`);
}

// Check Java version
try {
  const javaVersionOutput = execSync("java -version 2>&1").toString();
  const match = javaVersionOutput.match(/version\s+"(\d+)\.(\d+)/);
  const majorVersion = match ? parseInt(match[1]) : null;
  if (!majorVersion || majorVersion < 21) {
    error(
      "Java version 21 or higher is required. Please install openjdk 21 or higher."
    );
  }
} catch (e) {
  error("Failed to check Java version. Is Java installed?");
}

// Log build info
info(`Building app with type: ${appFreePaid}`);
info(`Building app with mode: ${mode}`);

// Admob settings
const AD_APP_ID = "ca-app-pub-5911839694379275~4255791238";
const PROJECT_ROOT = execSync("npm prefix").toString().trim();

try {
  if (appFreePaid === "p" || appFreePaid === "paid") {
    info("Removing Admob plugins if installed");

    if (
      execSync("cordova plugin ls")
        .toString()
        .includes("cordova-plugin-consent")
    ) {
      execSync("cordova plugin remove cordova-plugin-consent --save", {
        stdio: "inherit",
      });
    }

    if (
      execSync("cordova plugin ls").toString().includes("admob-plus-cordova")
    ) {
      execSync("cordova plugin remove admob-plus-cordova --save", {
        stdio: "inherit",
      });
    }
  } else {
    info("Adding Admob plugins");
    execSync("cordova plugin add cordova-plugin-consent@2.4.0 --save", {
      stdio: "inherit",
    });
    execSync(
      `cordova plugin add admob-plus-cordova@1.28.0 --save --variable APP_ID_ANDROID="${AD_APP_ID}" --variable PLAY_SERVICES_VERSION="21.5.0"`,
      { stdio: "inherit" }
    );
  }

  const webpackMode =
    mode === "p" || mode === "prod" ? "production" : "development";

  execSync(`webpack --progress --mode ${webpackMode}`, { stdio: "inherit" });
  execSync("node ./utils/loadStyles.js", { stdio: "inherit" });
  execSync("npm run sync", { stdio: "inherit" });

  const gradleCmd =
    mode === "p" || mode === "prod" ? "assembleRelease" : "assembleDebug";
  execSync(`sh "${PROJECT_ROOT}/scripts/gradlew-link" ${gradleCmd}`, {
    stdio: "inherit",
  });

  success("Build finished");
} catch (e) {
  error(`Build failed: ${e.message}`);
}
