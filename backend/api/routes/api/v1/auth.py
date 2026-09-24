from fastapi import APIRouter, BackgroundTasks, Path, Request

from app.Core.security import DB, AnyPlayer, Config, CurrentPlayer
from app.Http.Controllers.AccountController import AccountController
from app.Schemas.accounts import CodeLoginIn, CodeRequestIn, PasswordChangeIn, PasswordLoginIn, PasswordResetIn, SignupIn

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/email/code", status_code=202)
def request_code(body: CodeRequestIn, request: Request, tasks: BackgroundTasks, db: DB, settings: Config):
    return AccountController.request_code(body, request, tasks, db, settings)


@router.post("/signup", status_code=201)
def signup(body: SignupIn, request: Request, p: CurrentPlayer, db: DB, settings: Config):
    return AccountController.signup(body, request, p, db, settings)


@router.post("/login")
def login_password(body: PasswordLoginIn, request: Request, db: DB, settings: Config):
    return AccountController.login_password(body, request, db, settings)


@router.post("/login/code")
def login_code(body: CodeLoginIn, request: Request, db: DB, settings: Config):
    return AccountController.login_code(body, request, db, settings)


@router.post("/password/reset")
def reset_password(body: PasswordResetIn, request: Request, db: DB, settings: Config):
    return AccountController.reset_password(body, request, db, settings)


@router.put("/password")
def change_password(body: PasswordChangeIn, request: Request, p: CurrentPlayer, db: DB, settings: Config):
    return AccountController.change_password(body, request, p, db, settings)


@router.post("/logout", status_code=204)
def sign_out(request: Request, p: AnyPlayer, db: DB):
    return AccountController.sign_out(request, p, db)


@router.get("/sessions")
def sessions(request: Request, p: CurrentPlayer, db: DB, settings: Config):
    return AccountController.sessions(request, p, db, settings)


@router.delete("/sessions/{session_id}", status_code=204)
def end_session(request: Request, p: CurrentPlayer, db: DB, session_id: str = Path(min_length=1, max_length=36)):
    return AccountController.end_session(session_id, request, p, db)


@router.post("/sign-out-everywhere")
def sign_out_everywhere(p: CurrentPlayer, db: DB, settings: Config):
    return AccountController.sign_out_everywhere(p, db, settings)
