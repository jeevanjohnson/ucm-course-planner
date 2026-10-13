"""Atomic snapshots, stale-on-error reads, disk cache and failure backoff."""
import json
import threading
import time
from pathlib import Path
from datetime import datetime, timezone
from .providers import ProviderError

class SnapshotService:
    def __init__(self, providers, directory, ttl=600):
        self.providers = providers
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.ttl = max(300, ttl)
        self.lock = threading.Lock()
        self.key_locks = {}
        self.cache = {}
        self.failures = {}

    def get(self, mode, term=None, crn=None, detail='linked'):
        if mode not in self.providers:
            raise ValueError('Unknown provider.')
        if detail not in ('linked','details'):
            raise ValueError('Unknown detail type.')
        key = f'{mode}-{term or "terms"}'
        if crn:
            key += '-' + detail + '-' + crn
        with self.lock:
            operation_lock = self.key_locks.setdefault(key, threading.Lock())
        with operation_lock:
            path = self.directory / (key+'.json')
            if key not in self.cache and path.exists():
                try:
                    saved = json.loads(path.read_text(encoding='utf-8'))
                    if isinstance(saved, dict) and saved.get('schema') == 2 and isinstance(saved.get('data'), list) and isinstance(saved.get('timestamp'), (int,float)):
                        self.cache[key] = saved
                except (ValueError, OSError):
                    pass
            old = self.cache.get(key)
            now = time.time()
            ttl = self.ttl if term and not crn else 3600
            if old and now-old['timestamp'] < ttl:
                return dict(old, stale=False, error=None, retryAfter=max(0,int(ttl-(now-old['timestamp']))))
            failure = self.failures.get(key)
            if failure and now < failure[0]:
                if old:
                    return dict(old, stale=True, error=failure[1], retryAfter=int(failure[0]-now)+1)
                raise ProviderError(failure[1], int(failure[0]-now)+1)
            try:
                provider = self.providers[mode]
                data = getattr(provider,detail)(term, crn) if crn else provider.courses(term) if term else provider.terms()
                stamp = time.time()
                result = dict(schema=2, data=data, source=mode, timestamp=stamp,
                    fetchedAt=datetime.fromtimestamp(stamp,timezone.utc).isoformat())
                self.cache[key] = result
                self.failures.pop(key, None)
                try:
                    temporary = path.with_suffix('.tmp')
                    temporary.write_text(json.dumps(result), encoding='utf-8')
                    temporary.replace(path)
                except OSError:
                    pass  # In-memory operation still works if disk is read-only/full.
                return dict(result, stale=False, error=None, retryAfter=ttl)
            except (ProviderError, ValueError, KeyError, TypeError) as exc:
                message = str(exc) if isinstance(exc, ProviderError) else 'University data format changed. Previous data retained.'
                retry = getattr(exc, 'retry_after', 60)
                self.failures[key] = (time.time()+retry, message)
                if old:
                    return dict(old, stale=True, error=message, retryAfter=retry)
                raise ProviderError(message, retry) from exc
