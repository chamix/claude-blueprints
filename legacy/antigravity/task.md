# Tasks: Stream Input & Unconditional File Output

- [x] Create `IStreamReader.js` port interface
- [x] Create `StreamReaderAdapter.js` to buffer and parse JSON stream data
- [x] Update `RequestDTO.js` to accept optional `inputStream` parameter
- [x] Refactor `MapJsonUseCase.js` to accept `IStreamReader` dependency and execute mapping from `inputStream` when present
- [x] Refactor `CLIController.js` validation rules to accommodate `inputStream` DTOs
- [x] Refactor `container.js` to instantiate and inject `StreamReaderAdapter` into `MapJsonUseCase`
- [x] Refactor `bin.js` option parsing to support `-s, --stream`, resolve `process.stdin`, and run CLI-level checks
- [x] Bump version in `package.json` to `4.0.0`
- [x] Add unit tests for `StreamReaderAdapter` and `MapJsonUseCase`
- [x] Add E2E tests in `test/e2e/cli-lifecycle.test.js` validating stdin piping
- [x] Run full test suite and verify clean passes
