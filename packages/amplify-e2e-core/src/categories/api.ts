import { getCLIPath, updateSchema, nspawn as spawn, KEY_DOWN_ARROW } from '..';
import * as fs from 'fs-extra';
import { selectRuntime, selectTemplate } from './lambda-function';
import { singleSelect, multiSelect } from '../utils/selectors';
import _ from 'lodash';

type APIConfig = {
  'Amazon Cognito User Pool': {};
  IAM: {};
  'API Key': { apiExpirationDays?: number };
  'OpenID Connect': {
    oidcProviderName: string;
    oidcProviderDomain: string;
    oidcClientId: string;
    ttlaIssueInMillisecond: string;
    ttlaAuthInMillisecond: string;
  };
  apiOptions: {
    apiName: string;
    schemaPath: string;
  };
};

export function getSchemaPath(schemaName: string): string {
  return `${__dirname}/../../../amplify-e2e-tests/schemas/${schemaName}`;
}

export function apiGqlCompile(cwd: string, testingWithLatestCodebase: boolean = false) {
  return new Promise<void>((resolve, reject) => {
    spawn(getCLIPath(testingWithLatestCodebase), ['api', 'gql-compile'], { cwd, stripColors: true })
      .wait('GraphQL schema compiled successfully.')
      .run((err: Error) => {
        if (!err) {
          resolve();
        } else {
          reject(err);
        }
      });
  });
}

interface AddApiOptions {
  apiName: string;
}

const defaultOptions: AddApiOptions = {
  apiName: '\r',
};

export function addApiWithoutSchema(cwd: string, opts: Partial<AddApiOptions> = {}) {
  const options = _.assign(defaultOptions, opts);
  return new Promise<void>((resolve, reject) => {
    spawn(getCLIPath(), ['add', 'api'], { cwd, stripColors: true })
      .wait('Please select from one of the below mentioned services:')
      .sendCarriageReturn()
      .wait('Provide API name:')
      .sendLine(opts.apiName)
      .wait(/.*Choose the default authorization type for the API.*/)
      .sendCarriageReturn()
      .wait(/.*Enter a description for the API key.*/)
      .sendCarriageReturn()
      .wait(/.*After how many days from now the API key should expire.*/)
      .sendCarriageReturn()
      .wait(/.*Do you want to configure advanced settings for the GraphQL API.*/)
      .sendCarriageReturn()
      .wait('Do you have an annotated GraphQL schema?')
      .sendLine('n')
      .wait('Choose a schema template:')
      .sendCarriageReturn()
      .wait('Do you want to edit the schema now?')
      .sendLine('n')
      .wait(
        '"amplify publish" will build all your local backend and frontend resources (if you have hosting category added) and provision it in the cloud',
      )
      .run((err: Error) => {
        if (!err) {
          resolve();
        } else {
          reject(err);
        }
      });
  });
}

export function addApiWithSchema(cwd: string, schemaFile: string, opts: Partial<AddApiOptions & { apiKeyExpirationDays: number }> = {}) {
  const options = _.assign(defaultOptions, opts);
  const schemaPath = getSchemaPath(schemaFile);
  return new Promise<void>((resolve, reject) => {
    spawn(getCLIPath(), ['add', 'api'], { cwd, stripColors: true })
      .wait('Please select from one of the below mentioned services:')
      .sendCarriageReturn()
      .wait('Provide API name:')
      .sendLine(options.apiName)
      .wait(/.*Choose the default authorization type for the API.*/)
      .sendCarriageReturn()
      .wait(/.*Enter a description for the API key.*/)
      .sendCarriageReturn()
      .wait(/.*After how many days from now the API key should expire.*/)
      .sendLine(opts.apiKeyExpirationDays ? opts.apiKeyExpirationDays.toString() : '1')
      .wait(/.*Do you want to configure advanced settings for the GraphQL API.*/)
      .sendCarriageReturn()
      .wait('Do you have an annotated GraphQL schema?')
      .sendLine('y')
      .wait('Provide your schema file path:')
      .sendLine(schemaPath)
      .wait(
        '"amplify publish" will build all your local backend and frontend resources (if you have hosting category added) and provision it in the cloud',
      )
      .run((err: Error) => {
        if (!err) {
          resolve();
        } else {
          reject(err);
        }
      });
  });
}

export function addApiWithSchemaAndConflictDetection(cwd: string, schemaFile: string) {
  const schemaPath = getSchemaPath(schemaFile);
  return new Promise<void>((resolve, reject) => {
    spawn(getCLIPath(), ['add', 'api'], { cwd, stripColors: true })
      .wait('Please select from one of the below mentioned services:')
      .sendCarriageReturn()
      .wait('Provide API name:')
      .sendCarriageReturn()
      .wait(/.*Choose the default authorization type for the API.*/)
      .sendCarriageReturn()
      .wait(/.*Enter a description for the API key.*/)
      .sendCarriageReturn()
      .wait(/.*After how many days from now the API key should expire.*/)
      .sendCarriageReturn()
      .wait(/.*Do you want to configure advanced settings for the GraphQL API.*/)
      .sendLine(KEY_DOWN_ARROW) // Down
      .wait(/.*Configure additional auth types.*/)
      .sendLine('n')
      .wait(/.*Configure conflict detection.*/)
      .sendLine('y')
      .wait(/.*Select the default resolution strategy.*/)
      .sendCarriageReturn()
      .wait(/.*Do you have an annotated GraphQL schema.*/)
      .sendLine('y')
      .wait('Provide your schema file path:')
      .sendLine(schemaPath)
      .wait(
        '"amplify publish" will build all your local backend and frontend resources (if you have hosting category added) and provision it in the cloud',
      )
      .run((err: Error) => {
        if (!err) {
          resolve();
        } else {
          reject(err);
        }
      });
  });
}

export function updateApiSchema(cwd: string, projectName: string, schemaName: string) {
  const testSchemaPath = getSchemaPath(schemaName);
  const schemaText = fs.readFileSync(testSchemaPath).toString();
  updateSchema(cwd, projectName, schemaText);
}

export function updateApiWithMultiAuth(cwd: string, settings: any) {
  return new Promise<void>((resolve, reject) => {
    spawn(getCLIPath(settings.testingWithLatestCodebase), ['update', 'api'], { cwd, stripColors: true })
      .wait('Please select from one of the below mentioned services:')
      .sendCarriageReturn()
      .wait('Select from the options below')
      .sendCarriageReturn()
      .wait(/.*Choose the default authorization type for the API.*/)
      .sendCarriageReturn()
      .wait(/.*Enter a description for the API key.*/)
      .sendLine('description')
      .wait(/.*After how many days from now the API key should expire.*/)
      .sendLine('300')
      .wait(/.*Do you want to configure advanced settings for the GraphQL API.*/)
      .sendLine(KEY_DOWN_ARROW) // Down
      .wait(/.*Configure additional auth types.*/)
      .sendLine('y')
      .wait(/.*Choose the additional authorization types you want to configure for the API.*/)
      .sendLine('a\r') // All items
      // Cognito
      .wait(/.*Do you want to use the default authentication and security configuration.*/)
      .sendCarriageReturn()
      .wait('How do you want users to be able to sign in?')
      .sendCarriageReturn()
      .wait('Do you want to configure advanced settings?')
      .sendCarriageReturn()
      // OIDC
      .wait(/.*Enter a name for the OpenID Connect provider:.*/)
      .sendLine('myoidcprovider')
      .wait(/.*Enter the OpenID Connect provider domain \(Issuer URL\).*/)
      .sendLine('https://facebook.com/')
      .wait(/.*Enter the Client Id from your OpenID Client Connect application.*/)
      .sendLine('clientId')
      .wait(/.*Enter the number of milliseconds a token is valid after being issued to a user.*/)
      .sendLine('1000')
      .wait(/.*Enter the number of milliseconds a token is valid after being authenticated.*/)
      .sendLine('2000')
      .wait('Configure conflict detection?')
      .sendLine('n')
      .wait(/.*Successfully updated resource.*/)
      .sendEof()
      .run((err: Error) => {
        if (!err) {
          resolve();
        } else {
          reject(err);
        }
      });
  });
}

export function apiUpdateToggleDataStore(cwd: string, settings: any) {
  return new Promise<void>((resolve, reject) => {
    spawn(getCLIPath(settings.testingWithLatestCodebase), ['update', 'api'], { cwd, stripColors: true })
      .wait('Please select from one of the below mentioned services:')
      .sendCarriageReturn()
      .wait('Select from the options below')
      .send(KEY_DOWN_ARROW)
      .sendLine(KEY_DOWN_ARROW) // select enable datastore for the api
      .wait(/.*Successfully updated resource.*/)
      .sendEof()
      .run((err: Error) => {
        if (!err) {
          resolve();
        } else {
          reject(err);
        }
      });
  });
}

export function updateAPIWithResolutionStrategy(cwd: string, settings: any) {
  return new Promise<void>((resolve, reject) => {
    spawn(getCLIPath(settings.testingWithLatestCodebase), ['update', 'api'], { cwd, stripColors: true })
      .wait('Please select from one of the below mentioned services:')
      .sendCarriageReturn()
      .wait('Select from the options below')
      .sendCarriageReturn()
      .wait(/.*Choose the default authorization type for the API.*/)
      .sendCarriageReturn()
      .wait(/.*Enter a description for the API key.*/)
      .sendCarriageReturn()
      .wait(/.*After how many days from now the API key should expire.*/)
      .sendCarriageReturn()
      .wait(/.*Do you want to configure advanced settings for the GraphQL API.*/)
      .sendLine(KEY_DOWN_ARROW) // Down
      .wait(/.*Configure additional auth types.*/)
      .sendLine('n')
      .wait(/.*Configure conflict detection.*/)
      .sendLine('y')
      .wait(/.*Select the default resolution strategy.*/)
      .sendLine(KEY_DOWN_ARROW) // Down
      .wait(/.*Do you want to override default per model settings.*/)
      .sendLine('n')
      .wait(/.*Successfully updated resource.*/)
      .sendEof()
      .run((err: Error) => {
        if (!err) {
          resolve();
        } else {
          reject(err);
        }
      });
  });
}

// Either settings.existingLambda or settings.isCrud is required
export function addRestApi(cwd: string, settings: any) {
  return new Promise<void>((resolve, reject) => {
    if (!('existingLambda' in settings) && !('isCrud' in settings)) {
      reject(new Error('Missing property in settings object in addRestApi()'));
    } else {
      let chain = spawn(getCLIPath(), ['add', 'api'], { cwd, stripColors: true })
        .wait('Please select from one of the below mentioned services')
        .send(KEY_DOWN_ARROW)
        .sendCarriageReturn() // REST
        .wait('Provide a friendly name for your resource to be used as a label for this category in the project')
        .sendCarriageReturn()
        .wait('Provide a path')
        .sendCarriageReturn()
        .wait('Choose a lambda source');

      if (settings.existingLambda) {
        chain
          .send(KEY_DOWN_ARROW)
          .sendCarriageReturn() // Existing lambda
          .wait('Choose the Lambda function to invoke by this path')
          .sendCarriageReturn(); // Pick first one
      } else {
        chain
          .sendCarriageReturn() // Create new Lambda function
          .wait('Provide an AWS Lambda function name')
          .sendCarriageReturn();

        selectRuntime(chain, 'nodejs');

        const templateName = settings.isCrud
          ? 'CRUD function for DynamoDB (Integration with API Gateway)'
          : 'Serverless ExpressJS function (Integration with API Gateway)';
        selectTemplate(chain, templateName, 'nodejs');

        if (settings.isCrud) {
          chain
            .wait('Choose a DynamoDB data source option')
            .sendCarriageReturn() // Use DDB table configured in current project
            .wait('Choose from one of the already configured DynamoDB tables')
            .sendCarriageReturn(); // Use first one in the list
        }

        chain
          .wait('Do you want to configure advanced settings?')
          .sendLine('n')
          .wait('Do you want to edit the local lambda function now')
          .sendLine('n');
      }

      chain
        .wait('Restrict API access')
        .sendLine('n')
        .wait('Do you want to add another path')
        .sendLine('n')
        .sendEof()
        .run((err: Error) => {
          if (!err) {
            resolve();
          } else {
            reject(err);
          }
        });
    }
  });
}

const allAuthTypes = ['API key', 'Amazon Cognito User Pool', 'IAM', 'OpenID Connect'];

const removeAPIOpts = (
  opts: Partial<APIConfig>,
): {
  apiName: string;
  schemaPath: string;
} => {
  if (opts.apiOptions) {
    const apiOpts = opts.apiOptions;
    delete opts.apiOptions;
    return apiOpts;
  }
  return {
    apiName: null,
    schemaPath: null,
  };
};

export function addApi(projectDir: string, apiConfig?: Partial<APIConfig>) {
  let authTypesToSelectFrom = allAuthTypes.slice();
  const apiOptions = removeAPIOpts(apiConfig);
  return new Promise<void>((resolve, reject) => {
    let chain = spawn(getCLIPath(), ['add', 'api'], { cwd: projectDir, stripColors: true })
      .wait('Please select from one of the below mentioned services:')
      .sendCarriageReturn()
      .wait('Provide API name:');

    if (apiOptions.apiName) {
      chain.sendLine(apiOptions.apiName);
    } else {
      chain.sendCarriageReturn();
    }

    if (apiConfig && Object.keys(apiConfig).length > 0) {
      const authTypesToAdd = Object.keys(apiConfig);
      const defaultType = authTypesToAdd[0];

      singleSelect(chain.wait('Choose the default authorization type for the API'), defaultType, authTypesToSelectFrom);
      setupAuthType(defaultType, chain, apiConfig);

      if (authTypesToAdd.length > 1) {
        authTypesToAdd.shift();

        chain
          .wait('Do you want to configure advanced settings for the GraphQL API')
          .send(KEY_DOWN_ARROW) //yes
          .sendCarriageReturn()
          .wait('Configure additional auth types?')
          .sendLine('y');

        authTypesToSelectFrom = authTypesToSelectFrom.filter(x => x !== defaultType);

        multiSelect(
          chain.wait('Choose the additional authorization types you want to configure for the API'),
          authTypesToAdd,
          authTypesToSelectFrom,
        );

        authTypesToAdd.forEach(authType => {
          setupAuthType(authType, chain, apiConfig);
        });

        chain.wait('Configure conflict detection?').sendCarriageReturn(); //No
      } else {
        chain.wait('Do you want to configure advanced settings for the GraphQL API').sendCarriageReturn(); //No
      }
    } else {
      chain.wait('Choose the default authorization type for the API').sendCarriageReturn();
      setupAPIKey(chain);

      chain.wait('Do you want to configure advanced settings for the GraphQL API').sendCarriageReturn(); //No
    }
    chain.wait('Do you have an annotated GraphQL schema?');
    if (apiOptions.schemaPath) {
      chain.sendLine('y').wait('Provide your schema file path:').sendLine(apiOptions.schemaPath);
    } else {
      chain.sendLine('n').wait('Choose a schema template:').sendCarriageReturn().wait('Do you want to edit the schema now?').sendLine('n');
    }
    chain.wait('"amplify publish" will build all your local backend and frontend resources').run((err: Error) => {
      if (!err) {
        resolve();
      } else {
        reject(err);
      }
    });
  });
}

function setupAuthType(authType: string, chain: any, settings?: Partial<APIConfig>) {
  switch (authType) {
    case 'API key':
      setupAPIKey(chain, settings['API Key'].apiExpirationDays);
      break;
    case 'Amazon Cognito User Pool':
      setupCognitoUserPool(chain);
      break;
    case 'IAM':
      setupIAM(chain);
      break;
    case 'OpenID Connect':
      setupOIDC(chain, settings['OpenID Connect']);
      break;
  }
}

function setupAPIKey(chain: any, expirationInDays?: number) {
  chain
    .wait('Enter a description for the API key')
    .sendCarriageReturn()
    .wait('After how many days from now the API key should expire')
    .sendCarriageReturn();
}

function setupCognitoUserPool(chain: any) {
  chain
    .wait('Do you want to use the default authentication and security configuration')
    .sendCarriageReturn()
    .wait('How do you want users to be able to sign in')
    .sendCarriageReturn()
    .wait('Do you want to configure advanced settings?')
    .sendCarriageReturn();
}

function setupIAM(chain: any) {
  //no need to do anything
}

function setupOIDC(chain: any, settings?: any) {
  if (!settings || !settings['OpenID Connect']) {
    throw new Error('Must provide OIDC auth settings.');
  }
  chain
    .wait('Enter a name for the OpenID Connect provider')
    .send(settings['OpenID Connect'].oidcProviderName)
    .sendCarriageReturn()
    .wait('Enter the OpenID Connect provider domain')
    .send(settings['OpenID Connect'].oidcProviderDomain)
    .sendCarriageReturn()
    .wait('Enter the Client Id from your OpenID Client Connect application (optional)')
    .send(settings['OpenID Connect'].oidcClientId)
    .sendCarriageReturn()
    .wait('Enter the number of milliseconds a token is valid after being issued to a user')
    .send(settings['OpenID Connect'].ttlaIssueInMillisecond)
    .sendCarriageReturn()
    .wait('Enter the number of milliseconds a token is valid after being authenticated')
    .send(settings['OpenID Connect'].ttlaAuthInMillisecond)
    .sendCarriageReturn();
}

export function addApiWithCognitoUserPoolAuthTypeWhenAuthExists(projectDir: string) {
  return new Promise<void>((resolve, reject) => {
    spawn(getCLIPath(), ['add', 'api'], { cwd: projectDir, stripColors: true })
      .wait('Please select from one of the below mentioned services:')
      .sendCarriageReturn()
      .wait('Provide API name:')
      .sendCarriageReturn()
      .wait('Choose the default authorization type for the API')
      .send(KEY_DOWN_ARROW)
      .sendCarriageReturn()
      .wait('Do you want to configure advanced settings for the GraphQL AP')
      .sendCarriageReturn()
      .wait('Do you have an annotated GraphQL schema?')
      .sendLine('n')
      .wait('Choose a schema template:')
      .sendCarriageReturn()
      .wait('Do you want to edit the schema now?')
      .sendLine('n')
      .wait('"amplify publish" will build all your local backend and frontend resources')
      .run((err: Error) => {
        if (!err) {
          resolve();
        } else {
          reject(err);
        }
      });
  });
}

export function addRestContainerApi(projectDir: string) {
  return new Promise<void>((resolve, reject) => {
    spawn(getCLIPath(), ['add', 'api'], { cwd: projectDir, stripColors: true })
      .wait('Please select from one of the below mentioned services:')
      .sendKeyDown()
      .sendCarriageReturn()
      .wait('Which service would you like to use')
      .sendKeyDown()
      .sendCarriageReturn()
      .wait('Provide a friendly name for your resource to be used as a label for this category in the project:')
      .sendCarriageReturn()
      .wait('What image would you like to use')
      .sendKeyDown()
      .sendCarriageReturn()
      .wait('When do you want to build & deploy the Fargate task')
      .sendCarriageReturn()
      .wait('Do you want to restrict API access')
      .sendConfirmNo()
      .wait('Select which container is the entrypoint')
      .sendCarriageReturn()
      .wait('"amplify publish" will build all your local backend and frontend resources')
      .run((err: Error) => {
        if (!err) {
          resolve();
        } else {
          reject(err);
        }
      });
  });
}
