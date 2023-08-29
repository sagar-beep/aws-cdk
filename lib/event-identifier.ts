import { Stack, StackProps, Duration, CfnOutput, Fn } from "aws-cdk-lib";
import { Function, Runtime, Code } from "aws-cdk-lib/aws-lambda";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { SecurityGroup } from "aws-cdk-lib/aws-ec2";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { getVPC } from "./util/deploymentUtil";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Role } from "aws-cdk-lib/aws-iam";
import * as kms from "aws-cdk-lib/aws-kms";

export class EventIdentifier extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const allowedPrincipals = [
      `arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT}:role/DBA_SERVICES`,
      `arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT}:role/lambda-campaign-config-role`,
      `arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT}:user/sraghunathan@vitechinc.com`,
      `arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT}:user/mpalla@vitechinc.com`,
      `arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT}:user/psagar@vitechinc.com`,
      `arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT}:user/v3ops_svc_acc`,
    ];

    const myKmsKey = kms.Key.fromKeyArn(
      this,
      "KeyName",
      `arn:aws:kms:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:key/8d112303-3294-432a-aa8f-8b67db0dd597`
    );

    // Create a Lambda function
    const lambdaFn = new Function(this, "eventIdentifier", {
      functionName: `${process.env.ENV}EventIdentifierStack`,
      runtime: Runtime.NODEJS_18_X,
      code: Code.fromAsset("../event-identifier/."),
      handler: "index.handler",
      memorySize: 1024,
      environmentEncryption: myKmsKey,
      timeout: Duration.seconds(120),
      environment: {
        QUEUE_URL: `https://sqs.${process.env.CDK_DEFAULT_REGION}.amazonaws.com/${process.env.CDK_DEFAULT_ACCOUNT}/${process.env.ENV}event-processor.fifo`,
        STATUS_LOG_URL: `https://sqs.${process.env.CDK_DEFAULT_REGION}.amazonaws.com/${process.env.CDK_DEFAULT_ACCOUNT}/${process.env.ENV}event-status-log`,
        REGION: process.env.CDK_DEFAULT_REGION || "us-east-1",
        env: process.env.ENV || "test",
        DbSecretKey: process.env.DB_SECRET_KEY || "ng2eventcenter-bendev",
        event_center_db_name:
          process.env.EVENT_CENTER_DB_NAME || "eventscenter",
        EVENTS_BUCKET_NAME:
          process.env.EVENTS_BUCKET_NAME || "v3locitydev-eventslambda",
      },
      role: Role.fromRoleArn(
        this,
        "execution-role",
        `arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT}:role/lambda-NG2-PortalConfig-Role`
      ),
      securityGroups: [
        SecurityGroup.fromLookupById(
          this,
          `${process.env.ENV}EventIdentifierSecurityGroupId`,
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

    //Dead-Letter-Queue
    const EventIdentifierDeadLetterQueue = new Queue(
      this,
      `${process.env.ENV}event-processor-dlq.fifo`,
      {
        fifo: true,
        contentBasedDeduplication: true,
      }
    );

    // Add tags to the DLQ
    cdk.Tags.of(EventIdentifierDeadLetterQueue).add(
      "product",
      this.node.tryGetContext("product")
    );
    cdk.Tags.of(EventIdentifierDeadLetterQueue).add(
      "owner",
      this.node.tryGetContext("owner")
    );

    // Create an SQS queue
    const eventIdentifierQueue = new Queue(
      this,
      `${process.env.ENV}event-processor.fifo`,
      {
        visibilityTimeout: Duration.seconds(120),
        fifo: true,
        contentBasedDeduplication: true,
        retentionPeriod: Duration.seconds(21600),
        deadLetterQueue: {
          queue: EventIdentifierDeadLetterQueue,
          maxReceiveCount: 2,
        },
      }
    );

    // Add tags to the Main Queue
    cdk.Tags.of(eventIdentifierQueue).add(
      "product",
      this.node.tryGetContext("product")
    );
    cdk.Tags.of(eventIdentifierQueue).add(
      "owner",
      this.node.tryGetContext("owner")
    );

    // Adding policy to queue
    eventIdentifierQueue.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "Stmt1642913251116",
        effect: iam.Effect.DENY,
        principals: [new iam.ArnPrincipal("*")],
        actions: ["sqs:SendMessage"],
        resources: [eventIdentifierQueue.queueArn],
        conditions: {
          ArnNotLike: {
            "aws:SourceArn": [topicArnForCACentral1, topicArnForUSEast1],
          },
        },
      })
    );

    eventIdentifierQueue.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "Stmt1642913300048",
        effect: iam.Effect.DENY,
        principals: [new iam.ArnPrincipal("*")],
        actions: ["sqs:DeleteMessage", "sqs:ReceiveMessage"],
        resources: [eventIdentifierQueue.queueArn],
        conditions: {
          ArnNotLike: {
            "aws:PrincipalArn": allowedPrincipals,
          },
        },
      })
    );

    eventIdentifierQueue.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "Stmt1642913339947",
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("sns.amazonaws.com")],
        actions: ["sqs:SendMessage"],
        resources: [eventIdentifierQueue.queueArn],
        conditions: {
          ArnLike: {
            "aws:SourceArn": [topicArnForCACentral1, topicArnForUSEast1],
          },
        },
      })
    );

    lambdaFn.addEventSource(
      new SqsEventSource(eventIdentifierQueue, { batchSize: 5, enabled: true })
    );
  }
}
