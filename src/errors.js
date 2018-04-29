// @flow

import type { GraphQLCompositeType, GraphQLNamedType, GraphQLOutputType, GraphQLType } from 'graphql/type/definition'
import type { NameNode, OperationTypeNode } from 'graphql/language/ast'

export class LinkError extends Error {
  name: string

  constructor (name: string) {
    super(`Could not resolve seleciton with name: ${name}`)
    this.name = name
  }
}

export class TransformError extends Error {}

export class ResolveTypeError extends TransformError {
  type: NameNode

  constructor (type: NameNode) {
    super(`Could not resolve type: ${type.value}`)
    this.type = type
  }
}

export class ResolveTransformError extends TransformError {
  o: OperationTypeNode

  constructor (o: OperationTypeNode) {
    super(`Could not resolve operation: ${o}`)
    this.o = o
  }
}

export class TypeTransformError extends TransformError {
  type: GraphQLType

  constructor (type: GraphQLType) {
    super(`Could not resolve type for ${type.toString()}`)
    this.type = type
  }
}

export class ResolveFieldTransformError extends TransformError {
  type: GraphQLCompositeType
  n: NameNode

  constructor (name: NameNode, type: GraphQLCompositeType) {
    super(`Could not resolve field "${name.value}" on type: ${type.name}`)
    this.type = type
    this.n = name
  }
}

export class InvariantError extends Error {}

export class ResolveCompositeTransformError extends Error {
  type: GraphQLNamedType
  constructor (type: GraphQLNamedType) {
    super(`Could not resolve composite type ${type.name}`)
    this.type = type
  }
}

export class ResolveInputTransformError extends Error {
  type: GraphQLNamedType
  constructor (type: GraphQLNamedType) {
    super(`Could not resolve input type ${type.name}`)
    this.type = type
  }
}
