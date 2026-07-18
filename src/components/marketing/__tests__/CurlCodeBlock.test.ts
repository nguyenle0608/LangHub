import { describe, expect, it } from 'vitest'
import { toPostmanCurl } from '../CurlCodeBlock'

describe('toPostmanCurl', () => {
  it('produces a one-line Postman-compatible command using the production URL', () => {
    const command = `curl --fail-with-body \\
  -H "Authorization: Bearer $LANGHUB_TOKEN" \\
  "https://lang-hub.netlify.app/api/v1/projects/$PROJECT_ID/translations?locale=en&branch=main"`

    expect(toPostmanCurl(command)).toBe(
      'curl -H "Authorization: Bearer YOUR_LANGHUB_TOKEN" "https://lang-hub.netlify.app/api/v1/projects/YOUR_PROJECT_ID/translations?locale=en&branch=main"',
    )
  })

  it('replaces write-token and idempotency placeholders', () => {
    const command = `curl --fail-with-body -X POST \\
  -H "Authorization: Bearer $LANGHUB_WRITE_TOKEN" \\
  -H "Idempotency-Key: deploy-$GITHUB_RUN_ID" \\
  "https://lang-hub.netlify.app/api/v1/projects/$PROJECT_ID/import"`

    expect(toPostmanCurl(command)).toBe(
      'curl -X POST -H "Authorization: Bearer YOUR_LANGHUB_WRITE_TOKEN" -H "Idempotency-Key: YOUR_IDEMPOTENCY_KEY" "https://lang-hub.netlify.app/api/v1/projects/YOUR_PROJECT_ID/import"',
    )
  })
})
