const AWS = require('aws-sdk');
const dicomParser = require('dicom-parser');

const s3 = new AWS.S3();
const sqs = new AWS.SQS();
const healthImaging = new AWS.HealthImaging();

exports.handler = async (event) => {
  try {
    // Get the S3 bucket and key from the event
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

    // Get the file from S3
    const s3Object = await s3.getObject({
      Bucket: bucket,
      Key: key
    }).promise();

    // Parse DICOM file
    const dicomDataSet = dicomParser.parseDicom(s3Object.Body);

    // Extract metadata
    const metadata = {
      patientName: dicomDataSet.string('x00100010'),
      patientId: dicomDataSet.string('x00100020'),
      studyDate: dicomDataSet.string('x00080020'),
      modality: dicomDataSet.string('x00080060'),
      studyDescription: dicomDataSet.string('x00081030'),
      imageType: dicomDataSet.string('x00080008'),
      timestamp: new Date().toISOString()
    };

    // Send metadata to SQS
    await sqs.sendMessage({
      QueueUrl: process.env.QUEUE_URL,
      MessageBody: JSON.stringify({
        bucket,
        key,
        metadata
      })
    }).promise();

    // Import to HealthImaging
    const importResponse = await healthImaging.importImages({
      DatastoreId: process.env.HEALTHIMAGING_DATASTORE_ID,
      SourceS3Uri: `s3://${bucket}/${key}`,
      JobName: `import-${Date.now()}`,
      DataAccessRoleArn: process.env.HEALTHIMAGING_ROLE_ARN
    }).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'DICOM file processed successfully',
        metadata,
        importJobId: importResponse.jobId
      })
    };
  } catch (error) {
    console.error('Error processing DICOM file:', error);
    throw error;
  }
}; 