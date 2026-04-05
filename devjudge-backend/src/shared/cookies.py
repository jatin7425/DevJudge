from http.cookies import SimpleCookie


def parse_cookie_header(cookie_header: str | None) -> dict[str, str]:
    if not cookie_header:
        return {}

    cookie = SimpleCookie()
    cookie.load(cookie_header)
    return {key: morsel.value for key, morsel in cookie.items()}

def build_cookie(
    name: str,
    value: str,
    *,
    path: str = "/",
    max_age: int | None = None,
    http_only: bool = True,
    same_site: str = "Lax",
) -> str:
    cookie = SimpleCookie()
    cookie[name] = value
    morsel = cookie[name]
    morsel["path"] = path
    morsel["samesite"] = same_site

    if max_age is not None:
        morsel["max-age"] = str(max_age)

    if http_only:
        morsel["httponly"] = True

    return cookie.output(header="").strip()


def build_expired_cookie(name: str, *, path: str = "/") -> str:
    return build_cookie(name, "", path=path, max_age=0)
