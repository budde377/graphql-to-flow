// @flow
import {
  isListType, isScalarType, isUnionType, isNonNullType, isCompositeType, isEnumType,
  isAbstractType, isInputType, isInputObjectType
} from 'graphql'
import type {
  DefinitionNode,
  DocumentNode, FieldNode, FragmentDefinitionNode, NameNode, OperationDefinitionNode,
  SelectionNode,
  OperationTypeNode,
  SelectionSetNode, VariableDefinitionNode, TypeNode
} from 'graphql/language/ast'
import { GraphQLSchema } from 'graphql/type/schema'
import type {
  GraphQLScalarType, GraphQLEnumType,
  GraphQLCompositeType, GraphQLField, GraphQLNamedType,
  GraphQLOutputType, GraphQLObjectType, GraphQLInputType
} from 'graphql/type/definition'
import {
  ResolveTypeError,
  ResolveFieldTransformError,
  ResolveTransformError,
  TypeTransformError, ResolveCompositeTransformError, ResolveInputTransformError, InvariantError
} from './errors'

export type Scalar = {
  +kind: 'Scalar',
  +name: string
}

export type List<T> = {
  +kind: 'List',
  +type: T
}

export type NotNull<T> = {
  +kind: 'NotNull',
  +type: T
}

export type Enum = {
  +kind: 'Enum',
  +values: string[]
}

export type Typename = {
  +kind: 'Typename'
}

export type Type<S> = NotNull<Type<S>> | List<Type<S>> | Scalar | S | Enum | Typename

export type InputField = {
  +kind: 'InputField',
  +name: string,
  +type: InputType
}

export type Input = {
  +kind: 'Input',
  +fields: InputField[]
}

export type InputType = Scalar | Enum | Input | NotNull<InputType> | List<InputType>

export type Field<S> = {
  +kind: 'Field',
  +name: string,
  +type: Type<S>,
}

export type Selection = {
  +on: GraphQLCompositeType,
  +onPossible: $ReadOnlyArray<GraphQLObjectType>,
  +kind: 'Selection',
  +fields: $ReadOnlyArray<Field<Selection>>,
  +fragments: $ReadOnlyArray<Selection>,
  +fragmentReferences: $ReadOnlyArray<string>
}

export type Variable = {
  +kind: 'Variable',
  +name: string,
  +type: InputType
}

export type Operation = {
  +kind: 'Operation',
  +selection: Selection,
  +variables: Variable[]
}

export type Result = {
  +kind: 'Result',
  +operations: Operation[],
  +fragments: { [string]: Selection }
}

export type Transformer<R, V> = (c: R, n: V) => R

function transformInputType (): GraphQLInputType => InputType {
  return it => {
    if (isScalarType(it)) {
      return scalarType(it)
    }
    if (isEnumType(it)) {
      return enumType(it)
    }
    if (isInputObjectType(it)) {
      const fs = it.getFields()
      const fields = Object.keys(fs).map(k => fs[k]).map(({name, type}) => ({
        kind: 'InputField',
        name,
        type: transformInputType()(type)
      }))
      return (
        {
          kind: 'Input',
          fields
        }
      )
    }
    if (isListType(it)) {
      return {
        kind: 'List',
        type: transformInputType()(it.ofType)
      }
    }
    if (isNonNullType(it)) {
      return {
        kind: 'NotNull',
        type: transformInputType()(it.ofType)
      }
    }
    throw new TypeTransformError(it)
  }
}

function transformVariableType (s: GraphQLSchema): TypeNode => InputType {
  return (t: TypeNode) => {
    switch (t.kind) {
      case 'NamedType':
        const it = resolveInputType(s, t.name)
        return transformInputType()(it)
      case 'ListType':
        return (
          {
            kind: 'List',
            type: transformVariableType(s)(t.type)
          })
      case 'NonNullType':
        return (
          {
            kind: 'NotNull',
            type: transformVariableType(s)(t.type)
          })
      default:
        throw new InvariantError()
    }
  }
}

function transformVariable (s: GraphQLSchema): VariableDefinitionNode => Variable {
  return v => ({
    kind: 'Variable',
    type: transformVariableType(s)(v.type),
    name: v.variable.name.value
  })
}

function transformOperationDefinitionN (s: GraphQLSchema): Transformer<Result, OperationDefinitionNode> {
  return (result, odn) => ({
    ...result,
    operations: [
      ...result.operations,
      {
        kind: 'Operation',
        selection: transformSelectionSetN(s)(selection(s, resolveOperation(s, odn.operation)), odn.selectionSet),
        variables: (odn.variableDefinitions || []).map(transformVariable(s))
      }]
  })
}

function selection (schema: GraphQLSchema, t: GraphQLCompositeType): Selection {
  return (
    {
      kind: 'Selection',
      fields: [],
      fragmentReferences: [],
      fragments: [],
      on: t,
      onPossible: isAbstractType(t) ? schema.getPossibleTypes(t) : [t]
    }
  )
}

function resolveType (s: GraphQLSchema, n: NameNode): GraphQLNamedType {
  const type = s.getType(n.value)
  if (!type) {
    throw new ResolveTypeError(n)
  }
  return type
}

function resolveCompositeType (s: GraphQLSchema, n: NameNode): GraphQLCompositeType {
  const t = resolveType(s, n)
  if (!isCompositeType(t)) {
    throw new ResolveCompositeTransformError(t)
  }
  return t
}

function resolveInputType (s: GraphQLSchema, n: NameNode): GraphQLInputType {
  const t = resolveType(s, n)
  if (!isInputType(t)) {
    throw new ResolveInputTransformError(t)
  }
  return t
}

function findOperation (s: GraphQLSchema, o: OperationTypeNode): ?GraphQLObjectType {
  switch (o) {
    case 'query':
      return s.getQueryType()
    case 'mutation':
      return s.getMutationType()
    case 'subscription':
      return s.getSubscriptionType()
  }
}

function resolveOperation (s: GraphQLSchema, o: OperationTypeNode): GraphQLObjectType {
  const op = findOperation(s, o)
  if (!op) {
    throw new ResolveTransformError(o)
  }
  return op
}

function resolveFields (c: GraphQLCompositeType, name: NameNode): GraphQLField<*, *> {
  if (isUnionType(c)) {
    throw new ResolveFieldTransformError(name, c)
  }
  const fields = c.getFields()
  const field = fields[name.value]
  if (!field) {
    throw new ResolveFieldTransformError(name, c)
  }
  return field
}

function scalarType (t: GraphQLScalarType): Scalar {
  return {
    kind: 'Scalar',
    name: t.name
  }
}

function enumType (t: GraphQLEnumType): Enum {
  return (
    {kind: 'Enum', values: t.getValues().map(t => t.name)}
  )
}

function findType (schema: GraphQLSchema, t: GraphQLOutputType, field: FieldNode): Type<Selection> {
  if (isCompositeType(t)) {
    const selectionSet = field.selectionSet
    if (!selectionSet) {
      throw new TypeTransformError(t)
    }
    return transformSelectionSetN(schema)(selection(schema, t), selectionSet)
  }
  if (isListType(t)) {
    return {kind: 'List', type: findType(schema, t.ofType, field)}
  }
  if (isNonNullType(t)) {
    return {kind: 'NotNull', type: findType(schema, t.ofType, field)}
  }
  if (isScalarType(t)) {
    return scalarType(t)
  }
  if (isEnumType(t)) {
    return enumType(t)
  }
  throw new TypeTransformError(t)
}

function transformFieldN (schema: GraphQLSchema): Transformer<Selection, FieldNode> {
  return (s: Selection, fn: FieldNode) => {
    if (fn.name.value === '__typename') {
      return {
        ...s,
        fields:
          [
            ...s.fields,
            {
              kind: 'Field',
              name: '__typename',
              type: {kind: 'Typename'}
            }]
      }
    }
    const field = resolveFields(s.on, fn.name)
    const f: Field<Selection> = {
      kind: 'Field',
      name: (fn.alias && fn.alias.value) || fn.name.value,
      type: findType(schema, field.type, fn)
    }
    return {...s, fields: [...s.fields, f]}
  }
}

function transformSelectionN (schema: GraphQLSchema): Transformer<Selection, SelectionNode> {
  return (s: Selection, sn: SelectionNode) => {
    switch (sn.kind) {
      case 'Field':
        return transformFieldN(schema)(s, sn)
      case 'FragmentSpread':
        return {...s, fragmentReferences: [...s.fragmentReferences, sn.name.value]}
      case 'InlineFragment':
        const t = sn.typeCondition ? resolveCompositeType(schema, sn.typeCondition.name) : s.on
        const sel = selection(schema, t)
        return {...s, fragments: [...s.fragments, transformSelectionSetN(schema)(sel, sn.selectionSet)]}
      default:
        return s
    }
  }
}

function transformSelectionSetN (s: GraphQLSchema): Transformer<Selection, SelectionSetNode> {
  return (c, sn) => sn.selections.reduce(transformSelectionN(s), c)
}

function transformFragmentDefinitionN (s: GraphQLSchema): Transformer<Result, FragmentDefinitionNode> {
  return (c, fdn) => {
    const t = resolveCompositeType(s, fdn.typeCondition.name)
    const sel = transformSelectionSetN(s)(selection(s, t), fdn.selectionSet)
    return {...c, fragments: {...c.fragments, [fdn.name.value]: sel}}
  }
}

function transformDefinitionN (s: GraphQLSchema): Transformer<Result, DefinitionNode> {
  return (c, dn) => {
    switch (dn.kind) {
      case 'OperationDefinition':
        return transformOperationDefinitionN(s)(c, dn)
      case 'FragmentDefinition':
        return transformFragmentDefinitionN(s)(c, dn)
      default:
        return c
    }
  }
}

export default function transform (s: GraphQLSchema): DocumentNode => Result {
  return dn => dn.definitions.reduce(transformDefinitionN(s), {
    kind: 'Result',
    operations: [],
    fragments: {}
  })
}
