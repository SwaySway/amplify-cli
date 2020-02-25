import {
  parse,
  ObjectTypeDefinitionNode,
  Kind,
  DefinitionNode,
  DocumentNode,
  FieldDefinitionNode,
  InputObjectTypeDefinitionNode,
} from 'graphql';
import { GraphQLTransform, InvalidDirectiveError } from 'graphql-transformer-core';
import { SearchableModelTransformer } from '../SearchableModelTransformer';
import { DynamoDBModelTransformer } from 'graphql-dynamodb-transformer';

test('schema without @model', () => {
  const invalidSchema = `
  type Record @searchable {
    id: ID!
    createdAt: AWSDate
    updatedAt: AWSDateTime
    info: String
    precision: Float
    age: Int
    active: Boolean
    email: AWSEmail
    json: AWSJSON
    url: AWSURL
    phone: AWSPhone
    ip: AWSIPAddress
    time: AWSTime
  }`;

  const transformer = new GraphQLTransform({
    transformers: [new SearchableModelTransformer()],
  });
  expect(() => transformer.transform(invalidSchema)).toThrowError(InvalidDirectiveError);
});

test('filter input types have the correct output', () => {
  const validSchema = `
  type Record @model @searchable {
    id: ID!
    createdAt: AWSDate
    updatedAt: AWSDateTime
    info: String
    precision: Float
    age: Int
    active: Boolean
    email: AWSEmail
    json: AWSJSON
    url: AWSURL
    phone: AWSPhone
    ip: AWSIPAddress
    time: AWSTime
  }`;

  const transformer = new GraphQLTransform({
    transformers: [new DynamoDBModelTransformer(), new SearchableModelTransformer()],
  });
  const out = transformer.transform(validSchema);
  expect(out).toBeDefined();
  expect(out.schema).toContain('input SearchableDateFilterInput');
  expect(out.schema).toMatchSnapshot();
});
test('Test SearchableModelTransformer with query overrides', () => {
  const validSchema = `type Post @model @searchable(queries: { search: "customSearchPost" }) {
        id: ID!
        title: String!
        createdAt: String
        updatedAt: String
    }`;

  const transformer = new GraphQLTransform({
    transformers: [new DynamoDBModelTransformer(), new SearchableModelTransformer()],
  });
  const out = transformer.transform(validSchema);
  expect(out).toBeDefined();
  expect(out.schema).toBeDefined();
  const parsed = parse(out.schema);
  const queryType = getObjectType(parsed, 'Query');
  expect(queryType).toBeDefined();
  expectFields(queryType, ['customSearchPost']);
});

test('Test SearchableModelTransformer with only create mutations', () => {
  const validSchema = `type Post @model(mutations: { create: "customCreatePost" }) @searchable {
        id: ID!
        title: String!
        createdAt: String
        updatedAt: String
    }
    `;
  const transformer = new GraphQLTransform({
    transformers: [new DynamoDBModelTransformer(), new SearchableModelTransformer()],
  });
  const out = transformer.transform(validSchema);
  expect(out).toBeDefined();
  const parsed = parse(out.schema);
  const mutationType = getObjectType(parsed, 'Mutation');
  expect(mutationType).toBeDefined();
  expectFields(mutationType, ['customCreatePost']);
  doNotExpectFields(mutationType, ['updatePost']);
});

test('Test SearchableModelTransformer with multiple model searchable directives', () => {
  const validSchema = `
    type Post @model @searchable {
        id: ID!
        title: String!
        createdAt: String
        updatedAt: String
    }

    type User @model @searchable {
        id: ID!
        name: String!
    }
    `;
  const transformer = new GraphQLTransform({
    transformers: [new DynamoDBModelTransformer(), new SearchableModelTransformer()],
  });
  const out = transformer.transform(validSchema);
  expect(out).toBeDefined();
  expect(out.schema).toBeDefined();
  const parsed = parse(out.schema);
  const queryType = getObjectType(parsed, 'Query');
  expect(queryType).toBeDefined();
  expectFields(queryType, ['searchPosts']);
  expectFields(queryType, ['searchUsers']);

  const stringInputType = getInputType(parsed, 'SearchableStringFilterInput');
  expect(stringInputType).toBeDefined();
  const booleanInputType = getInputType(parsed, 'SearchableBooleanFilterInput');
  expect(booleanInputType).toBeDefined();
  const intInputType = getInputType(parsed, 'SearchableIntFilterInput');
  expect(intInputType).toBeDefined();
  const floatInputType = getInputType(parsed, 'SearchableFloatFilterInput');
  expect(floatInputType).toBeDefined();
  const dateInputType = getInputType(parsed, 'SearchableDateFilterInput');
  expect(dateInputType).toBeDefined();
  const idInputType = getInputType(parsed, 'SearchableIDFilterInput');
  expect(idInputType).toBeDefined();
  const postInputType = getInputType(parsed, 'SearchablePostFilterInput');
  expect(postInputType).toBeDefined();
  const userInputType = getInputType(parsed, 'SearchableUserFilterInput');
  expect(userInputType).toBeDefined();

  expect(verifyInputCount(parsed, 'SearchableStringFilterInput', 1)).toBeTruthy;
  expect(verifyInputCount(parsed, 'SearchableBooleanFilterInput', 1)).toBeTruthy;
  expect(verifyInputCount(parsed, 'SearchableIntFilterInput', 1)).toBeTruthy;
  expect(verifyInputCount(parsed, 'SearchableFloatFilterInput', 1)).toBeTruthy;
  expect(verifyInputCount(parsed, 'ModelIDFilterInput', 1)).toBeTruthy;
  expect(verifyInputCount(parsed, 'SearchableDateFilterInput', 1)).toBeTruthy;
  expect(verifyInputCount(parsed, 'SearchablePostFilterInput', 1)).toBeTruthy;
  expect(verifyInputCount(parsed, 'SearchableUserFilterInput', 1)).toBeTruthy;
});

test('Test SearchableModelTransformer with sort fields', () => {
  const validSchema = `
    type Post @model @searchable {
        id: ID!
        title: String!
        createdAt: String
        updatedAt: String
    }`;

  const transformer = new GraphQLTransform({
    transformers: [new DynamoDBModelTransformer(), new SearchableModelTransformer()],
  });
  const out = transformer.transform(validSchema);
  expect(out).toBeDefined();
  expect(out.schema).toBeDefined();
  const parsed = parse(out.schema);
  const queryType = getObjectType(parsed, 'Query');
  expect(queryType).toBeDefined();
  expectFields(queryType, ['searchPosts']);

  const stringInputType = getInputType(parsed, 'SearchableStringFilterInput');
  expect(stringInputType).toBeDefined();
  const booleanInputType = getInputType(parsed, 'SearchableBooleanFilterInput');
  expect(booleanInputType).toBeDefined();
  const intInputType = getInputType(parsed, 'SearchableIntFilterInput');
  expect(intInputType).toBeDefined();
  const floatInputType = getInputType(parsed, 'SearchableFloatFilterInput');
  expect(floatInputType).toBeDefined();
  const dateInputType = getInputType(parsed, 'SearchableDateFilterInput');
  expect(dateInputType).toBeDefined();
  const idInputType = getInputType(parsed, 'SearchableIDFilterInput');
  expect(idInputType).toBeDefined();
  const postInputType = getInputType(parsed, 'SearchablePostFilterInput');
  expect(postInputType).toBeDefined();
  const sortInputType = getInputType(parsed, 'SearchablePostSortInput');
  expect(sortInputType).toBeDefined();

  expect(verifyInputCount(parsed, 'SearchableStringFilterInput', 1)).toBeTruthy;
  expect(verifyInputCount(parsed, 'SearchableBooleanFilterInput', 1)).toBeTruthy;
  expect(verifyInputCount(parsed, 'SearchableIntFilterInput', 1)).toBeTruthy;
  expect(verifyInputCount(parsed, 'SearchableFloatFilterInput', 1)).toBeTruthy;
  expect(verifyInputCount(parsed, 'SearchableDateFilterInput', 1)).toBeTruthy;
  expect(verifyInputCount(parsed, 'SearchablePostFilterInput', 1)).toBeTruthy;
  expect(verifyInputCount(parsed, 'SearchablePostSortInput', 1)).toBeTruthy;
});

function expectFields(type: ObjectTypeDefinitionNode, fields: string[]) {
  for (const fieldName of fields) {
    const foundField = type.fields.find((f: FieldDefinitionNode) => f.name.value === fieldName);
    expect(foundField).toBeDefined();
  }
}

function doNotExpectFields(type: ObjectTypeDefinitionNode, fields: string[]) {
  for (const fieldName of fields) {
    expect(type.fields.find((f: FieldDefinitionNode) => f.name.value === fieldName)).toBeUndefined();
  }
}

function getObjectType(doc: DocumentNode, type: string): ObjectTypeDefinitionNode | undefined {
  return doc.definitions.find((def: DefinitionNode) => def.kind === Kind.OBJECT_TYPE_DEFINITION && def.name.value === type) as
    | ObjectTypeDefinitionNode
    | undefined;
}

function getInputType(doc: DocumentNode, type: string): InputObjectTypeDefinitionNode | undefined {
  return doc.definitions.find((def: DefinitionNode) => def.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION && def.name.value === type) as
    | InputObjectTypeDefinitionNode
    | undefined;
}

function verifyInputCount(doc: DocumentNode, type: string, count: number): boolean {
  return doc.definitions.filter(def => def.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION && def.name.value === type).length == count;
}
