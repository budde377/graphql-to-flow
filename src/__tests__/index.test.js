// @flow
import build from '../'
import { buildSchema, GraphQLSchema } from 'graphql'
import fs from 'fs'
import gql from 'graphql-tag'
import path from 'path'
import { intersection, l, nullable, num, obj, op, property, res, str, strl, union } from './utils'

describe('index', () => {
  let schema: GraphQLSchema

  beforeAll(async () => {
    const string = await new Promise((resolve, reject) => {
      fs.readFile(path.join(__dirname, 'schema.graphqls'), (err, data) => {
        if (err) return reject(err)
        resolve(data.toString('utf-8'))
      })
    })
    schema = buildSchema(string)
  })

  it('should transform default example', () => {
    const dn = gql`
        query {
            hero {
                name
                appearsIn
            }
            droid(id: "2000") {
                name
            }
        }
    `
    const t = build(schema, dn)
    expect(t).toEqual(
      res(
        op(
          obj(
            property('hero',
              nullable(obj(
                property('name', str()),
                property('appearsIn', l(
                  nullable(
                    union(
                      strl('NEWHOPE'),
                      strl('EMPIRE'),
                      strl('JEDI')
                    )
                  )
                  ),
                )))),
            property('droid',
              nullable(obj(
                property('name', str())
              ))))
        )))
  })
  it('should transform search with fragments', () => {
    const dn = gql`
        query {
            search(text: "an") {
                ... on Human {
                    __typename
                    name
                    height
                }
                ... on Droid {
                    __typename
                    name
                    primaryFunction
                }
                ... on Starship {
                    __typename
                    name
                    length
                }
            }
        }
    `
    const t = build(schema, dn)
    expect(t).toEqual(
      res(
        op(
          obj(
            property('search',
              nullable(l(
                nullable(
                  union(
                    obj(
                      property('__typename', strl('Human')),
                      property('name', str()),
                      property('height', nullable(num()))
                    ),
                    obj(
                      property('__typename', strl('Droid')),
                      property('name', str()),
                      property('primaryFunction', nullable(str()))
                    ),
                    obj(
                      property('__typename', strl('Starship')),
                      property('name', str()),
                      property('length', nullable(num()))
                    ),
                  ))
              )))
          ))
      ))
  })
  it('should hero with interface', () => {
    const dn = gql`
        query HeroForEpisode($ep: Episode!) {
            hero(episode: $ep) {
                name
                ... on Droid {
                    primaryFunction
                }
            }
        }
    `
    const t = build(schema, dn)
    expect(t).toEqual(
      res(
        op(
          obj(
            property('hero', nullable(
              intersection(
                obj(
                  property('name', str())
                ),
                union(
                  obj(
                    property('primaryFunction', nullable(str()))
                  ),
                  obj()
                )
              )
            )),
          ),
          {
            ep: union(
              strl('NEWHOPE'),
              strl('EMPIRE'),
              strl('JEDI'),
            )
          }
        )
      ))
  })
  it('should work with fragments', () => {
    const dn = gql`
        query {
            leftComparison: hero(episode: EMPIRE) {
                ...comparisonFields
                ...comparisonFields
            }
            rightComparison: hero(episode: JEDI) {
                ...comparisonFields
            }
        }
        fragment comparisonFields on Character {
            __typename
            name
            appearsIn
            friends {
                name
            }
        }
    `
    const t = build(schema, dn)
    expect(t).toEqual(
      res(
        op(
          obj(
            property('leftComparison', nullable(
              obj(
                property('__typename', union(strl('Human'), strl('Droid'))),
                property('name', str()),
                property('appearsIn',
                  l(nullable(union(
                    strl('NEWHOPE'),
                    strl('EMPIRE'),
                    strl('JEDI'),
                  )))),
                property('friends', nullable(l(nullable(
                  obj(
                    property('name', str())
                  ))))),
              )
            )),
            property('rightComparison', nullable(
              obj(
                property('__typename', union(strl('Human'), strl('Droid'))),
                property('name', str()),
                property('appearsIn',
                  l(nullable(union(
                    strl('NEWHOPE'),
                    strl('EMPIRE'),
                    strl('JEDI'),
                  )))),
                property('friends', nullable(l(nullable(
                  obj(
                    property('name', str())
                  ))))),
              )
            ))
          ))
      ))
  })
  it('should work with fragments', () => {
    const dn = gql`
        mutation CreateReviewForEpisode($ep: Episode!, $review: ReviewInput!) {
            createReview(episode: $ep, review: $review) {
                stars
                commentary
            }
        }
    `
    const t = build(schema, dn)
    expect(t).toEqual(
      res(
        op(
          obj(
            property('createReview', nullable(obj(
              property('stars', num()),
              property('commentary', nullable(str()))
            )))
          ),
          {
            ep: union(
              strl('NEWHOPE'),
              strl('EMPIRE'),
              strl('JEDI'),
            ),
            review: obj(
              property('stars', num()),
              property('commentary', nullable(str())),
              property('favorite_color', nullable(obj(
                property('red', num()),
                property('green', num()),
                property('blue', num()),
              )))
            )
          }
        )
      ))
  })
})
