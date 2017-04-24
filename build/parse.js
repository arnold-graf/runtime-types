'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.readFile = readFile;

// https://github.com/estree/estree/blob/master/spec.md

var path = require('path');
var fs = require('fs');
var _ = require('lodash');
var flow_parser = require('flow-parser');

//////////////////////////////////////////////////////////////
// fileTypes


// read a file synchronously and return a type definition for each type alias found
// keys are the name of the alias
// values are the type description
// you should run this when your program starts

function readFile(filepath) {
  // console.log(require('util').inspect(findTypes(parseFile(filepath)), { depth: null }));
  return findTypes(parseFile(filepath), filepath);
}

function parseFile(filepath) {
  var data = fs.readFileSync(filepath).toString();

  // TODO: IS THIS EVEN NEEDED IN FLOW_PARSE?
  // Strip 'declare export' statements from Flow 0.19, which aren't supported by esprima.
  // They're not useful to us anyway.
  data = data.replace(/declare export .*?(?:\n|$)/ig, '');

  var ast = flow_parser.parse(data.toString(), {});
  // console.log(require('util').inspect(ast, { depth: null }))
  return ast;
}

function treeToTypes(tree, filepath, paths) {
  var all_paths = (paths || []).concat(path.normalize(filepath));
  console.log('all_paths', all_paths);
  // console.log(require('util').inspect(tree, { depth: null }));
  return _(tree.body).map(function (s) {
    // new import declarations: recursion.
    if (s.type == "ImportDeclaration" && s.importKind == "type") {
      var import_path = path.normalize(path.dirname(filepath) + '/' + s.source.value + '.js');
      if (all_paths.indexOf(import_path) > -1) {
        return [];
      } else {
        // RECURSION:
        return treeToTypes(parseFile(import_path), import_path, all_paths);
      }
      // TODO: OTHER EXTENSIONS THAN JS
    }
    if (s.type == "ExportNamedDeclaration") {
      var ex = s;
      s = ex.declaration;
    }
    if (s.type == "TypeAlias") {
      return s;
    }
  }).flattenDeep().value();
}

function findTypes(tree, filepath) {
  // console.log(require('util').inspect(tree.body, { depth: null }));

  var aliases = treeToTypes(tree, filepath);

  // console.log('ALIASES',require('util').inspect(aliases, { depth: null }))

  var reduced = _.reduce(aliases, function (values, alias) {
    if (alias) {
      values[alias.id.name] = toType(alias.right);
    }
    return values;
  }, {});
  // console.log(require('util').inspect(reduced, { depth: null }));
  return reduced;
}

function toProperty(prop) {
  var p = {
    key: prop.key.name,
    type: toType(prop.value)
  };
  if (prop.optional) {
    p.optional = true;
  }
  return p;
}

function toType(anno) {

  if (anno.type === "ObjectTypeAnnotation") {
    return objectType(anno);
  } else if (anno.type === "GenericTypeAnnotation") {
    return genericType(anno);
  } else if (anno.type === "NullableTypeAnnotation") {
    return nullableType(anno);
  } else if (anno.type === "StringLiteralTypeAnnotation") {
    return literalType(anno);
  } else if (anno.type === "BooleanLiteralTypeAnnotation") {
    return literalType(anno);
  } else if (anno.type === "NumberLiteralTypeAnnotation") {
    return literalType(anno);
  } else if (anno.type === "UnionTypeAnnotation") {
    return unionType(anno);
  } else {
    return valueType(anno);
  }
}

//GenericTypeAnnotation
function genericType(anno) {
  var type = emptyType(anno.id.name);

  if (anno.typeParameters) {
    type.params = anno.typeParameters.params.map(toType);
  }

  return type;
}

function objectType(anno) {
  var type = emptyType('Object');
  type.properties = anno.properties.map(function (prop) {
    return toProperty(prop);
  });
  return type;
}

function nullableType(anno) {
  var type = toType(anno.typeAnnotation);
  type.nullable = true;
  return type;
}

function literalType(anno) {
  var type = valueType(anno);
  type.literal = anno.value;
  return type;
}

function unionType(anno) {
  var type = emptyType('Union');
  type.types = anno.types.map(toType);
  return type;
}

//VoidTypeAnnotation
//StringTypeAnnotation
//BooleanTypeAnnotation
//NumberTypeAnnotation
//FunctionTypeAnnotation
//StringLiteralTypeAnnotation
//AnyTypeAnnotation
//UnionTypeAnnotation

// UNSUPPORTED
//ArrayTypeAnnotation (it uses GenericTypeAnnotation)
//IntersectionTypeAnnotation
//TupleTypeAnnotation
//TypeAnnotation
//TypeofTypeAnnotation

function valueType(anno) {
  var type = emptyType(shortName(anno));
  return type;
}

function emptyType(name) {
  return {
    name: name
  };
}

function shortName(anno) {

  if (anno.type === "StringTypeAnnotation") {
    return 'string';
  } else if (anno.type === "NumberTypeAnnotation") {
    return 'number';
  } else if (anno.type === "BooleanTypeAnnotation") {
    return 'boolean';
  } else if (anno.type === "AnyTypeAnnotation") {
    return 'any';
  }

  return anno.type.replace('TypeAnnotation', '');
}

//////////////////////////////////////////////////////////////
// Type description of what esprima returns
//////////////////////////////////////////////////////////////

// -------------------------------------------------
// annotations

// use an intersection type so I don't have to cast later


// Array uses this