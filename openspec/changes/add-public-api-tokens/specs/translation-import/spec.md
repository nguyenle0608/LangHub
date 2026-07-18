## ADDED Requirements

### Requirement: Write tokens can import bounded translation files
The system SHALL allow write-scoped tokens to import a supported localization file only when the project, branch, and locale all belong to the token's organization. The system MUST reject oversized requests, excessive key counts, invalid formats, and invalid field lengths before mutation.

#### Scenario: Valid public import
- **WHEN** a write token submits a valid file within the configured size and key limits for an authorized project, branch, and locale
- **THEN** the system parses and validates the complete command before starting privileged writes

#### Scenario: Request exceeds import bounds
- **WHEN** the file size or parsed key count exceeds the configured public API limit
- **THEN** the system returns a payload or validation error without creating a snapshot or changing translations

### Requirement: Public imports snapshot before mutation
The system MUST create or reuse a pre-import version snapshot before applying a public import that may overwrite existing translations.

#### Scenario: Snapshot creation fails
- **WHEN** the system cannot create the required pre-import snapshot
- **THEN** the import fails and no translation mutation is applied

### Requirement: Public imports apply atomically
The system MUST apply key, translation, history, and mutation-audit changes through a transactional boundary and MUST NOT report success for partially applied data.

#### Scenario: Database mutation fails
- **WHEN** any key, translation, history, or audit write fails during the transaction
- **THEN** the transaction rolls back and the API returns an error rather than partial success

### Requirement: Public imports are retry safe
The system SHALL require `Idempotency-Key` for public imports and SHALL bind the key to the authenticated token and normalized request hash.

#### Scenario: Network retry after success
- **WHEN** a client retries an import after success with the same token, key, and content
- **THEN** the system returns the original result without creating another snapshot or repeating writes

#### Scenario: Missing idempotency key
- **WHEN** a public import request omits `Idempotency-Key`
- **THEN** the system rejects the request before parsing the uploaded file

### Requirement: Browser and public imports share validated behavior
The system SHALL use one transport-independent import service for cookie-authenticated browser imports and token-authenticated public imports while preserving their distinct authorization and audit actors.

#### Scenario: Same file through both transports
- **WHEN** equivalent valid import commands are submitted through browser and public transports
- **THEN** both paths apply the same parsing, namespace, validation, snapshot, and persistence rules while recording the correct actor type
