import { Construct, Node } from 'constructs';
import * as cloudwatch from '../../../aws-cloudwatch';
import * as ec2 from '../../../aws-ec2';
import * as iam from '../../../aws-iam';
import * as lambda from '../../../aws-lambda';
import * as ssm from '../../../aws-ssm';
import {
  CfnResource,
  CustomResource,
  Lazy,
  Resource,
  Stack,
  Stage,
  Token,
  ValidationError,
} from '../../../core';
import { addConstructMetadata, MethodMetadata } from '../../../core/lib/metadata-resource';
import { propertyInjectable } from '../../../core/lib/prop-injectable';
import { CrossRegionStringParamReaderProvider } from '../../../custom-resource-handlers/dist/aws-cloudfront/cross-region-string-param-reader-provider.generated';

/**
 * Properties for creating a Lambda@Edge function
 */
export interface EdgeFunctionProps extends lambda.FunctionProps {
  /**
   * The stack ID of Lambda@Edge function.
   *
   * @default - `edge-lambda-stack-${region}`
   */
  readonly stackId?: string;
}

/**
 * A Lambda@Edge function.
 *
 * Convenience resource for requesting a Lambda function in the 'us-east-1' region for use with Lambda@Edge.
 * Implements several restrictions enforced by Lambda@Edge.
 *
 * Note that this construct requires that the 'us-east-1' region has been bootstrapped.
 * See https://docs.aws.amazon.com/cdk/latest/guide/bootstrapping.html or 'cdk bootstrap --help' for options.
 *
 * @resource AWS::Lambda::Function
 */
@propertyInjectable
export class EdgeFunction extends Resource implements lambda.IVersion {
  /**
   * Uniquely identifies this class.
   */
  public static readonly PROPERTY_INJECTION_ID: string = 'aws-cdk-lib.aws-cloudfront.experimental.EdgeFunction';

  private static readonly EDGE_REGION: string = 'us-east-1';

  public readonly edgeArn: string;
  public readonly functionName: string;
  public readonly functionArn: string;
  public readonly grantPrincipal: iam.IPrincipal;
  public readonly isBoundToVpc = false;
  public readonly permissionsNode: Node;
  public readonly role?: iam.IRole;
  public readonly version: string;
  public readonly architecture: lambda.Architecture;
  public readonly resourceArnsForGrantInvoke: string[];

  private readonly _edgeFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: EdgeFunctionProps) {
    super(scope, id);
    // Enhanced CDK Analytics Telemetry
    addConstructMetadata(this, props);

    // Create a simple Function if we're already in us-east-1; otherwise create a cross-region stack.
    const regionIsUsEast1 = !Token.isUnresolved(this.env.region) && this.env.region === 'us-east-1';
    const { edgeFunction, edgeArn } = regionIsUsEast1
      ? this.createInRegionFunction(props)
      : this.createCrossRegionFunction(id, props);

    this.edgeArn = edgeArn;

    this.functionArn = edgeArn;
    this._edgeFunction = edgeFunction;
    this.functionName = this._edgeFunction.functionName;
    this.grantPrincipal = this._edgeFunction.role!;
    this.permissionsNode = this._edgeFunction.permissionsNode;
    this.version = lambda.extractQualifierFromArn(this.functionArn);
    this.architecture = this._edgeFunction.architecture;
    this.resourceArnsForGrantInvoke = this._edgeFunction.resourceArnsForGrantInvoke;

    this.node.defaultChild = this._edgeFunction;
  }

  public get lambda(): lambda.IFunction {
    return this._edgeFunction;
  }

  /**
   * Convenience method to make `EdgeFunction` conform to the same interface as `Function`.
   */
  public get currentVersion(): lambda.IVersion {
    return this;
  }

  @MethodMetadata()
  public addAlias(aliasName: string, options: lambda.AliasOptions = {}): lambda.Alias {
    return new lambda.Alias(this._edgeFunction, `Alias${aliasName}`, {
      aliasName,
      version: this._edgeFunction.currentVersion,
      ...options,
    });
  }

  /**
   * Not supported. Connections are only applicable to VPC-enabled functions.
   */
  public get connections(): ec2.Connections {
    throw new ValidationError('Lambda@Edge does not support connections', this);
  }
  public get latestVersion(): lambda.IVersion {
    throw new ValidationError('$LATEST function version cannot be used for Lambda@Edge', this);
  }

  @MethodMetadata()
  public addEventSourceMapping(id: string, options: lambda.EventSourceMappingOptions): lambda.EventSourceMapping {
    return this.lambda.addEventSourceMapping(id, options);
  }
  @MethodMetadata()
  public addPermission(id: string, permission: lambda.Permission): void {
    return this.lambda.addPermission(id, permission);
  }
  @MethodMetadata()
  public addToRolePolicy(statement: iam.PolicyStatement): void {
    return this.lambda.addToRolePolicy(statement);
  }
  @MethodMetadata()
  public grantInvoke(identity: iam.IGrantable): iam.Grant {
    return this.lambda.grantInvoke(identity);
  }
  @MethodMetadata()
  public grantInvokeLatestVersion(identity: iam.IGrantable): iam.Grant {
    return this.lambda.grantInvokeLatestVersion(identity);
  }
  @MethodMetadata()
  public grantInvokeVersion(identity: iam.IGrantable, version: lambda.IVersion): iam.Grant {
    return this.lambda.grantInvokeVersion(identity, version);
  }
  @MethodMetadata()
  public grantInvokeUrl(identity: iam.IGrantable): iam.Grant {
    return this.lambda.grantInvokeUrl(identity);
  }
  @MethodMetadata()
  public grantInvokeCompositePrincipal(compositePrincipal: iam.CompositePrincipal): iam.Grant[] {
    return this.lambda.grantInvokeCompositePrincipal(compositePrincipal);
  }
  @MethodMetadata()
  public metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.lambda.metric(metricName, { ...props, region: EdgeFunction.EDGE_REGION });
  }
  @MethodMetadata()
  public metricDuration(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.lambda.metricDuration({ ...props, region: EdgeFunction.EDGE_REGION });
  }
  @MethodMetadata()
  public metricErrors(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.lambda.metricErrors({ ...props, region: EdgeFunction.EDGE_REGION });
  }
  @MethodMetadata()
  public metricInvocations(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.lambda.metricInvocations({ ...props, region: EdgeFunction.EDGE_REGION });
  }
  @MethodMetadata()
  public metricThrottles(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.lambda.metricThrottles({ ...props, region: EdgeFunction.EDGE_REGION });
  }
  /** Adds an event source to this function. */
  @MethodMetadata()
  public addEventSource(source: lambda.IEventSource): void {
    return this.lambda.addEventSource(source);
  }
  @MethodMetadata()
  public configureAsyncInvoke(options: lambda.EventInvokeConfigOptions): void {
    return this.lambda.configureAsyncInvoke(options);
  }
  @MethodMetadata()
  public addFunctionUrl(options?: lambda.FunctionUrlOptions): lambda.FunctionUrl {
    return this.lambda.addFunctionUrl(options);
  }

  /** Create a function in-region */
  private createInRegionFunction(props: lambda.FunctionProps): FunctionConfig {
    const edgeFunction = new lambda.Function(this, 'Fn', props);
    addEdgeLambdaToRoleTrustStatement(edgeFunction.role!);

    return { edgeFunction, edgeArn: edgeFunction.currentVersion.edgeArn };
  }

  /** Create a support stack and function in us-east-1, and a SSM reader in-region */
  private createCrossRegionFunction(id: string, props: EdgeFunctionProps): FunctionConfig {
    const parameterNamePrefix = 'cdk/EdgeFunctionArn';
    if (Token.isUnresolved(this.env.region)) {
      throw new ValidationError('stacks which use EdgeFunctions must have an explicitly set region', this);
    }
    // SSM parameter names must only contain letters, numbers, ., _, -, or /.
    const sanitizedPath = this.node.path.replace(/[^\/\w.-]/g, '_');
    const parameterName = `/${parameterNamePrefix}/${this.env.region}/${sanitizedPath}`;
    const functionStack = this.edgeStack(props.stackId);

    const edgeFunction = new lambda.Function(functionStack, id, props);
    addEdgeLambdaToRoleTrustStatement(edgeFunction.role!);

    // Store the current version's ARN to be retrieved by the cross region reader below.
    const version = edgeFunction.currentVersion;
    new ssm.StringParameter(edgeFunction, 'Parameter', {
      parameterName,
      stringValue: version.edgeArn,
    });

    const edgeArn = this.createCrossRegionArnReader(parameterNamePrefix, parameterName, version);

    return { edgeFunction, edgeArn };
  }

  private createCrossRegionArnReader(parameterNamePrefix: string, parameterName: string, version: lambda.Version): string {
    // Prefix of the parameter ARN that applies to all EdgeFunctions.
    // This is necessary because the `CustomResourceProvider` is a singleton, and the `policyStatement`
    // must work for multiple EdgeFunctions.
    const parameterArnPrefix = this.stack.formatArn({
      service: 'ssm',
      region: EdgeFunction.EDGE_REGION,
      resource: 'parameter',
      resourceName: parameterNamePrefix + '/*',
    });

    const resourceType = 'Custom::CrossRegionStringParameterReader';
    const serviceToken = CrossRegionStringParamReaderProvider.getOrCreate(this, resourceType, {
      policyStatements: [{
        Effect: 'Allow',
        Resource: parameterArnPrefix,
        Action: ['ssm:GetParameter'],
      }],
    });
    const resource = new CustomResource(this, 'ArnReader', {
      resourceType: resourceType,
      serviceToken,
      properties: {
        Region: EdgeFunction.EDGE_REGION,
        ParameterName: parameterName,
        // This is used to determine when the function has changed, to refresh the ARN from the custom resource.
        //
        // Use the logical id of the function version. Whenever a function version changes, the logical id must be
        // changed for it to take effect - a good candidate for RefreshToken.
        RefreshToken: Lazy.uncachedString({
          produce: () => {
            const cfn = version.node.defaultChild as CfnResource;
            return this.stack.resolve(cfn.logicalId);
          },
        }),
      },
    });

    return resource.getAttString('FunctionArn');
  }

  private edgeStack(stackId?: string): Stack {
    const stage = Stage.of(this);
    if (!stage) {
      throw new ValidationError('stacks which use EdgeFunctions must be part of a CDK app or stage', this);
    }

    const edgeStackId = stackId ?? `edge-lambda-stack-${this.stack.node.addr}`;
    let edgeStack = stage.node.tryFindChild(edgeStackId) as Stack;
    if (!edgeStack) {
      edgeStack = new Stack(stage, edgeStackId, {
        env: {
          region: EdgeFunction.EDGE_REGION,
          account: Stack.of(this).account,
        },
      });
    }
    this.stack.addDependency(edgeStack);
    return edgeStack;
  }
}

/** Result of creating an in-region or cross-region function */
interface FunctionConfig {
  readonly edgeFunction: lambda.Function;
  readonly edgeArn: string;
}

function addEdgeLambdaToRoleTrustStatement(role: iam.IRole) {
  if (iam.Role.isRole(role) && role.assumeRolePolicy) {
    const statement = new iam.PolicyStatement();
    const edgeLambdaServicePrincipal = new iam.ServicePrincipal('edgelambda.amazonaws.com');
    statement.addPrincipals(edgeLambdaServicePrincipal);
    statement.addActions(edgeLambdaServicePrincipal.assumeRoleAction);
    role.assumeRolePolicy.addStatements(statement);
  }
}
