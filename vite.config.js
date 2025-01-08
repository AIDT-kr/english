import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import fs from 'fs';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		include: ['pdfjs-dist'],
		exclude: ['pdfjs-dist/build/pdf.worker.min.js']
	},
	build: {
		commonjsOptions: {
			include: [/pdfjs-dist/]
		}
	},
	server: {
		fs: {
			strict: false
		},
		https: {
			key: fs.readFileSync('./certs/privkey.pem'),
			cert: fs.readFileSync('./certs/fullchain.pem')
		},
		proxy: {
			'/api/pdf': 'http://localhost:8000',
			'/api/pdf/analyze': 'http://localhost:8000'
		}
	}
});
