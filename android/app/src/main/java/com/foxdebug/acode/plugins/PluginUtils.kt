package com.foxdebug.acode.plugins

import com.getcapacitor.PluginCall


fun PluginCall.has(key: String): Boolean {
    return data.has(key)
}