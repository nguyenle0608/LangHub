export interface TranslationMemorySuggestion {
  id: string
  sourceText: string
  targetText: string
  score: number
  matchKind: 'exact' | 'fuzzy'
  projectId: string | null
  usageCount: number
  lastUsedAt: string | null
}

export interface TranslationAssistance {
  sourceText: string
  sourceLocale: string
  targetLocale: string
  suggestions: TranslationMemorySuggestion[]
  glossary: import('./matcher').GlossaryMatchTerm[]
}
