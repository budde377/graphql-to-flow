// @flow

import { bool, intersection, l, nullable, num, obj, property, ref, str, strl, union } from './utils'
import printer from '../printer'

describe('printer', () => {
  describe('strl', () => {
    it('should quote string', () => {
      expect(printer(strl("foobar"))).toBe('"foobar"')
    })
    it('should escape string', () => {
      expect(printer(strl('foo"bar'))).toBe('"foo\\"bar"')
    })
  })
  describe('list', () => {
    it('should print', () => expect(printer(l(str()))).toBe('Array<string>'))
  })
  describe('union', () => {
    it('should print', () => expect(printer(union(str(), num()))).toBe('( string | number )'))
  })
  describe('intersection', () => {
    it('should print', () => expect(printer(intersection(str(), num()))).toBe('( string & number )'))
  })
  describe('boolean', () => {
    it('should print', () => expect(printer(bool())).toBe('boolean'))
  })
  describe('string', () => {
    it('should print', () => expect(printer(str())).toBe('string'))
  })
  describe('nullable', () => {
    it('should print', () => expect(printer(nullable(str()))).toBe('?string'))
  })
  describe('reference', () => {
    it('should print', () => expect(printer(nullable(ref('Foo')))).toBe('?Foo'))
  })
  describe('object', () => {
    it('should print empty', () => expect(printer(obj())).toBe('{}'))
    it('should print', () => expect(printer(obj(property('foo', str()), property('bar', num())))).toBe('{foo: string, bar: number}'))
  })
})
