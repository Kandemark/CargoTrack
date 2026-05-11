# Contributing to CargoTrack

Thanks for your interest in contributing. CargoTrack is a B2B logistics intelligence platform serving East African trade corridors.

## Getting started

1. Fork the repository and clone it locally.
2. Follow the setup guide in the README to get the backend and mobile app running.
3. Create a branch from `main` for your work.

## Development workflow

- **Backend** — Django 5 + Django REST Framework + PostgreSQL. Run `python manage.py test` before pushing.
- **Mobile** — Expo SDK 54 + React Native. Run `npx tsc --noEmit` to type-check, then `npx expo run:android` for a dev build.
- **Frontend** — Vite + React + TypeScript. Run `npm run dev` and `npm run lint`.

## Commit conventions

- Use present-tense, imperative commit messages (`fix:`, `feat:`, `chore:`, `docs:`).
- Keep commits focused — one logical change per commit.
- Reference issues with `#issue-number` in the commit body, not the subject line.

## Pull requests

- Open PRs against `main`.
- Include a summary of what changed and why.
- Link any related issues.
- Ensure CI (tests, type-check, lint) passes.
- Keep PRs scoped — large refactors should be discussed in an issue first.

## Code and content rules

- Never reference universities, course codes, group numbers, or student names in code, comments, docs, or UI.
- All UI must be enterprise SaaS quality — think Flexport/ShipBob.
- No tutorial-style comments. Code should be self-documenting through clear naming.
- Docs and messages must use professional, B2B-appropriate language.

## Code style

- Backend: PEP 8, 100-column limit, type hints on public functions.
- Mobile / frontend: Prettier defaults, TypeScript strict mode. No `any` without justification.
- Prefer explicit over clever. Readability wins.
- No commented-out code in PRs.

## Reporting issues

- Use the issue tracker.
- Include steps to reproduce, expected vs actual behaviour, and relevant logs.
- For security issues, do not open a public issue — contact the maintainers directly.

## License

By contributing, you agree that your contributions will be licensed under the GNU Affero General Public License v3.0.
