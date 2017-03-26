// @flow
var path = require('path')
var validate = require('../src/validate')
import * as types from '../src'
var {create, createAll, validateRegex, validateTypeOf} = types.validate
import type {ValidatorMap, Validator} from '../src/validate';
import type {PhoneNumber, User} from './example'

var VALIDATORS:ValidatorMap = {
  PhoneNumber: validateRegex(/^\d{10}$/),
}

function validateAnyGUID():Validator<any> {
  return function(guid) {
    return true
  }
}

function validatePhoneNumber():Validator<any> {
  return function(phone:PhoneNumber) {
    if (phone.length != 9) {
      return "invalid phone number: " + phone
    }
    return true
  }
}

var sample:User = {
  username: "bobby",
  age: 23,
  phone: "8014114399",
  created: null
}

// -------------------------------------

var MyTypes = types.readFile(path.join(__dirname, 'example.js.flow'))
console.log(MyTypes.User.properties)

// ------------------------------------

//var validateGUID = validate.create({}, MyTypes.GUID)

//console.log("TEST")
//var errs = validateGUID(1235) // guids should be strings!
//console.log(errs)

// ------------------------

// find all the types in a given file
// should I use the working directory or ..
//console.log(MyTypes.MemberOffer.properties)

// create validators for all the types
console.log("")
console.log("VALIDATE")
console.log("")
var validators = createAll(VALIDATORS, MyTypes)

console.log(validators.User({
  age: 23,
  phone: "8014114399"
}))

console.log(validators.User({
  username: "bobby",
  age: "hello",
  phone: "8014114399",
}))


console.log(validators.User({
  username: "bobby",
  age: 23,
  phone: "801-411-4399",
  created: 1432757991843 // was supposed to be date, not a timestamp
}))

// --------------------------------------------

console.log(validators.Kiosk({
  mac_address: "asdf",
  global_location_id: 1,
  settings: {
    test: 1234,
  },
  stuffs: {message: "HI"}
}))

export var aNum = 3
export var aFunc = function() {}
