// vite.config.ts
import { defineConfig } from "file:///C:/Users/Us%C3%BAario%20x/Downloads/Nova%20pasta%20(2)/vendus-v3-main/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Us%C3%BAario%20x/Downloads/Nova%20pasta%20(2)/vendus-v3-main/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///C:/Users/Us%C3%BAario%20x/Downloads/Nova%20pasta%20(2)/vendus-v3-main/node_modules/lovable-tagger/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\Us\xFAario x\\Downloads\\Nova pasta (2)\\vendus-v3-main";
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080
  },
  plugins: [
    react(),
    mode === "development" && componentTagger()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  build: {
    chunkSizeWarningLimit: 1500
    // IMPORTANT: do NOT manually split React / Radix / etc. into separate chunks.
    // The previous manualChunks config produced a circular dependency
    // (ui-vendor -> react-vendor -> ui-vendor) which, in production builds,
    // caused `ui-vendor` to evaluate before React exports were ready, throwing
    // `Cannot read properties of undefined (reading 'forwardRef')` and leaving
    // the app stuck on the boot loader (black screen + green spinner).
    // Letting Rollup decide chunking is safe and avoids this class of bug.
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxVc1x1MDBGQWFyaW8geFxcXFxEb3dubG9hZHNcXFxcTm92YSBwYXN0YSAoMilcXFxcdmVuZHVzLXYzLW1haW5cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXFVzXHUwMEZBYXJpbyB4XFxcXERvd25sb2Fkc1xcXFxOb3ZhIHBhc3RhICgyKVxcXFx2ZW5kdXMtdjMtbWFpblxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvVXMlQzMlQkFhcmlvJTIweC9Eb3dubG9hZHMvTm92YSUyMHBhc3RhJTIwKDIpL3ZlbmR1cy12My1tYWluL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgY29tcG9uZW50VGFnZ2VyIH0gZnJvbSBcImxvdmFibGUtdGFnZ2VyXCI7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiAoe1xuICBzZXJ2ZXI6IHtcbiAgICBob3N0OiBcIjo6XCIsXG4gICAgcG9ydDogODA4MCxcbiAgfSxcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAgbW9kZSA9PT0gXCJkZXZlbG9wbWVudFwiICYmIGNvbXBvbmVudFRhZ2dlcigpLFxuICBdLmZpbHRlcihCb29sZWFuKSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcbiAgICB9LFxuICB9LFxuICBidWlsZDoge1xuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTUwMCxcbiAgICAvLyBJTVBPUlRBTlQ6IGRvIE5PVCBtYW51YWxseSBzcGxpdCBSZWFjdCAvIFJhZGl4IC8gZXRjLiBpbnRvIHNlcGFyYXRlIGNodW5rcy5cbiAgICAvLyBUaGUgcHJldmlvdXMgbWFudWFsQ2h1bmtzIGNvbmZpZyBwcm9kdWNlZCBhIGNpcmN1bGFyIGRlcGVuZGVuY3lcbiAgICAvLyAodWktdmVuZG9yIC0+IHJlYWN0LXZlbmRvciAtPiB1aS12ZW5kb3IpIHdoaWNoLCBpbiBwcm9kdWN0aW9uIGJ1aWxkcyxcbiAgICAvLyBjYXVzZWQgYHVpLXZlbmRvcmAgdG8gZXZhbHVhdGUgYmVmb3JlIFJlYWN0IGV4cG9ydHMgd2VyZSByZWFkeSwgdGhyb3dpbmdcbiAgICAvLyBgQ2Fubm90IHJlYWQgcHJvcGVydGllcyBvZiB1bmRlZmluZWQgKHJlYWRpbmcgJ2ZvcndhcmRSZWYnKWAgYW5kIGxlYXZpbmdcbiAgICAvLyB0aGUgYXBwIHN0dWNrIG9uIHRoZSBib290IGxvYWRlciAoYmxhY2sgc2NyZWVuICsgZ3JlZW4gc3Bpbm5lcikuXG4gICAgLy8gTGV0dGluZyBSb2xsdXAgZGVjaWRlIGNodW5raW5nIGlzIHNhZmUgYW5kIGF2b2lkcyB0aGlzIGNsYXNzIG9mIGJ1Zy5cbiAgfSxcbn0pKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBdVgsU0FBUyxvQkFBb0I7QUFDcFosT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUNqQixTQUFTLHVCQUF1QjtBQUhoQyxJQUFNLG1DQUFtQztBQU16QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssT0FBTztBQUFBLEVBQ3pDLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNSO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixTQUFTLGlCQUFpQixnQkFBZ0I7QUFBQSxFQUM1QyxFQUFFLE9BQU8sT0FBTztBQUFBLEVBQ2hCLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN0QztBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLHVCQUF1QjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFRekI7QUFDRixFQUFFOyIsCiAgIm5hbWVzIjogW10KfQo=
