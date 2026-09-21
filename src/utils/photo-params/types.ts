export type PhotoParamsStage = 'idle' | 'resolvingUid' | 'readingPhoto' | 'loadingWasm' | 'decryptingPhoto' | 'parsingCamera' | 'ready' | 'error' | 'cancelled'

export interface PhotoParamsProgress {
  stage: PhotoParamsStage
  percent: number
  message: string
}

export interface PhotoParamsResult {
  environmentFields: Array<{ label: string; value: string }>
  cameraFields: Array<{ label: string; value: string; position?: number }>
  imageFields: Array<{ label: string; value: string; position?: number }>
  resourceGroups: Array<{ title: string; name: string; value?: string; imageUrl?: string }>
  rawCameraParams: string
}
