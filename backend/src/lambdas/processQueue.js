const { MedicalImagingClient, ImportDICOMCommand } = require("@aws-sdk/client-medical-imaging");

const medicalImaging = new MedicalImagingClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
    try {
        // Process each record from S3 event
        for (const record of event.Records) {
            // Get bucket and key from S3 event
            const bucket = record.s3.bucket.name;
            const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

            // Only process files in the uploads directory
            if (!key.startsWith('uploads/')) {
                console.log('Skipping file not in uploads directory:', key);
                continue;
            }

            // Import to AWS HealthImaging
            const importParams = {
                DatastoreId: process.env.HEALTHIMAGING_DATASTORE_ID,
                InputS3Uri: `s3://${bucket}/${key}`,
                JobName: `import-${Date.now()}`,
                DataAccessRoleArn: process.env.HEALTHIMAGING_ROLE_ARN
            };

            const command = new ImportDICOMCommand(importParams);
            const response = await medicalImaging.send(command);

            console.log('Successfully imported DICOM to HealthImaging:', {
                bucket,
                key,
                jobId: response.jobId,
                jobStatus: response.jobStatus
            });
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Successfully processed S3 events' })
        };
    } catch (error) {
        console.error('Error processing S3 events:', error);
        throw error;
    }
}; 