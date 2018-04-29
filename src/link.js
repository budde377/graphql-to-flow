// @flow
import type { GraphQLCompositeType, GraphQLObjectType } from 'graphql/type/definition'
import type {
  Transformer,
  Result as TResult,
  Selection as TSelection,
  Operation as TOperation,
  Field as TField,
  Type as TType,
  Variables,
} from './transform'
import { LinkError } from './errors'

export type Field = {
  +kind: 'Field',
  +name: string,
  +type: TType<Selection>
}

export type Selection = {
  +on: GraphQLCompositeType,
  +onPossible: $ReadOnlyArray<GraphQLObjectType>,
  +kind: 'Selection',
  +fields: Field[],
  +fragments: Selection[]
}

export type Operation = {
  +kind: 'Operation',
  +selection: Selection,
  +variables: Variables
}

export type Result = {
  +kind: 'Result',
  +operations: Operation[]
}

type DependencyVector = Array<boolean>

type DependencyMatrix = Array<DependencyVector>

function depEq (d1: DependencyMatrix, d2: DependencyMatrix): boolean {
  return d1.every((_, i) => d1.every((_, j) => d1[i][j] === d2[i][j]))
}

function depVecMerge (v1: DependencyVector, v2: DependencyVector): DependencyVector {
  return v1.map((v, k) => v || v2[k])
}

function findDependencyWeights (deps: DependencyMatrix): number[] {
  return deps.map(v => v.reduce((acc, val) => acc + (val ? 1 : 0), 0))
}

function findTransitiveDependencies (deps: DependencyMatrix): DependencyMatrix {
  const step = deps
    .map(vec => vec // Map each row
      .reduce((acc, v, j) => // With the transitive row
          v // If this row is dependent on 'j'
            ? depVecMerge(acc, deps[j]) // merge rows
            : acc // else nothing
        , vec))
  if (depEq(deps, step)) {
    return step // If no changes were made, we terminate
  }
  return findTransitiveDependencies(step) // Lets take another roll
}

function selectionDirectDependencies (selection: TSelection): string[] {
  // Find selections in fields
  const fieldSelections: TSelection[] = selection.fields.reduce((acc, f) => f.type.kind === 'Selection' ? [...acc, f.type] : acc, [])
  // merge with selections in fragments
  const selections: TSelection[] = [...fieldSelections, ...selection.fragments]
  // Take direct fragment references and merge with transitive references
  return [...selection.fragmentReferences, ...selections.reduce((acc, s) => [...acc, ...selectionDirectDependencies(s)], [])]
}

function findDirectDependencies (fragments: { [string]: TSelection }): { keys: $ReadOnlyArray<string>, dependencies: DependencyMatrix } {
  const keys = Object.keys(fragments) // Fixate key order
  const initO = keys.reduce((acc, k) => ({...acc, [k]: keys.reduce((acc, k) => ({...acc, [k]: false}), {})}), {}) // Create an initial {key: {key: false}} object
  const depMap = keys.reduce((acc, key) => // Build a dependency map {key: {key: boolean}}
    selectionDirectDependencies(fragments[key])
      .reduce((acc, k) => ({
        ...acc,
        [key]: {...acc[key], [k]: true}
      }), acc), {...initO})
  const dependencies = keys.map((k1) => keys.map(k2 => depMap[k1][k2]))  // Finally create a dependency matrix
  return {keys, dependencies}
}

function findTransformOrder (fragments: { [string]: TSelection }): string[] {
  const {dependencies: directDependencies, keys} = findDirectDependencies(fragments)
  const transitiveDependencies: DependencyMatrix = findTransitiveDependencies(directDependencies)
  const weights: number[] = findDependencyWeights(transitiveDependencies)
  const weightMap: { [string]: number } = keys.reduce((acc, key, i) => ({...acc, [key]: weights[i]}), {})
  return [...keys].sort((f1, f2) => weightMap[f1] - weightMap[f2]) // Return sorted list of keys
}

type LinkContext = { [string]: Selection }

function linkTOperation (context: LinkContext): Transformer<Result, TOperation> {
  return (r, to) => ({
    ...r,
    operations: [...r.operations,
      {
        kind: 'Operation',
        selection: linkTSelection(context)(to.selection),
        variables: to.variables
      }]
  })
}

function linkTType (context: LinkContext): TType<TSelection> => TType<Selection> {
  return t => {
    switch (t.kind) {
      case 'Selection':
        return linkTSelection(context)(t)
      case 'NotNull':
        return {kind: 'NotNull', type: linkTType(context)(t.type)}
      case 'List':
        return {kind: 'List', type: linkTType(context)(t.type)}
      default:
        return t
    }
  }
}

function linkTField (context: LinkContext): TField<TSelection> => Field {
  return field => ({
    kind: 'Field',
    name: field.name,
    type: linkTType(context)(field.type)
  })
}

function resolveReference (context: LinkContext): string => Selection {
  return key => {
    const selection = context[key]
    if (!selection) {
      throw new LinkError(key)
    }
    return selection
  }
}

function linkTSelection (context: LinkContext): TSelection => Selection {
  return s => {
    return {
      kind: 'Selection',
      on: s.on,
      onPossible: s.onPossible,
      fields: s.fields.map(linkTField(context)),
      fragments: [...s.fragments.map(linkTSelection(context)), ...s.fragmentReferences.map(resolveReference(context))]
    }
  }
}

function linkTSelectionEntry (): Transformer<LinkContext, { key: string, selection: TSelection }> {
  return (r, tr) => ({...r, [tr.key]: linkTSelection(r)(tr.selection)})
}

export default (tr: TResult): Result => {
  const order = findTransformOrder(tr.fragments)
  const fragments = order.map(key => ({key, selection: tr.fragments[key]})).reduce(linkTSelectionEntry(), {})
  return tr.operations.reduce(linkTOperation(fragments), {kind: 'Result', operations: []})
}
