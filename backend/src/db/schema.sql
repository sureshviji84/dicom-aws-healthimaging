CREATE TABLE IF NOT EXISTS dicom_metadata (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(64) NOT NULL,
    study_instance_uid VARCHAR(64) NOT NULL,
    series_instance_uid VARCHAR(64) NOT NULL,
    sop_instance_uid VARCHAR(64) NOT NULL,
    modality VARCHAR(16),
    study_date DATE,
    file_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(study_instance_uid, series_instance_uid, sop_instance_uid)
);

CREATE INDEX idx_patient_id ON dicom_metadata(patient_id);
CREATE INDEX idx_study_instance_uid ON dicom_metadata(study_instance_uid);
CREATE INDEX idx_series_instance_uid ON dicom_metadata(series_instance_uid); 