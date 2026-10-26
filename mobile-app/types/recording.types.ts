export type RecordingStatus =
  | 'ready'
  | 'recording'
  | 'saved_locally'
  | 'uploading'
  | 'uploaded'
  | 'published'
  | 'failed';

export type PublicationStatus = 'unpublished' | 'published';

/** Lecture details entered by faculty before recording. */
export interface LectureMetadata {
  classroomId: string;
  classroomName: string;
  facultyId: string;
  facultyName: string;
  degreeId: string;
  degreeName: string;
  streamId: string;
  streamName: string;
  /** 1-based year of study. */
  year: number;
  subjectId: string;
  subjectName: string;
  /** Display label, e.g. "B.Tech CSE · Second Year". */
  className: string;
  chapter: string;
  topic: string;
  /** ISO 8601 timestamp of the lecture. */
  recordedAt: string;
}

/** A lecture recording. ID = sessionId. */
export interface Recording extends LectureMetadata {
  id: string;
  sessionId: string;
  facultyUid: string;
  mountUid: string;
  durationSeconds: number;
  fileSizeBytes: number;
  /** Video API URLs of the video, in order. */
  partFileIds: string[];
  videoApiId?: string;
  thumbnailFileId: string;
  mimeType: string;
  status: RecordingStatus;
  publicationStatus: PublicationStatus;
  /** 0–100, written by the mount phone while uploading. */
  uploadProgress: number;
  errorMessage: string;
  notes: string;
  startedAt: string;
  endedAt: string;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

/** Entry in the mount phone's on-device upload queue. */
export interface LocalRecording {
  sessionId: string;
  facultyUid: string;
  videoUri: string;
  thumbnailUri?: string;
  durationSeconds: number;
  fileSizeBytes: number;
  savedAt: string;
  lastError?: string;
  /** Android: true once compression has run (or was skipped because it did not help). */
  compressed?: boolean;
  /** Android: the compressed copy that is uploaded. The original stays at videoUri until the upload is verified. */
  compressedUri?: string;
  compressedSizeBytes?: number;
  /** Browser recordings: "video/mp4" or "video/webm". Android always records MP4. */
  mimeType?: string;
  /** Set once the upload is verified; the file is deleted on the next cleanup. */
  uploaded?: boolean;
  metadata: LectureMetadata;
}

export const UPLOADED_STATUSES: RecordingStatus[] = ['uploaded', 'published'];
export const PENDING_STATUSES: RecordingStatus[] = ['ready', 'recording', 'saved_locally', 'failed'];
