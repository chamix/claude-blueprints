# Implementation Plan: Stream Input & Unconditional File Output (v4)

This plan outlines the architecture-focused approach to support sequential JSON stream inputs while unconditionally writing mapped output to a physical file path.

## User Review Required

> [!WARNING]
> **Breaking Change on Output**: The output destination is unconditionally restricted to a physical file path. Any previous behavior that allowed stdout/stderr streaming or optional output options is removed.
>
> **Version Bump Recommendation**: The active repository version is `1.0.0` (while CLI files refer to `2.0.0` and specs refer to v3). To resolve this cleanly and signify the breaking change, we recommend bumping to version **4.0.0**.

## Open Questions

None. The refined architecture isolates stream reading behind a new port (`IStreamReader`) and adapter (`StreamReaderAdapter`), adhering strictly to the Interface Segregation Principle (ISP) and the Inward Dependency Rule.

## Proposed Changes

---

### Use Cases (Core Application Rules)

#### [NEW] [IStreamReader.js](file:///c:/Source/json-mapper/src/usecases/ports/IStreamReader.js)
- Define interface/port for stream data retrieval: `readJson(stream)`.

#### [MODIFY] [RequestDTO.js](file:///c:/Source/json-mapper/src/usecases/dto/RequestDTO.js)
- Add optional `inputStream` field to the constructor to accept Node.js Readable streams.

#### [MODIFY] [MapJsonUseCase.js](file:///c:/Source/json-mapper/src/usecases/MapJsonUseCase.js)
- Inject `IStreamReader` as an optional parameter in the constructor.
- Check for `request.inputStream` in `execute(request)`. If present, read from the stream using `this.streamReader.readJson(request.inputStream)`, run mapping transformation, and write to `request.outputFile` via `this.fileRepository.writeJson`.
- Set telemetry `inputFile` property to `"<stream>"` under streaming execution.

---

### Adapters (Interface Adapters)

#### [NEW] [StreamReaderAdapter.js](file:///c:/Source/json-mapper/src/adapters/repositories/StreamReaderAdapter.js)
- Implement `IStreamReader` to buffer and parse JSON array content from Node.js Readable streams.

#### [MODIFY] [CLIController.js](file:///c:/Source/json-mapper/src/adapters/controllers/CLIController.js)
- Refactor the DTO validation rules:
  - If `requestDto.inputStream` is present, bypass the `files.length` validation checks, and verify only `dictionaryFile` and `outputFile` are present.
  - If `requestDto.inputStream` is absent, run normal file-path checks.

#### Presenter Flow Assessment (No Changes Required):
- [CLIPresenter.js](file:///c:/Source/json-mapper/src/adapters/presenters/CLIPresenter.js) only outputs console diagnostics (metadata/errors) to `stdout`/`stderr`. It does not output the mapped JSON data, meaning no modifications are needed there to guarantee output constraints.

---

### Infrastructure (CLI & Bootstrap)

#### [MODIFY] [bin.js](file:///c:/Source/json-mapper/src/infrastructure/cli/bin.js)
- Register `-s, --stream` boolean option in Commander.
- Make `-i, --input` parameter optional.
- Enforce validation:
  - If `--stream` is set, check that `--input` is NOT set.
  - If `--stream` is absent, check that `--input` is set.
  - Verify that `--output` is provided (if it points to an existing directory when streaming, throw an error).
- Instantiate `RequestDTO` with `process.stdin` as the stream source when `--stream` is enabled.

#### [MODIFY] [container.js](file:///c:/Source/json-mapper/src/infrastructure/di/container.js)
- Instantiate `StreamReaderAdapter` and inject it into the `MapJsonUseCase` constructor.

---

## Verification Plan

### Automated Tests

- **Unit Tests**:
  - `StreamReaderAdapter.test.js` [NEW]: Test reading valid JSON array from readable stream, empty stream error handling, and malformed JSON stream handling.
  - `MapJsonUseCase.test.js`: Test streaming execution path with mocked streams and repositories.
  - CLI validation tests: Validate input option exclusivity constraints.

- **End-to-End Tests**:
  - `test/e2e/cli-lifecycle.test.js`: Add test cases validating standard input pipes:
    `cat input.json | node src/infrastructure/cli/bin.js -s -d dict.json -o output.json`

### Manual Verification
- Pipe sample file into CLI:
  `powershell -Command "Get-Content sample/initial_model.json -Raw | node src/infrastructure/cli/bin.js -s -d sample/dictionary.json -o sample/output_piped.json"`
- Verify that `sample/output_piped.json` is generated correctly.
