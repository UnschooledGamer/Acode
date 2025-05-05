package com.foxdebug.acode.plugins

import android.content.Context
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.core.net.toFile
import androidx.core.net.toUri
import java.io.File
import java.nio.file.Files

class AcodeNativeFs(private val context: Context) {

    @Throws(Exception::class)
    fun isSymlink(uri: String): Boolean {
        val file = getFileFromUri(uri.toUri()) ?: return false
        if (file.exists().not()) return false

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Files.isSymbolicLink(file.toPath())
        } else file.canonicalPath != file.absolutePath
    }

    private fun getFileFromUri(uri: Uri): File? {
        return when (uri.scheme) {
            "file" -> uri.toFile()

            "content" -> {
                val projection = arrayOf(MediaStore.MediaColumns.DATA)
                context.contentResolver.query(uri, projection, null, null, null)?.use {
                    val columnIndex = it.getColumnIndexOrThrow(MediaStore.MediaColumns.DATA)
                    if (it.moveToFirst()) {
                        val filePath = it.getString(columnIndex)
                        if (filePath != null) File(filePath) else null
                    } else null
                }
            }

            else -> null
        }
    }
}
