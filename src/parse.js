// @flow
// https://github.com/estree/estree/blob/master/spec.md

var esprima = require('esprima-fb')
var path = require('path')
// var lodash = require('lodash')
// var {assign, curry} = lodash
var fs = require('fs')
var _ = require('lodash')

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
  // Strip 'declare export' statements from Flow 0.19, which aren't supported by esprima.
  // They're not useful to us anyway.
  data = data.replace(/declare export .*?(?:\n|$)/ig, '')
  return esprima.parse(data.toString(), {tolerant:true})
}

function treeToTypes(tree:Tree, filepath:string, paths):Array<?TypeAlias> {
  var all_paths = (paths || []).concat(path.normalize(filepath))
  console.log('all_paths',all_paths)
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
    if (s.type == "ExportDeclaration") {
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

  var reduced =  _.reduce(aliases, (values, alias:?TypeAlias) => {
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

  if (anno.type === Syntax.ObjectTypeAnnotation) {
    return objectType((anno : any))
  }

  else if (anno.type === Syntax.GenericTypeAnnotation) {
    return genericType((anno : any))
  }

  else if (anno.type === Syntax.NullableTypeAnnotation) {
    return nullableType((anno : any))
  }

  else if (anno.type === Syntax.StringLiteralTypeAnnotation) {
    return literalType((anno : any))
  }

  else if (anno.type === Syntax.UnionTypeAnnotation) {
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
  type.properties = anno.properties.map(toProperty)
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

  if (anno.type === Syntax.StringTypeAnnotation) {
    return 'string'
  }

  else if (anno.type === Syntax.NumberTypeAnnotation) {
    return 'number'
  }

  else if (anno.type === Syntax.BooleanTypeAnnotation) {
    return 'boolean'
  }

  else if (anno.type === Syntax.AnyTypeAnnotation) {
    return 'any'
  }

  return anno.type.replace('TypeAnnotation', '')
}













//////////////////////////////////////////////////////////////
// Type description of what esprima returns
//////////////////////////////////////////////////////////////

type Tree = {
  type: string;
  body: Array<AnySyntax>;
}

type AnySyntax = TypeAlias | ExportDeclaration;

type ExportDeclaration = {
  type: string;
  declaration: AnySyntax;
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

//////////////////////////////////////////////////////////////////

type SyntaxTokens = {
  AnyTypeAnnotation: string;
  ArrayTypeAnnotation: string;
  BooleanTypeAnnotation: string;
  FunctionTypeAnnotation: string;
  GenericTypeAnnotation: string;
  IntersectionTypeAnnotation: string;
  NullableTypeAnnotation: string;
  NumberTypeAnnotation: string;
  ObjectTypeAnnotation: string;
  StringLiteralTypeAnnotation: string;
  StringTypeAnnotation: string;
  TupleTypeAnnotation: string;
  TypeAnnotation: string;
  TypeofTypeAnnotation: string;
  UnionTypeAnnotation: string;
  VoidTypeAnnotation: string;
}

var Syntax:SyntaxTokens = esprima.Syntax
