## ADDED Requirements

### Requirement: Target cells show translation assistance on demand
The editor SHALL request TM suggestions and applicable glossary terms when an editable non-base target cell with non-empty base source text receives focus. It SHALL NOT perform a new server search on every target-text keystroke.

#### Scenario: Translator focuses a target cell
- **WHEN** an editable target cell receives focus and its key has non-empty base-locale text
- **THEN** the editor loads bounded TM suggestions and glossary context for that authorized project, branch, key, and target locale

#### Scenario: Translator types in the target draft
- **WHEN** the assistance context has loaded and the translator changes only the target draft
- **THEN** the editor reuses the loaded context without issuing a TM search for each keystroke

#### Scenario: Base cell is focused
- **WHEN** the user focuses the project's base-locale cell
- **THEN** the editor does not request target translation assistance

### Requirement: Assistance failures do not block editing
The editor SHALL keep translation editing and saving available when TM or glossary lookup fails.

#### Scenario: Suggestion request fails
- **WHEN** the assistance service returns an error or times out
- **THEN** the editor shows a retryable unavailable state while preserving the current draft and save controls

### Requirement: Assistance context cannot mix project resources
The server SHALL validate that the requested branch, key, base locale, and target locale all belong to the authorized project before returning editor assistance.

#### Scenario: Request contains a foreign locale
- **WHEN** an authorized project request includes a locale belonging to another project
- **THEN** the system returns a generic not-found outcome and no TM or glossary data
