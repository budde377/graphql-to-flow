// @flow

import type {
  Intersection, List, Property, Result, Type, Union, String, Number, Boolean,
  StringLiteral, Reference, Operation
} from '../flowify'

export function res (...operations: Operation[]): Result {
  return {
    kind: 'Result',
    operations
  }
}

export function op (result: Type, variables: {[string]: Type} = {}) {
  return {
    kind: 'Operation',
    result,
    variables

  }
}

export function obj (...properties: Property[]) {
  return {
    kind: 'Object',
    properties
  }
}

export function union (...types: Type[]): Union {
  return {
    kind: 'Union',
    types
  }
}

export function intersection (...types: Type[]): Intersection {
  return {
    kind: 'Intersection',
    types
  }
}

export function l (type: Type): List {
  return {
    kind: 'List',
    type
  }
}

export function str (): String {
  return {
    kind: 'String'
  }
}

export function bool (): Boolean {
  return {
    kind: 'Boolean'
  }
}

export function num (): Number {
  return {
    kind: 'Number'
  }
}

export function property (key: string, type: Type): Property {
  return {
    kind: 'Property',
    key,
    type
  }
}

export function nullable (type: Type) {
  return {
    kind: 'Nullable',
    type
  }
}

export function strl (value: string): StringLiteral {
  return {
    kind: 'StringLiteral',
    value
  }
}

export function ref (name: string): Reference {
  return {
    kind: 'Reference',
    name
  }
}
