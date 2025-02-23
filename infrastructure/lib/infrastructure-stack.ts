import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create S3 bucket for DICOM files
    const dicomBucket = new s3.Bucket(this, 'DicomBucket', {
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
          ],
          allowedOrigins: ['*'], // Replace with your frontend domain in production
          allowedHeaders: ['*'],
        },
      ],
    });

    // Create SQS queue for processing
    const dicomQueue = new sqs.Queue(this, 'DicomProcessingQueue', {
      visibilityTimeout: cdk.Duration.seconds(300),
      retentionPeriod: cdk.Duration.days(14),
    });

    // Create Lambda function for DICOM processing
    const processingLambda = new lambda.Function(this, 'DicomProcessingFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda'),
      timeout: cdk.Duration.seconds(300),
      environment: {
        QUEUE_URL: dicomQueue.queueUrl,
        BUCKET_NAME: dicomBucket.bucketName,
      },
    });

    // Grant permissions
    dicomBucket.grantRead(processingLambda);
    dicomQueue.grantSendMessages(processingLambda);

    // Create S3 notification to trigger Lambda
    dicomBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(processingLambda)
    );

    // Create HealthImaging Datastore
    const healthImagingRole = new iam.Role(this, 'HealthImagingRole', {
      assumedBy: new iam.ServicePrincipal('healthimaging.amazonaws.com'),
    });

    healthImagingRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'healthimaging:CreateDatastore',
          'healthimaging:ImportImages',
          'healthimaging:GetImage',
          'healthimaging:GetImageSet',
          'healthimaging:GetImageFrame',
        ],
        resources: ['*'],
      })
    );

    // Output values
    new cdk.CfnOutput(this, 'BucketName', {
      value: dicomBucket.bucketName,
      description: 'Name of the S3 bucket for DICOM files',
    });

    new cdk.CfnOutput(this, 'QueueUrl', {
      value: dicomQueue.queueUrl,
      description: 'URL of the SQS queue for processing',
    });
  }
} 