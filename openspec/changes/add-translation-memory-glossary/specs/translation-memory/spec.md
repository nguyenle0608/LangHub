## ADDED Requirements

### Requirement: Approved translations build organization memory
The system SHALL capture a non-empty source/target translation pair in organization Translation Memory when the target translation becomes approved. Pending, reviewed, empty, and base-to-base values MUST NOT be captured.

#### Scenario: Target translation becomes approved
- **WHEN** a target-locale translation with a non-empty base-locale source becomes approved
- **THEN** the system stores or refreshes a deduplicated organization TM entry with its locale pair and provenance

#### Scenario: Unreviewed value is saved
- **WHEN** a translator saves a pending or reviewed target value
- **THEN** the system does not add that value to Translation Memory

#### Scenario: Base source changes after targets are approved
- **WHEN** an approved base-locale value changes while approved target values exist for the key
- **THEN** the system captures the new source with each currently approved target without deleting prior memory pairs

### Requirement: Existing approved data can be backfilled safely
The system SHALL provide a bounded, idempotent backfill operation that derives organization TM pairs from existing approved translations across branches.

#### Scenario: Backfill is repeated
- **WHEN** an operator reruns the same backfill batch
- **THEN** existing fingerprints are not duplicated and only missing pairs are added

### Requirement: Translation Memory search is exact-first and bounded
The system SHALL search within one organization and locale pair, return normalized exact matches before fuzzy trigram matches, use deterministic ordering, and return no more than five suggestions.

#### Scenario: Exact source exists
- **WHEN** the normalized source equals one or more TM sources
- **THEN** exact suggestions are returned first with score 1.0

#### Scenario: Only similar sources exist
- **WHEN** no exact source exists and trigram candidates meet the configured threshold
- **THEN** the system returns the highest-similarity candidates in deterministic order

#### Scenario: Very short source has no exact match
- **WHEN** the normalized source is shorter than four characters and no exact entry exists
- **THEN** the system returns no fuzzy suggestions

### Requirement: Translation Memory is tenant isolated
The system MUST prevent members and service routes from reading or mutating TM entries outside their organization, including requests that combine an authorized project with foreign branch, key, or locale identifiers.

#### Scenario: Member searches another organization memory
- **WHEN** a member of organization A attempts to search organization B's TM directly or through mixed resource identifiers
- **THEN** the system returns no foreign entry and performs no foreign mutation

#### Scenario: Translation provenance is deleted
- **WHEN** a source project, branch, key, or translation is deleted
- **THEN** the reusable TM text remains within its organization while deleted provenance identifiers become null

#### Scenario: Organization is deleted
- **WHEN** an organization is deleted
- **THEN** all of its TM entries are deleted

### Requirement: Suggestions remain advisory
The system SHALL require an explicit user action to apply a TM suggestion and MUST NOT save, review, or approve a translation merely because a suggestion was returned.

#### Scenario: Translator selects a suggestion
- **WHEN** a translator clicks a TM suggestion
- **THEN** its target text fills the current draft, the cell remains dirty, and the existing save workflow remains required
