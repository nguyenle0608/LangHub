## ADDED Requirements

### Requirement: Owners and admins can manage organization API tokens
The system SHALL allow only organization owners and admins to list, create, and revoke API tokens for their organization. Token list responses MUST expose only safe metadata and MUST NOT expose token hashes or plaintext secrets.

#### Scenario: Admin creates a read token
- **WHEN** an organization admin creates a token with a valid name, read scope, and expiration
- **THEN** the system stores only the token hash, returns the plaintext token once with a no-store response, and lists only its safe prefix and metadata afterward

#### Scenario: Non-admin attempts token management
- **WHEN** a viewer or translator attempts to list, create, or revoke organization tokens
- **THEN** the system rejects the request without revealing token metadata

### Requirement: Bearer tokens authenticate without browser sessions
The system SHALL authenticate v1 requests from an `Authorization: Bearer` credential without requiring cookies. Malformed, unknown, revoked, and expired tokens MUST all fail with the same unauthorized response.

#### Scenario: Active token authenticates
- **WHEN** a request presents a correctly formatted active token
- **THEN** the system returns an authentication context containing only the token ID, organization ID, scope, and audit actor information

#### Scenario: Invalid token states are indistinguishable
- **WHEN** a request presents a malformed, unknown, revoked, or expired token
- **THEN** the system returns the same 401 error shape and does not disclose which validation failed

### Requirement: Token scopes enforce least privilege
The system SHALL treat `read` tokens as read-only and `write` tokens as permitting both read and write operations.

#### Scenario: Read token attempts import
- **WHEN** a read-scoped token calls a write endpoint
- **THEN** the system returns 403 before parsing or mutating import data

#### Scenario: Write token reads project data
- **WHEN** a write-scoped token calls an allowed read endpoint
- **THEN** the system authorizes the request subject to tenant and rate-limit checks

### Requirement: Every public request is tenant scoped
The system MUST prove that each requested project, branch, locale, key, and other child resource belongs to the authenticated token's organization before executing service-role data access.

#### Scenario: Token requests another organization project
- **WHEN** a valid token for organization A requests a project belonging to organization B
- **THEN** the system returns a not-found response and performs no project data read or mutation

#### Scenario: Project contains a mismatched child identifier
- **WHEN** a request combines an authorized project with a branch or locale from another project
- **THEN** the system rejects the request before executing export or import work

### Requirement: Public requests are rate limited
The system SHALL enforce shared database-backed per-token read and write limits across application instances and SHALL return 429 with retry guidance when a limit is exhausted.

#### Scenario: Read quota exhausted
- **WHEN** a token exceeds its configured read quota within the active window
- **THEN** the system returns 429 with `Retry-After` and does not execute the requested data query

#### Scenario: Separate write quota
- **WHEN** a write token has remaining read quota but has exhausted its write quota
- **THEN** read requests remain eligible while write requests return 429

### Requirement: Public mutations are idempotent and auditable
The system SHALL require an idempotency key for public mutations, bind it to the token and request content, and record the token actor, target resources, request ID, and outcome in an audit event.

#### Scenario: Completed request is retried
- **WHEN** a client repeats a completed mutation with the same token, idempotency key, and content
- **THEN** the system returns the stored result without applying the mutation again

#### Scenario: Idempotency key content changes
- **WHEN** a client reuses an idempotency key with different request content
- **THEN** the system returns 409 and does not apply the new mutation

### Requirement: API documentation describes secure automation
The system SHALL document token creation, bearer authentication, scopes, expiration, revocation, rate limits, idempotency, curl usage, and a GitHub Actions example without embedding a real secret.

#### Scenario: Developer follows CI example
- **WHEN** a developer follows the GitHub Actions documentation
- **THEN** the example reads the token from a repository secret and transmits it only in the Authorization header
