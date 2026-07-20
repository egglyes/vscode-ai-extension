# Change Log

All notable changes to the "ai-fixer" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- Initial release

## [0.1.0]

### Changed

- Replaced moondream vision LLM with `tesseract.js` (eng) for screenshot transcription. The image-to-fix pipeline now uses one Ollama call instead of two.
- Pipeline label in the chat header is now `tesseract.js → my-coder`.

### Removed

- `aiFixer.fixFromImage` command (transcription-only entry point superseded by the chat view).
- `aiFixer.visionModel` setting.