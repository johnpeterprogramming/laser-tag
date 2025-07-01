import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    
    return {
        plugins: [
            react(),
            ...(mode === 'development' ? [basicSsl()] : [])
        ],
        server: {
            host: '0.0.0.0',
            port: Number(env.VITE_PORT) || 5173,
            hmr: false,
        },
        build: {
            outDir: '../build'
        }
    };
});
