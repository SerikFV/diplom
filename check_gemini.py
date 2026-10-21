"""Run locally to diagnose Gemini access without displaying the API key."""
import getpass
import json
import os
import re
from html import unescape
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def main():
    configured = os.environ.get('ESSAY_AI_API_KEY')
    print('Diagnostic version: 2')
    print('Key source:', 'environment variable' if configured else 'hidden input')
    key = (configured or getpass.getpass('Gemini API key: ')).strip()
    if not key:
        print('No key entered.'); return
    if not key.isascii() or re.search(r'\s', key):
        print('Key contains whitespace or non-ASCII characters. Copy only the key from Google AI Studio.'); return
    if key.startswith('sk-'):
        print('This is an OpenAI key. Use a Google AI Studio Gemini key instead.'); return
    base = 'https://generativelanguage.googleapis.com/v1beta/models'
    stage = 'list models'
    try:
        with urlopen(Request(base, headers={'x-goog-api-key': key}), timeout=30) as response:
            models = json.load(response).get('models', [])
        names = [m['name'].removeprefix('models/') for m in models if 'generateContent' in m.get('supportedGenerationMethods', [])]
        print('Available text-generation models:', ', '.join(names))
        model = os.environ.get('ESSAY_AI_MODEL', 'gemini-3.8-flash')
        body = {'contents': [{'parts': [{'text': 'Reply with OK.'}]}], 'generationConfig': {'maxOutputTokens': 128}}
        stage = 'generate content: ' + model
        req = Request(f'{base}/{model}:generateContent', data=json.dumps(body).encode(), headers={'x-goog-api-key': key, 'Content-Type': 'application/json'})
        with urlopen(req, timeout=60) as response:
            json.load(response)
        print('Gemini generation request succeeded. Model:', model)
    except HTTPError as error:
        raw = error.read(8192).decode('utf-8', errors='replace')
        try:
            diagnostic = json.loads(raw)
            if isinstance(diagnostic, list):
                diagnostic = diagnostic[0] if diagnostic else {}
            details = diagnostic.get('error', diagnostic) if isinstance(diagnostic, dict) else {}
            message = details.get('message') if isinstance(details, dict) else None
        except (ValueError, TypeError):
            message = None
        if not message:
            message = unescape(re.sub(r'<[^>]+>', ' ', raw))
            message = re.sub(r'\s+', ' ', message).strip() or '(empty response)'
        message = message.replace(key, '[REDACTED]')
        message = re.sub(r'(?:AIza[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]+)', '[REDACTED]', message)
        print('Failed step:', stage)
        print('Gemini HTTP status:', error.code)
        print('Response type:', error.headers.get('Content-Type', 'unknown') if error.headers else 'unknown')
        print('Diagnostic:', message[:1000])
    except (URLError, TimeoutError, OSError):
        print('Connection failed. Check network access to generativelanguage.googleapis.com.')


if __name__ == '__main__':
    main()
