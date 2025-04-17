#! /bin/bash

set -e #exit on error

appFreePaid="$1"
mode="$2"


function success(){
    echo -e "\e[32;1m[+] \e[37m$1\e[0m"
}

function info(){
    echo -e "\e[34;1m[*] \e[37m$1\e[0m"
}

function warn(){
    echo -e "\e[33;1m[~] \e[37m$1\e[0m"
}

function error(){
    echo -e "\e[31;1m[!] \e[37m$1\e[0m"
}

if [ -z "$JAVA_HOME" ]; then
    warn "JAVA_HOME is not set. Please set it to your Java installation path."
else
    info "JAVA_HOME is set to $JAVA_HOME"
fi

if [ -z "$ANDROID_HOME" ]; then
    warn "ANDROID_HOME is not set. Please set it to your Android SDK installation path."
else
    info "ANDROID_HOME is set to $ANDROID_HOME"
fi


java_version=$(java -version 2>&1 | awk -F[\".] '/version/ {print $2}')
if [ "$java_version" -ge 21 ]; then
    :
else
    error "Java version 21 or higher is required. Please install openjdk 21 or higher."
    exit 1
fi


if [ -z "$mode" ]
then
  mode="d"
fi

if [ -z "$appFreePaid" ]
then
  appFreePaid="paid"
fi

info "Building app with type: $appFreePaid"
info "Building app with mode: $mode"


# AD ID
AD_APP_ID="ca-app-pub-5911839694379275~4255791238"
PROJECT_ROOT=$(npm prefix)

if [ "$appFreePaid" = "p" ] || [ "$appFreePaid" = "paid" ]; then
  info "Removing Admob plugins if installed"

  if cordova plugin ls | grep -q "cordova-plugin-consent"; then
    cordova plugin remove cordova-plugin-consent --save
  fi

  if cordova plugin ls | grep -q "admob-plus-cordova"; then
    cordova plugin remove admob-plus-cordova --save
  fi
else
  info "Adding Admob plugins"
  cordova plugin add cordova-plugin-consent@2.4.0 --save
  cordova plugin add admob-plus-cordova@1.28.0 --save --variable APP_ID_ANDROID="${AD_APP_ID}" --variable PLAY_SERVICES_VERSION="21.5.0"
fi


if [ "$mode" = "p" ] || [ "$mode" = "prod" ]
then
  webpack --progress --mode production
  node ./utils/loadStyles.js
  npm run sync    
  sh "$PROJECT_ROOT"/scripts/gradlew-link assembleRelease
else
  webpack --progress --mode development
  node ./utils/loadStyles.js
  npm run sync    
  sh "$PROJECT_ROOT"/scripts/gradlew-link assembleDebug
fi

success "Build finished"