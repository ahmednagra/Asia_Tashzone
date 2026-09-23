# app/Services/IdentityVerifier.py
"""
Turning a provider credential into an opaque subject, and nothing else.

A verifier is handed whatever the phone got from the provider and must return the provider's stable, opaque id for
that person -- or raise. It never returns an email, a name or a photo, and the API never asks for a scope that would
give it one: the only thing this API wants from Google or Apple is "the same person as last time, yes or no".

Three providers, two mechanisms:

* **google** -- an OpenID Connect ID token. Verified offline against Google's published JWKS. `iss` is
  `accounts.google.com` or `https://accounts.google.com`, `aud` is one of the app's OAuth client ids (one per
  platform, hence a list), the subject is `sub`, which Google documents as unique across all Google Accounts and
  never reused. https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
* **apple** -- an OpenID Connect ID token. Same shape: JWKS at `https://appleid.apple.com/auth/keys`, `iss` is
  `https://appleid.apple.com`, `aud` is the app's bundle id (or Services ID on web), subject is `sub`. Apple puts a
  `nonce` claim in the token only when the client passed one in the authorization request, so the nonce is checked
  when it is there and not demanded when it is not.
  https://developer.apple.com/documentation/signinwithapple/verifying-a-user
* **play_games** -- *not* an ID token. Play Games Services v2 gives the client a single-use **server auth code**
  from `requestServerSideAccess`, which the server exchanges at `https://oauth2.googleapis.com/token` using the
  game server's own OAuth client, then reads the player id from `games/v1/players/me` (`id`). There is no offline
  form of this, by design: the code is single-use and only Google can redeem it.
  https://developer.android.com/games/pgs/android/server-access

Every verifier is reached through `get_verifier`, which reads the `VERIFIERS` mapping. Tests replace an entry with
a fake so the suite needs no network and no provider account; the real implementations above are what runs in
every deployed environment.
"""

import hmac
import logging
import threading
import time
from dataclasses import dataclass
from typing import Any, Protocol

import httpx
import jwt
from jwt import PyJWK, PyJWKSet

from app.Core.errors import ApiError
from app.Models import IDENTITY_PROVIDERS
from config.settings import get_settings

logger = logging.getLogger("tashzone")

MAX_SUBJECT_LENGTH = 255
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"  # noqa: S105 - a public URL, not a credential
PLAY_GAMES_PLAYER_ENDPOINT = "https://www.googleapis.com/games/v1/players/me"


@dataclass(frozen=True, slots=True)
class VerifiedIdentity:
    """What a verifier is allowed to hand back: which provider, and their opaque id for this person."""

    provider: str
    subject: str


def invalid_token() -> ApiError:
    """
    One answer for every way a credential can fail: wrong signature, wrong audience, wrong issuer, expired,
    replayed, malformed. Telling a caller *which* check failed only helps someone forging tokens.
    """
    return ApiError(401, "INVALID_PROVIDER_TOKEN", "That sign-in could not be verified")


def not_configured(provider: str) -> ApiError:
    return ApiError(503, "PROVIDER_NOT_CONFIGURED", f"Signing in with {provider} is not available")


def provider_unavailable() -> ApiError:
    """The provider itself could not be reached. Retryable, and never confused with a bad token."""
    return ApiError(503, "PROVIDER_UNAVAILABLE", "The sign-in provider could not be reached, try again")


def unknown_provider() -> ApiError:
    return ApiError(422, "UNKNOWN_PROVIDER", "That sign-in provider is not supported")


class IdentityVerifier(Protocol):
    """The whole contract. Anything that can do this can stand in for a provider, including a test fake."""

    provider: str

    def configured(self) -> bool:
        """False when this build has no credentials for the provider, so the endpoint can answer 503 instead."""
        ...

    def verify(self, credential: str, nonce: str | None) -> VerifiedIdentity:
        """The identity behind `credential`, or `invalid_token()` / `provider_unavailable()`."""
        ...


def _get(url: str) -> dict[str, Any]:
    return _request("GET", url)


def _request(method: str, url: str, *, data: dict[str, str] | None = None, token: str | None = None) -> dict[str, Any]:
    """
    One bounded call to a provider: a timeout, no redirect following, a size cap read before parsing, and an answer
    that is always a dict. Nothing here is retried -- the caller is a phone that can ask again.
    """
    headers = {"Accept": "application/json"}
    if token is not None:
        headers["Authorization"] = f"Bearer {token}"
    try:
        with httpx.Client(timeout=get_settings().oidc_http_timeout_seconds, follow_redirects=False) as client:
            response = client.request(method, url, data=data, headers=headers)
            if response.status_code >= 400:
                # A 4xx here means the credential was refused; a 5xx means the provider is having a bad day.
                # The caller decides which of the two answers to give, so both arrive as the same exception.
                raise _ProviderRefusedError(response.status_code)
            if len(response.content) > get_settings().oidc_max_response_bytes:
                raise _ProviderRefusedError(response.status_code)
            body = response.json()
    except _ProviderRefusedError:
        raise
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("provider_request_failed", extra={"url": url, "error": type(exc).__name__})
        raise provider_unavailable() from exc
    if not isinstance(body, dict):
        raise provider_unavailable()
    return body


class _ProviderRefusedError(Exception):
    """The provider answered, but not with what was asked for."""

    def __init__(self, status_code: int) -> None:
        super().__init__(str(status_code))
        self.status_code = status_code


class JwksCache:
    """
    One provider's signing keys, cached with a TTL and a floor on how often they may be re-fetched.

    Key rotation is the reason a cache cannot simply be "fetch once": a token signed with a brand new `kid` is
    legitimate and arrives before the TTL is up. The floor is the reason the refresh is bounded: a flood of tokens
    carrying invented `kid`s would otherwise become one outbound request per token. So an unknown `kid` triggers at
    most one fetch per OIDC_JWKS_MIN_REFRESH_SECONDS across the whole process, and a fetch that fails leaves the
    keys already in hand in place.
    """

    def __init__(self, url: str) -> None:
        self._url = url
        self._lock = threading.Lock()
        self._keys: dict[str, PyJWK] = {}
        self._fetched_at = 0.0
        self._attempted_at = 0.0

    def clear(self) -> None:
        with self._lock:
            self._keys = {}
            self._fetched_at = 0.0
            self._attempted_at = 0.0

    def signing_key(self, kid: str) -> PyJWK:
        with self._lock:
            now = time.monotonic()
            fresh = now - self._fetched_at < get_settings().oidc_jwks_ttl_seconds
            key = self._keys.get(kid) if fresh else None
            if key is not None:
                return key
            # Stale, empty, or a `kid` we have never seen: one refresh, if the floor allows it.
            if now - self._attempted_at >= get_settings().oidc_jwks_min_refresh_seconds or not self._keys:
                self._attempted_at = now
                self._refresh()
            key = self._keys.get(kid)
        if key is None:
            # Either a forged `kid`, or a rotation this process has not been allowed to fetch yet. Both are the
            # caller's problem to retry; neither is worth a distinct answer.
            raise invalid_token()
        return key

    def _refresh(self) -> None:
        """Called with the lock held. Leaves the previous keys untouched when the fetch or the parse fails."""
        try:
            document = _get(self._url)
            key_set = PyJWKSet.from_dict(document)
        except (_ProviderRefusedError, ApiError, jwt.PyJWTError, KeyError, TypeError, AttributeError) as exc:
            logger.warning("jwks_refresh_failed", extra={"url": self._url, "error": type(exc).__name__})
            return
        keys = {key.key_id: key for key in key_set.keys if key.key_id}
        if keys:
            self._keys = keys
            self._fetched_at = time.monotonic()


class OidcVerifier:
    """
    An OpenID Connect provider whose ID tokens can be checked without calling it: signature against its published
    JWKS, then issuer, audience, expiry, and the nonce when the token carries one.
    """

    def __init__(self, provider: str, issuers: tuple[str, ...], jwks_url: str, algorithms: tuple[str, ...]) -> None:
        self.provider = provider
        self._issuers = issuers
        self._algorithms = algorithms
        self.jwks = JwksCache(jwks_url)

    def _audiences(self) -> tuple[str, ...]:
        if self.provider == "google":
            return get_settings().google_audiences
        return get_settings().apple_audiences

    def configured(self) -> bool:
        return bool(self._audiences())

    def verify(self, credential: str, nonce: str | None) -> VerifiedIdentity:
        audiences = self._audiences()
        if not audiences:
            raise not_configured(self.provider)
        if not credential or len(credential) > get_settings().oidc_max_token_chars:
            raise invalid_token()
        try:
            header = jwt.get_unverified_header(credential)
        except jwt.PyJWTError as exc:
            raise invalid_token() from exc
        # `alg` comes from the caller, so it is never trusted: only the algorithms this provider actually signs
        # with are passed to decode(), which is what stops an "alg": "none" or HMAC-with-the-public-key forgery.
        if header.get("alg") not in self._algorithms:
            raise invalid_token()
        kid = header.get("kid")
        if not isinstance(kid, str) or not kid:
            raise invalid_token()
        key = self.jwks.signing_key(kid)
        try:
            claims = jwt.decode(
                credential,
                key=key,  # type: ignore[arg-type]
                algorithms=list(self._algorithms),
                audience=list(audiences),
                leeway=get_settings().oidc_clock_skew_seconds,
                options={"require": ["exp", "iat", "aud", "iss", "sub"], "verify_aud": True},
            )
        except jwt.PyJWTError as exc:
            raise invalid_token() from exc
        # PyJWT takes a single issuer string, and Google documents two spellings of its own, so `iss` is compared
        # here against the whole set rather than being handed to decode().
        if claims.get("iss") not in self._issuers:
            raise invalid_token()
        token_nonce = claims.get("nonce")
        if token_nonce is not None:
            # The provider echoed a nonce, so the client must be able to produce the one it asked with. This binds
            # the token to that sign-in attempt; a token lifted from another app's traffic will not match.
            if not isinstance(token_nonce, str) or nonce is None or not hmac.compare_digest(token_nonce, nonce):
                raise invalid_token()
        return VerifiedIdentity(self.provider, _subject(claims.get("sub")))


class PlayGamesVerifier:
    """
    Play Games Services v2. The credential is a single-use server auth code, not a token, so verification is an
    exchange: the code is redeemed with the game server's OAuth client and the resulting access token is used for
    exactly one read, `games/v1/players/me`, whose `id` is the Play Games player id.

    The code being single-use is itself the replay protection, which is why there is no nonce to check here. Neither
    the access token nor a refresh token is stored: this API has no further use for Google on the player's behalf.
    """

    provider = "play_games"

    def configured(self) -> bool:
        return get_settings().play_games_configured

    def verify(self, credential: str, nonce: str | None) -> VerifiedIdentity:
        del nonce  # the single-use code cannot be replayed, so there is nothing to bind it to
        if not self.configured():
            raise not_configured(self.provider)
        if not credential or len(credential) > get_settings().oidc_max_token_chars:
            raise invalid_token()
        try:
            exchanged = _request(
                "POST",
                GOOGLE_TOKEN_ENDPOINT,
                data={
                    "code": credential,
                    "client_id": get_settings().play_games_client_id,
                    "client_secret": get_settings().play_games_client_secret,
                    "grant_type": "authorization_code",
                    "redirect_uri": "",
                },
            )
        except _ProviderRefusedError as exc:
            # A refused code is the client's problem; a broken Google is not.
            raise (invalid_token() if exc.status_code < 500 else provider_unavailable()) from exc
        access_token = exchanged.get("access_token")
        if not isinstance(access_token, str) or not access_token:
            raise invalid_token()
        try:
            player = _request("GET", PLAY_GAMES_PLAYER_ENDPOINT, token=access_token)
        except _ProviderRefusedError as exc:
            raise (invalid_token() if exc.status_code < 500 else provider_unavailable()) from exc
        return VerifiedIdentity(self.provider, _subject(player.get("id")))


def _subject(value: object) -> str:
    if not isinstance(value, str) or not value or len(value) > MAX_SUBJECT_LENGTH:
        raise invalid_token()
    return value


VERIFIERS: dict[str, IdentityVerifier] = {
    "google": OidcVerifier(
        "google",
        issuers=("accounts.google.com", "https://accounts.google.com"),
        jwks_url="https://www.googleapis.com/oauth2/v3/certs",
        algorithms=("RS256",),
    ),
    "apple": OidcVerifier(
        "apple",
        issuers=("https://appleid.apple.com",),
        jwks_url="https://appleid.apple.com/auth/keys",
        algorithms=("RS256",),
    ),
    "play_games": PlayGamesVerifier(),
}
assert set(VERIFIERS) == set(IDENTITY_PROVIDERS)  # a provider in the schema with no verifier is a deployment bug


def get_verifier(provider: str) -> IdentityVerifier:
    verifier = VERIFIERS.get(provider)
    if verifier is None:
        raise unknown_provider()
    if not verifier.configured():
        raise not_configured(provider)
    return verifier


def configured_providers() -> tuple[str, ...]:
    """Which providers this build can actually offer, for the app to decide which buttons to show."""
    return tuple(name for name in IDENTITY_PROVIDERS if VERIFIERS[name].configured())
