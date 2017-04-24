'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.validate = exports.parse = exports.getTypes = undefined;

var _parse = require('./parse');

var validate = require('./validate').validate;


var parse = function parse(path) {
  var typeMap = (0, _parse.readFile)(path);
  return {
    assert: function assert(value, typename) {
      return validate(typeMap, typename, value);
    }
  };
};

exports.getTypes = _parse.readFile;
exports.parse = parse;
exports.validate = validate;