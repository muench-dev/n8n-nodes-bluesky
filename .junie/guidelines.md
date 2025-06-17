# n8n Bluesky Node

## Project Overview
This project implements custom nodes for the [n8n](https://n8n.io) workflow automation tool, specifically for integrating with the Bluesky API.

## Project Structure
- `credentials/` — Contains credential classes for authenticating with external services (e.g., `BlueskyApi.credentials.ts`).
- `nodes/Bluesky/` — Main directory for Bluesky node implementations.
  - `Bluesky.node.ts` — Entry point for the Bluesky node.
  - `bluesky.svg` — Node icon.
  - `V1/` — Version 1 of the Bluesky node.
    - `BlueskyV1.node.ts`, `languages.ts` — Node logic and language support.
  - `V2/` — Version 2 of the Bluesky node.
    - `BlueskyV2.node.ts`, `BlueskyTestNode.node.ts`, `feedOperations.ts`, `postOperations.ts`, `userOperations.ts`, `resources.ts`, `languages.ts` — Node logic, operations, and resources.
    - `__tests__/` — Contains test files for V2 operations.
- `index.js` — Main entry point for the package.
- `package.json` — Project metadata and dependencies.
- `tsconfig.json` — TypeScript configuration.
- `tslint.json` — Linting rules.
- `jest.config.js` — Jest configuration for testing.

## Tools Used
- **TypeScript** — Main language for node and credential implementations.
- **Jest** — Testing framework for unit and integration tests (see `nodes/Bluesky/V2/__tests__/`).
- **TSLint** — Linting for TypeScript code.
- **pnpm** — Package manager (see `pnpm-lock.yaml`).

## Running Tests

To run all tests:

```sh
pnpm install
pnpm test
```

Run a specific test file:

```sh
pnpm test nodes/Bluesky/V2/__tests__/feedOperations.test.ts
```


## Commit Message Guidelines
This project follows the [Conventional Commit Standard](https://www.conventionalcommits.org/):
- Use `feat:`, `fix:`, `chore:`, etc. in commit messages.
- Example: `feat: add support for new Bluesky post operation`

## Contribution
- Ensure all tests pass before submitting a PR.
- Follow the project structure and naming conventions.
- Use Conventional Commits for all commit messages.
