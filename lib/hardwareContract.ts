export const HARDWARE_API_VERSION = '2026-07-07';
export const STOREY_AUDIO_BUCKET = 'memory-audio';

export type BoxLifecycleStatus = 'provisioned' | 'unpaired' | 'paired' | 'revoked';

export type BoxUiState = 'idle' | 'recording' | 'syncing' | 'offline' | 'needs_attention';

export type CurrentBoxVisualState = 'ready' | 'recording' | 'syncing' | 'processing' | 'offline';

export type RecordingSessionState =
  | 'recording'
  | 'recorded'
  | 'uploading'
  | 'uploaded'
  | 'processing'
  | 'ready'
  | 'failed';

export type StoreyProcessingStatus =
  | 'awaiting_upload'
  | 'queued'
  | 'transcribing'
  | 'summarizing'
  | 'processing'
  | 'ready'
  | 'failed';

export type HardwareEnvelope<TBody> = {
  box_id: string;
  request_id: string;
  sent_at: string;
  body: TBody;
};

export type BoxAudioDescriptor = {
  channel_count: number;
  codec: 'aac' | 'opus' | 'mp3' | 'pcm' | string;
  container: 'm4a' | 'mp4' | 'webm' | 'wav' | string;
  sample_rate_hz: number;
};

export type BoxHeartbeatRequest = {
  active_recording_session_id: string | null;
  battery_percent?: number;
  error?: BoxReportedError | null;
  firmware_version: string;
  network?: {
    rssi?: number;
    ssid_hash?: string;
    type: 'wifi' | 'ethernet' | 'cellular' | string;
  };
  observed_at: string;
  power?: 'battery' | 'usb' | 'mains' | string;
  state: BoxUiState;
  storage?: {
    free_bytes: number;
    queued_recordings: number;
  };
};

export type BoxHeartbeatResponse = {
  accepted_at: string;
  box: {
    cloud_state: BoxUiState;
    location: string | null;
    name: string;
  };
  commands: BoxCommand[];
  config: {
    heartbeat_interval_seconds: number;
    offline_after_seconds: number;
    preferred_audio: BoxAudioDescriptor;
  };
  paired: boolean;
  server_time: string;
};

export type BoxPairingCodeRequest = {
  display_code_format: 'numeric_6' | 'alphanumeric_8' | string;
  expires_in_seconds: number;
};

export type BoxPairingCodeResponse = {
  box_state: 'unpaired' | BoxUiState;
  expires_at: string;
  pairing_code: string;
  pairing_uri: string;
};

export type AppPairingClaimRequest = {
  box_name: string;
  location?: string;
  pairing_code: string;
  pairing_nonce?: string;
};

export type AppPairingClaimResponse = {
  box: {
    cloud_state: BoxUiState;
    id: string;
    location: string | null;
    name: string;
    paired_at: string;
    public_device_id: string;
  };
};

export type RecordingStartedRequest = {
  audio: BoxAudioDescriptor;
  client_recording_id: string;
  started_at: string;
  trigger: 'button' | 'scheduled_test' | 'support' | string;
};

export type RecordingStartedResponse = {
  accepted_at: string;
  app_box_state: BoxUiState;
  box_state: BoxUiState;
  recording_session_id: string;
};

export type RecordingCompletedRequest = {
  client_recording_id: string;
  duration_ms: number;
  ended_at: string;
  file_size_bytes: number;
  interrupted: boolean;
  recording_session_id: string;
  sha256: string;
};

export type RecordingCompletedResponse = {
  app_box_state: BoxUiState;
  box_state: BoxUiState;
  memory_id: string;
  recording_session_id: string;
  storey: StoreyPlaceholder;
  upload: SignedAudioUpload;
};

export type SignedAudioUpload = {
  bucket: typeof STOREY_AUDIO_BUCKET;
  expires_at: string;
  headers: Record<string, string>;
  method: 'PUT' | 'POST';
  path: string;
  signed_url: string;
};

export type UploadCompleteRequest = {
  upload: {
    bucket: typeof STOREY_AUDIO_BUCKET;
    content_type: string;
    file_size_bytes: number;
    path: string;
    sha256: string;
  };
};

export type UploadCompleteResponse = {
  app_box_state: BoxUiState;
  box_state: BoxUiState;
  memory_id: string;
  processing_job: {
    id: string;
    status: StoreyProcessingStatus;
  };
  recording_session_id: string;
  safe_to_delete_local: boolean;
};

export type StoreyPlaceholder = {
  processing_status: StoreyProcessingStatus;
  provenance_label: string;
  recorded_at: string;
  user_id: string;
};

export type BoxReportedError = {
  code: string;
  message: string;
  recording_session_id?: string;
  retry_count?: number;
  severity: 'info' | 'warning' | 'error' | 'fatal';
};

export type BoxCommand =
  | {
      type: 'none';
    }
  | {
      type: 'set_upload_policy';
      max_upload_part_bytes?: number;
      signed_url_ttl_seconds: number;
    }
  | {
      type: 'firmware_update_available';
      minimum_required_version?: string;
      version: string;
    };

export const HARDWARE_TO_CURRENT_BOX_STATE: Record<BoxUiState, CurrentBoxVisualState> = {
  idle: 'ready',
  needs_attention: 'offline',
  offline: 'offline',
  recording: 'recording',
  syncing: 'syncing',
};
