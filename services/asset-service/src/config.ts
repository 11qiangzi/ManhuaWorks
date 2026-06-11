/**
 * asset-service 配置
 * 所有可调参数都集中在这里，避免散落在代码各处。
 */

const num = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const str = (v: string | undefined, fallback: string): string => {
  const s = (v ?? '').trim();
  return s.length > 0 ? s : fallback;
};

const bool = (v: string | undefined, fallback: boolean): boolean => {
  if (v === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
};

export const config = {
  /** HTTP 端口 */
  port: num(process.env.ASSET_PORT, num(process.env.PORT, 8085)),

  /** 运行环境 */
  env: str(process.env.NODE_ENV, 'development'),

  /** PostgreSQL 连接 */
  db: {
    url: str(
      process.env.DATABASE_URL,
      'postgresql://mhw:mhw_dev_only@localhost:5432/manhuaworks'
    ),
    /** 连接池上限 */
    max: num(process.env.DB_MAX, 10),
  },

  /** 鉴权 */
  auth: {
    mode: str(process.env.AUTH_MODE, 'api-key') as 'api-key' | 'jwt' | 'none',
    apiKey: str(process.env.AUTH_API_KEY, 'dev-asset-service-key'),
    jwtSecret: str(process.env.AUTH_JWT_SECRET, 'dev-jwt-secret-change-me'),
  },

  /** S3 兼容对象存储 */
  s3: {
    endpoint: str(process.env.S3_ENDPOINT, ''),
    bucket: str(process.env.S3_BUCKET, 'manhuaworks-assets'),
    accessKey: str(process.env.S3_ACCESS_KEY, ''),
    secretKey: str(process.env.S3_SECRET_KEY, ''),
    region: str(process.env.S3_REGION, 'us-east-1'),
    /** 是否启用 S3；未配置 endpoint 时回退到本地存储 */
    enabled: bool(process.env.S3_ENABLED, false),
  },

  /** 本地存储（开发 / 离线环境） */
  storage: {
    localDir: str(process.env.LOCAL_STORAGE_DIR, '/tmp/mhw-assets'),
    /** 公开访问前缀（生成 URL 用） */
    publicBaseUrl: str(process.env.PUBLIC_BASE_URL, 'http://localhost:8085/static'),
  },

  /** 上传 */
  upload: {
    /** 单文件最大（MB） */
    maxSizeMb: num(process.env.MAX_UPLOAD_MB, 200),
    /** 允许的 MIME 类型 */
    allowedImageMimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    allowedVideoMimes: ['video/mp4', 'video/webm', 'video/quicktime'],
    allowedAudioMimes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-m4a'],
  },

  /** 锁脸 */
  lockFace: {
    /** 4 个固定角度 */
    angles: ['front', 'left', 'right', 'back'] as const,
    /** 头像最小尺寸（像素） */
    minSize: 256,
  },

  /** 导出 */
  export: {
    /** 单 zip 内最大文件数（防止误操作打爆） */
    maxFilesPerZip: num(process.env.EXPORT_MAX_FILES, 500),
    /** zip 输出目录 */
    workDir: str(process.env.EXPORT_WORK_DIR, '/tmp/mhw-exports'),
  },

  /** 货架 */
  shelf: {
    /** 每页最大 */
    maxPageSize: 100,
  },
} as const;

export type AppConfig = typeof config;
