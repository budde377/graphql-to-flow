// @flow
import type { Type } from './flowify'
import { InvariantError } from './errors'

export default function printFlowType (t: Type): string {
  switch (t.kind) {
    case 'List':
      return `Array<${printFlowType(t.type)}>`
    case 'StringLiteral':
      return JSON.stringify(t.value)
    case 'Union':
      return `( ${t.types.map(printFlowType).join(' | ')} )`
    case 'Intersection':
      return `( ${t.types.map(printFlowType).join(' & ')} )`
    case 'Boolean':
      return `boolean`
    case 'String':
      return `string`
    case 'Number':
      return `number`
    case 'Object':
      return `{${t.properties.map(p => `${p.key}: ${printFlowType(p.type)}`).join(', ')}}`
    case 'Nullable':
      return `?${printFlowType(t.type)}`
    case 'Reference':
      return t.name
    default:
      throw new InvariantError()
  }
}
