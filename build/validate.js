"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var _ = require('lodash');

var validateTypeOf = function validateTypeOf(type) {
  return function (val) {
    if ((typeof val === "undefined" ? "undefined" : _typeof(val)) === type) {
      return true;
    } else {
      // TODO: throw
      return "expected typeof " + type + ", got " + (typeof val === "undefined" ? "undefined" : _typeof(val));
    }
  };
};

var validateInstanceOf = function validateInstanceOf(func) {
  return function (val) {
    if (val instanceof func) {
      return true;
    } else {
      // TODO: throw
      return "expected instance of " + func.name;
    }
  };
};

var validatePrimitives = {
  "string": validateTypeOf("string"),
  "number": validateTypeOf("number"),
  "boolean": validateTypeOf("boolean"),
  "Date": validateInstanceOf(Date)
};

var validateObject = function validateObject(contextTypes, type, value) {
  return _.map(type.properties, function (prop) {
    // THESE ARE NECESSARY BECAUSE OF THE AST-STRUCTURE.
    // it’s optional and missing => ok
    if (prop.optional === true && isUndefined(value[prop.key])) {
      return true;
      // it’s not optional and missing => error
    } else if (!prop.optional && isUndefined(value[prop.key])) {
      throw new TypeError("Property \u201D" + prop.key + "\u201D: expected a value, got missing (" + value[prop.key] + ")");
      // else => validate
    } else {
      return _defineProperty({}, prop.key, validate(contextTypes, prop.type.name, value[prop.key], prop.type));
    }
  });
};

var validateArray = function validateArray(contextTypes, type, value) {
  if (Array.isArray(value)) {
    if (type.params) {
      return _.map(value, function (v) {
        return validate(contextTypes, type.params[0].name, v, type.params[0]);
      });
    } else {
      return true;
    }
  } else {
    throw new TypeError("Property \u201D" + type.params[0].name + "\u201D: expected an array, got (" + (typeof value === "undefined" ? "undefined" : _typeof(value)) + ")");
  }
};

var validateUnion = function validateUnion(contextTypes, type, value) {
  if (Array.isArray(type.types)) {
    var isValid = _.some(type.types, function (type) {
      try {
        var validation = validate(contextTypes, type.name, value, type);
        console.log('validation', validation);
        return validation;
      } catch (e) {
        return false;
      }
    });
    if (isValid) {
      return true;
    } else {
      throw new TypeError("Union Type could not be validated.");
    }
  } else {
    throw new TypeError("Union Types must consist of a list of types.");
  }
};

var validateLiteral = function validateLiteral(contextTypes, type, value) {
  if (type.literal === value) {
    return true;
  } else {
    throw new TypeError(value + " is literally not " + type.literal);
  }
};

var isNull = function isNull(value) {
  return value === null;
};

var isUndefined = function isUndefined(value) {
  return value === undefined;
};

var isAnyType = function isAnyType(type) {
  return type.name == "any";
};

var isPrimitiveType = function isPrimitiveType(type) {
  return !!validatePrimitives[type.name];
};

var isNullableType = function isNullableType(type) {
  return !!type.nullable;
};

var isOptionalType = function isOptionalType(type) {
  return !!type.optional;
};

var validate = function validate(contextTypes, typename, value, type) {

  // FIGURE OUT THE `type`

  // the actual type information was not passed in and its name
  // could not be found in the context types.
  if (type == undefined && !contextTypes[typename]) {
    throw new TypeError("Type name \u201D" + typename + "\u201D not found in value.");

    // the actual type information was not passed in, but only
    // the type’s name. Get the actual type from the context types.
  } else if (contextTypes[typename]) {
    type = contextTypes[typename];
  }

  // console.log('TYPE:', type)
  // console.log('VALUE:',value)

  // EXISTENTIAL CHECKS

  // it’s not nullable yet null: error
  if (!isNullableType(type) && !isAnyType(type) && isNull(value)) {
    throw new TypeError(type.name + " cannot be null.");

    // it’s nullable and null: ok
  } else if (isNullableType(type) && isNull(value)) {
    // console.log('NULLABLE & NULL')
    return true;

    // it’s not optional and undefined: error
  } else if (!isOptionalType(type) && isUndefined(value)) {
    throw new TypeError(type.name + " cannot be undefined");

    // it’s optional and undefined: ok
  } else if (isOptionalType(type) && isUndefined(value)) {
    // console.log('OPTIONAL & UNDEFINED')
    return true;
  }

  // PERFORM ACTUAL TYPE CHECKS
  else {
      // console.log('NONE OF THE EXISTENTIAL CONDITIONS APPLY')
      // PRIMITIVES
      if (isPrimitiveType(type)) {
        return validatePrimitives[type.name](value);
        // TYPE ANY
      } else if (isAnyType(type)) {
        return !isUndefined(value);
        // LITERAL
      } else if (type.name.indexOf('Literal') !== -1) {
        return validateLiteral(contextTypes, type, value);

        // ALL OF THESE CALL RECURSIONS
        // OBJECT
      } else if (type.name == 'Object') {
        return validateObject(contextTypes, type, value);
        // ARRAY
      } else if (type.name == 'Array') {
        return validateArray(contextTypes, type, value);
        // UNION TYPE
      } else if (type.name == 'Union') {
        return validateUnion(contextTypes, type, value);
        // TYPE ALIAS (COMPLEX)
      } else if (contextTypes[type.name] !== undefined) {
        return validate(contextTypes, null, value, type);
        // NONE OF THE ABOVE
      } else {
        throw new TypeError("\n        \u201D" + type.name + "\u201D does not seem to be a valid type and\n        is not mentioned in the supplied TypeMap.\n        Checked value was: \u201D" + JSON.stringify(value) + "\u201D (" + (typeof value === "undefined" ? "undefined" : _typeof(value)) + ") ");
      }
    }
};

module.exports.validate = validate;