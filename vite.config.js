import { defineConfig } from 'vite';

export default defineConfig({
  // 빌드 설정
  build: {
    // 빌드 출력 디렉토리 (Netlify는 dist 폴더를 사용)
    outDir: 'dist',
    // 빌드 시 소스맵 생성 (프로덕션에서는 false로 설정 가능)
    sourcemap: false,
    // 청크 크기 경고 임계값 (KB)
    chunkSizeWarningLimit: 1000,
    // 빌드 최적화 설정
    rollupOptions: {
      output: {
        // 청크 파일명 형식
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/css/i.test(ext)) {
            return `assets/css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        // 수동 청크 분할 (선택사항)
        manualChunks: {
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'vendor-handsontable': ['handsontable'],
          'vendor-sweetalert2': ['sweetalert2']
        }
      }
    },
    // 빌드 시 미사용 코드 제거 (esbuild는 기본값이며 terser보다 빠름)
    minify: 'esbuild',
    // esbuild 옵션 (선택사항)
    // esbuildOptions: {
    //   drop: ['console', 'debugger'] // 콘솔 로그 제거하려면 주석 해제
    // }
  },
  
  // 개발 서버 설정
  server: {
    port: 3000,
    open: true,
    // CORS 설정
    cors: true
  },
  
  // 미리보기 서버 설정
  preview: {
    port: 4173,
    open: true
  },
  
  // 경로 별칭 설정 (선택사항)
  resolve: {
    alias: {
      '@': '/src',
      '@public': '/public'
    }
  },
  
  // 정적 파일 처리
  publicDir: 'public',
  
  // 환경 변수 접두사
  envPrefix: 'VITE_'
});

