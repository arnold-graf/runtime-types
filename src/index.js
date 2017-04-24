// @flow

var validate = require('./validate').validate
import type {Property, Type} from './types'
import { readFile as getTypes } from './parse'

var parse = (path:string) => {
  var typeMap = getTypes(path)
  return {
    assert : (value:any, typename:string) => {
      return validate(typeMap, typename, value)
    }
  }
}

export {getTypes, parse, validate}
export type {Type, Property}
