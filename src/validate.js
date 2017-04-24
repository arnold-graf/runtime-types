
var _ = require('lodash')

var validateTypeOf = (type) => {
  return (val) => {
    if (typeof val === type) {
      return true
    }else{
      // TODO: throw
      return "expected typeof " + type + ", got " + typeof val
    }
  }
}

var validateInstanceOf = (func) => {
  return (val) => {
    if (val instanceof func) {
      return true
    }else{
      // TODO: throw
      return "expected instance of " + func.name
    }
  }
}

var validatePrimitives = {
  "string"  : validateTypeOf("string"),
  "number"  : validateTypeOf("number"),
  "boolean" : validateTypeOf("boolean"),
  "Date"    : validateInstanceOf(Date)
}

var validateObject = (contextTypes, type, value) => {
  return _.map(type.properties, (prop) => {

    // console.log('PROP TYPE');
    // debug(prop)
    // console.log('PROP VALUE');
    // debug(value)

    // it’s optional and missing => ok
    if (prop.optional === true && isUndefined(value[prop.key])) {
      return true
    // it’s not optional and missing => error
    }else if (!prop.optional && isUndefined(value[prop.key])){
      throw new TypeError(`Property ”${prop.key}”: expected a value, got missing (${value[prop.key]})`)
    // else => validate
    }else{
      return { [prop.key]: validate(contextTypes, prop.type.name, value[prop.key], prop.type) }
    }
  })
}

var validateArray = (contextTypes, type, value) => {
  if (Array.isArray(value)) {
    if (type.params) {
      return _.map(value, (v) => {
        return validate(contextTypes, type.params[0].name, v, type.params[0])
      })
    }else{
      return true
    }
  }else{
    throw new TypeError(`Property ”${type.params[0].name}”: expected an array, got (${typeof(value)})`)
  }
}

var validateUnion = (contextTypes, type, value) => {
  if (Array.isArray(type.types)) {
    var isValid = _.some(type.types, (type) => {
      try {
        var validation = validate(contextTypes, type.name, value, type)
        console.log('validation', validation);
        return validation
      }catch (e){
        return false
      }
    })
    if (isValid) {
      return true
    }else{
      throw new TypeError(`Union Type could not be validated.`)
    }
  }else{
    throw new TypeError(`Union Types must consist of a list of types.`)
  }
}

var validateLiteral = (contextTypes, type, value) => {
  if (type.literal === value) {
    return true
  }else{
    throw new TypeError(`${value} is literally not ${type.literal}`)
  }
}

var isNull = (value) => value === null

var isUndefined = (value) => value === undefined

var isAnyType = (type) => type.name == "any"

var isPrimitiveType = (type) => !!validatePrimitives[type.name]

var isNullableType = (type) => !!type.nullable

var isOptionalType = (type) => !!type.optional

var validate = (contextTypes, typename, value, type) => {

  // FIGURE OUT THE `type`

  // the actual type information was not passed in and its name
  // could not be found in the context types.
  if (type == undefined && !contextTypes[typename]){
    throw new TypeError(`Type name ”${typename}” not found in value.`)

  // the actual type information was not passed in, but only
  // the type’s name. Get the actual type from the context types.
  } else if (contextTypes[typename]) {
    type = contextTypes[typename]
  }
  // if (typename) {
  //   console.log('TYPENAME',typename);
  // }
  console.log('TYPE:', type)
  // debug(type)
  console.log('VALUE:',value)
  // debug()

  // EXISTENTIAL CHECKS

  // it’s not nullable yet null: error
  if (!isNullableType(type) && !isAnyType(type) && isNull(value)) {
    throw new TypeError(`${type.name} cannot be null.`)

  // it’s nullable and null: ok
  }else if (isNullableType(type) && isNull(value)) {
    // console.log('NULLABLE & NULL')
    return true

  // it’s not optional and undefined: error
  }else if (!isOptionalType(type) && isUndefined(value)){
    throw new TypeError(`${type.name} cannot be undefined`)

  // it’s optional and undefined: ok
  }else if (isOptionalType(type) && isUndefined(value)){
    // console.log('OPTIONAL & UNDEFINED')
    return true
  }

  // PERFORM ACTUAL TYPE CHECKS
  else{
    // console.log('NONE OF THE EXISTENTIAL CONDITIONS APPLY')
    // PRIMITIVES
    if (isPrimitiveType(type)) {
      return validatePrimitives[type.name](value)
    // TYPE ANY
    }else if (isAnyType(type)){
      return !isUndefined(value)
    // LITERAL
    }else if (type.name.indexOf('Literal') !== -1){
      return validateLiteral(contextTypes, type, value)

    // ALL OF THESE CALL RECURSIONS
    // OBJECT
    }else if (type.name == 'Object'){
      return validateObject(contextTypes, type, value)
    // ARRAY
    }else if (type.name == 'Array'){
      return validateArray(contextTypes, type, value)
    // UNION TYPE
    }else if (type.name == 'Union'){
      return validateUnion(contextTypes, type, value)
    // TYPE ALIAS (COMPLEX)
    }else{
      return validate(contextTypes, null, value, type)
    }

  }
}

module.exports.validate = validate
