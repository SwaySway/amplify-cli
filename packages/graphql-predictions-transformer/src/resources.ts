import { IAM, Fn, AppSync, Lambda } from 'cloudform-types';
import { ResourceConstants, PredictionsResourceIDs } from 'graphql-transformer-common';
import { iamActions } from './predictions_utils';
import { HttpConfig, LambdaConfig } from 'cloudform-types/types/appSync/dataSource';
// import { RoleProperties } from 'cloudform-types/types/iam/role';
import {
  obj,
  str,
  print,
  int,
  ref,
  iff,
  compoundExpression,
  ifElse,
  raw,
  set,
  forEach,
  ObjectNode,
  CompoundExpressionNode,
  printBlock,
  qref,
  toJson,
  comment,
} from 'graphql-mapping-template';
import DataSource from 'cloudform-types/types/appSync/dataSource';

// tslint:disable: no-magic-numbers
export interface PredictionsDSConfig {
  id: string;
  httpConfig?: HttpConfig;
  lambdaConfig?: LambdaConfig;
}
export type ActionPolicyMap = {
  [action: string]: any;
};
export class ResourceFactory {
  public createIAMRole(map: ActionPolicyMap, bucketName: string) {
    return new IAM.Role({
      RoleName: this.joinWithEnv('-', [
        PredictionsResourceIDs.getIAMRole(),
        Fn.GetAtt(ResourceConstants.RESOURCES.GraphQLAPILogicalID, 'ApiId'),
      ]),
      AssumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'appsync.amazonaws.com',
            },
            Action: 'sts:AssumeRole',
          },
        ],
      },
      Policies: [
        new IAM.Role.Policy({
          PolicyName: 'PredictionsStorageAccess',
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Action: ['s3:GetObject', 's3:PutObject'],
                Effect: 'Allow',
                Resource: this.getStorageARN(bucketName),
              },
            ],
          },
        }),
        ...Object.values(map),
      ],
    });
  }

  private getStorageARN(name: string) {
    const substitutions = {
      hash: Fn.Select(3, Fn.Split('-', Fn.Ref('AWS::StackName')))
    };
    if (this.referencesEnv(name)) {
      substitutions['env'] = Fn.Ref(ResourceConstants.PARAMETERS.Env);
    }
    return Fn.If(
      ResourceConstants.CONDITIONS.HasEnvironmentParameter,
      Fn.Sub(this.s3ArnKey(name), substitutions),
      Fn.Sub(this.s3ArnKey(this.removeEnvReference(name)), { hash: Fn.Select(3, Fn.Split('-', Fn.Ref('AWS::StackName'))) })
    );
  }

  private addStorageInStash(storage: string) {
    const substitutions = {
      hash: Fn.Select(3, Fn.Split('-', Fn.Ref('AWS::StackName')))
    };
    if (this.referencesEnv(storage)) {
      substitutions['env'] = Fn.Ref(ResourceConstants.PARAMETERS.Env);
    }
    return Fn.If(
      ResourceConstants.CONDITIONS.HasEnvironmentParameter,
      Fn.Sub(`$util.qr($ctx.stash.put("s3Bucket", "${storage}"))`, substitutions),
      Fn.Sub(`$util.qr($ctx.stash.put("s3Bucket", "${this.removeEnvReference(storage)}"))`, { hash: Fn.Select(3, Fn.Split('-', Fn.Ref('AWS::StackName'))) })
    );
  }

  private s3ArnKey(name: string) {
    return `arn:aws:s3:::${name}/*`;
  }

  public mergeActionRole(map: ActionPolicyMap, action: string) {
    if (!map[action] && iamActions[action]) {
      map[action] = new IAM.Role.Policy({
        PolicyName: `${action}Access`,
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: iamActions[action],
              Effect: 'Allow',
              Resource: '*',
            },
          ],
        },
      });
    }
    return map;
  }

  public mergeLambdaActionRole(map: ActionPolicyMap) {
    if (!map['PredictionsLambdaAccess']) {
      map['PredictionsLambdaAccess'] = new IAM.Role.Policy({
        PolicyName: 'PredictionsLambdaAccess',
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: ['lambda:InvokeFunction'],
              Effect: 'Allow',
              Resource: Fn.GetAtt(PredictionsResourceIDs.getLambdaID(), 'Arn'),
            },
          ],
        },
      });
    }
    return map;
  }

  public createLambdaIAMRole(bucketName: string) {
    return new IAM.Role({
      RoleName: this.joinWithEnv('-', [
        PredictionsResourceIDs.getLambdaIAMRole(),
        Fn.GetAtt(ResourceConstants.RESOURCES.GraphQLAPILogicalID, 'ApiId'),
      ]),
      AssumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'lambda.amazonaws.com',
            },
            Action: 'sts:AssumeRole',
          },
        ],
      },
      Policies: [
        new IAM.Role.Policy({
          PolicyName: 'StorageAccess',
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Action: ['s3:PutObject', 's3:GetObject'],
                Effect: 'Allow',
                Resource: this.getStorageARN(bucketName),
              },
            ],
          },
        }),
        new IAM.Role.Policy({
          PolicyName: 'PollyAccess',
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Action: ['polly:SynthesizeSpeech'],
                Effect: 'Allow',
                Resource: '*',
              },
            ],
          },
        }),
      ],
    });
  }

  public createPredictionsDataSource(config: PredictionsDSConfig): DataSource {
    let dataSource: DataSource;
    if (config.httpConfig) {
      dataSource = new AppSync.DataSource({
        ApiId: Fn.Ref(ResourceConstants.PARAMETERS.AppSyncApiId),
        Name: config.id,
        Type: 'HTTP',
        ServiceRoleArn: Fn.GetAtt(PredictionsResourceIDs.getIAMRole(), 'Arn'),
        HttpConfig: config.httpConfig,
      }).dependsOn(PredictionsResourceIDs.getIAMRole());
    }
    if (config.lambdaConfig) {
      dataSource = new AppSync.DataSource({
        ApiId: Fn.Ref(ResourceConstants.PARAMETERS.AppSyncApiId),
        Name: config.id,
        Type: 'AWS_LAMBDA',
        ServiceRoleArn: Fn.GetAtt(PredictionsResourceIDs.getIAMRole(), 'Arn'),
        LambdaConfig: config.lambdaConfig,
      }).dependsOn([PredictionsResourceIDs.getIAMRole(), PredictionsResourceIDs.getLambdaID()]);
    }
    return dataSource;
  }

  public getPredictionsDSConfig(action: string): PredictionsDSConfig {
    switch (action) {
      case 'identifyEntities':
      case 'identifyText':
      case 'identifyLabels':
        return {
          id: 'RekognitionDataSource',
          httpConfig: {
            Endpoint: Fn.Sub('https://rekognition.${AWS::Region}.amazonaws.com', {}),
            AuthorizationConfig: {
              AuthorizationType: 'AWS_IAM',
              AwsIamConfig: {
                SigningRegion: Fn.Sub('${AWS::Region}', {}),
                SigningServiceName: 'rekognition',
              },
            },
          },
        };
      case 'translateText':
        return {
          id: 'TranslateDataSource',
          httpConfig: {
            Endpoint: Fn.Sub('https://translate.${AWS::Region}.amazonaws.com', {}),
            AuthorizationConfig: {
              AuthorizationType: 'AWS_IAM',
              AwsIamConfig: {
                SigningRegion: Fn.Sub('${AWS::Region}', {}),
                SigningServiceName: 'translate',
              },
            },
          },
        };
      case 'convertTextToSpeech':
        return {
          id: 'LambdaDataSource',
          lambdaConfig: {
            LambdaFunctionArn: Fn.GetAtt(PredictionsResourceIDs.getLambdaID(), 'Arn'),
          },
        };
      default:
        break;
    }
  }

  private joinWithEnv(separator: string, listToJoin: any[]) {
    return Fn.If(
      ResourceConstants.CONDITIONS.HasEnvironmentParameter,
      Fn.Join(separator, [...listToJoin, Fn.Ref(ResourceConstants.PARAMETERS.Env)]),
      Fn.Join(separator, listToJoin)
    );
  }

  public createResolver(type: string, field: string, pipelineFunctions: any[], bucketName: string) {
    return new AppSync.Resolver({
      ApiId: Fn.Ref(ResourceConstants.PARAMETERS.AppSyncApiId),
      TypeName: type,
      FieldName: field,
      Kind: 'PIPELINE',
      PipelineConfig: {
        Functions: pipelineFunctions,
      },
      RequestMappingTemplate: Fn.Join('\n', [
        this.addStorageInStash(bucketName),
        print(compoundExpression([qref('$ctx.stash.put("isList", false)'), obj({})])),
      ]),
      ResponseMappingTemplate: print(
        compoundExpression([
          comment('If the result is a list return the result as a list'),
          ifElse(
            ref('ctx.stash.get("isList")'),
            compoundExpression([set(ref('result'), ref('ctx.result.split("[ ,]+")')), toJson(ref('result'))]),
            toJson(ref('ctx.result'))
          ),
        ])
      ),
    }).dependsOn(pipelineFunctions);
  }

  // predictions action functions
  public createActionFunction(action: string, datasourceName: string) {
    const actionFunctionResolvers = {
      identifyText: {
        request: compoundExpression([
          set(ref('bucketName'), ref('ctx.stash.get("s3Bucket")')),
          obj({
            version: str('2018-05-29'),
            method: str('POST'),
            resourcePath: str('/'),
            params: obj({
              body: obj({
                Image: obj({
                  S3Object: obj({
                    Bucket: str('$bucketName'),
                    Name: str('$ctx.args.input.identifyText.key'),
                  }),
                }),
              }),
              headers: obj({
                'Content-Type': str('application/x-amz-json-1.1'),
                'X-Amz-Target': str('RekognitionService.DetectText'),
              }),
            }),
          }),
        ]),
        response: compoundExpression([
          iff(ref('ctx.error'), ref('$util.error($ctx.error.message)')),
          ifElse(
            raw('$ctx.result.statusCode == 200'),
            compoundExpression([
              set(ref('results'), ref('util.parseJson($ctx.result.body)')),
              set(ref('finalResult'), str('')),
              forEach(/** for */ ref('item'), /** in */ ref('results.TextDetections'), [
                iff(raw('$item.Type == "LINE"'), set(ref('finalResult'), str('$finalResult$item.DetectedText '))),
              ]),
              ref('util.toJson($finalResult.trim())'),
            ]),
            ref('utils.error($ctx.result.body)')
          ),
        ]),
      },
      identifyLabels: {
        request: compoundExpression([
          set(ref('bucketName'), ref('ctx.stash.get("s3Bucket")')),
          qref('$ctx.stash.put("isList", true)'),
          obj({
            version: str('2018-05-29'),
            method: str('POST'),
            resourcePath: str('/'),
            params: obj({
              body: obj({
                Image: obj({
                  S3Object: obj({
                    Bucket: str('$bucketName'),
                    Name: str('$ctx.args.input.identifyLabels.key'),
                  }),
                }),
                MaxLabels: int(10),
                MinConfidence: int(55),
              }),
              headers: obj({
                'Content-Type': str('application/x-amz-json-1.1'),
                'X-Amz-Target': str('RekognitionService.DetectLabels'),
              }),
            }),
          }),
        ]),
        response: compoundExpression([
          iff(ref('ctx.error'), ref('util.error($ctx.error.message)')),
          ifElse(
            raw('$ctx.result.statusCode == 200'),
            compoundExpression([
              set(ref('labels'), str('')),
              set(ref('result'), ref('util.parseJson($ctx.result.body)')),
              forEach(/** for */ ref('label'), /** in */ ref('result.Labels'), [set(ref('labels'), str('$labels$label.Name, '))]),
              toJson(ref('labels.replaceAll(", $", "")')), // trim unnessary space
            ]),
            ref('util.error($ctx.result.body)')
          ),
        ]),
      },
      translateText: {
        request: compoundExpression([
          set(ref('text'), ref('util.defaultIfNull($ctx.args.input.translateText.text, $ctx.prev.result)')),
          obj({
            version: str('2018-05-29'),
            method: str('POST'),
            resourcePath: str('/'),
            params: obj({
              body: obj({
                SourceLanguageCode: str('$ctx.args.input.translateText.sourceLanguage'),
                TargetLanguageCode: str('$ctx.args.input.translateText.targetLanguage'),
                Text: str('$text'),
              }),
              headers: obj({
                'Content-Type': str('application/x-amz-json-1.1'),
                'X-Amz-Target': str('AWSShineFrontendService_20170701.TranslateText'),
              }),
            }),
          }),
        ]),
        response: compoundExpression([
          iff(ref('ctx.error'), ref('util.error($ctx.error.message)')),
          ifElse(
            raw('$ctx.result.statusCode == 200'),
            compoundExpression([set(ref('result'), ref('util.parseJson($ctx.result.body)')), ref('util.toJson($result.TranslatedText)')]),
            ref('util.error($ctx.result.body)')
          ),
        ]),
      },
      convertTextToSpeech: {
        request: compoundExpression([
          set(ref('bucketName'), ref('ctx.stash.get("s3Bucket")')),
          qref('$ctx.stash.put("isList", false)'),
          set(ref('text'), ref('util.defaultIfNull($ctx.args.input.convertTextToSpeech.text, $ctx.prev.result)')),
          obj({
            version: str('2018-05-29'),
            operation: str('Invoke'),
            payload: toJson(
              obj({
                uuid: str('$util.autoId()'),
                action: str('convertTextToSpeech'),
                bucket: str('$bucketName'),
                voiceID: str('$ctx.args.input.convertTextToSpeech.voiceID'),
                text: str('$text'),
              })
            ),
          }),
        ]),
        response: compoundExpression([
          iff(ref('ctx.error'), ref('util.error($ctx.error.message, $ctx.error.type)')),
          set(ref('response'), ref('util.parseJson($ctx.result)')),
          ref('util.toJson($ctx.result.url)'),
        ]),
      },
    };
    return this.genericFunction(action, datasourceName, PredictionsResourceIDs.getIAMRole(), actionFunctionResolvers[action]);
  }

  private genericFunction(
    action: string,
    datasourceName: string,
    iamRole: string,
    resolver: {
      request: ObjectNode | CompoundExpressionNode;
      response: ObjectNode | CompoundExpressionNode;
    }
  ) {
    return new AppSync.FunctionConfiguration({
      ApiId: Fn.Ref(ResourceConstants.PARAMETERS.AppSyncApiId),
      Name: `${action}Function`,
      DataSourceName: datasourceName,
      FunctionVersion: '2018-05-29',
      RequestMappingTemplate: print(resolver.request),
      ResponseMappingTemplate: print(resolver.response),
    }).dependsOn([iamRole, datasourceName]);
  }

  // Predictions Lambda Functions
  public createPredictionsLambda() {
    return new Lambda.Function({
      Code: {
        S3Bucket: Fn.Ref(ResourceConstants.PARAMETERS.S3DeploymentBucket),
        S3Key: Fn.Join('/', [
          Fn.Ref(ResourceConstants.PARAMETERS.S3DeploymentRootKey),
          'functions',
          Fn.Join('.', [PredictionsResourceIDs.getLambdaID(), 'zip']),
        ]),
      },
      FunctionName: this.joinWithEnv('-', [
        PredictionsResourceIDs.getLambdaName(),
        Fn.GetAtt(ResourceConstants.RESOURCES.GraphQLAPILogicalID, 'ApiId'),
      ]),
      Handler: PredictionsResourceIDs.getLambdaHandlerName(),
      Role: Fn.GetAtt(PredictionsResourceIDs.getLambdaIAMRole(), 'Arn'),
      Runtime: PredictionsResourceIDs.getLambdaRuntime(),
    }).dependsOn([PredictionsResourceIDs.getLambdaIAMRole()]);
  }

  // storage env ref
  public referencesEnv(value: string) {
    return value.match(/(\${env})/) !== null;
  }

  public removeEnvReference(value: string) {
    return value.replace(/(-\${env})/, '');
  }
}
