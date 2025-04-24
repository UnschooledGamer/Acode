package com.foxdebug.acode

import android.content.Context
import android.os.Bundle
import androidx.lifecycle.lifecycleScope
import com.foxdebug.acode.plugins.NativeLayer
import com.foxdebug.acode.plugins.Sftp
import com.getcapacitor.BridgeActivity
import kotlinx.coroutines.CoroutineScope
import java.lang.ref.WeakReference


class MainActivity : BridgeActivity(){

    companion object{
        private var activityRef: WeakReference<MainActivity?>? = WeakReference(null)
        fun getActivityContext(): Context?{
            return activityRef?.get()
        }

        val lifeCycleScope: CoroutineScope get() {
                val scope = activityRef?.get()?.lifecycleScope
                return if (scope == null){
                    throw IllegalStateException("Activity is not available")
                }else{
                    scope
                }
        }

    }

    override fun onCreate(savedInstanceState: Bundle?) {
        //register plugins before calling super
        registerPlugin(NativeLayer::class.java)


        super.onCreate(savedInstanceState)
        activityRef = WeakReference(this)
    }

    override fun onDestroy() {
        super.onDestroy()
        activityRef = WeakReference(null)
        activityRef = null
    }
}