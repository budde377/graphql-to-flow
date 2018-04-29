// @flow
import type {
  Result as LResult,
  Selection as LSelection,
  Field as LField,
  Operation as LOperation
} from './link'
import type { Type } from './transform'

function mergeSelections (s1: LSelection, s2: LSelection): LSelection {
  return {
    kind: 'Selection',
    on: s1.on,
    onPossible: s1.onPossible,
    fields: [...s1.fields, ...s2.fields],
    fragments: [...s1.fragments, ...s2.fragments]
  }
}

function collapseSelection (s: LSelection): LSelection {
  return s.fragments.reduce((acc, s) => {
    if (s.on.name !== acc.on.name) {
      return {...acc, fragments: [...acc.fragments, s]}
    }
    return {...acc, fields: [...acc.fields, ...s.fields], fragments: [...acc.fragments, ...s.fragments]}
  }, {...s, fields: s.fields, fragments: []})
}

function flattenLType (): Type<LSelection> => Type<LSelection> {
  return t => {
    if (t.kind !== 'Selection') {
      return t
    }
    return flattenLSection()(t)
  }
}

function flattenLField (): LField => LField {
  return f => ({...f, type: flattenLType()(f.type)})
}

function collapseAndMergeSelection (selection: LSelection): LSelection {
  const collapsed = collapseSelection(selection)
  const fragmentMap = collapsed.fragments.reduce((acc, selection) => (
    {
      ...acc,
      [selection.on.name]: acc[selection.on.name]
        ? mergeSelections(acc[selection.on.name], selection)
        : selection
    }
  ), {})
  const fragments = Object.keys(fragmentMap).reduce((acc, k) => [...acc, flattenLSection()(fragmentMap[k])], [])
  const fields = collapsed.fields.map(flattenLField())
  return {...collapsed, fragments, fields}
}

function flattenLSection (): LSelection => LSelection {
  return s => collapseAndMergeSelection(s)

}

function flattenLOperation (): LOperation => LOperation {
  return op => ({...op, selection: flattenLSection()(op.selection)})
}

export default (r: LResult): LResult => ({...r, operations: r.operations.map(flattenLOperation())})

