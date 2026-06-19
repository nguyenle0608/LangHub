import yaml from 'js-yaml'
import { buildNested } from './json'

export function exportYAML(keys: Record<string, string>): string {
  const nested = buildNested(keys)
  return yaml.dump(nested, { indent: 2, lineWidth: -1, quotingType: '"', forceQuotes: false })
}
