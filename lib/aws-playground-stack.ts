import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";
import * as lambda from "@aws-cdk/aws-lambda";
import * as iam from "@aws-cdk/aws-iam";
import * as events from "@aws-cdk/aws-events";
import * as targets from "@aws-cdk/aws-events-targets";
import * as apiGateway from "@aws-cdk/aws-apigateway";

import { NodejsFunction } from "@aws-cdk/aws-lambda-nodejs";

export class AwsPlaygroundStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, "PlaygroundBucket", {
      versioned: true,
      bucketName: "playground-bucket2",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const lambdaRole = new iam.Role(this, "LambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });
    lambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaBasicExecutionRole"
      )
    );

    const sitemapFunction = new NodejsFunction(this, "sitemap-function", {
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "main",
      entry: "lambdas/sitemap/index.ts",
      role: lambdaRole,
    });

    bucket.grantWrite(sitemapFunction);

    const sitemapCronJob = new events.Rule(this, "sitemapCronJob", {
      schedule: events.Schedule.cron({ minute: "0/30" }),
      targets: [
        new targets.LambdaFunction(sitemapFunction, {
          retryAttempts: 3,
        }),
      ],
    });

    targets.addLambdaPermission(sitemapCronJob, sitemapFunction);

    const api = new apiGateway.RestApi(this, "sitemap-api", {
      restApiName: "Sitemap API",
      description: "Sitemap Gateway",
      deployOptions: {
        metricsEnabled: true,
        loggingLevel: apiGateway.MethodLoggingLevel.INFO,
      },
      binaryMediaTypes: ["application/xml", "text/xml"],
    });

    const s3IntegrationRole = new iam.Role(this, "S3IntegrationRole", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
    });
    bucket.grantRead(s3IntegrationRole);

    const s3proxy = api.root.addResource("sitemaps");
    s3proxy.addResource("{proxy}").addMethod(
      "GET",
      new apiGateway.AwsIntegration({
        service: "s3",
        integrationHttpMethod: "GET",
        path: `${bucket.bucketName}/{objkey}`,
        options: {
          credentialsRole: s3IntegrationRole,
          requestParameters: {
            "integration.request.path.objkey": "method.request.path.proxy",
          },
          integrationResponses: [
            {
              statusCode: "200",
              responseParameters: {
                "method.response.header.Content-Type": "'application/xml'",
              },
            },
            { selectionPattern: "^404", statusCode: "404" },
          ],
        },
      }),
      {
        requestParameters: {
          "method.request.path.proxy": true,
        },
        methodResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Content-Type": true,
            },
          },
          { statusCode: "404" },
        ],
      }
    );
  }
}
