import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { visualizer } from "rollup-plugin-visualizer";
import { analyzer } from "vite-bundle-analyzer";

export default defineConfig((configEnv) => {
  const plugins = [react(), runtimeErrorOverlay()];
  
  // Only add cartographer plugin in development on Replit
  if (process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined) {
    try {
      // Dynamic import handled synchronously for build
      const cartographer = require("@replit/vite-plugin-cartographer").cartographer;
      if (cartographer) {
        plugins.push(cartographer());
      }
    } catch (e) {
      // Cartographer not available, continue without it
    }
  }

  // Add bundle analysis plugins for production builds
  if (process.env.ANALYZE_BUNDLE) {
    plugins.push(
      visualizer({
        filename: 'dist/bundle-analyzer.html',
        open: false, // Don't auto-open to prevent hanging
        gzipSize: true,
        brotliSize: true,
        template: 'treemap', // sunburst, treemap, network
      })
      // Remove analyzer() plugin as it can cause timeouts
    );
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      
      // Performance optimizations
      target: 'esnext', // Modern browsers for better optimization
      minify: 'esbuild', // Fastest minifier
      
      // Bundle splitting and optimization
      rollupOptions: {
        output: {
          // Manual chunk splitting for better caching
          manualChunks: {
            // Vendor chunks
            'vendor-react': ['react', 'react-dom'],
            'vendor-ui': [
              '@radix-ui/react-accordion',
              '@radix-ui/react-alert-dialog',
              '@radix-ui/react-aspect-ratio',
              '@radix-ui/react-avatar',
              '@radix-ui/react-checkbox',
              '@radix-ui/react-collapsible',
              '@radix-ui/react-context-menu',
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-hover-card',
              '@radix-ui/react-label',
              '@radix-ui/react-menubar',
              '@radix-ui/react-navigation-menu',
              '@radix-ui/react-popover',
              '@radix-ui/react-progress',
              '@radix-ui/react-radio-group',
              '@radix-ui/react-scroll-area',
              '@radix-ui/react-select',
              '@radix-ui/react-separator',
              '@radix-ui/react-slider',
              '@radix-ui/react-slot',
              '@radix-ui/react-switch',
              '@radix-ui/react-tabs',
              '@radix-ui/react-toast',
              '@radix-ui/react-toggle',
              '@radix-ui/react-toggle-group',
              '@radix-ui/react-tooltip'
            ],
            'vendor-utils': [
              'date-fns',
              'clsx',
              'class-variance-authority',
              'tailwind-merge',
              'zod'
            ],
            'vendor-query': ['@tanstack/react-query'],
            'vendor-forms': ['react-hook-form', '@hookform/resolvers'],
            'vendor-charts': ['recharts'],
            'vendor-animation': ['framer-motion'],
            'vendor-routing': ['wouter']
          },
          
          // File naming for better caching
          chunkFileNames: (chunkInfo: any) => {
            const facadeModuleId = chunkInfo.facadeModuleId
              ? chunkInfo.facadeModuleId.split('/').pop().replace('.tsx', '').replace('.ts', '')
              : 'chunk';
            return `assets/${facadeModuleId}-[hash].js`;
          },
          assetFileNames: 'assets/[name]-[hash][extname]'
        }
      },
      
      // Build performance
      reportCompressedSize: process.env.ANALYZE_BUNDLE === 'true',
      chunkSizeWarningLimit: 1000, // Warn for chunks > 1MB
      
      // Source maps for production debugging (optional)
      sourcemap: process.env.NODE_ENV === 'production' ? false : true,
    },
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
