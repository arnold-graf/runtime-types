// @flow
// https://github.com/estree/estree/blob/master/spec.md

var path = require('path')
var fs = require('fs')
var _ = require('lodash')
var flow_parser = require('flow-parser')

import type {ObjectMap, Property, Type} from './types'


//////////////////////////////////////////////////////////////
// fileTypes


// read a file synchronously and return a type definition for each type alias found
// keys are the name of the alias
// values are the type description
// you should run this when your program starts

export function readFile(filepath:string):ObjectMap<Type> {
  // console.log(require('util').inspect(findTypes(parseFile(filepath)), { depth: null }));
  return findTypes(parseFile(filepath), filepath)
}

function parseFile(filepath:string):Tree {
  var data = fs.readFileSync(filepath).toString()

  // TODO: IS THIS EVEN NEEDED IN FLOW_PARSE?
  // Strip 'declare export' statements from Flow 0.19, which aren't supported by esprima.
  // They're not useful to us anyway.
  data = data.replace(/declare export .*?(?:\n|$)/ig, '')

  var ast = flow_parser.parse(data.toString(), {})
  // console.log(require('util').inspect(ast, { depth: null }))
  return ast
}

function treeToTypes(tree:Tree, filepath:string, paths):Array<?TypeAlias> {
  var all_paths = (paths || []).concat(path.normalize(filepath))
  console.log('all_paths',all_paths)
  // console.log(require('util').inspect(tree, { depth: null }));
  return _(tree.body).map((s) => {
    // new import declarations: recursion.
    if (s.type == "ImportDeclaration" && s.importKind == "type") {
      var import_path = path.normalize(path.dirname(filepath) + '/' + s.source.value + '.js')
      if (all_paths.indexOf(import_path) > -1) {
        return []
      }else{
        return treeToTypes(parseFile(import_path), import_path, all_paths)
      }
      // TODO: OTHER EXTENSIONS THAN JS
    }
    if (s.type == "ExportNamedDeclaration") {
      var ex:ExportDeclaration = (s : any)
      s = ex.declaration
    }
    if (s.type == "TypeAlias") {
      return s
    }
  })
  .flattenDeep()
  .value()
}

function findTypes(tree:Tree, filepath:string):ObjectMap<Type> {
  // console.log(require('util').inspect(tree.body, { depth: null }));

  var aliases:Array<?TypeAlias> = treeToTypes(tree, filepath)

  // console.log('ALIASES',require('util').inspect(aliases, { depth: null }))

  var reduced = _.reduce(aliases, (values, alias:?TypeAlias) => {
    if (alias) {
      values[alias.id.name] = toType(alias.right)
    }
    return values
  }, {})
  // console.log(require('util').inspect(reduced, { depth: null }));
  return reduced
}

function toProperty(prop:TypeProperty):Property {
  var p:any = {
    key: prop.key.name,
    type: toType(prop.value),
  }
  if (prop.optional) {
    p.optional = true
  }
  return p
}

function toType(anno:TypeAnnotation):Type {

  if (anno.type === "ObjectTypeAnnotation") {
    return objectType((anno : any))
  }

  else if (anno.type === "GenericTypeAnnotation") {
    return genericType((anno : any))
  }

  else if (anno.type === "NullableTypeAnnotation") {
    return nullableType((anno : any))
  }

  else if (anno.type === "StringLiteralTypeAnnotation") {
    return literalType((anno : any))
  }

  else if (anno.type === "UnionTypeAnnotation") {
    return unionType((anno : any))
  }
  else {
    return valueType(anno)
  }
}

//GenericTypeAnnotation
function genericType(anno:GenericTypeAnnotation):Type {
  var type = (emptyType(anno.id.name) : any)

  if (anno.typeParameters) {
    type.params = anno.typeParameters.params.map(toType)
  }

  return type
}

function objectType(anno:ObjectTypeAnnotation):Type {
  var type = (emptyType('Object') : any)
  type.properties = anno.properties.map((prop) => {
    return toProperty(prop)
  })
  return type
}

function nullableType(anno:WrapperTypeAnnotation):Type {
  var type = toType(anno.typeAnnotation)
  type.nullable = true
  return type
}

function literalType(anno:StringLiteralTypeAnnotation):Type {
  var type = valueType(anno)
  type.literal = anno.value
  return type
}

function unionType(anno:UnionTypeAnnotation):Type {
  var type = (emptyType('Union') : any)
  type.types = anno.types.map(toType)
  return type
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

function valueType(anno:TypeAnnotation):Type {
  var type = emptyType(shortName(anno))
  return (type : any)
}

function emptyType(name:string):Type {
  return {
    name: name,
  }
}

function shortName(anno:TypeAnnotation):string {

  if (anno.type === "StringTypeAnnotation") {
    return 'string'
  }

  else if (anno.type === "NumberTypeAnnotation") {
    return 'number'
  }

  else if (anno.type === "BooleanTypeAnnotation") {
    return 'boolean'
  }

  else if (anno.type === "AnyTypeAnnotation") {
    return 'any'
  }

  return anno.type.replace('TypeAnnotation', '')
}


//////////////////////////////////////////////////////////////
// Type description of what esprima returns
//////////////////////////////////////////////////////////////

type Tree = {
  type: string,
  body: Array<AnySyntax>
}

type AnySyntax = TypeAlias | ExportDeclaration;

type ExportDeclaration = {
  type: string,
  declaration: AnySyntax,
  importKind?: string,
  source?: ObjectMap<any>
}

type TypeAlias = {
  type: string;
  id: Identifier;
  typeParameters: ?TypeParameters;
  right: TypeAnnotation;
}

type TypeProperty = {
  type: string; // ObjectTypeProperty
  key: Identifier;
  value: TypeAnnotation;
  optional: boolean;
  // static: any;
}


type TypeParameters = {
  type: 'TypeParameterInstantiation';
  params: Array<TypeAnnotation>;
}

type Identifier = {
  type: 'Identifier';
  name: string;
  typeAnnotation: any; // undefined
  optional: any;       // undefined
}

// -------------------------------------------------
// annotations

// use an intersection type so I don't have to cast later
type TypeAnnotation = ObjectTypeAnnotation | ValueTypeAnnotation | GenericTypeAnnotation | WrapperTypeAnnotation | StringLiteralTypeAnnotation | UnionTypeAnnotation;

type ValueTypeAnnotation = {
  type: string; // StringTypeAnnotation, NumberTypeAnnotation
}

type StringLiteralTypeAnnotation = {
  type: "StringLiteralTypeAnnotation";
  value: string;
  raw: string;
}

type WrapperTypeAnnotation = {
  type: string;
  typeAnnotation: TypeAnnotation;
}

type ObjectTypeAnnotation = {
  type: "ObjectTypeAnnotation";
  properties: Array<TypeProperty>;
  indexers?: Array<any>;
  callProperties?: Array<any>;
}

// Array uses this
type GenericTypeAnnotation = {
  type: string; // "GenericTypeAnnotation";
  id: Identifier;
  typeParameters: ?TypeParameters;
}

type UnionTypeAnnotation = {
  type: "UnionTypeAnnotation";
  types: TypeAnnotation[];
}
