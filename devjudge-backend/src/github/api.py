import requests
from typing import Union
from .configuration import GITHUB_ENDPOINT_MAPPING

BASE_URL = "https://api.github.com"

_cache: dict = {}

def _cache_key(endpoint_key: str, **kwargs) -> str:
    return f"{endpoint_key}:{sorted(kwargs.items())}"

def clear_cache() -> None:
    _cache.clear()


def github_api_client(access_token: str) -> requests.Session:
    client = requests.Session()
    client.headers.update({
        "Authorization": f"token {access_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    })
    return client

def resolve_url(key: str) -> str:
    endpoint = GITHUB_ENDPOINT_MAPPING[key]
    url = f"{BASE_URL}{endpoint}"
    return url

def hit_endpoint(
    client: requests.Session, 
    endpoint_key: str, 
    use_cache: bool = True,
    **kwargs
) -> Union[dict, list, str, int, bool]:
    key = _cache_key(endpoint_key, **kwargs)
    
    if use_cache and key in _cache:
        return _cache[key]
    url_template = resolve_url(endpoint_key)
    path_params = {
        template_key: value
        for template_key, value in kwargs.items()
        if f"{{{template_key}}}" in url_template
    }
    query_params = {
        query_key: value
        for query_key, value in kwargs.items()
        if query_key not in path_params
    }

    url = url_template.format(**path_params)
    response = client.get(url, params=query_params or None)

    if not response.ok:
        raise RuntimeError(
            f"GitHub API request to {response.url} failed with status "
            f"code {response.status_code}: {response.text}"
        )

    result = response.json()
    
    if use_cache:
        _cache[key] = result
    
    return result
