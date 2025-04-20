package com.foxdebug.acode.plugins

import android.net.Uri
import android.util.Log
import androidx.documentfile.provider.DocumentFile
import com.foxdebug.acode.MainActivity
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.sshtools.client.SshClient
import com.sshtools.client.SshClient.SshClientBuilder
import com.sshtools.client.sftp.SftpClient
import com.sshtools.client.sftp.SftpClient.SftpClientBuilder
import com.sshtools.common.permissions.PermissionDeniedException
import com.sshtools.common.publickey.InvalidPassphraseException
import com.sshtools.common.publickey.SshKeyUtils
import com.sshtools.common.sftp.SftpFile
import com.sshtools.common.sftp.SftpFileAttributes
import com.sshtools.common.ssh.components.SshKeyPair
import com.sshtools.common.ssh.components.jce.JCEProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import special.anonymous
import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException
import java.net.URI
import java.net.URLDecoder
import java.net.URLEncoder
import java.nio.channels.UnresolvedAddressException
import java.nio.charset.StandardCharsets


@CapacitorPlugin(name = "Sftp")
class Sftp : Plugin() {
    private val TAG = "SFTP"
    private var ssh: SshClient? = null
    private var connectionID: String? = null
    private var sftp: SftpClient? = null


    override fun load() {
        super.load()
        System.setProperty("maverick.log.nothread", "true")
    }


    private suspend fun PluginCall.connectSsh(host: String, port: Int, username: String, password: String? = null, passphrase: String? = null,keyFile: DocumentFile? = null) = withContext(Dispatchers.IO){
        runCatching {
            JCEProvider.enableBouncyCastle(true)
            Log.d(TAG, "Connecting to $host:$port as $username")

            ssh?.close()
            SshClientBuilder.create().apply {
                withHostname(host)
                withPort(port)
                withUsername(username)

                if (password != null){
                    withPassword(password)
                }

                if (passphrase != null && keyFile != null){
                    context.contentResolver.openInputStream(keyFile.uri).use { stream ->
                        val keyPair: SshKeyPair = SshKeyUtils.getPrivateKey(stream, passphrase);
                        withIdentities(keyPair)
                    }
                }


                ssh = build()
            }



            if (ssh!!.isConnected) {
                connectionID = "$username@$host"
                runCatching {
                    sftp = SftpClientBuilder.create().withClient(ssh).build()
                }.onFailure {
                    it.printStackTrace()
                    ssh?.close()
                    reject("Failed to initialize SFTP subsystem: ${it.message.toString()}")
                    return@withContext
                }

                runCatching {
                    sftp?.subsystemChannel?.setCharsetEncoding("UTF-8")
                }.onFailure {
                    Log.w(TAG, "Failed to set UTF-8 encoding, falling back to default", it)
                }

                Log.d(TAG, "Connected successfully to $connectionID")
                resolve()
            } else {
                reject("Failed to connect to $connectionID")
                //ssh?.close()
            }
        }.onFailure {
            it.printStackTrace()
            when (it) {
                is UnresolvedAddressException -> {
                    reject("Cannot resolve host address")
                }

                is PermissionDeniedException -> {
                    reject("Authentication failed: ${it.message}")
                }

                is InvalidPassphraseException -> {
                    reject("Invalid passphrase for $connectionID")
                }

                is IOException -> {
                    reject("Could not read key file: ${it.message}")
                }

                else -> {
                    reject("Unknown error ${it.message}")
                }
            }
        }
    }

    @PluginMethod
    fun connectUsingPassword(call: PluginCall) = with(call) {
        async{
            existsNot("host") {
                return@async
            }
            existsNot("port") {
                return@async
            }
            existsNot("username") {
                return@async
            }
            existsNot("password") {
                return@async
            }

            val host = call.getString("host")!!
            val port = call.getInt("port")!!
            val username = call.getString("username")!!
            val password = call.getString("password")!!

            MainActivity.lifeCycleScope.launch {
                connectSsh(
                    host = host,
                    port = port,
                    username = username,
                    password = password,
                )
            }
        }

    }

    @PluginMethod
    fun connectUsingKeyFile(call: PluginCall) = with(call){
        async{
            existsNot("host") {
                return@async
            }
            existsNot("port") {
                return@async
            }
            existsNot("username") {
                return@async
            }
            existsNot("passphrase") {
                return@async
            }
            existsNot("keyFile") {
                return@async
            }

            val host = call.getString("host")!!
            val port = call.getInt("port")!!
            val username = call.getString("username")!!
            val passphrase = call.getString("passphrase")!!
            val keyFile = call.getString("keyFile")!!

            MainActivity.lifeCycleScope.launch{
                JCEProvider.enableBouncyCastle(true);
                connectSsh(
                    host = host,
                    port = port,
                    username = username,
                    passphrase = passphrase,
                    keyFile = DocumentFile.fromSingleUri(context, Uri.parse(keyFile))
                )
            }
        }

    }


    @PluginMethod
    fun executeCommandWithResult(call: PluginCall) = with(call){
        async {
            existsNot("command"){
                return@async
            }
            val command = getString("command")!!
            runCatching {
                if (ssh != null){
                    val res = JSObject()
                    val buffer = StringBuffer()
                    val code = ssh!!.executeCommandWithResult(command, buffer);

                    res.put("code",code)
                    res.put("result",buffer.toString())

                    resolve(res)
                }else{
                    reject("Not Connected")
                }
            }.onFailure {
                it.printStackTrace()
                reject("SSH Error : ${it.message}")
            }
        }
    }

    @PluginMethod
    fun getFile(call: PluginCall) = with(call){
        async{
            existsNot("remoteFile"){
                return@async
            }
            existsNot("localFileUri"){
                return@async
            }

            if (ssh == null || sftp == null){
                reject("Not Connected")
                return@async
            }

            val remoteFile = getString("remoteFile")!!
            val localFileUri = getString("localFileUri")!!

            if (remoteFile.isBlank()){
                reject("Remote remoteFile is required")
                return@async
            }

            if (localFileUri.isBlank()){
                reject("Local remoteFile is required")
                return@async
            }



            runCatching {
                val file = DocumentFile.fromSingleUri(
                    context,
                    Uri.parse(localFileUri)
                );

                val fileUri = file!!.uri
                sftp!!.getInputStream(remoteFile).use { inputSteam ->
                    context.contentResolver.openOutputStream(fileUri)!!.use { outputStream ->
                        inputSteam.copyTo(outputStream)
                    }
                }

                resolve()
            }.onFailure {
                it.printStackTrace()
                reject("File transfer error: ${it.message}")
            }


        }

    }


    @PluginMethod
    fun putFile(call: PluginCall) = with(call){
        async{
            existsNot("remoteFile"){
                return@async
            }
            existsNot("localFileUri"){
                return@async
            }

            runCatching {
                if (ssh == null || sftp == null){
                    reject("Not Connected")
                    return@async
                }

                val remoteFile = getString("remoteFile")!!
                val localFileUri = getString("localFileUri")!!

                if (remoteFile.isBlank()){
                    reject("Remote remoteFile is required")
                    return@async
                }

                if (localFileUri.isBlank()){
                    reject("Local remoteFile is required")
                    return@async
                }

                val localFile = try {
                    File(URI(localFileUri))
                }catch (e: Exception){
                    e.printStackTrace()
                    reject("Invalid local URI: ${e.message}")
                    return@async
                }

                if (localFile.exists().not() || localFile.canRead().not()){
                    reject("Local file does not exist or is not readable")
                    return@async
                }

                sftp!!.put(localFile.absolutePath,remoteFile)
                resolve()
            }.onFailure {
                it.printStackTrace()
                reject(it.message)
                return@async
            }
        }
        

    }

    @PluginMethod
    fun listFiles(call: PluginCall) = with(call){
        async{
            existsNot("path"){
                return@async
            }

            if (ssh == null || sftp == null){
                reject("Not Connected")
                return@async
            }

            val path = getString("path")!!
            
            val files = JSONArray()

            for (file in sftp!!.ls(path)){
                val filename = file.filename
                if (filename == "." || filename == ".."){
                    continue
                }

                runCatching {
                    files.put(getStat(name = file.filename, fileAttributes = file.attributes(), url = file.absolutePath))
                }.onFailure {
                    it.printStackTrace()
                    reject(it.message)
                }


            }

            val result = JSObject()
            result.put("result", files)
            resolve(result)
        }

    }

    @PluginMethod
    fun mkdir(call: PluginCall) = with(call){
        async{
            existsNot("path"){
                return@async
            }
            if (ssh == null || sftp == null){
                reject("Not Connected")
                return@async
            }
            val path = getString("path")!!
            runCatching {
                sftp!!.mkdir(path);
                resolve()
            }.onFailure {
                it.printStackTrace()
                reject(it.message)
            }

        }
    }

    @PluginMethod
    fun rm(call: PluginCall) = with(call){
        async{
            existsNot("path"){
                return@async
            }

            if (ssh == null || sftp == null){
                reject("Not Connected")
                return@async
            }
            val path = getString("path")!!
            val force = getBoolean("force") == true
            val recursive = getBoolean("recursive") == true

            runCatching {
                sftp!!.rm(path,force,recursive)
                resolve()
            }.onFailure {
                it.printStackTrace()
                reject(it.message)
            }

        }
    }

    @PluginMethod
    fun pwd(call: PluginCall) = with(call){
        async{
            if (ssh == null || sftp == null){
                reject("Not Connected")
                return@async
            }

            runCatching {
                val pwd = sftp!!.pwd()
                val result = JSObject()
                result.put("result",pwd)
                resolve(result)
            }.onFailure {
                it.printStackTrace()
                reject(it.message)
            }


        }
    }

    @PluginMethod
    fun rename(call: PluginCall) = with(call){
        async{
            runCatching {
                if (ssh == null || sftp == null){
                    reject("Not Connected")
                    return@async
                }

                existsNot("oldPath"){
                    return@async
                }
                existsNot("newPath"){
                    return@async
                }

                val oldPath = getString("oldPath")!!
                val newPath = getString("newPath")!!
                sftp!!.rename(oldPath,newPath)
                resolve()
            }.onFailure {
                it.printStackTrace()
                reject(it.message)
            }
        }
    }

    @PluginMethod
    fun createFile(call: PluginCall) = with(call){
        async{
            runCatching {
                if (ssh == null || sftp == null){
                    reject("Not Connected")
                    return@async
                }

                existsNot("path"){
                    return@async
                }

                val path = getString("path")!!
                val content = getString("content").toString()


                if (sftp!!.exists(path)){
                    reject("File already exists")
                    return@async
                }

                ByteArrayInputStream(content.toByteArray(Charsets.UTF_8)).use {
                    runCatching {
                        sftp!!.put(it,path)
                    }.onFailure {
                        it.printStackTrace()
                        reject(it.message)
                    }
                }


            }.onFailure {
                it.printStackTrace()
                reject(it.message)
            }
        }
    }

    @PluginMethod
    fun getStat(call: PluginCall) = with(call){
        async{
            existsNot("path"){
                return@async
            }

            val path = sanitizePath(getString("path")!!)

            if (ssh == null || sftp == null){
                reject("Not Connected")
                return@async
            }
            
            runCatching {
                val uri = URI(path);
                val pathSegments = uri.getPath().split("/");
                val filename = pathSegments[pathSegments.size - 1];
                val result = getStat(fileAttributes = sftp!!.stat(uri.path), url = uri.path, name = filename)

                resolve(JSObject().also { it.put("result",result) })
            }.onFailure {
                it.printStackTrace()
                reject(it.message)
            }
        }


    }

    @PluginMethod
    fun close(call: PluginCall){
        async{
            runCatching {
                if (ssh != null) {
                    ssh!!.close();
                    sftp?.quit();
                    call.resolve()
                    return@async;
                }
                call.reject("Not Connected")
            }.onFailure {
                it.printStackTrace()
                call.reject(it.message)
            }
        }
    }


    @PluginMethod
    fun isConnected(call: PluginCall){
        if (ssh != null &&
            ssh!!.isConnected &&
            sftp != null &&
            !sftp!!.isClosed
        ){
          call.resolve()
        }else{
            call.reject("Not Connected")
        }
    }



    private fun sanitizePath(path: String): String {
        return try {
            val decodedPath = URLDecoder.decode(path, StandardCharsets.UTF_8.toString())
            val encodedPath = URLEncoder.encode(decodedPath, StandardCharsets.UTF_8.toString())
                .replace("+", "%20") // Replace + with %20 for spaces
                .replace("%2F", "/") // Preserve forward slashes
                .replace("%5C", "\\") // Preserve backslashes if needed

            encodedPath
        } catch (e: Exception) {
            e.printStackTrace()
            path // Return original if encoding fails
        }
    }


    private fun getStat(fileAttributes: SftpFileAttributes, url: String, name: String): JSONObject{
        val fileInfo = JSONObject();
        fileInfo.put("name", name);
        fileInfo.put("exists", true);

            val permissions = fileAttributes.toPermissionsString();
            val canRead = permissions[1] == 'r';
            val canWrite = permissions[2] == 'w';
            fileInfo.put("canRead", canRead);
            fileInfo.put("canWrite", canWrite);
            fileInfo.put("permissions", permissions);
            fileInfo.put("length", fileAttributes.size());
            fileInfo.put("url", url);
            fileInfo.put("lastModified", fileAttributes.lastModifiedTime())

            if (permissions[0] == 'l'){
                fileInfo.put("isLink", true);
                runCatching {
                    val linkTarget = sftp!!.getSymbolicLinkTarget(
                        url
                    );
                    fileInfo.put("linkTarget", linkTarget);

                    val linkAttributes = sftp!!.stat(
                        linkTarget
                    );
                    fileInfo.put("isFile", linkAttributes.isFile);
                    fileInfo.put(
                        "isDirectory",
                        linkAttributes.isDirectory
                    );


                }.onFailure {
                    it.printStackTrace()
                    fileInfo.put("isFile", false);
                    fileInfo.put("isDirectory", false);
                    fileInfo.put("isLink", false);
                }

            }else{
                fileInfo.put("isLink", false);
                fileInfo.put("isDirectory", fileAttributes.isDirectory);
                fileInfo.put("isFile", fileAttributes.isFile);
            }


        return fileInfo
    }
}














