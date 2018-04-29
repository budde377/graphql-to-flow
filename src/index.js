// @flow

import type { Result } from './flowify'
import transform from './transform'
import type { GraphQLSchema } from 'graphql/type/schema'
import type { DocumentNode } from 'graphql/language/ast'
import link from './link'
import flatten from './flatten'
import flowify from './flowify'

export default (schema: GraphQLSchema, document: DocumentNode): Result => flowify(flatten(link(transform(schema)(document))))
