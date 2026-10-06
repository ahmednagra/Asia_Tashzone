import smtplib
import ssl
from email.message import EmailMessage

from app.Utils.Logger import logger
from config.settings import Settings

LANGS = ("en", "ur", "hi", "ne", "bn")

SUBJECTS = {
    "en": {"signup": "Your TashZone sign-up code", "login": "Your TashZone sign-in code", "reset": "Reset your TashZone password"},
    "ur": {"signup": "آپ کا TashZone سائن اَپ کوڈ", "login": "آپ کا TashZone سائن اِن کوڈ", "reset": "اپنا TashZone پاس ورڈ نیا بنائیں"},
    "hi": {"signup": "आपका TashZone साइन-अप कोड", "login": "आपका TashZone साइन-इन कोड", "reset": "अपना TashZone पासवर्ड बदलें"},
    "ne": {"signup": "तपाईंको TashZone साइन-अप कोड", "login": "तपाईंको TashZone साइन-इन कोड", "reset": "आफ्नो TashZone पासवर्ड बदल्नुहोस्"},
    "bn": {"signup": "আপনার TashZone সাইন-আপ কোড", "login": "আপনার TashZone সাইন-ইন কোড", "reset": "আপনার TashZone পাসওয়ার্ড বদলান"},
}

BODIES = {
    "en": ("Your code is {code}. It expires in {minutes} minutes.",
           "If you didn't ask for this, ignore this email. Never share this code."),
    "ur": ("آپ کا کوڈ {code} ہے۔ یہ {minutes} منٹ میں ختم ہو جائے گا۔",
           "اگر آپ نے یہ نہیں مانگا تو اس ای میل کو نظر انداز کریں۔ یہ کوڈ کسی کو نہ بتائیں۔"),
    "hi": ("आपका कोड {code} है। यह {minutes} मिनट में ख़त्म हो जाएगा।",
           "अगर आपने यह नहीं माँगा, तो इस ईमेल को अनदेखा करें। यह कोड किसी को न बताएँ।"),
    "ne": ("तपाईंको कोड {code} हो। यो {minutes} मिनेटमा सकिन्छ।",
           "तपाईंले यो माग्नुभएको होइन भने यो इमेल बेवास्ता गर्नुहोस्। यो कोड कसैलाई नदिनुहोस्।"),
    "bn": ("আপনার কোড {code}। এটি {minutes} মিনিটে শেষ হবে।",
           "আপনি এটি না চাইলে এই ইমেল উপেক্ষা করুন। এই কোড কাউকে দেবেন না।"),
}


def compose(settings: Settings, to: str, purpose: str, code: str, lang: str) -> EmailMessage:
    lang = lang if lang in LANGS else "en"
    first, second = BODIES[lang]
    msg = EmailMessage()
    msg["Subject"] = SUBJECTS[lang][purpose]
    msg["From"] = settings.mail_from
    msg["To"] = to
    msg.set_content(f"{first.format(code=code, minutes=settings.auth_code_ttl_minutes)}\n\n{second}\n\nTashZone")
    return msg


def send_code(settings: Settings, to: str, purpose: str, code: str, lang: str) -> None:
    if settings.mail_backend == "console" and not settings.is_production:
        logger.warning("dev_auth_code", extra={"purpose": purpose, "code": code})
        return
    if settings.mail_backend != "smtp":
        return
    msg = compose(settings, to, purpose, code, lang)
    try:
        if settings.smtp_use_ssl:
            server: smtplib.SMTP = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds,
                                                   context=ssl.create_default_context())
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds)
        with server:
            if not settings.smtp_use_ssl:
                server.starttls(context=ssl.create_default_context())
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(msg)
    except (OSError, smtplib.SMTPException) as exc:
        logger.warning("auth_mail_failed", extra={"purpose": purpose, "error": type(exc).__name__})
