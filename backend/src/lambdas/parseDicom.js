const AWS = require('aws-sdk');
const dicomParser = require('dicom-parser');

const aurora = new AWS.RDSDataService();
const s3 = new AWS.S3();

exports.handler = async (event) => {
    try {
        // Get the S3 bucket and key from the event
        const bucket = event.Records[0].s3.bucket.name;
        const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

        // Get the DICOM file from S3
        const dicomFile = await s3.getObject({ Bucket: bucket, Key: key }).promise();
        
        // Parse DICOM metadata
        const dataSet = dicomParser.parseDicom(dicomFile.Body);
        
        // Extract relevant metadata
        const metadata = {
            patientId: dataSet.string('x00100020'),
            studyInstanceUID: dataSet.string('x0020000d'),
            seriesInstanceUID: dataSet.string('x0020000e'),
            sopInstanceUID: dataSet.string('x00080018'),
            modality: dataSet.string('x00080060'),
            studyDate: dataSet.string('x00080020'),
            fileName: key
        };

        // Store metadata in Aurora
        const params = {
            resourceArn: process.env.AURORA_CLUSTER_ARN,
            secretArn: process.env.AURORA_SECRET_ARN,
            sql: `INSERT INTO dicom_metadata 
                  (patient_id, study_instance_uid, series_instance_uid, sop_instance_uid, modality, study_date, file_name) 
                  VALUES (:patientId, :studyInstanceUID, :seriesInstanceUID, :sopInstanceUID, :modality, :studyDate, :fileName)`,
            parameters: [
                { name: 'patientId', value: { stringValue: metadata.patientId } },
                { name: 'studyInstanceUID', value: { stringValue: metadata.studyInstanceUID } },
                { name: 'seriesInstanceUID', value: { stringValue: metadata.seriesInstanceUID } },
                { name: 'sopInstanceUID', value: { stringValue: metadata.sopInstanceUID } },
                { name: 'modality', value: { stringValue: metadata.modality } },
                { name: 'studyDate', value: { stringValue: metadata.studyDate } },
                { name: 'fileName', value: { stringValue: metadata.fileName } }
            ]
        };

        await aurora.executeStatement(params).promise();

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'DICOM metadata processed successfully' })
        };
    } catch (error) {
        console.error('Error processing DICOM file:', error);
        throw error;
    }
}; 