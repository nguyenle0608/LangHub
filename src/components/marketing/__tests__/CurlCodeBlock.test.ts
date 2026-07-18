import { describe, expect, it } from 'vitest'
import { toPostmanCurl } from '../CurlCodeBlock'

describe('toPostmanCurl', () => {
  it('produces a one-line Postman-compatible command for the current website', () => {
    const command = `curl --fail-with-body \\
  -H "Authorization: Bearer $LANGHUB_TOKEN" \\
  "https://your-langhub.example/api/v1/projects/$PROJECT_ID/translations?locale=en&branch=main"`

    expect(toPostmanCurl(command, 'https://langhub.example/')).toBe(
      'curl -H "Authorization: Bearer YOUR_LANGHUB_TOKEN" "https://langhub.example/api/v1/projects/YOUR_PROJECT_ID/translations?locale=en&branch=main"',
    )
  })

  it('replaces write-token and idempotency placeholders', () => {
    const command = `curl --fail-with-body -X POST \\
  -H "Authorization: Bearer $LANGHUB_WRITE_TOKEN" \\
  -H "Idempotency-Key: deploy-$GITHUB_RUN_ID" \\
  "https://your-langhub.example/api/v1/projects/$PROJECT_ID/import"`

    expect(toPostmanCurl(command, 'http://localhost:3000')).toBe(
      'curl -X POST -H "Authorization: Bearer YOUR_LANGHUB_WRITE_TOKEN" -H "Idempotency-Key: YOUR_IDEMPOTENCY_KEY" "http://localhost:3000/api/v1/projects/YOUR_PROJECT_ID/import"',
    )
  })
})
