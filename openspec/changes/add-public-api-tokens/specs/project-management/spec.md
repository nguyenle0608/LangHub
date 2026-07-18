## ADDED Requirements

### Requirement: API clients can discover organization projects
The system SHALL provide a cursor-paginated v1 project listing containing only projects owned by the authenticated token's organization.

#### Scenario: List first project page
- **WHEN** an active read-capable token requests the first projects page with a valid limit
- **THEN** the system returns deterministic project summaries, a next cursor when more results exist, and no project from another organization

#### Scenario: Invalid cursor
- **WHEN** a client supplies an invalid or out-of-scope cursor
- **THEN** the system returns a validation error without falling back to an unbounded project query
