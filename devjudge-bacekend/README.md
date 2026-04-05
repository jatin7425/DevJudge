# DevJudge Python Azure Functions Backend

## Local setup

1. `python -m venv .venv`
2. `.venv\Scripts\activate`
3. `pip install -r requirements.txt`
4. `func start`

Use `http://localhost:7071/api/auth/github/signin` to start GitHub OAuth locally.
Set your GitHub OAuth callback URL to `http://localhost:7071/api/auth/github/callback`.
