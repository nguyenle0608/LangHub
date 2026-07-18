import { describe, expect, it } from 'vitest'
import { checkGlossaryConsistency, findApplicableGlossaryTerms, normalizeAssistanceText } from '../matcher'

const term = {
  id: 'term-1', sourceTerm: 'Sign in', targetTerm: 'Đăng nhập',
  caseSensitive: false, wholeWord: true, description: null,
}

describe('translation assistance matching', () => {
  it('normalizes case and whitespace deterministically', () => {
    expect(normalizeAssistanceText('  Sign\n  IN  ')).toBe('sign in')
  })

  it('matches case-insensitive whole terms', () => {
    expect(findApplicableGlossaryTerms('Please SIGN IN now', [term])).toEqual([term])
    expect(findApplicableGlossaryTerms('This is a sign inside', [term])).toEqual([])
  })

  it('treats regex metacharacters literally', () => {
    const special = { ...term, id: 'special', sourceTerm: 'C++ (beta)', targetTerm: 'C++ thử nghiệm', wholeWord: false }
    expect(findApplicableGlossaryTerms('Use C++ (beta) today', [special])).toEqual([special])
  })

  it('emits a non-blocking warning only when the required target is absent', () => {
    expect(checkGlossaryConsistency('Sign in now', 'Vui lòng tiếp tục', [term])).toEqual([
      expect.objectContaining({ rule: 'glossary-missing:term-1', severity: 'warning' }),
    ])
    expect(checkGlossaryConsistency('Sign in now', 'Đăng nhập ngay', [term])).toEqual([])
  })
})
