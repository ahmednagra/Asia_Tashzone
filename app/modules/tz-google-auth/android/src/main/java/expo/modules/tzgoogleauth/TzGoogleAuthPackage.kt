package expo.modules.tzgoogleauth

import android.app.Application
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import com.google.android.gms.games.PlayGamesSdk
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package

class TzGoogleAuthPackage : Package {
  override fun createApplicationLifecycleListeners(context: Context): List<ApplicationLifecycleListener> =
    listOf(object : ApplicationLifecycleListener {
      override fun onCreate(application: Application) {
        playGamesReady = hasPlayGamesAppId(application)
        if (playGamesReady) PlayGamesSdk.initialize(application)
      }
    })

  companion object {
    private const val APP_ID_KEY = "com.google.android.gms.games.APP_ID"

    @Volatile
    var playGamesReady = false
      private set

    private fun hasPlayGamesAppId(application: Application): Boolean {
      val info: ApplicationInfo = try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          application.packageManager.getApplicationInfo(
            application.packageName,
            PackageManager.ApplicationInfoFlags.of(PackageManager.GET_META_DATA.toLong()),
          )
        } else {
          @Suppress("DEPRECATION")
          application.packageManager.getApplicationInfo(application.packageName, PackageManager.GET_META_DATA)
        }
      } catch (_: PackageManager.NameNotFoundException) {
        return false
      }
      return !info.metaData?.getString(APP_ID_KEY).isNullOrBlank()
    }
  }
}
