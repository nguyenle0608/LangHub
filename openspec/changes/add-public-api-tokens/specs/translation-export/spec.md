## ADDED Requirements

### Requirement: API clients can retrieve project translations
The system SHALL allow read-capable tokens to retrieve a deterministic JSON key-to-value mapping for a locale and branch that belong to a project in the token's organization.

#### Scenario: Retrieve default-branch locale translations
- **WHEN** a token requests a valid project and locale without specifying a branch
- **THEN** the system resolves the project's default branch and returns only translations for that project, branch, and locale

#### Scenario: Locale belongs to another project
- **WHEN** a client supplies a locale that does not belong to the requested project
- **THEN** the system rejects the request before loading translations

### Requirement: API clients can export supported localization formats
The system SHALL expose existing supported export formats through a read-capable v1 endpoint using the same paginated data loader and serializers as the browser export workflow.

#### Scenario: Export a supported format
- **WHEN** a token requests a supported format, valid filter, valid project locales, and valid project branch
- **THEN** the system returns the complete export with the appropriate content type and filename

#### Scenario: Export query exceeds resource boundary
- **WHEN** any requested locale or branch belongs outside the requested project or token organization
- **THEN** the system returns a safe not-found or validation response and does not invoke the exporter

#### Scenario: Export data query fails
- **WHEN** any paginated key or translation query fails
- **THEN** the system returns an error response and MUST NOT return a partial export file
