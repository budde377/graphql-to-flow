// @flow
import type {
  Result as LResult,
  Operation as LOperation,
  Selection, Field
} from './link'
import type {
  InputField,
  InputType,
  Type as TType, Variable
} from './transform'
import { InvariantError } from './errors'

export type StringLiteral = { kind: 'StringLiteral', value: string }
export type List = { kind: 'List', type: Type }
export type Union = { kind: 'Union', types: Type[] }
export type Intersection = { kind: 'Intersection', types: Type[] }
export type Boolean = { kind: 'Boolean' }
export type String = { kind: 'String' }
export type Number = { kind: 'Number' }
export type Ob = { kind: 'Object', properties: Property[] }
export type Property = { kind: 'Property', key: string, type: Type }
export type Nullable = { kind: 'Nullable', type: Type }
export type Reference = { kind: 'Reference', name: string }

export type Type = StringLiteral | List | Union | Boolean | String | Number | Ob | Intersection | Nullable | Reference

export type Operation = {
  kind: 'Operation',
  result: Type,
  variables: { [string]: Type }
}

export type Result = {
  kind: 'Result',
  operations: Operation[]
}

function findTypename (context: Selection): Type {
  if (context.onPossible.length) {
    return {
      kind: 'Union',
      types: context.onPossible.map(c => ({kind: 'StringLiteral', value: c.name}))
    }
  }
  return {kind: 'String'}
}

function wrapNullable (type: Type, confirm: boolean): Type {
  return confirm ? {kind: 'Nullable', type} : type
}

function flowifyType (context: ?Selection = null, nullable = true): (TType<Selection> | InputType) => Type {
  return (t) => {
    switch (t.kind) {
      case 'List':
        const type: Type = flowifyType(context)(t.type)
        return wrapNullable({kind: 'List', type}, nullable)
      case 'NotNull':
        return flowifyType(context, false)(t.type)
      case 'Selection':
        return wrapNullable(flowifySelection()(t), nullable)
      case 'Scalar':
        switch (t.name) {
          case 'Int':
            return wrapNullable({kind: 'Number'}, nullable)
          case 'Float':
            return wrapNullable({kind: 'Number'}, nullable)
          case 'ID':
          case 'String':
            return wrapNullable({kind: 'String'}, nullable)
          case 'Boolean':
            return wrapNullable({kind: 'Boolean'}, nullable)
          default:
            return wrapNullable({kind: 'Reference', name: t.name}, nullable)
        }
      case 'Enum':
        const types = t.values.map(value => ({value, kind: 'StringLiteral'}))
        return wrapNullable({kind: 'Union', types}, nullable)
      case 'Typename':
        if (!context) {
          throw new InvariantError()
        }
        return findTypename(context)
      case 'Input':
        return wrapNullable({kind: 'Object', properties: t.fields.map(flowifyField(context))}, nullable)
    }
    throw new InvariantError()
  }
}

function flowifyField (context: ?Selection = null): (Field | InputField) => Property {
  return f => ({kind: 'Property', key: f.name, type: flowifyType(context)(f.type)})
}

function clean (type: Type): Type {
  switch (type.kind) {
    case 'List':
      return {
        kind: 'List',
        type: clean(type.type)
      }
    case 'Union':
      return (
        type.types.length === 1
          ? clean(type.types[0])
          : {kind: 'Union', types: type.types.map(clean)}
      )
    case 'Intersection':
      return (
        type.types.length === 1
          ? clean(type.types[0])
          : {kind: 'Intersection', types: type.types.map(clean)}
      )
    case 'Nullable':
      return {
        kind: 'Nullable',
        type: clean(type.type)
      }
    case 'Object':
      const cleanedProperties = type.properties.map(p => ({...p, type: clean(p.type)}))
      const mergedProperties = cleanedProperties.reduce((acc, p) => ({...acc, [p.key]: p}), {})
      return {
        kind: 'Object',
        properties: Object.keys(mergedProperties).map(k => mergedProperties[k])
      }
    default:
      return type
  }
}

function flowifyFields (context: Selection): (Field)[] => Property[] {
  return fs => fs.map(flowifyField(context))
}

function areAllCasesMatched (s: Selection): boolean {
  const types = s.onPossible.map(t => t.name)
  const fragments = s.fragments.map(s => s.on.name)
  return types.length === fragments.length && types.every(t => fragments.indexOf(t) >= 0)
}

function flowifySelection (): Selection => Type {
  return s => {
    const fieldObject = {kind: 'Object', properties: flowifyFields(s)(s.fields)}
    const fragmentObjects = s.fragments.map(flowifySelection())
    const empty = {kind: 'Object', properties: []}
    const allCaseMatch = areAllCasesMatched(s)
    const fragmentUnion = {kind: 'Union', types: allCaseMatch ? fragmentObjects : [...fragmentObjects, empty]}
    if (fieldObject.properties.length && fragmentObjects.length) {
      return {kind: 'Intersection', types: [fieldObject, fragmentUnion]}
    }
    if (fieldObject.properties.length) {
      return fieldObject
    }
    if (fragmentObjects.length) {
      return fragmentUnion
    }
    return empty
  }
}

function flowifyVariables (): Variable[] => { [string]: Type } {
  return variables => variables.reduce((acc, v) => ({...acc, [v.name]: flowifyType()(v.type)}), {})
}

function flowifyOperation (): LOperation => Operation {
  return op => {
    const result = clean(flowifySelection()(op.selection))
    const variables = flowifyVariables()(op.variables)
    return {kind: 'Operation', result, variables}
  }
}

export default (r: LResult): Result => ({kind: 'Result', operations: r.operations.map(flowifyOperation())})
