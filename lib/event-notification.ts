import { Stack, StackProps, Duration, CfnOutput } from "aws-cdk-lib";
import { Function, Runtime, Code } from "aws-cdk-lib/aws-lambda";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { Role } from "aws-cdk-lib/aws-iam";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { SecurityGroup } from "aws-cdk-lib/aws-ec2";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { getVPC } from "./util/deploymentUtil";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cdk from "aws-cdk-lib";
import * as kms from "aws-cdk-lib/aws-kms";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";

export class EventNotification extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const myKmsKey = kms.Key.fromKeyArn(
      this,
      "KeyName",
      `arn:aws:kms:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:key/8d112303-3294-432a-aa8f-8b67db0dd597`
    );

    // Create a Lambda function
    const lambdaFn = new Function(this, "eventNotification", {
      functionName: `${process.env.ENV}EventNotificationrStack`,
      runtime: Runtime.NODEJS_18_X,
      code: Code.fromAsset("../event-notification/."),
      handler: "index.handler",
      memorySize: 1024,
      environmentEncryption: myKmsKey,
      timeout: Duration.seconds(120),
      environment: {
        REGION: process.env.CDK_DEFAULT_REGION || "us-east-1",
        env: process.env.ENV || "test",
        DB_SECRET_KEY: process.env.DB_SECRET_KEY || "ng2eventcenter-bendev",
        EVENT_CENTER_DB_NAME:
          process.env.EVENT_CENTER_DB_NAME || "eventscenter",
        TABLE_NAME: "v3locitydev_f10dev_business_events",
      },

      role: Role.fromRoleArn(
        this,
        "execution-role",
        `arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT}:role/lambda-NG2-PortalConfig-Role`
      ),
      securityGroups: [
        SecurityGroup.fromLookupById(
          this,
          `${process.env.ENV}EventNotificationSecurityGroupId`,
          process.env.SECUIRTY_GROUP_ID || ""
        ),
      ],
      vpc: getVPC(this, "vpcId"),
    });

    // Add tags to the function
    cdk.Tags.of(lambdaFn).add("product", this.node.tryGetContext("product"));
    cdk.Tags.of(lambdaFn).add("owner", this.node.tryGetContext("owner"));
    cdk.Tags.of(lambdaFn).add("client", "ngss");
    cdk.Tags.of(lambdaFn).add("category", "app");
    cdk.Tags.of(lambdaFn).add("env", "non-prod");
    cdk.Tags.of(lambdaFn).add("env-purpose", "val");
    cdk.Tags.of(lambdaFn).add("v3ops-custom-tag", "ngsslambda");
    cdk.Tags.of(lambdaFn).add("fincode", "vit-nextgen-opx");

    const logGroup = new logs.LogGroup(this, "myLogGroup", {
      logGroupName: `/aws/lambda/${lambdaFn.functionName}`,
      retention: 60,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Automatically delete log group when stack is deleted
    });

    // Add tags to the log group
    cdk.Tags.of(logGroup).add("product", this.node.tryGetContext("product"));
    cdk.Tags.of(logGroup).add("owner", this.node.tryGetContext("owner"));

    // Replace with your actual role ARN
    const roleArn = `arn:aws:iam::${process.env.CDK_DEFAULT_REGION}:role/Splunk-Kinesis-cloudwatch`;

    // Replace with your actual destination ARN
    const destinationArn = `arn:aws:firehose:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:deliverystream/Splunk-Kinesis-Ng2`;

    new logs.CfnSubscriptionFilter(this, "SubscriptionFilter", {
      logGroupName: logGroup.logGroupName,
      filterPattern: "",
      destinationArn: destinationArn,
      roleArn: roleArn,
    });

    const lambdaExecutionRole = new iam.Role(this, "LambdaExecutionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole"
        ),
      ],
    });

    // Add inline policy
    const policyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
      ],
      resources: ["arn:aws:logs:*:*:*"],
    });

    lambdaExecutionRole.addToPolicy(policyStatement);

    // Add tags to the role
    cdk.Tags.of(lambdaExecutionRole).add(
      "product",
      this.node.tryGetContext("product")
    );
    cdk.Tags.of(lambdaExecutionRole).add(
      "owner",
      this.node.tryGetContext("owner")
    );

    //Dead-Letter-Queue
    const eventNotificationDeadLetterQueue = new Queue(
      this,
      `${process.env.ENV}Event_Notification_Queue-dlq.fifo`,
      {
        fifo: true,
        contentBasedDeduplication: true,
      }
    );

    // Add tags to the DLQ
    cdk.Tags.of(eventNotificationDeadLetterQueue).add(
      "product",
      this.node.tryGetContext("product")
    );
    cdk.Tags.of(eventNotificationDeadLetterQueue).add(
      "owner",
      this.node.tryGetContext("owner")
    );

    // Create an SQS queue
    const eventNotificationQueue = new Queue(
      this,
      `${process.env.ENV}Event_Notification_Queue.fifo`,
      {
        visibilityTimeout: Duration.seconds(120),
        fifo: true,
        contentBasedDeduplication: true,
        retentionPeriod: Duration.seconds(21600),
        deadLetterQueue: {
          queue: eventNotificationDeadLetterQueue,
          maxReceiveCount: 2,
        },
      }
    );

    // Add tags to the Main Queue
    cdk.Tags.of(eventNotificationQueue).add(
      "product",
      this.node.tryGetContext("product")
    );
    cdk.Tags.of(eventNotificationQueue).add(
      "owner",
      this.node.tryGetContext("owner")
    );

    lambdaFn.addEventSource(
      new SqsEventSource(eventNotificationQueue, {
        batchSize: 5,
        enabled: true,
      })
    );
  }
}
