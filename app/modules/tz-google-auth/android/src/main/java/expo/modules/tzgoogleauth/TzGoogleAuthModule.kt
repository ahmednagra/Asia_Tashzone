package expo.modules.tzgoogleauth

import android.app.Activity
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.games.PlayGames
import com.google.android.gms.tasks.Task
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class SignInException(code: String, message: String, cause: Throwable? = null) : CodedException(code, message, cause)

class TzGoogleAuthModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TzGoogleAuth")

    Function("isPlayGamesReady") { TzGoogleAuthPackage.playGamesReady }

    AsyncFunction("googleIdToken") Coroutine { webClientId: String, nonce: String ->
      val activity = activity()
      val option = GetSignInWithGoogleOption.Builder(webClientId).setNonce(nonce).build()
      val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
      val credential = try {
        CredentialManager.create(activity).getCredential(activity, request).credential
      } catch (e: GetCredentialCancellationException) {
        throw SignInException("CANCELLED", "Sign-in was cancelled", e)
      } catch (e: NoCredentialException) {
        throw SignInException("NO_ACCOUNT", "No Google account is available", e)
      } catch (e: GetCredentialException) {
        throw SignInException("FAILED", e.type, e)
      }
      if (credential !is CustomCredential || credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
        throw SignInException("FAILED", "Unexpected credential type")
      }
      try {
        GoogleIdTokenCredential.createFrom(credential.data).idToken
      } catch (e: GoogleIdTokenParsingException) {
        throw SignInException("FAILED", "Unreadable Google credential", e)
      }
    }

    AsyncFunction("playGamesServerCode") Coroutine { serverClientId: String ->
      if (!TzGoogleAuthPackage.playGamesReady) throw SignInException("NOT_CONFIGURED", "Play Games is not set up in this build")
      val client = PlayGames.getGamesSignInClient(activity())
      try {
        val signedIn = client.isAuthenticated.awaitResult().isAuthenticated || client.signIn().awaitResult().isAuthenticated
        if (!signedIn) throw SignInException("CANCELLED", "Play Games sign-in was not completed")
        client.requestServerSideAccess(serverClientId, false).awaitResult()
      } catch (e: ApiException) {
        throw SignInException("FAILED", "Play Games error ${e.statusCode}", e)
      }
    }
  }

  private fun activity(): Activity =
    appContext.currentActivity ?: throw SignInException("NO_ACTIVITY", "The app is not in the foreground")
}

private suspend fun <T> Task<T>.awaitResult(): T = suspendCancellableCoroutine { cont ->
  addOnCompleteListener { task ->
    if (task.isSuccessful) cont.resume(task.result)
    else cont.resumeWithException(task.exception ?: SignInException("FAILED", "Play Games request failed"))
  }
}
