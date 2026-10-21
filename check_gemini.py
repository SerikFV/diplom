"""Run locally to diagnose Gemini access without displaying the API key."""
import getpass
import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def main():
    key = os.environ.get('ESSAY_AI_API_KEY') or getpass.getpass('Gemini API key: ').strip()
    if not key:
        print('No key entered.'); return
    base = 'https://generativelanguage.googleapis.com/v1beta/models'
    try:
        with urlopen(Request(base, headers={'x-goog-api-key': key}), timeout=30) as response:
            models = json.load(response).get('models', [])
        names = [m['name'].removeprefix('models/') for m in models if 'generateContent' in m.get('supportedGenerationMethods', [])]
        print('Available text-generation models:', ', '.join(names))
        model = os.environ.get('ESSAY_AI_MODEL', 'gemini-3.8-flash')
        body = {'contents': [{'parts': [{'text': 'Reply with OK.'}]}], 'generationConfig': {'maxOutputTokens': 128}}
        req = Request(f'{base}/{model}:generateContent', data=json.dumps(body).encode(), headers={'x-goog-api-key': key, 'Content-Type': 'application/json'})
        with urlopen(req, timeout=60) as response:
            json.load(response)
        print('Gemini generation request succeeded. Model:', model)
    except HTTPError as error:
        try:
            raw = json.load(error).get('error', {})
            message = raw.get('message', 'No details') if isinstance(raw, dict) else 'No details'
        except (ValueError, TypeError):
            message = 'No JSON diagnostic returned'
        print('Gemini HTTP status:', error.code)
        print('Diagnostic:', message.replace(key, '[REDACTED]'))
    except (URLError, TimeoutError, OSError):
        print('Connection failed. Check network access to generativelanguage.googleapis.com.')


if __name__ == '__main__':
    main()
