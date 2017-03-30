// @flow

// TODO FEATURE support nested objects

import type {Type, Property, ObjectMap} from './types'
import {extend} from 'lodash'

import * as _ from 'lodash'
export type Validator<T> = (value:T) => ValidationResult
export type ValidationError = string;
// either true, or a string with the error
// use === true to test
export type ValidationResult = boolean | ValidationError;

export type ValidatorMap = {[key:string]:Validator<any>}

export type ValidateObject = (value:Object) => Array<KeyedError>

export type KeyedError = {
  key: string;
  value: string;
  error: ValidationError;
}

type KeyedValidator = [string, Validator<any>];


// -------------------------------------------------------------

// create a single validator: a function to call with your object
// it will return an array of errors

export function create(map:ValidatorMap, type:Type, contextTypes:ObjectMap<Type>):ValidateObject {
  var vs = typeValidators(map, type, contextTypes)
  console.log(require('util').inspect(type, { depth: null }))
  console.log('vs:')
  console.log(require('util').inspect(vs, { depth: null }))
  return function(obj) {
    return validateAll(vs, obj)
  }
}

export function createAll(map:ValidatorMap, types:ObjectMap<Type>):ObjectMap<ValidateObject> {
  var vs = {}
  for (var name in types) {
    console.log('-------');
    console.log('name',name);
    vs[name] = create(map, types[name], types)
  }
  return vs
}

// ---------------------------------------------------------------

var VALIDATORS_BY_TYPE:ValidatorMap = {
  "string"  : validateTypeOf("string"),
  "number"  : validateTypeOf("number"),
  "boolean" : validateTypeOf("boolean"),
  "Date"    : validateInstanceOf(Date),
  "Object"  : validateExists(),
  "Array"   : validateArray(),
}

function validateAll(vs:Array<KeyedValidator>, obj:Object):Array<KeyedError> {
  var maybeErrs:Array<?KeyedError> = vs.map(function(kv) {
    return validate(kv, obj)
  })

  var errs:any = maybeErrs.filter(function(err:?KeyedError):boolean {
    return (err !== undefined)
  })

  return errs
}

function validate([key, validator]:KeyedValidator, obj:Object):?KeyedError {
  // this runs the validator
  var result = validator(obj[key])
  if (!valid(result)) {
    return {key: key, value: obj[key], error: (result : any)}
  }
}

function valid(result:ValidationResult):boolean {
  return result === true
}

//////////////////////////////////////////////////////////////////////////

// turns a property into a validator
// ignore optional, it doesn't work right
function propToValidator(map:ValidatorMap, prop:Property, contextTypes:ObjectMap<Type>):KeyedValidator {
  if (contextTypes[prop.type.name]) {
    console.log('prop.type.name', prop.type.name)
    console.log('contextTypes[prop.type.name]', contextTypes[prop.type.name])
    return typeToValidator(map, prop.key, contextTypes[prop.type.name])
  }else{
    return typeToValidator(map, prop.key, prop.type)
  }
}

// just do required for now?
// you want to allow them to override the mapping
// especially for their custom types!
function typeToValidator(map:ValidatorMap, key:string, type:Type):KeyedValidator {
  // console.log('key', key)
  // console.log('type', type)
  // console.log('map', map)
  // TODO nested objects
  if (type.properties || type.params) {

    console.log("TWE", type.properties)
    console.log("TWA", type.params);
    // var all = objToValidators(map, type.properties, contextTypes)

    // function allThemBones(value) {
    //   var errs = validateAll(all, value)
    //
    //   if (errs.length) {
    //     return "error there was some stuff: " + errs.length
    //   }
    //
    //   return true
    // }
    //
    // return [key, allThemBones]
  }

  // now run the type-based validator
  var validator = map[type.name]
  if (!validator) {
    throw new Error("Could not find validator for type: " + type.name)
  }

  function isValid(value) {
    console.log('key', key)
    console.log('value', value)
    if (!exists(value)) {
      // if the property doesn't exist, and it's not a nullable property
      // otherwise just do the second one
      if (type.nullable) {
        return true
      }else {
        return "missing"
      }
    }else {
      return validator(value)
    }
  }
  return [key, isValid]
}

function typeValidators(map:ValidatorMap, type:Type, contextTypes:ObjectMap<Type>):Array<KeyedValidator> {
  // console.log('typeValidators',type);
  var fullMap:ValidatorMap = extend(map, VALIDATORS_BY_TYPE)
  if (type.properties) {
    return objToValidators(fullMap, type.properties, contextTypes)
  if (type.params) {
    return arrToValidators(fullMap, type.params, contextTypes)
  }else {
    return [typeToValidator(map, "", type, contextTypes)]
  }
}

function objToValidators(map:ValidatorMap, props:Array<Property>, contextTypes:ObjectMap<Type>):Array<KeyedValidator> {
  return props.map(function(prop) {
    return propToValidator(map, prop, contextTypes)
  })
}

function arrToValidators(map:ValidatorMap, params:Array<Property>, contextTypes:ObjectMap<Type>):Array<KeyedValidator> {
  return params.map((param) => {
    return paramToValidator(map, param, contextTypes)
  })
}

//////////////////////////////////////////////////////////////
// Validators
//////////////////////////////////////////////////////////////

export function validateExists():Validator<any> {
  return function(val) {
    return exists(val) || "missing"
  }
}

export function validateTypeOf(type:string):Validator<any> {
  return function(val) {
    return (typeof val === type) || "expected typeof " + type
  }
}

export function validateArray():Validator<any> {
  return function(val) {
    return (Array.isArray(val) || "expected array")
  }
}

export function validateInstanceOf(func:Function):Validator<any> {
  return function(val) {
    return (val instanceof func) || "expected instance of " + func.name
  }
}

export function validateRegex(regex:RegExp):Validator<any> {
  return function(val) {
    return (regex.test(val)) || "did not match " + regex.toString()
  }
}

function exists(value):boolean {
  return !(value === undefined || value === null)
}
