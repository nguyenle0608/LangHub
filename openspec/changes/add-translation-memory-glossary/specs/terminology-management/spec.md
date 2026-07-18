## ADDED Requirements

### Requirement: Owners and admins manage organization terminology
The system SHALL allow organization owners and admins to create, update, list, and delete glossary terms for a source/target locale pair. Translators and viewers SHALL be able to read applicable terms but MUST NOT mutate them.

#### Scenario: Admin creates a glossary term
- **WHEN** an organization admin submits valid source and required target terms for two distinct locale codes
- **THEN** the system stores the organization-scoped term and makes it available to authorized project editors

#### Scenario: Translator attempts glossary mutation
- **WHEN** a translator attempts to create, update, or delete a glossary term
- **THEN** the system rejects the request without changing terminology data

#### Scenario: Duplicate source term is created
- **WHEN** an admin creates a normalized source term that already exists for the same organization and locale pair
- **THEN** the system returns a conflict and preserves the existing required target term

### Requirement: Glossary lookup follows the active locale pair
The system SHALL return only terms whose source occurs in the active base-locale text and whose source/target locale pair matches the current translation cell.

#### Scenario: Source contains a configured term
- **WHEN** the active source contains a matching glossary source term under its case and whole-word rules
- **THEN** the editor displays the required target term and description

#### Scenario: Term belongs to another target locale
- **WHEN** the source term exists but only for a different target locale
- **THEN** the editor does not show that term for the current cell

### Requirement: Glossary matching is deterministic and safe
The system SHALL treat glossary content as plain text, apply configured case and whole-word behavior, and MUST NOT execute user-provided terms as regular expressions or code.

#### Scenario: Term contains regex metacharacters
- **WHEN** a glossary term contains characters such as `+`, `(`, `[` or `.`
- **THEN** matching treats those characters literally and does not raise a pattern error

### Requirement: Glossary consistency contributes QA warnings
The system SHALL emit a non-blocking QA warning when the source contains an applicable glossary term and the target does not contain its required translation.

#### Scenario: Required target term is missing
- **WHEN** a translated value omits the required target term for a source match
- **THEN** the cell displays a glossary consistency warning while still allowing save

#### Scenario: Required target term is present
- **WHEN** the translated value contains the required term under its configured matching rules
- **THEN** no glossary consistency warning is emitted for that term

### Requirement: Glossary data is tenant isolated
The system MUST prevent any direct query or privileged route from reading or mutating glossary terms outside the caller's organization.

#### Scenario: Admin supplies a foreign organization or term ID
- **WHEN** an admin of organization A attempts to read, update, or delete a term belonging to organization B
- **THEN** the system returns a generic not-found outcome and does not disclose or mutate the foreign term
